<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\PlatformAssetConflict;
use App\Exceptions\PlatformSettingsConflict;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdatePlatformSettingsRequest;
use App\Http\Resources\AdminPlatformSettingsResource;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Services\PlatformSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PlatformSettingsController extends Controller
{
    public function show(Request $request, PlatformSettingsService $settings): JsonResponse
    {
        $setting = $settings->current();
        Gate::authorize('view', $setting);

        return response()->json([
            'data' => (new AdminPlatformSettingsResource($setting))->resolve($request),
        ])->header('Cache-Control', 'no-store');
    }

    public function update(
        UpdatePlatformSettingsRequest $request,
        PlatformSettingsService $settings,
        AdminAuditService $audit,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        try {
            $setting = $settings->update($request->validated(), $actor, $request);
        } catch (PlatformSettingsConflict|PlatformAssetConflict $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], 409);
        }

        return response()->json([
            'data' => (new AdminPlatformSettingsResource($setting))->resolve($request),
            'meta' => ['requestId' => $audit->requestId($request)],
        ])->header('Cache-Control', 'no-store');
    }
}
