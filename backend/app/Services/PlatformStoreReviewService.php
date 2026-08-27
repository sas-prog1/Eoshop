<?php

namespace App\Services;

use App\Enums\TenantVerificationStatus;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PlatformStoreReviewService
{
    public function __construct(
        private readonly AdminAuditService $audit,
        private readonly ProvisioningCoordinator $provisioning,
        private readonly PublicationService $publications,
        private readonly StoreDraftService $drafts,
        private readonly StoreApplicationService $applications,
    ) {}

    public function changeStatus(
        Tenant $tenant,
        TenantVerificationStatus $status,
        ?string $reason,
        User $actor,
        Request $request,
        array $requestedFields = [],
    ): Tenant {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($tenant, $status, $reason, $actor, $request, $requestedFields): Tenant {
                $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
                $normalizedReason = $status->requiresReason() ? trim((string) $reason) : null;
                $oldPublicationStatus = $lockedTenant->getAttribute('publication_status');
                $oldReviewValues = [
                    'verification_status' => $lockedTenant->getAttribute('verification_status'),
                    'rejection_reason' => $lockedTenant->getAttribute('rejection_reason'),
                ];
                $newReviewValues = [
                    'verification_status' => $status->value,
                    'rejection_reason' => $normalizedReason,
                ];

                if ($oldReviewValues === $newReviewValues) {
                    return $lockedTenant;
                }

                Gate::forUser($actor)->authorize('changeStatus', [$lockedTenant, $status]);

                $previousStatus = TenantVerificationStatus::from((string) $lockedTenant->getAttribute('verification_status'));
                if ($previousStatus === TenantVerificationStatus::Pending && $status === TenantVerificationStatus::Approved) {
                    $this->applications->assertReviewReady($lockedTenant);
                }
                if ($previousStatus === TenantVerificationStatus::Pending && $status === TenantVerificationStatus::ChangesRequested) {
                    $this->drafts->markCorrectionRequired($lockedTenant);
                    $this->publications->reject($lockedTenant, $actor, $normalizedReason);
                    $this->applications->requestCorrection($lockedTenant, $requestedFields, (string) $normalizedReason, $actor);
                } elseif ($previousStatus === TenantVerificationStatus::Pending && $status === TenantVerificationStatus::Rejected) {
                    $this->publications->reject($lockedTenant, $actor, $normalizedReason);
                    $this->applications->recordDecision($lockedTenant, $actor, 'rejected', 'رفضت إدارة المنصة الطلب مع توضيح السبب.');
                }

                $oldValues = $oldReviewValues + ['publication_status' => $oldPublicationStatus];
                $lockedTenant->forceFill($newReviewValues)->save();
                $newValues = $newReviewValues + ['publication_status' => $lockedTenant->getAttribute('publication_status')];
                $this->audit->record(
                    request: $request,
                    actor: $actor,
                    action: 'platform.store.verification_status.changed',
                    subject: $lockedTenant,
                    tenant: $lockedTenant,
                    oldValues: $oldValues,
                    newValues: $newValues,
                );

                if ($status === TenantVerificationStatus::Approved) {
                    $this->applications->recordDecision($lockedTenant, $actor, 'approved', 'وافقت إدارة المنصة على طلب المتجر وبدأ التجهيز.');
                    $this->provisioning->queueAfterApproval($lockedTenant, $actor, $request);
                }

                return $lockedTenant->refresh();
            });
    }
}
