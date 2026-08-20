<?php

namespace App\Http\Controllers;

use App\Exceptions\StoreAssetConflict;
use App\Http\Requests\UploadStoreAssetRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\StoreAssetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

class MerchantStoreAssetController extends Controller
{
    public function store(UploadStoreAssetRequest $request, Tenant $tenant, StoreAssetService $service): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $image = $request->file('image');
        abort_unless($image instanceof UploadedFile, 422);

        try {
            return response()->json(['data' => $service->upload(
                $tenant,
                $actor,
                $image,
                (string) $request->validated('idempotencyKey'),
            )], 201);
        } catch (StoreAssetConflict $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], 409);
        }
    }
}
