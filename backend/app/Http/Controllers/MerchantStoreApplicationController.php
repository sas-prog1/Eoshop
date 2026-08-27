<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExemptStoreApplicationRequirementRequest;
use App\Http\Requests\UploadStoreApplicationEvidenceRequest;
use App\Models\StoreApplicationEvidence;
use App\Models\StoreDraft;
use App\Models\User;
use App\Services\StoreApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MerchantStoreApplicationController extends Controller
{
    public function show(StoreDraft $draft, Request $request, StoreApplicationService $applications): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        return response()->json(['data' => $applications->dossier($draft, $actor)]);
    }

    public function upload(
        UploadStoreApplicationEvidenceRequest $request,
        StoreDraft $draft,
        string $requirement,
        StoreApplicationService $applications,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        $document = $request->file('document');
        abort_unless($document instanceof UploadedFile, 422);

        return response()->json(['data' => $applications->upload(
            draft: $draft,
            requirementKey: $requirement,
            file: $document,
            expectedRevision: (int) $request->validated('expectedRevision'),
            idempotencyKey: (string) $request->validated('idempotencyKey'),
            actor: $actor,
            request: $request,
        )], 201);
    }

    public function exempt(
        ExemptStoreApplicationRequirementRequest $request,
        StoreDraft $draft,
        string $requirement,
        StoreApplicationService $applications,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        return response()->json(['data' => $applications->exempt(
            draft: $draft,
            requirementKey: $requirement,
            expectedRevision: (int) $request->validated('expectedRevision'),
            reason: (string) $request->validated('reason'),
            actor: $actor,
            request: $request,
        )]);
    }

    public function download(
        StoreDraft $draft,
        StoreApplicationEvidence $evidence,
        Request $request,
        StoreApplicationService $applications,
    ): StreamedResponse {
        /** @var User $actor */
        $actor = $request->user();

        return $applications->download($draft, $evidence, $actor);
    }
}
