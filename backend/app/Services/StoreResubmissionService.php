<?php

namespace App\Services;

use App\Enums\DomainKind;
use App\Enums\DomainReservationOrigin;
use App\Enums\DomainReservationStatus;
use App\Enums\ProvisioningState;
use App\Enums\PublicationRequestStatus;
use App\Enums\StoreDraftStatus;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Exceptions\StoreDraftConflict;
use App\Models\DomainReservation;
use App\Models\Plan;
use App\Models\PublicationRequest;
use App\Models\StoreDraft;
use App\Models\StoreResubmission;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Support\CanonicalPayload;
use App\Support\StorefrontSectionLayout;
use App\Support\StoreWorkspaceContract;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class StoreResubmissionService
{
    public function __construct(
        private readonly DomainReservationService $domains,
        private readonly SubscriptionService $subscriptions,
        private readonly PublicationService $publications,
        private readonly AdminAuditService $audit,
        private readonly MerchantMembershipService $memberships,
        private readonly StoreApplicationService $applications,
    ) {}

    /** @return array{tenant: Tenant, replayed: bool} */
    public function resubmit(
        Tenant $tenant,
        int $expectedRevision,
        string $idempotencyKey,
        User $actor,
        Request $request,
    ): array {
        $fingerprint = CanonicalPayload::fingerprint([
            'tenantId' => $tenant->getKey(),
            'expectedRevision' => $expectedRevision,
        ]);

        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($tenant, $expectedRevision, $idempotencyKey, $actor, $request, $fingerprint): array {
                $lockedActor = User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->firstOrFail();
                if ($lockedActor->trashed() || $lockedActor->getAttribute('status') !== UserStatus::Active) {
                    throw new AuthorizationException('The merchant account is not active.');
                }
                $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
                $this->memberships->lockActiveOwner($lockedTenant, $lockedActor);
                Gate::forUser($lockedActor)->authorize('ownStore', $lockedTenant);
                $existing = $this->existing($lockedActor, $idempotencyKey, true);
                if ($existing !== null) {
                    return $this->replay($existing, $fingerprint);
                }
                $submission = StoreSubmission::query()->where('tenant_id', $lockedTenant->getKey())->lockForUpdate()->firstOrFail();
                $draft = StoreDraft::query()->where('tenant_id', $lockedTenant->getKey())->lockForUpdate()->firstOrFail();
                $publication = PublicationRequest::query()
                    ->whereKey($lockedTenant->getAttribute('publication_request_id'))
                    ->lockForUpdate()
                    ->firstOrFail();
                $reservation = DomainReservation::query()
                    ->whereKey($publication->getAttribute('domain_reservation_id'))
                    ->lockForUpdate()
                    ->firstOrFail();
                $subscription = TenantSubscription::query()
                    ->whereKey($publication->getAttribute('tenant_subscription_id'))
                    ->lockForUpdate()
                    ->firstOrFail();
                $plan = Plan::query()->whereKey($draft->getAttribute('plan_key'))->where('is_active', true)->lockForUpdate()->firstOrFail();

                Gate::forUser($lockedActor)->authorize('resubmitStore', $lockedTenant);
                if (! in_array($lockedTenant->getAttribute('verification_status'), [
                    TenantVerificationStatus::ChangesRequested->value,
                    TenantVerificationStatus::Rejected->value,
                ], true)
                    || $lockedTenant->getAttribute('provisioning_status') !== ProvisioningState::NotStarted->value
                    || $draft->getAttribute('status') !== StoreDraftStatus::CorrectionRequired
                    || $publication->getAttribute('status') !== PublicationRequestStatus::Rejected
                ) {
                    throw StoreDraftConflict::state();
                }
                if ((int) $draft->getAttribute('revision') !== $expectedRevision) {
                    throw StoreDraftConflict::revision();
                }
                $this->applications->assertCorrectionAddressed($draft);
                $this->applications->assertReady($draft);

                $centralDraftConfig = StorefrontSectionLayout::withoutLayout((array) $draft->getAttribute('config'));
                $provisioningConfig = StorefrontSectionLayout::forProvisioning($centralDraftConfig);
                $workspace = StoreWorkspaceContract::validator(
                    $provisioningConfig,
                    $plan->getAttribute('max_products') === null ? null : (int) $plan->getAttribute('max_products'),
                );
                if ($workspace->fails()) {
                    throw ValidationException::withMessages($workspace->errors()->toArray());
                }

                $nextSubscription = $this->subscriptions->forResubmission($lockedTenant, $plan, $lockedActor, $subscription);
                $nextReservation = $reservation->getAttribute('origin') === DomainReservationOrigin::Wp22Internal
                    && $reservation->getAttribute('status') === DomainReservationStatus::Active
                    && $reservation->getAttribute('handle') === $draft->getAttribute('handle')
                        ? $reservation
                        : $this->domains->reserve($lockedTenant, (string) $draft->getAttribute('handle'), $lockedActor);
                $nextPublication = $this->publications->createRequest($lockedTenant, $nextReservation, $nextSubscription, $lockedActor);

                $internalDomain = $lockedTenant->domains()
                    ->where('kind', DomainKind::Internal)
                    ->value('domain');
                $nextSubmissionRevision = ((int) $submission->getAttribute('revision')) + 1;
                $previousVerificationStatus = (string) $lockedTenant->getAttribute('verification_status');
                $submission->forceFill([
                    'payload_snapshot' => [
                        'storeName' => $draft->getAttribute('store_name'),
                        'businessType' => $draft->getAttribute('business_type'),
                        'internalDomain' => $internalDomain,
                        'requestedDomain' => $nextReservation->getAttribute('domain'),
                        'handle' => $nextReservation->getAttribute('handle'),
                        'planKey' => $plan->getKey(),
                        'themeStyle' => $draft->getAttribute('theme_style'),
                        'config' => $provisioningConfig,
                        'owner' => [
                            'id' => $lockedActor->getKey(),
                            'name' => $lockedActor->getAttribute('name'),
                            'email' => $lockedActor->getAttribute('email'),
                        ],
                        'applicationEvidence' => $this->applications->snapshot($draft),
                    ],
                    'revision' => $nextSubmissionRevision,
                    'revised_at' => now(),
                ])->save();

                $lockedTenant->forceFill([
                    'store_name' => $draft->getAttribute('store_name'),
                    'business_type' => $draft->getAttribute('business_type'),
                    'theme_style' => $draft->getAttribute('theme_style'),
                    'verification_status' => TenantVerificationStatus::Pending->value,
                    'rejection_reason' => null,
                ])->save();
                $resultRevision = $expectedRevision + 1;
                $draft->forceFill([
                    'status' => StoreDraftStatus::Submitted,
                    'config' => $centralDraftConfig,
                    'revision' => $resultRevision,
                    'saved_at' => now(),
                    'submitted_at' => now(),
                ])->save();
                $this->applications->resolveCorrection($draft, $lockedActor);
                StoreResubmission::query()->create([
                    'tenant_id' => $lockedTenant->getKey(),
                    'store_draft_id' => $draft->getKey(),
                    'submitted_by_user_id' => $lockedActor->getKey(),
                    'idempotency_key' => $idempotencyKey,
                    'request_fingerprint' => $fingerprint,
                    'source_draft_revision' => $expectedRevision,
                    'result_draft_revision' => $resultRevision,
                    'submitted_at' => now(),
                ]);
                $this->audit->record(
                    request: $request,
                    actor: $lockedActor,
                    action: 'merchant.store.resubmitted',
                    subject: $nextPublication,
                    tenant: $lockedTenant,
                    oldValues: [
                        'verification_status' => $previousVerificationStatus,
                        'draft_revision' => $expectedRevision,
                        'submission_revision' => $nextSubmissionRevision - 1,
                    ],
                    newValues: [
                        'verification_status' => TenantVerificationStatus::Pending->value,
                        'draft_revision' => $resultRevision,
                        'submission_revision' => $nextSubmissionRevision,
                        'handle' => $nextReservation->getAttribute('handle'),
                        'plan_key' => $plan->getKey(),
                    ],
                );

                return ['tenant' => $lockedTenant->refresh(), 'replayed' => false];
            });
    }

    private function existing(User $actor, string $key, bool $lock = false): ?StoreResubmission
    {
        $query = StoreResubmission::query()
            ->where('submitted_by_user_id', $actor->getKey())
            ->where('idempotency_key', $key);

        return ($lock ? $query->lockForUpdate() : $query)->first();
    }

    /** @return array{tenant: Tenant, replayed: true} */
    private function replay(StoreResubmission $receipt, string $fingerprint): array
    {
        if (! hash_equals((string) $receipt->getAttribute('request_fingerprint'), $fingerprint)) {
            throw StoreDraftConflict::resubmissionKeyReused();
        }

        return [
            'tenant' => Tenant::query()->whereKey($receipt->getAttribute('tenant_id'))->firstOrFail(),
            'replayed' => true,
        ];
    }
}
