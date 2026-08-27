<?php

namespace App\Http\Resources;

use App\Enums\ProvisioningState;
use App\Enums\PublicationStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\TenantVerificationStatus;
use App\Models\StoreDraft;
use App\Models\Tenant;
use App\Services\StoreApplicationService;
use App\Support\PublicationReadiness;
use App\Support\StorefrontSectionLayout;
use App\Support\TenantSchemaName;
use Illuminate\Http\Request;

/** @mixin Tenant */
class PlatformStoreDetailResource extends PlatformStoreResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $data = parent::toArray($request);
        $draft = $this->draft;
        $application = $draft instanceof StoreDraft
            ? app(StoreApplicationService::class)->platformSummary($draft)
            : null;
        $run = $this->latestProvisioningRun;
        $subscription = $this->currentPublicationRequest?->subscription;
        $blockers = PublicationReadiness::blockers($this->resource);

        $data['applicationWorkspace'] = $draft instanceof StoreDraft ? [
            'snapshot' => [
                'draftId' => $draft->getKey(),
                'revision' => (int) $draft->getAttribute('revision'),
                'submittedAt' => $draft->getAttribute('submitted_at')?->toIso8601String(),
                'storeName' => $draft->getAttribute('store_name'),
                'businessType' => $draft->getAttribute('business_type'),
                'themeStyle' => $draft->getAttribute('theme_style'),
                'handle' => $draft->getAttribute('handle'),
                'planKey' => $draft->getAttribute('plan_key'),
                'planName' => $draft->plan?->getAttribute('name'),
                'config' => StorefrontSectionLayout::withoutLayout((array) $draft->getAttribute('config')),
            ],
            'dossier' => $application,
            'checklist' => collect($application['requirements'])
                ->map(fn (array $requirement): array => [
                    'key' => $requirement['key'],
                    'label' => $requirement['label'],
                    'status' => $requirement['evidence']['reviewStatus'] ?? 'missing',
                    'resolved' => $requirement['resolved'],
                ])->values()->all(),
            'decisionReady' => (bool) $application['reviewReady'],
        ] : null;

        $data['operations'] = [
            'tenant' => [
                'id' => $this->getKey(),
                'schemaName' => TenantSchemaName::for((string) $this->getKey()),
            ],
            'health' => [
                'review' => $this->getAttribute('verification_status') === TenantVerificationStatus::Approved->value,
                'provisioning' => $this->getAttribute('provisioning_status') === ProvisioningState::Active->value,
                'domain' => $this->publishedDomain !== null || $this->currentPublicationRequest?->reservation !== null,
                'subscription' => $subscription?->getAttribute('status') === SubscriptionStatus::Active && $subscription->isCurrentlyActive(),
                'publication' => $this->getAttribute('publication_status') === PublicationStatus::Published->value,
            ],
            'blockers' => $blockers,
            'provisioning' => $run === null ? null : [
                'id' => $run->getKey(),
                'status' => $run->getAttribute('status')?->value,
                'runNumber' => (int) $run->getAttribute('run_number'),
                'schemaName' => $run->getAttribute('schema_name'),
                'schemaOrigin' => $run->getAttribute('schema_origin')?->value,
                'queuedAt' => $run->getAttribute('queued_at')?->toIso8601String(),
                'startedAt' => $run->getAttribute('started_at')?->toIso8601String(),
                'completedAt' => $run->getAttribute('completed_at')?->toIso8601String(),
                'failedAt' => $run->getAttribute('failed_at')?->toIso8601String(),
                'lastErrorCode' => $run->getAttribute('last_error_code'),
                'lastErrorMessage' => $run->getAttribute('last_error_message'),
                'steps' => $run->steps->map(fn ($step): array => [
                    'step' => $step->getAttribute('step')->value,
                    'status' => $step->getAttribute('status')->value,
                    'startedAt' => $step->getAttribute('started_at')?->toIso8601String(),
                    'finishedAt' => $step->getAttribute('finished_at')?->toIso8601String(),
                    'errorCode' => $step->getAttribute('error_code'),
                ])->values()->all(),
            ],
            'publication' => [
                'status' => $this->getAttribute('publication_status'),
                'requestedAt' => $this->getAttribute('publication_requested_at')?->toIso8601String(),
                'publishedAt' => $this->getAttribute('published_at')?->toIso8601String(),
                'requestedDomain' => $this->currentPublicationRequest?->reservation?->getAttribute('domain'),
                'publicDomain' => $this->publishedDomain?->getAttribute('domain'),
            ],
        ];

        return $data;
    }
}
