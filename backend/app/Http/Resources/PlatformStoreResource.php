<?php

namespace App\Http\Resources;

use App\Models\PublicationRequest;
use App\Models\Tenant;
use App\Services\StoreApplicationService;
use App\Support\PublicationReadiness;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Tenant
 */
class PlatformStoreResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $createdAt = $this->getAttribute('created_at');
        $activeAt = $this->getAttribute('active_at');

        return [
            'id' => $this->getKey(),
            'storeName' => $this->getAttribute('store_name'),
            'ownerName' => $this->getAttribute('owner_name'),
            'ownerEmail' => $this->getAttribute('owner_email'),
            'ownerPhone' => $this->getAttribute('owner_phone'),
            'businessType' => $this->getAttribute('business_type'),
            'verificationStatus' => $this->getAttribute('verification_status'),
            'provisioningStatus' => $this->getAttribute('provisioning_status'),
            'publicationStatus' => $this->getAttribute('publication_status'),
            'rejectionReason' => $this->getAttribute('rejection_reason'),
            'themeStyle' => $this->getAttribute('theme_style'),
            'domains' => $this->whenLoaded('domains', fn () => $this->domains->pluck('domain')->values()->all()),
            'requestedDomain' => $this->whenLoaded('currentPublicationRequest', function (): ?string {
                $publication = $this->currentPublicationRequest;

                return $publication instanceof PublicationRequest
                    ? (string) $publication->reservation?->getAttribute('domain')
                    : null;
            }),
            'publicDomain' => $this->whenLoaded('publishedDomain', fn (): ?string => $this->publishedDomain?->getAttribute('domain')),
            'publicationBlockers' => PublicationReadiness::blockers($this->resource),
            'subscription' => $this->whenLoaded('currentPublicationRequest', function (): ?array {
                $subscription = $this->currentPublicationRequest?->subscription;
                $plan = $subscription?->plan;

                return $subscription === null || $plan === null ? null : [
                    'id' => $subscription->getKey(),
                    'status' => $subscription->getAttribute('status')->value,
                    'endsAt' => $subscription->getAttribute('ends_at')?->toIso8601String(),
                    'plan' => [
                        'key' => $plan->getKey(),
                        'name' => $plan->getAttribute('name'),
                        'activationMode' => $plan->getAttribute('activation_mode')->value,
                    ],
                ];
            }),
            'createdAt' => $createdAt instanceof CarbonInterface ? $createdAt->toIso8601String() : null,
            'activeAt' => $activeAt instanceof CarbonInterface ? $activeAt->toIso8601String() : null,
            'publishedAt' => $this->getAttribute('published_at') instanceof CarbonInterface
                ? $this->getAttribute('published_at')->toIso8601String()
                : null,
            'latestProvisioningRun' => $this->whenLoaded('latestProvisioningRun', function (): ?array {
                $run = $this->latestProvisioningRun;

                return $run === null ? null : [
                    'id' => $run->getKey(),
                    'status' => $run->getAttribute('status')?->value,
                    'runNumber' => $run->getAttribute('run_number'),
                    'lastCompletedStep' => $run->getAttribute('last_completed_step'),
                    'lastErrorCode' => $run->getAttribute('last_error_code'),
                    'lastErrorMessage' => $run->getAttribute('last_error_message'),
                ];
            }),
            'application' => $this->whenLoaded('draft', fn (): ?array => $this->draft === null
                ? null
                : app(StoreApplicationService::class)->summary($this->draft)),
        ];
    }
}
