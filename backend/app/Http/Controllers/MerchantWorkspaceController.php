<?php

namespace App\Http\Controllers;

use App\Exceptions\InventoryConflict;
use App\Exceptions\ProductCatalogConflict;
use App\Exceptions\StoreAssetConflict;
use App\Exceptions\StoreWorkspaceConflict;
use App\Http\Requests\UpdateStoreWorkspaceRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\StoreWorkspaceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MerchantWorkspaceController extends Controller
{
    public function show(Request $request, Tenant $tenant, StoreWorkspaceService $workspaces): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        try {
            $workspace = $workspaces->read($tenant, $actor);
            $this->recordAccess($request, $actor, $tenant, 'merchant.workspace.read', null, $workspace['revision']);

            return response()->json(['data' => $workspace]);
        } catch (StoreWorkspaceConflict|StoreAssetConflict|ProductCatalogConflict|InventoryConflict $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], 409);
        }
    }

    public function update(
        UpdateStoreWorkspaceRequest $request,
        Tenant $tenant,
        StoreWorkspaceService $workspaces,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        try {
            $validated = $request->validated();
            $workspace = $workspaces->update($tenant, $actor, $validated);
            $this->recordAccess(
                $request,
                $actor,
                $tenant,
                'merchant.workspace.updated',
                (int) $validated['revision'],
                $workspace['revision'],
            );

            return response()->json(['data' => $workspace]);
        } catch (StoreWorkspaceConflict|StoreAssetConflict|ProductCatalogConflict|InventoryConflict $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], 409);
        }
    }

    private function recordAccess(
        Request $request,
        User $actor,
        Tenant $tenant,
        string $action,
        ?int $expectedRevision,
        int $committedRevision,
    ): void {
        $candidate = trim((string) $request->header('X-Request-ID'));
        $requestId = Str::isUuid($candidate) ? $candidate : (string) Str::uuid();

        Log::info($action, array_filter([
            'request_id' => $requestId,
            'actor_user_id' => (string) $actor->getKey(),
            'tenant_id' => (string) $tenant->getKey(),
            'expected_revision' => $expectedRevision,
            'committed_revision' => $committedRevision,
        ], static fn (mixed $value): bool => $value !== null));
    }
}
