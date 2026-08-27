<?php

namespace App\Http\Resources;

use App\Enums\DomainKind;
use App\Models\Domain;
use App\Models\PublicationRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\StoreApplicationService;
use App\Support\PublicationReadiness;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Tenant */
class StoreSubmissionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $createdAt = $this->getAttribute('created_at');
        $activeAt = $this->getAttribute('active_at');
        $publishedAt = $this->getAttribute('published_at');
        $actor = $request->user();
        $publicationBlockers = PublicationReadiness::blockers($this->resource);
        $canManagePublication = $actor instanceof User && $actor->can('managePublication', $this->resource);

        return [
            'id' => $this->getKey(),
            'storeName' => $this->getAttribute('store_name'),
            'businessType' => $this->getAttribute('business_type'),
            'verificationStatus' => $this->getAttribute('verification_status'),
            'provisioningStatus' => $this->getAttribute('provisioning_status'),
            'publicationStatus' => $this->getAttribute('publication_status'),
            'reviewFeedback' => in_array($this->getAttribute('verification_status'), ['changes_requested', 'rejected'], true)
                ? $this->getAttribute('rejection_reason')
                : null,
            'application' => $this->whenLoaded('draft', fn (): ?array => $this->draft === null
                ? null
                : app(StoreApplicationService::class)->summary($this->draft)),
            'capabilities' => [
                'workspaceManage' => $actor instanceof User && $actor->can('updateStoreWorkspace', $this->resource),
                'catalogManage' => $actor instanceof User && $actor->can('updateProductCatalog', $this->resource),
                'inventoryView' => $actor instanceof User && $actor->can('viewInventory', $this->resource),
                'inventoryManage' => $actor instanceof User && $actor->can('updateInventory', $this->resource),
                'ordersView' => $actor instanceof User && $actor->can('viewOrders', $this->resource),
                'ordersManage' => $actor instanceof User && $actor->can('updateOrders', $this->resource),
                'draftEdit' => $actor instanceof User && $actor->can('editStoreDraft', $this->resource),
                'resubmit' => $actor instanceof User && $actor->can('resubmitStore', $this->resource),
                'publish' => $canManagePublication
                    && $this->getAttribute('publication_status') !== 'published'
                    && $publicationBlockers === [],
                'unpublish' => $canManagePublication
                    && $this->getAttribute('publication_status') === 'published',
            ],
            'internalDomain' => $this->whenLoaded('domains', function (): ?string {
                $domain = $this->domains->firstWhere('kind', DomainKind::Internal);

                return $domain instanceof Domain ? (string) $domain->getAttribute('domain') : null;
            }),
            'requestedDomain' => $this->whenLoaded('currentPublicationRequest', function (): ?string {
                $publication = $this->currentPublicationRequest;

                return $publication instanceof PublicationRequest
                    ? (string) $publication->reservation?->getAttribute('domain')
                    : null;
            }),
            'publicDomain' => $this->whenLoaded('publishedDomain', fn (): ?string => $this->publishedDomain?->getAttribute('domain')),
            'plan' => $this->whenLoaded('currentPublicationRequest', function (): ?array {
                $subscription = $this->currentPublicationRequest?->subscription;
                $plan = $subscription?->plan;

                return $plan === null ? null : [
                    'key' => $plan->getKey(),
                    'name' => $plan->getAttribute('name'),
                    'activationMode' => $plan->getAttribute('activation_mode')->value,
                ];
            }),
            'subscriptionStatus' => $this->whenLoaded('currentPublicationRequest', fn (): ?string => $this->currentPublicationRequest?->subscription?->getAttribute('status')?->value),
            'publicationBlockers' => $publicationBlockers,
            'createdAt' => $createdAt instanceof CarbonInterface ? $createdAt->toIso8601String() : null,
            'activeAt' => $activeAt instanceof CarbonInterface ? $activeAt->toIso8601String() : null,
            'publishedAt' => $publishedAt instanceof CarbonInterface ? $publishedAt->toIso8601String() : null,
        ];
    }
}
