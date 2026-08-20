<?php

namespace App\Support;

use Illuminate\Support\Str;

final class StoreAssetPath
{
    public const PREFIX = '/api/store-assets/';

    public static function url(string $tenantId, string $assetId): string
    {
        return self::PREFIX.rawurlencode($tenantId).'/'.$assetId;
    }

    public static function assetId(string $value, string $tenantId): ?string
    {
        $prefix = self::PREFIX.rawurlencode($tenantId).'/';
        if (! str_starts_with($value, $prefix)) {
            return null;
        }

        $id = substr($value, strlen($prefix));

        return ! str_contains($id, '/') && Str::isUuid($id) ? $id : null;
    }

    public static function accepts(string $value, ?string $managedTenantId): bool
    {
        if ($value === '') {
            return true;
        }

        if (str_starts_with($value, self::PREFIX)) {
            return $managedTenantId !== null && self::assetId($value, $managedTenantId) !== null;
        }

        if (str_contains($value, '\\') || filter_var($value, FILTER_VALIDATE_URL) === false
            || mb_strtolower((string) parse_url($value, PHP_URL_SCHEME)) !== 'https'
            || trim((string) parse_url($value, PHP_URL_HOST)) === '') {
            return false;
        }

        $path = (string) parse_url($value, PHP_URL_PATH);

        return ! str_starts_with(self::canonicalPath($path), self::PREFIX);
    }

    /** @param array<string, mixed> $config
     * @return list<string>
     */
    public static function referencedIds(array $config, string $tenantId): array
    {
        $ids = [];
        foreach (['logoUrl', 'heroBannerImage'] as $field) {
            $value = $config[$field] ?? null;
            if (is_string($value)) {
                $id = self::assetId($value, $tenantId);
                if ($id !== null) {
                    $ids[] = $id;
                }
            }
        }

        sort($ids, SORT_STRING);

        return array_values(array_unique($ids));
    }

    private static function canonicalPath(string $path): string
    {
        do {
            $decoded = rawurldecode($path);
            if ($decoded === $path) {
                break;
            }

            $path = $decoded;
        } while (true);

        $segments = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }

            if ($segment === '..') {
                array_pop($segments);

                continue;
            }

            $segments[] = $segment;
        }

        return '/'.implode('/', $segments).(str_ends_with($path, '/') ? '/' : '');
    }
}
