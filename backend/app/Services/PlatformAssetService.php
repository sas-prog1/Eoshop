<?php

namespace App\Services;

use App\Enums\PermissionKey;
use App\Enums\UserStatus;
use App\Exceptions\PlatformAssetConflict;
use App\Models\PlatformSetting;
use App\Models\User;
use App\Support\PlatformIdentityImageUrl;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class PlatformAssetService
{
    private const QUOTA_LOCK_KEY = 52750002;

    /** @return array{id: string, url: string, purpose: string, mimeType: string, byteSize: int, width: int, height: int} */
    public function upload(User $actor, UploadedFile $file, string $purpose, string $idempotencyKey): array
    {
        [$realPath, $byteSize, $width, $height, $mime, $extension, $checksum] = $this->inspect($file);
        $pending = null;

        try {
            $row = DB::connection((string) config('tenancy.database.central_connection'))->transaction(
                function () use ($actor, $realPath, $byteSize, $width, $height, $mime, $extension, $checksum, $purpose, $idempotencyKey, &$pending): object {
                    $this->lockQuota();
                    $lockedActor = User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->first();
                    if (! $lockedActor instanceof User || $lockedActor->trashed()
                        || $lockedActor->getAttribute('status') !== UserStatus::Active
                        || ! $lockedActor->hasPlatformPermission(PermissionKey::PlatformSettingsManage)) {
                        throw new AuthorizationException('Active platform-settings permission is required.');
                    }

                    $existing = DB::table('platform_assets')->where('uploaded_by_user_id', $lockedActor->getKey())
                        ->where('upload_idempotency_key', $idempotencyKey)->lockForUpdate()->first();
                    if ($existing !== null) {
                        if (! hash_equals((string) $existing->checksum_sha256, $checksum) || $existing->purpose !== $purpose) {
                            throw new PlatformAssetConflict('The platform asset idempotency key was reused for different content.', 'platform_asset_idempotency_conflict');
                        }
                        if (! in_array($existing->state, ['staging', 'ready'], true) || ! $this->safeRow($existing)) {
                            throw new PlatformAssetConflict('The platform asset is unavailable.', 'platform_asset_unavailable');
                        }
                        if ($existing->state === 'ready') {
                            return $existing;
                        }

                        $row = $existing;
                    } else {
                        $count = DB::table('platform_assets')->whereIn('state', ['staging', 'ready'])->count();
                        $bytes = (int) DB::table('platform_assets')->whereIn('state', ['staging', 'ready'])->sum('byte_size');
                        if ($count >= (int) config('platform_assets.max_assets') || $bytes + $byteSize > (int) config('platform_assets.max_total_bytes')) {
                            throw new PlatformAssetConflict('The managed platform asset quota has been reached.', 'platform_asset_quota_exceeded');
                        }

                        $id = (string) Str::uuid();
                        $now = $this->now();
                        $values = [
                            'id' => $id, 'purpose' => $purpose, 'state' => 'staging',
                            'disk' => (string) config('platform_assets.disk'), 'path' => $this->managedPath($id, $extension),
                            'quarantine_path' => null, 'mime_type' => $mime, 'byte_size' => $byteSize,
                            'width' => $width, 'height' => $height, 'checksum_sha256' => $checksum,
                            'uploaded_by_user_id' => $lockedActor->getKey(), 'upload_idempotency_key' => $idempotencyKey,
                            'orphaned_at' => $now, 'quarantined_at' => null, 'recoverable_until' => null,
                            'created_at' => $now, 'updated_at' => $now,
                        ];
                        DB::table('platform_assets')->insert($values);
                        $row = (object) $values;
                    }

                    $pending = $row;
                    $stream = fopen($realPath, 'rb');
                    if ($stream === false) {
                        throw new RuntimeException('The uploaded platform image could not be opened.');
                    }
                    try {
                        $stored = $this->put((string) $row->disk, (string) $row->path, $stream);
                    } finally {
                        fclose($stream);
                    }
                    if (! $stored) {
                        throw new RuntimeException('The uploaded platform image could not be stored.');
                    }

                    DB::table('platform_assets')->where('id', $row->id)->where('state', 'staging')->update([
                        'state' => 'ready', 'updated_at' => $this->now(),
                    ]);
                    $row->state = 'ready';

                    return $row;
                },
            );
        } catch (Throwable $exception) {
            if (is_object($pending) && $this->safeRow($pending)) {
                DB::connection((string) config('tenancy.database.central_connection'))->transaction(function () use ($pending): void {
                    $this->lockQuota();
                    DB::table('platform_assets')->where('id', $pending->id)->where('state', 'staging')->delete();
                });
                $this->deleteIfOwned((string) $pending->disk, (string) $pending->path);
            }

            throw $exception;
        }

        return $this->resource($row);
    }

    public function syncReferences(?string $currentLanding, ?string $currentAuth, ?string $nextLanding, ?string $nextAuth): void
    {
        $current = array_filter([
            PlatformIdentityImageUrl::managedAssetId($currentLanding),
            PlatformIdentityImageUrl::managedAssetId($currentAuth),
        ]);
        $nextByPurpose = array_filter([
            'landing_hero' => PlatformIdentityImageUrl::managedAssetId($nextLanding),
            'authentication' => PlatformIdentityImageUrl::managedAssetId($nextAuth),
        ]);
        $ids = array_values(array_unique([...$current, ...array_values($nextByPurpose)]));
        sort($ids, SORT_STRING);
        if ($ids === []) {
            return;
        }

        $rows = DB::table('platform_assets')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
        foreach ($nextByPurpose as $purpose => $id) {
            $row = $rows->get($id);
            if ($row === null || $row->state !== 'ready' || $row->purpose !== $purpose || ! $this->safeRow($row)
                || ! $this->exists((string) $row->disk, (string) $row->path)) {
                throw new PlatformAssetConflict('A referenced managed platform asset is unavailable.', 'platform_asset_unavailable');
            }
        }

        $next = array_values($nextByPurpose);
        $now = $this->now();
        if ($next !== []) {
            DB::table('platform_assets')->whereIn('id', $next)->update(['orphaned_at' => null, 'updated_at' => $now]);
        }
        $detached = array_values(array_diff($current, $next));
        if ($detached !== []) {
            DB::table('platform_assets')->whereIn('id', $detached)->where('state', 'ready')->update(['orphaned_at' => $now, 'updated_at' => $now]);
        }
    }

    public function response(string $assetId): StreamedResponse
    {
        $row = DB::transaction(function () use ($assetId): ?object {
            $asset = DB::table('platform_assets')->where('id', $assetId)->where('state', 'ready')->first();
            if ($asset === null) {
                return null;
            }
            $settings = PlatformSetting::query()->whereKey(PlatformSetting::SINGLETON_ID)->first();
            if ($settings === null || ! in_array($assetId, [
                PlatformIdentityImageUrl::managedAssetId($settings->landing_hero_image_url),
                PlatformIdentityImageUrl::managedAssetId($settings->auth_image_url),
            ], true)) {
                return null;
            }

            return $asset;
        });
        if ($row === null || ! $this->safeRow($row) || ! Storage::disk((string) $row->disk)->exists((string) $row->path)) {
            abort(404);
        }

        return Storage::disk((string) $row->disk)->response((string) $row->path, null, [
            'Content-Type' => (string) $row->mime_type,
            'Cache-Control' => 'no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** @return array{quarantined: int, deleted: int} */
    public function prune(): array
    {
        $cutoff = $this->now()->subHours((int) config('platform_assets.orphan_retention_hours'));
        $quarantined = 0;
        $deleted = 0;
        $ids = DB::table('platform_assets')->where(function ($query) use ($cutoff): void {
            $query->where(function ($ready) use ($cutoff): void {
                $ready->where('state', 'ready')->whereNotNull('orphaned_at')->where('orphaned_at', '<=', $cutoff);
            })->orWhere(function ($staging) use ($cutoff): void {
                $staging->where('state', 'staging')->where('created_at', '<=', $cutoff);
            });
        })->orderBy('id')->pluck('id');
        foreach ($ids as $id) {
            $quarantined += DB::transaction(function () use ($id, $cutoff): int {
                $setting = PlatformSetting::query()->whereKey(PlatformSetting::SINGLETON_ID)->lockForUpdate()->firstOrFail();
                $row = DB::table('platform_assets')->where('id', $id)->lockForUpdate()->first();
                if ($row === null || ! in_array($row->state, ['staging', 'ready'], true) || ! $this->safeRow($row)
                    || $this->isReferenced($setting, (string) $id)) {
                    return 0;
                }
                $expired = $row->state === 'staging'
                    ? Carbon::parse((string) $row->created_at)->isBefore($cutoff) || Carbon::parse((string) $row->created_at)->equalTo($cutoff)
                    : $row->orphaned_at !== null && ! Carbon::parse((string) $row->orphaned_at)->isAfter($cutoff);
                if (! $expired) {
                    return 0;
                }

                $quarantinePath = $this->quarantinePath($row);
                $sourceExists = $this->exists((string) $row->disk, (string) $row->path);
                $quarantineExists = $this->exists((string) $row->disk, $quarantinePath);
                if ($sourceExists && $quarantineExists) {
                    return 0;
                }
                if (! $sourceExists && ! $quarantineExists) {
                    if ($row->state === 'staging') {
                        DB::table('platform_assets')->where('id', $id)->where('state', 'staging')->delete();
                    }

                    return 0;
                }
                if ($sourceExists && ! $this->move((string) $row->disk, (string) $row->path, $quarantinePath)) {
                    return 0;
                }

                $now = $this->now();
                DB::table('platform_assets')->where('id', $id)->update([
                    'state' => 'quarantined', 'quarantine_path' => $quarantinePath,
                    'quarantined_at' => $now, 'recoverable_until' => $now->copy()->addDays((int) config('platform_assets.recovery_days')),
                    'updated_at' => $now,
                ]);

                return 1;
            });
        }

        $expired = DB::table('platform_assets')->whereIn('state', ['quarantined', 'purging'])
            ->where('recoverable_until', '<=', $this->now())->orderBy('id')->pluck('id');
        foreach ($expired as $id) {
            $claimed = DB::transaction(function () use ($id): bool {
                $setting = PlatformSetting::query()->whereKey(PlatformSetting::SINGLETON_ID)->lockForUpdate()->firstOrFail();
                $row = DB::table('platform_assets')->where('id', $id)->lockForUpdate()->first();
                if ($row === null || ! in_array($row->state, ['quarantined', 'purging'], true)
                    || $this->isReferenced($setting, (string) $id) || ! $this->safeRow($row, true)
                    || Carbon::parse((string) $row->recoverable_until)->isFuture()) {
                    return false;
                }
                if ($row->state === 'quarantined') {
                    DB::table('platform_assets')->where('id', $id)->update(['state' => 'purging', 'updated_at' => $this->now()]);
                }

                return true;
            });
            if (! $claimed) {
                continue;
            }

            $deleted += DB::transaction(function () use ($id): int {
                $setting = PlatformSetting::query()->whereKey(PlatformSetting::SINGLETON_ID)->lockForUpdate()->firstOrFail();
                $row = DB::table('platform_assets')->where('id', $id)->lockForUpdate()->first();
                if ($row === null || $row->state !== 'purging' || $this->isReferenced($setting, (string) $id)
                    || ! $this->safeRow($row, true) || Carbon::parse((string) $row->recoverable_until)->isFuture()
                    || ! $this->deleteOwnedFiles($row)) {
                    return 0;
                }

                return DB::table('platform_assets')->where('id', $id)->where('state', 'purging')->delete();
            });
        }

        return ['quarantined' => $quarantined, 'deleted' => $deleted];
    }

    public function restore(string $assetId): bool
    {
        return DB::transaction(function () use ($assetId): bool {
            $setting = PlatformSetting::query()->whereKey(PlatformSetting::SINGLETON_ID)->lockForUpdate()->firstOrFail();
            $row = DB::table('platform_assets')->where('id', $assetId)->lockForUpdate()->first();
            if ($row === null || ! in_array($row->state, ['ready', 'quarantined'], true) || ! $this->safeRow($row)) {
                return false;
            }

            $quarantinePath = $row->state === 'quarantined' ? (string) $row->quarantine_path : $this->quarantinePath($row);
            if ($row->state === 'quarantined' && ($this->isReferenced($setting, $assetId)
                || ! $this->safeRow($row, true) || Carbon::parse((string) $row->recoverable_until)->isPast())) {
                return false;
            }
            $sourceExists = $this->exists((string) $row->disk, (string) $row->path);
            $quarantineExists = $this->exists((string) $row->disk, $quarantinePath);
            if ($sourceExists && $quarantineExists) {
                return false;
            }
            if ($row->state === 'ready' && $sourceExists) {
                return false;
            }
            if (! $sourceExists && (! $quarantineExists || ! $this->move((string) $row->disk, $quarantinePath, (string) $row->path))) {
                return false;
            }
            if ($row->state === 'ready') {
                return true;
            }

            $now = $this->now();

            return DB::table('platform_assets')->where('id', $assetId)->where('state', 'quarantined')->update([
                'state' => 'ready', 'quarantine_path' => null, 'quarantined_at' => null, 'recoverable_until' => null,
                'orphaned_at' => $now, 'updated_at' => $now,
            ]) === 1;
        });
    }

    /** @return array{0: string, 1: int, 2: int, 3: int, 4: string, 5: string, 6: string} */
    private function inspect(UploadedFile $file): array
    {
        $realPath = $file->getRealPath();
        if (! is_string($realPath) || ! is_file($realPath)) {
            throw new RuntimeException('The uploaded platform image is unavailable.');
        }
        $byteSize = filesize($realPath);
        $dimensions = @getimagesize($realPath);
        $mime = is_array($dimensions) ? $dimensions['mime'] : null;
        $width = is_array($dimensions) ? (int) $dimensions[0] : 0;
        $height = is_array($dimensions) ? (int) $dimensions[1] : 0;
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (! is_int($byteSize) || $byteSize <= 0 || $byteSize > (int) config('platform_assets.max_bytes')
            || ! is_string($mime) || ! isset($allowed[$mime])
            || $width < (int) config('platform_assets.min_width') || $height < (int) config('platform_assets.min_height')
            || $width > (int) config('platform_assets.max_width') || $height > (int) config('platform_assets.max_height')
            || $width * $height > (int) config('platform_assets.max_pixels')) {
            throw new PlatformAssetConflict('The platform image type, size or dimensions are not allowed.', 'platform_asset_invalid');
        }
        $checksum = hash_file('sha256', $realPath);
        if (! is_string($checksum)) {
            throw new RuntimeException('The platform image checksum could not be calculated.');
        }

        return [$realPath, $byteSize, $width, $height, $mime, $allowed[$mime], $checksum];
    }

    /** @return array{id: string, url: string, purpose: string, mimeType: string, byteSize: int, width: int, height: int} */
    private function resource(object $row): array
    {
        return ['id' => (string) $row->id, 'url' => PlatformIdentityImageUrl::url((string) $row->id),
            'purpose' => (string) $row->purpose, 'mimeType' => (string) $row->mime_type,
            'byteSize' => (int) $row->byte_size, 'width' => (int) $row->width, 'height' => (int) $row->height];
    }

    private function safeRow(object $row, bool $quarantined = false): bool
    {
        $extension = match ($row->mime_type ?? null) {
            'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', default => null
        };

        return $extension !== null && Str::isUuid((string) ($row->id ?? ''))
            && ($row->purpose ?? null) && in_array($row->purpose, ['landing_hero', 'authentication'], true)
            && $row->disk === (string) config('platform_assets.disk')
            && $row->path === $this->managedPath((string) $row->id, $extension)
            && ! str_contains((string) $row->path, '..') && ! str_contains((string) $row->path, '\\')
            && (! $quarantined || $row->quarantine_path === $this->quarantinePath($row));
    }

    private function managedPath(string $id, string $extension): string
    {
        return 'platform-assets/'.substr($id, 0, 2).'/'.$id.'.'.$extension;
    }

    private function quarantinePath(object $row): string
    {
        return 'platform-assets-recovery/'.substr((string) $row->id, 0, 2).'/'.basename((string) $row->path);
    }

    private function isReferenced(PlatformSetting $setting, string $id): bool
    {
        return in_array($id, [PlatformIdentityImageUrl::managedAssetId($setting->landing_hero_image_url), PlatformIdentityImageUrl::managedAssetId($setting->auth_image_url)], true);
    }

    private function lockQuota(): void
    {
        DB::connection((string) config('tenancy.database.central_connection'))
            ->select('SELECT pg_advisory_xact_lock(?)', [self::QUOTA_LOCK_KEY]);
    }

    /** @param resource $contents */
    protected function put(string $disk, string $path, $contents): bool
    {
        return Storage::disk($disk)->put($path, $contents);
    }

    protected function exists(string $disk, string $path): bool
    {
        return Storage::disk($disk)->exists($path);
    }

    protected function move(string $disk, string $from, string $to): bool
    {
        return Storage::disk($disk)->move($from, $to);
    }

    protected function delete(string $disk, string $path): bool
    {
        return Storage::disk($disk)->delete($path);
    }

    private function deleteIfOwned(string $disk, string $path): void
    {
        if ($this->exists($disk, $path)) {
            $this->delete($disk, $path);
        }
    }

    private function deleteOwnedFiles(object $row): bool
    {
        foreach (array_unique([(string) $row->path, (string) $row->quarantine_path]) as $path) {
            if ($this->exists((string) $row->disk, $path) && ! $this->delete((string) $row->disk, $path)) {
                return false;
            }
        }

        return true;
    }

    private function now(): Carbon
    {
        return now()->utc();
    }
}
