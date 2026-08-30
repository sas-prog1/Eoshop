<?php

namespace App\Services;

use App\Enums\PermissionKey;
use App\Enums\TenantMembershipStatus;
use App\Exceptions\StoreAssetConflict;
use App\Models\Tenant;
use App\Models\User;
use App\Support\CanonicalDomain;
use App\Support\StoreAssetPath;
use App\Support\TenantRuntimeReadiness;
use App\Support\TenantWorkspaceReadiness;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StoreAssetService
{
    /** @return array{id: string, url: string, mimeType: string, byteSize: int} */
    public function upload(Tenant $tenant, User $actor, UploadedFile $file, string $idempotencyKey): array
    {
        [$realPath, $byteSize, $mime, $extension, $checksum] = $this->inspect($file);

        return $this->withLockedMembership($tenant, $actor, function (Tenant $lockedTenant) use ($actor, $realPath, $byteSize, $mime, $extension, $checksum, $idempotencyKey): array {
            if (! TenantWorkspaceReadiness::check($lockedTenant)) {
                throw new StoreAssetConflict('The tenant workspace is not ready for managed assets.', 'workspace_not_ready');
            }

            return $lockedTenant->run(function () use ($lockedTenant, $actor, $realPath, $byteSize, $mime, $extension, $checksum, $idempotencyKey): array {
                $row = DB::transaction(function () use ($lockedTenant, $actor, $byteSize, $mime, $extension, $checksum, $idempotencyKey): object {
                    $existing = DB::table('store_assets')
                        ->where('uploaded_by_user_id', $actor->getKey())
                        ->where('upload_idempotency_key', $idempotencyKey)
                        ->lockForUpdate()
                        ->first();
                    if ($existing !== null) {
                        if (! hash_equals((string) $existing->checksum_sha256, $checksum)) {
                            throw new StoreAssetConflict('The asset idempotency key was reused for different content.', 'store_asset_idempotency_conflict');
                        }
                        if (! in_array($existing->state, ['staging', 'ready'], true)
                            || ! $this->safeOwnedRow($lockedTenant, $existing)
                            || $existing->mime_type !== $mime
                            || (int) $existing->byte_size !== $byteSize) {
                            throw new StoreAssetConflict('The replayed asset is already being cleaned up.', 'workspace_asset_unavailable');
                        }

                        return $existing;
                    }

                    $count = DB::table('store_assets')->count();
                    $bytes = (int) DB::table('store_assets')->sum('byte_size');
                    if ($count >= (int) config('store_assets.max_assets_per_tenant')
                        || $bytes + $byteSize > (int) config('store_assets.max_total_bytes_per_tenant')) {
                        throw new StoreAssetConflict('The managed store asset quota has been reached.', 'store_asset_quota_exceeded');
                    }

                    $id = (string) Str::uuid();
                    $now = now();
                    $values = [
                        'id' => $id,
                        'state' => 'staging',
                        'disk' => (string) config('store_assets.disk'),
                        'path' => $this->managedPath($lockedTenant, $id, $extension),
                        'mime_type' => $mime,
                        'byte_size' => $byteSize,
                        'checksum_sha256' => $checksum,
                        'uploaded_by_user_id' => $actor->getKey(),
                        'upload_idempotency_key' => $idempotencyKey,
                        'orphaned_at' => $now,
                        'cleanup_started_at' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                    DB::table('store_assets')->insert($values);

                    return (object) $values;
                });

                if ($row->state === 'ready') {
                    return $this->resource($lockedTenant, $row);
                }

                $stream = fopen($realPath, 'rb');
                if ($stream === false) {
                    throw new RuntimeException('The uploaded store image could not be opened.');
                }
                try {
                    $stored = Storage::disk((string) $row->disk)->put((string) $row->path, $stream);
                } finally {
                    fclose($stream);
                }
                if (! $stored) {
                    throw new RuntimeException('The uploaded store image could not be stored.');
                }

                $ready = DB::transaction(function () use ($row): object {
                    $locked = DB::table('store_assets')->where('id', $row->id)->lockForUpdate()->first();
                    if ($locked === null || $locked->state === 'cleanup') {
                        throw new StoreAssetConflict('The uploaded asset is no longer available.', 'workspace_asset_unavailable');
                    }
                    if ($locked->state === 'staging') {
                        DB::table('store_assets')->where('id', $locked->id)->update([
                            'state' => 'ready',
                            'updated_at' => now(),
                        ]);
                        $locked->state = 'ready';
                    }

                    return $locked;
                });

                return $this->resource($lockedTenant, $ready);
            });
        });
    }

    /**
     * Called inside a tenant transaction after the current store_configs row is locked.
     *
     * @param  array<string, mixed>  $currentConfig
     * @param  array<string, mixed>  $nextConfig
     */
    public function syncReferences(Tenant $tenant, array $currentConfig, array $nextConfig): void
    {
        $tenantId = (string) $tenant->getKey();
        $current = StoreAssetPath::referencedIds($currentConfig, $tenantId);
        $next = StoreAssetPath::referencedIds($nextConfig, $tenantId);
        $referenceBudgets = StoreAssetPath::referenceBudgets($nextConfig, $tenantId);
        $ids = array_values(array_unique([...$current, ...$next]));
        sort($ids, SORT_STRING);
        if ($ids === []) {
            return;
        }

        $rows = DB::table('store_assets')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
        foreach ($next as $id) {
            $row = $rows->get($id);
            if ($row === null || $row->state !== 'ready' || $row->cleanup_started_at !== null
                || ! $this->safeOwnedRow($tenant, $row)) {
                throw new StoreAssetConflict('A referenced managed store asset is unavailable.', 'workspace_asset_unavailable');
            }
            if (isset($referenceBudgets[$id]) && (int) $row->byte_size > $referenceBudgets[$id]) {
                throw new StoreAssetConflict(
                    'A referenced managed store asset exceeds the byte budget for its storefront placement.',
                    'workspace_asset_budget_exceeded',
                );
            }
        }

        $now = now();
        if ($next !== []) {
            DB::table('store_assets')->whereIn('id', $next)->update(['orphaned_at' => null, 'updated_at' => $now]);
        }
        $detached = array_values(array_diff($current, $next));
        if ($detached !== []) {
            DB::table('store_assets')->whereIn('id', $detached)->where('state', 'ready')->update([
                'orphaned_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function response(Tenant $tenant, string $assetId, Request $request): StreamedResponse
    {
        $host = CanonicalDomain::normalize($request->getHost());
        $central = in_array($host, config('tenancy.central_domains', []), true);
        $actor = $request->user();
        $centralPreview = $central && $actor instanceof User
            && $actor->hasTenantPermission($tenant, PermissionKey::TenantStoreManage);
        $tenantHost = ! $central && $tenant->domains()->where('domain', $host)->exists();
        $public = $tenantHost && TenantRuntimeReadiness::check($tenant, $host)
            && TenantWorkspaceReadiness::isMaterialized($tenant);
        if (! $centralPreview && ! $public) {
            abort(404);
        }

        $asset = $tenant->run(function () use ($tenant, $assetId, $public): ?object {
            return DB::connection('tenant')->transaction(function () use ($tenant, $assetId, $public): ?object {
                DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                $row = DB::table('store_assets')->where('id', $assetId)
                    ->where('state', 'ready')->whereNull('cleanup_started_at')->first();
                if ($row === null) {
                    return null;
                }
                if ($public) {
                    $configRow = DB::table('store_configs')->where('is_current', true)->first();
                    if ($configRow === null) {
                        return null;
                    }
                    $config = json_decode((string) $configRow->config_json, true, 512, JSON_THROW_ON_ERROR);
                    if (! in_array($assetId, StoreAssetPath::referencedIds($config, (string) $tenant->getKey()), true)) {
                        return null;
                    }
                }

                return $row;
            });
        });
        if ($asset === null || ! $this->safeOwnedRow($tenant, $asset)
            || ! Storage::disk((string) $asset->disk)->exists((string) $asset->path)) {
            abort(404);
        }

        return Storage::disk((string) $asset->disk)->response((string) $asset->path, null, [
            'Content-Type' => (string) $asset->mime_type,
            'Cache-Control' => $centralPreview ? 'private, no-store' : 'no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function pruneOrphans(Tenant $tenant): int
    {
        if (! TenantWorkspaceReadiness::maintenanceCheck($tenant)) {
            return 0;
        }

        return $tenant->run(function () use ($tenant): int {
            $cutoff = now()->subHours((int) config('store_assets.orphan_retention_hours'));
            $ids = DB::table('store_assets')->where(function ($query) use ($cutoff): void {
                $query->where('state', 'cleanup')->orWhere('orphaned_at', '<=', $cutoff);
            })->orderBy('id')->pluck('id');
            $deleted = 0;
            foreach ($ids as $id) {
                $claimed = DB::transaction(function () use ($tenant, $id, $cutoff): ?object {
                    $configRow = DB::table('store_configs')->where('is_current', true)->lockForUpdate()->first();
                    if ($configRow === null) {
                        return null;
                    }
                    $config = json_decode((string) $configRow->config_json, true, 512, JSON_THROW_ON_ERROR);
                    $row = DB::table('store_assets')->where('id', $id)->lockForUpdate()->first();
                    if ($row === null || in_array((string) $id, StoreAssetPath::referencedIds($config, (string) $tenant->getKey()), true)
                        || ($row->state !== 'cleanup' && ($row->orphaned_at === null || Carbon::parse((string) $row->orphaned_at)->isAfter($cutoff)))) {
                        return null;
                    }
                    if (! $this->safeOwnedRow($tenant, $row)) {
                        return null;
                    }
                    if ($row->state !== 'cleanup') {
                        DB::table('store_assets')->where('id', $id)->update([
                            'state' => 'cleanup',
                            'cleanup_started_at' => now(),
                            'updated_at' => now(),
                        ]);
                        $row->state = 'cleanup';
                    }

                    return $row;
                });
                if ($claimed === null) {
                    continue;
                }

                $disk = (string) $claimed->disk;
                $path = (string) $claimed->path;
                if (Storage::disk($disk)->exists($path) && ! Storage::disk($disk)->delete($path)) {
                    continue;
                }

                $deleted += DB::transaction(function () use ($tenant, $id, $disk, $path): int {
                    $configRow = DB::table('store_configs')->where('is_current', true)->lockForUpdate()->first();
                    if ($configRow === null) {
                        return 0;
                    }
                    $config = json_decode((string) $configRow->config_json, true, 512, JSON_THROW_ON_ERROR);
                    $row = DB::table('store_assets')->where('id', $id)->lockForUpdate()->first();
                    if ($row === null || $row->state !== 'cleanup' || $row->disk !== $disk || $row->path !== $path
                        || in_array((string) $id, StoreAssetPath::referencedIds($config, (string) $tenant->getKey()), true)) {
                        return 0;
                    }

                    return DB::table('store_assets')->where('id', $id)->delete();
                });
            }

            return $deleted;
        });
    }

    /** @return array{0: string, 1: int, 2: string, 3: string, 4: string} */
    private function inspect(UploadedFile $file): array
    {
        $realPath = $file->getRealPath();
        if (! is_string($realPath) || ! is_file($realPath)) {
            throw new RuntimeException('The uploaded store image is unavailable.');
        }
        $byteSize = filesize($realPath);
        $dimensions = @getimagesize($realPath);
        $mime = is_array($dimensions) ? $dimensions['mime'] : null;
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (! is_int($byteSize) || $byteSize <= 0 || $byteSize > (int) config('store_assets.max_bytes')
            || ! is_array($dimensions) || ! is_string($mime) || ! isset($allowed[$mime])
            || (int) $dimensions[0] <= 0 || (int) $dimensions[1] <= 0
            || ((int) $dimensions[0] * (int) $dimensions[1]) > (int) config('store_assets.max_pixels')) {
            throw new StoreAssetConflict('The store image type, size or dimensions are not allowed.', 'store_asset_invalid');
        }
        $checksum = hash_file('sha256', $realPath);
        if (! is_string($checksum)) {
            throw new RuntimeException('The store image checksum could not be calculated.');
        }

        return [$realPath, $byteSize, $mime, $allowed[$mime], $checksum];
    }

    /** @return array{id: string, url: string, mimeType: string, byteSize: int} */
    private function resource(Tenant $tenant, object $asset): array
    {
        return [
            'id' => (string) $asset->id,
            'url' => StoreAssetPath::url((string) $tenant->getKey(), (string) $asset->id),
            'mimeType' => (string) $asset->mime_type,
            'byteSize' => (int) $asset->byte_size,
        ];
    }

    private function safeOwnedRow(Tenant $tenant, object $row): bool
    {
        $extension = match ($row->mime_type ?? null) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => null,
        };

        return $extension !== null
            && Str::isUuid((string) ($row->id ?? ''))
            && $row->disk === (string) config('store_assets.disk')
            && (string) $row->path === $this->managedPath($tenant, (string) $row->id, $extension)
            && ! str_contains((string) $row->path, '..')
            && ! str_contains((string) $row->path, '\\');
    }

    private function tenantPrefix(Tenant $tenant): string
    {
        return 'store-assets/'.preg_replace('/[^a-z0-9-]/', '', mb_strtolower((string) $tenant->getKey())).'/';
    }

    private function managedPath(Tenant $tenant, string $id, string $extension): string
    {
        return $this->tenantPrefix($tenant).substr($id, 0, 2).'/'.$id.'.'.$extension;
    }

    /**
     * @template T
     *
     * @param  callable(Tenant): T  $operation
     * @return T
     */
    private function withLockedMembership(Tenant $tenant, User $actor, callable $operation): mixed
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($central, $tenant, $actor, $operation): mixed {
            $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
            $membership = $central->table('tenant_user')->where('tenant_id', $lockedTenant->getKey())
                ->where('user_id', $actor->getKey())->lockForUpdate()->first();
            if ($membership === null || $membership->status !== TenantMembershipStatus::Active->value
                || ! $actor->hasTenantPermission($lockedTenant, PermissionKey::TenantStoreManage)) {
                throw new AuthorizationException('Active store-management membership is required.');
            }

            return $operation($lockedTenant);
        });
    }
}
