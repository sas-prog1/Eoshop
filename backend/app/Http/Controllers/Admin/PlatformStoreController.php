<?php

namespace App\Http\Controllers\Admin;

use App\Enums\TenantVerificationStatus;
use App\Exceptions\StoreSubmissionConflict;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ActivateSubscriptionRequest;
use App\Http\Requests\Admin\ListPlatformStoresRequest;
use App\Http\Requests\Admin\UpdateTenantMetadataRequest;
use App\Http\Requests\Admin\UpdateTenantStatusRequest;
use App\Http\Resources\PlatformStoreResource;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Services\PlatformAdministrationReadService;
use App\Services\PlatformStoreManagementService;
use App\Services\PlatformStoreReviewService;
use App\Services\ProvisioningCoordinator;
use App\Services\PublicationService;
use App\Services\SubscriptionService;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PlatformStoreController extends Controller
{
    public function index(
        ListPlatformStoresRequest $request,
        PlatformAdministrationReadService $administration,
    ): AnonymousResourceCollection {
        return PlatformStoreResource::collection(
            $administration->stores($request->validated(), self::relations())
        );
    }

    public function updateStatus(
        UpdateTenantStatusRequest $request,
        Tenant $tenant,
        PlatformStoreReviewService $reviews,
        AdminAuditService $audit,
    ): PlatformStoreResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        $status = TenantVerificationStatus::from((string) $request->validated('status'));
        try {
            $updatedTenant = $reviews->changeStatus(
                tenant: $tenant,
                status: $status,
                reason: $request->validated('reason'),
                actor: $actor,
                request: $request,
                requestedFields: (array) ($request->validated('requestedFields') ?? []),
            );
        } catch (StoreSubmissionConflict $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return (new PlatformStoreResource($updatedTenant->load(self::relations())))
            ->additional(['meta' => ['requestId' => $audit->requestId($request)]]);
    }

    public function update(
        UpdateTenantMetadataRequest $request,
        Tenant $tenant,
        PlatformStoreManagementService $stores,
        AdminAuditService $audit,
    ): PlatformStoreResource {
        /** @var User $actor */
        $actor = $request->user();
        $updatedTenant = $stores->updateMetadata($tenant, $request->validated(), $actor, $request);

        return (new PlatformStoreResource($updatedTenant->load(self::relations())))
            ->additional(['meta' => ['requestId' => $audit->requestId($request)]]);
    }

    public function retryProvisioning(
        Request $request,
        Tenant $tenant,
        ProvisioningCoordinator $provisioning,
        AdminAuditService $audit,
    ): PlatformStoreResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $provisioning->retry($tenant, $actor, $request);
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return (new PlatformStoreResource($tenant->refresh()->load(self::relations())))
            ->additional(['meta' => ['requestId' => $audit->requestId($request)]]);
    }

    public function activateSubscription(
        ActivateSubscriptionRequest $request,
        Tenant $tenant,
        SubscriptionService $subscriptions,
        AdminAuditService $audit,
    ): PlatformStoreResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $subscriptions->activate(
                $tenant,
                $actor,
                CarbonImmutable::parse((string) $request->validated('endsAt')),
                $request,
            );
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return (new PlatformStoreResource($tenant->refresh()->load(self::relations())))
            ->additional(['meta' => ['requestId' => $audit->requestId($request)]]);
    }

    public function publish(
        Request $request,
        Tenant $tenant,
        PublicationService $publications,
        AdminAuditService $audit,
    ): PlatformStoreResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $updatedTenant = $publications->publish($tenant, $actor, $request);
        } catch (DomainException|StoreSubmissionConflict $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return (new PlatformStoreResource($updatedTenant->load(self::relations())))
            ->additional(['meta' => ['requestId' => $audit->requestId($request)]]);
    }

    public function unpublish(
        Request $request,
        Tenant $tenant,
        PublicationService $publications,
        AdminAuditService $audit,
    ): PlatformStoreResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $updatedTenant = $publications->unpublish($tenant, $actor, $request);
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return (new PlatformStoreResource($updatedTenant->load(self::relations())))
            ->additional(['meta' => ['requestId' => $audit->requestId($request)]]);
    }

    /** @return list<string> */
    private static function relations(): array
    {
        return [
            'domains',
            'latestProvisioningRun',
            'currentPublicationRequest.reservation',
            'currentPublicationRequest.subscription.plan',
            'publishedDomain',
            'publicationSubscription.plan',
            'draft.applicationEvidence',
            'draft.applicationEvents',
            'draft.openCorrectionRequest',
        ];
    }
}
