<?php

namespace App\Services;

use App\Enums\ApplicationEvidenceResolution;
use App\Enums\ApplicationEvidenceReviewStatus;
use App\Enums\StoreDraftStatus;
use App\Models\StoreApplicationEvent;
use App\Models\StoreApplicationEvidence;
use App\Models\StoreCorrectionRequest;
use App\Models\StoreDraft;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StoreApplicationService
{
    public function __construct(
        private readonly StoreApplicationRequirementPolicy $policy,
        private readonly AdminAuditService $audit,
    ) {}

    /** @return array<string, mixed> */
    public function dossier(StoreDraft $draft, User $actor): array
    {
        $this->authorizeDraft($draft, $actor);

        return $this->summary($draft->refresh());
    }

    /** @return array<string, mixed> */
    public function summary(StoreDraft $draft): array
    {
        $draft->loadMissing(['applicationEvidence', 'applicationEvents', 'openCorrectionRequest']);
        $evidence = $draft->applicationEvidence->keyBy('requirement_key');
        $requirements = collect($this->policy->requirementsFor((string) $draft->getAttribute('business_type')))
            ->map(function (array $requirement) use ($evidence): array {
                $item = $evidence->get($requirement['key']);
                $resolution = $item instanceof StoreApplicationEvidence ? $item->getAttribute('resolution') : null;
                $reviewStatus = $item instanceof StoreApplicationEvidence ? $item->getAttribute('review_status') : null;
                $resolved = $reviewStatus !== ApplicationEvidenceReviewStatus::Rejected
                    && ($resolution === ApplicationEvidenceResolution::Uploaded
                        || ($resolution === ApplicationEvidenceResolution::Exempted && $requirement['allowExemption']));

                return $requirement + [
                    'resolved' => $resolved,
                    'evidence' => $item instanceof StoreApplicationEvidence ? $this->evidenceResource($item) : null,
                ];
            })->values()->all();
        $ready = collect($requirements)->every(fn (array $requirement): bool => $requirement['resolved']);
        $correction = $draft->openCorrectionRequest;

        return [
            'draftId' => $draft->getKey(),
            'tenantId' => $draft->getAttribute('tenant_id'),
            'draftRevision' => (int) $draft->getAttribute('revision'),
            'ready' => $ready,
            'blockers' => collect($requirements)
                ->reject(fn (array $requirement): bool => $requirement['resolved'])
                ->pluck('key')->values()->all(),
            'requirements' => $requirements,
            'correctionRequest' => $correction instanceof StoreCorrectionRequest ? [
                'id' => $correction->getKey(),
                'reason' => $correction->getAttribute('reason'),
                'requestedFields' => (array) $correction->getAttribute('requested_fields'),
                'requestedFieldLabels' => collect((array) $correction->getAttribute('requested_fields'))
                    ->map(fn (mixed $field): string => $this->policy->correctionFieldLabels()[(string) $field] ?? (string) $field)
                    ->values()->all(),
                'requestedAt' => $correction->getAttribute('requested_at')?->toIso8601String(),
            ] : null,
            'timeline' => $this->timeline($draft),
        ];
    }

    public function assertReady(StoreDraft $draft): void
    {
        $summary = $this->summary($draft);
        if (! $summary['ready']) {
            throw ValidationException::withMessages([
                'application' => ['أكمل متطلبات وثائق طلب المتجر أو سجّل الإعفاء المسموح قبل الإرسال.'],
            ]);
        }
    }

    /** @return array<string, mixed> */
    public function upload(
        StoreDraft $draft,
        string $requirementKey,
        UploadedFile $file,
        int $expectedRevision,
        string $idempotencyKey,
        User $actor,
        Request $request,
    ): array {
        [$realPath, $mime, $extension, $byteSize, $checksum] = $this->inspect($file);
        $disk = (string) config('store_application.disk');
        $evidenceId = (string) Str::uuid();
        $path = 'store-applications/'.$draft->getKey().'/'.$evidenceId.'.'.$extension;
        $oldFile = null;
        $stored = false;

        try {
            DB::connection((string) config('tenancy.database.central_connection'))
                ->transaction(function () use ($draft, $requirementKey, $file, $expectedRevision, $idempotencyKey, $actor, $request, $realPath, $mime, $byteSize, $checksum, $disk, $path, $evidenceId, &$oldFile, &$stored): void {
                    $lockedActor = User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->firstOrFail();
                    $lockedDraft = StoreDraft::query()->whereKey($draft->getKey())->lockForUpdate()->firstOrFail();
                    $this->authorizeDraft($lockedDraft, $lockedActor);
                    $this->assertEditable($lockedDraft);

                    $replay = StoreApplicationEvidence::query()
                        ->where('owner_user_id', $lockedActor->getKey())
                        ->where('upload_idempotency_key', $idempotencyKey)
                        ->lockForUpdate()->first();
                    if ($replay instanceof StoreApplicationEvidence) {
                        if ($replay->getAttribute('store_draft_id') !== $lockedDraft->getKey()
                            || $replay->getAttribute('requirement_key') !== $requirementKey
                            || ! hash_equals((string) $replay->getAttribute('checksum_sha256'), $checksum)
                        ) {
                            throw ValidationException::withMessages(['document' => ['أعيد استخدام مفتاح الرفع لملف مختلف.']]);
                        }

                        return;
                    }
                    $this->assertRevision($lockedDraft, $expectedRevision);
                    $requirement = $this->requirement($lockedDraft, $requirementKey);

                    $stream = fopen($realPath, 'rb');
                    if ($stream === false) {
                        throw new RuntimeException('The application document could not be opened.');
                    }
                    try {
                        $stored = Storage::disk($disk)->put($path, $stream);
                    } finally {
                        fclose($stream);
                    }
                    if (! $stored) {
                        throw new RuntimeException('The application document could not be stored.');
                    }

                    $existing = StoreApplicationEvidence::query()
                        ->where('store_draft_id', $lockedDraft->getKey())
                        ->where('requirement_key', $requirementKey)
                        ->lockForUpdate()->first();
                    if ($existing instanceof StoreApplicationEvidence && $existing->getAttribute('path') !== null) {
                        $oldFile = [(string) $existing->getAttribute('disk'), (string) $existing->getAttribute('path')];
                    }
                    $values = [
                        'store_draft_id' => $lockedDraft->getKey(),
                        'owner_user_id' => $lockedActor->getKey(),
                        'tenant_id' => $lockedDraft->getAttribute('tenant_id'),
                        'requirement_key' => $requirement['key'],
                        'resolution' => ApplicationEvidenceResolution::Uploaded,
                        'review_status' => ApplicationEvidenceReviewStatus::Pending,
                        'original_name' => Str::limit(basename((string) $file->getClientOriginalName()), 255, ''),
                        'disk' => $disk,
                        'path' => $path,
                        'mime_type' => $mime,
                        'byte_size' => $byteSize,
                        'checksum_sha256' => $checksum,
                        'upload_idempotency_key' => $idempotencyKey,
                        'exemption_reason' => null,
                        'uploaded_at' => now(),
                    ];
                    if ($existing instanceof StoreApplicationEvidence) {
                        $existing->forceFill($values)->save();
                        $subject = $existing;
                    } else {
                        $subject = StoreApplicationEvidence::query()->create(['id' => $evidenceId] + $values);
                    }
                    $this->advanceDraft($lockedDraft);
                    $this->appendEvent($lockedDraft, $lockedActor, 'merchant', 'document_uploaded', 'تم رفع '.$requirement['label'].'.', [
                        'requirementKey' => $requirementKey,
                    ]);
                    $this->audit->record(
                        request: $request,
                        actor: $lockedActor,
                        action: 'merchant.store_application.document_uploaded',
                        subject: $subject,
                        tenant: $lockedDraft->tenant,
                        oldValues: null,
                        newValues: ['requirement_key' => $requirementKey, 'checksum_sha256' => $checksum, 'byte_size' => $byteSize],
                    );
                });
        } catch (\Throwable $exception) {
            if ($stored) {
                Storage::disk($disk)->delete($path);
            }
            throw $exception;
        }
        if (is_array($oldFile)) {
            Storage::disk($oldFile[0])->delete($oldFile[1]);
        }

        return $this->summary($draft->refresh());
    }

    /** @return array<string, mixed> */
    public function exempt(
        StoreDraft $draft,
        string $requirementKey,
        int $expectedRevision,
        string $reason,
        User $actor,
        Request $request,
    ): array {
        $oldFile = null;
        DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($draft, $requirementKey, $expectedRevision, $reason, $actor, $request, &$oldFile): void {
                $lockedActor = User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->firstOrFail();
                $lockedDraft = StoreDraft::query()->whereKey($draft->getKey())->lockForUpdate()->firstOrFail();
                $this->authorizeDraft($lockedDraft, $lockedActor);
                $this->assertEditable($lockedDraft);
                $this->assertRevision($lockedDraft, $expectedRevision);
                $requirement = $this->requirement($lockedDraft, $requirementKey);
                if (! $requirement['allowExemption']) {
                    throw ValidationException::withMessages(['reason' => ['لا تسمح سياسة هذا النشاط بالإعفاء من هذا المستند.']]);
                }

                $existing = StoreApplicationEvidence::query()
                    ->where('store_draft_id', $lockedDraft->getKey())
                    ->where('requirement_key', $requirementKey)
                    ->lockForUpdate()->first();
                if ($existing instanceof StoreApplicationEvidence && $existing->getAttribute('path') !== null) {
                    $oldFile = [(string) $existing->getAttribute('disk'), (string) $existing->getAttribute('path')];
                }
                $values = [
                    'store_draft_id' => $lockedDraft->getKey(),
                    'owner_user_id' => $lockedActor->getKey(),
                    'tenant_id' => $lockedDraft->getAttribute('tenant_id'),
                    'requirement_key' => $requirementKey,
                    'resolution' => ApplicationEvidenceResolution::Exempted,
                    'review_status' => ApplicationEvidenceReviewStatus::Pending,
                    'original_name' => null,
                    'disk' => null,
                    'path' => null,
                    'mime_type' => null,
                    'byte_size' => null,
                    'checksum_sha256' => null,
                    'upload_idempotency_key' => null,
                    'exemption_reason' => trim($reason),
                    'uploaded_at' => null,
                ];
                $subject = $existing instanceof StoreApplicationEvidence
                    ? tap($existing)->forceFill($values)
                    : StoreApplicationEvidence::query()->make($values);
                $subject->save();
                $this->advanceDraft($lockedDraft);
                $this->appendEvent($lockedDraft, $lockedActor, 'merchant', 'exemption_declared', 'تم تسجيل إفادة الإعفاء لـ '.$requirement['label'].'.', [
                    'requirementKey' => $requirementKey,
                ]);
                $this->audit->record(
                    request: $request,
                    actor: $lockedActor,
                    action: 'merchant.store_application.exemption_declared',
                    subject: $subject,
                    tenant: $lockedDraft->tenant,
                    oldValues: null,
                    newValues: ['requirement_key' => $requirementKey, 'resolution' => 'exempted'],
                );
            });
        if (is_array($oldFile)) {
            Storage::disk($oldFile[0])->delete($oldFile[1]);
        }

        return $this->summary($draft->refresh());
    }

    public function download(StoreDraft $draft, StoreApplicationEvidence $evidence, User $actor): StreamedResponse
    {
        $this->authorizeDraft($draft, $actor);
        abort_unless($evidence->getAttribute('store_draft_id') === $draft->getKey(), 404);
        abort_unless($evidence->getAttribute('resolution') === ApplicationEvidenceResolution::Uploaded, 404);
        $disk = (string) $evidence->getAttribute('disk');
        $path = (string) $evidence->getAttribute('path');
        abort_unless(Storage::disk($disk)->exists($path), 404);
        $types = (array) config('store_application.allowed_mime_types');
        $extension = (string) ($types[(string) $evidence->getAttribute('mime_type')] ?? 'bin');

        return Storage::disk($disk)->download(
            $path,
            (string) $evidence->getAttribute('requirement_key').'.'.$extension,
            ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff'],
        );
    }

    public function linkSubmitted(StoreDraft $draft, Tenant $tenant, User $actor): void
    {
        StoreApplicationEvidence::query()->where('store_draft_id', $draft->getKey())->update(['tenant_id' => $tenant->getKey()]);
        StoreApplicationEvent::query()->where('store_draft_id', $draft->getKey())->update(['tenant_id' => $tenant->getKey()]);
        $this->appendEvent($draft, $actor, 'merchant', 'submitted', 'تم إرسال طلب المتجر إلى إدارة المنصة.', []);
    }

    /** @return list<array<string, mixed>> */
    public function snapshot(StoreDraft $draft): array
    {
        return StoreApplicationEvidence::query()->where('store_draft_id', $draft->getKey())
            ->orderBy('requirement_key')->get()
            ->map(fn (StoreApplicationEvidence $evidence): array => [
                'id' => $evidence->getKey(),
                'requirementKey' => $evidence->getAttribute('requirement_key'),
                'resolution' => $evidence->getAttribute('resolution')->value,
                'originalName' => $evidence->getAttribute('original_name'),
                'mimeType' => $evidence->getAttribute('mime_type'),
                'byteSize' => $evidence->getAttribute('byte_size'),
                'checksumSha256' => $evidence->getAttribute('checksum_sha256'),
                'exemptionReason' => $evidence->getAttribute('exemption_reason'),
            ])->all();
    }

    /** @param list<string> $requestedFields */
    public function requestCorrection(Tenant $tenant, array $requestedFields, string $reason, User $actor): StoreCorrectionRequest
    {
        $draft = StoreDraft::query()->where('tenant_id', $tenant->getKey())->lockForUpdate()->firstOrFail();
        StoreCorrectionRequest::query()->where('tenant_id', $tenant->getKey())->where('status', 'open')->update([
            'status' => 'resolved', 'resolved_at' => now(),
        ]);
        $correction = StoreCorrectionRequest::query()->create([
            'tenant_id' => $tenant->getKey(),
            'store_draft_id' => $draft->getKey(),
            'requested_by_user_id' => $actor->getKey(),
            'status' => 'open',
            'requested_fields' => array_values(array_unique($requestedFields)),
            'requested_draft_revision' => (int) $draft->getAttribute('revision'),
            'reason' => trim($reason),
            'requested_at' => now(),
            'resolved_at' => null,
        ]);
        $documentRequirements = collect($requestedFields)
            ->filter(fn (string $field): bool => str_starts_with($field, 'documents.'))
            ->map(fn (string $field): string => Str::after($field, 'documents.'))
            ->values()->all();
        if ($documentRequirements !== []) {
            StoreApplicationEvidence::query()
                ->where('store_draft_id', $draft->getKey())
                ->whereIn('requirement_key', $documentRequirements)
                ->update(['review_status' => ApplicationEvidenceReviewStatus::Rejected->value]);
        }
        $this->appendEvent($draft, $actor, 'platform', 'changes_requested', 'طلبت إدارة المنصة استكمال بنود محددة.', [
            'requestedFields' => $correction->getAttribute('requested_fields'),
        ]);

        return $correction;
    }

    public function assertCorrectionAddressed(StoreDraft $draft): void
    {
        $correction = StoreCorrectionRequest::query()
            ->where('store_draft_id', $draft->getKey())
            ->where('status', 'open')
            ->lockForUpdate()
            ->first();
        if ($correction instanceof StoreCorrectionRequest
            && (int) $draft->getAttribute('revision') <= (int) $correction->getAttribute('requested_draft_revision')
        ) {
            throw ValidationException::withMessages([
                'application' => ['نفّذ التعديلات المطلوبة واحفظها قبل إعادة إرسال الطلب.'],
            ]);
        }
    }

    public function recordDecision(Tenant $tenant, User $actor, string $eventType, string $message): void
    {
        // Tenants created before the guided application lifecycle do not have a
        // dossier. Their existing review path must remain operable while new
        // submissions receive the richer application timeline.
        $draft = StoreDraft::query()->where('tenant_id', $tenant->getKey())->lockForUpdate()->first();
        if (! $draft instanceof StoreDraft) {
            return;
        }
        $this->appendEvent($draft, $actor, 'platform', $eventType, $message, []);
    }

    public function resolveCorrection(StoreDraft $draft, User $actor): void
    {
        StoreCorrectionRequest::query()->where('store_draft_id', $draft->getKey())->where('status', 'open')->update([
            'status' => 'resolved', 'resolved_at' => now(),
        ]);
        $this->appendEvent($draft, $actor, 'merchant', 'resubmitted', 'تم استكمال البنود المطلوبة وإعادة إرسال الطلب.', []);
    }

    /** @param array<string, mixed> $metadata */
    public function appendEvent(StoreDraft $draft, ?User $actor, string $actorType, string $eventType, string $message, array $metadata): void
    {
        StoreApplicationEvent::query()->create([
            'store_draft_id' => $draft->getKey(),
            'tenant_id' => $draft->getAttribute('tenant_id'),
            'actor_user_id' => $actor?->getKey(),
            'actor_type' => $actorType,
            'event_type' => $eventType,
            'public_message' => $message,
            // PostgreSQL guards this JSON column as an object. PHP encodes an
            // empty array as `[]`, so normalize every event map explicitly.
            'metadata' => (object) $metadata,
            'occurred_at' => now(),
        ]);
    }

    private function authorizeDraft(StoreDraft $draft, User $actor): void
    {
        if ($draft->getAttribute('tenant_id') === null) {
            if ($draft->getAttribute('owner_user_id') !== $actor->getKey()) {
                throw new AuthorizationException('The store application does not belong to this account.');
            }

            return;
        }
        $tenant = $draft->tenant()->firstOrFail();
        Gate::forUser($actor)->authorize('ownStore', $tenant);
    }

    private function assertEditable(StoreDraft $draft): void
    {
        $editable = ($draft->getAttribute('tenant_id') === null && $draft->getAttribute('status') === StoreDraftStatus::Draft)
            || $draft->getAttribute('status') === StoreDraftStatus::CorrectionRequired;
        if (! $editable) {
            throw ValidationException::withMessages(['application' => ['لا يمكن تعديل وثائق الطلب في حالته الحالية.']]);
        }
    }

    private function assertRevision(StoreDraft $draft, int $expected): void
    {
        if ((int) $draft->getAttribute('revision') !== $expected) {
            throw ValidationException::withMessages(['expectedRevision' => ['تغير الطلب على الخادم؛ حدّث الصفحة ثم أعد المحاولة.']]);
        }
    }

    /** @return array{key: string, label: string, description: string, uploadRequired: bool, allowExemption: bool} */
    private function requirement(StoreDraft $draft, string $key): array
    {
        $requirement = collect($this->policy->requirementsFor((string) $draft->getAttribute('business_type')))
            ->firstWhere('key', $key);
        if (! is_array($requirement)) {
            throw ValidationException::withMessages(['requirement' => ['متطلب الوثيقة غير معروف لهذا النشاط.']]);
        }

        return $requirement;
    }

    private function advanceDraft(StoreDraft $draft): void
    {
        $draft->forceFill([
            'revision' => ((int) $draft->getAttribute('revision')) + 1,
            'saved_at' => now(),
        ])->save();
    }

    /** @return array{0: string, 1: string, 2: string, 3: int, 4: string} */
    private function inspect(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        $size = $file->getSize();
        if (! is_string($path) || $path === '' || ! is_int($size) || $size < 1 || $size > (int) config('store_application.max_document_bytes')) {
            throw ValidationException::withMessages(['document' => ['حجم المستند غير صالح أو يتجاوز 5 ميجابايت.']]);
        }
        $mime = $file->getMimeType();
        $types = (array) config('store_application.allowed_mime_types');
        if (! is_string($mime) || ! isset($types[$mime])) {
            throw ValidationException::withMessages(['document' => ['نوع المستند غير مسموح. استخدم PDF أو JPG أو PNG.']]);
        }

        $checksum = hash_file('sha256', $path);
        if (! is_string($checksum)) {
            throw new RuntimeException('The application document could not be hashed.');
        }

        return [$path, $mime, (string) $types[$mime], $size, $checksum];
    }

    /** @return array<string, mixed> */
    private function evidenceResource(StoreApplicationEvidence $evidence): array
    {
        return [
            'id' => $evidence->getKey(),
            'resolution' => $evidence->getAttribute('resolution')->value,
            'reviewStatus' => $evidence->getAttribute('review_status')->value,
            'originalName' => $evidence->getAttribute('original_name'),
            'mimeType' => $evidence->getAttribute('mime_type'),
            'byteSize' => $evidence->getAttribute('byte_size'),
            'exemptionReason' => $evidence->getAttribute('exemption_reason'),
            'uploadedAt' => $evidence->getAttribute('uploaded_at')?->toIso8601String(),
            'downloadUrl' => $evidence->getAttribute('resolution') === ApplicationEvidenceResolution::Uploaded
                ? '/api/merchant/store-drafts/'.$evidence->getAttribute('store_draft_id').'/evidence/'.$evidence->getKey()
                : null,
        ];
    }

    /** @return list<array<string, mixed>> */
    private function timeline(StoreDraft $draft): array
    {
        $createdAt = $draft->getAttribute('created_at');
        $events = [[
            'id' => 'draft-created',
            'type' => 'draft_created',
            'actorType' => 'merchant',
            'message' => 'تم إنشاء مسودة طلب المتجر وحفظها على الخادم.',
            'occurredAt' => $createdAt?->toIso8601String(),
        ]];
        foreach ($draft->applicationEvents as $event) {
            $events[] = [
                'id' => $event->getKey(),
                'type' => $event->getAttribute('event_type'),
                'actorType' => $event->getAttribute('actor_type'),
                'message' => $event->getAttribute('public_message'),
                'occurredAt' => $event->getAttribute('occurred_at')?->toIso8601String(),
            ];
        }

        return $events;
    }
}
