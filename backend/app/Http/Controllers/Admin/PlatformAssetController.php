<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\PlatformAssetConflict;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UploadPlatformAssetRequest;
use App\Models\User;
use App\Services\PlatformAssetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

class PlatformAssetController extends Controller
{
    public function store(UploadPlatformAssetRequest $request, PlatformAssetService $service): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $image = $request->file('image');
        abort_unless($image instanceof UploadedFile, 422);

        try {
            return response()->json(['data' => $service->upload(
                $actor,
                $image,
                (string) $request->validated('purpose'),
                (string) $request->validated('idempotencyKey'),
            )], 201)->header('Cache-Control', 'no-store');
        } catch (PlatformAssetConflict $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], 409);
        }
    }
}
