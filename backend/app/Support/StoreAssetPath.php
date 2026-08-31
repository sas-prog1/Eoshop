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

    public static function acceptsManaged(string $value, ?string $managedTenantId): bool
    {
        return $value === '' || ($managedTenantId !== null && self::assetId($value, $managedTenantId) !== null);
    }

    /** @param array<string, mixed> $config
     * @return list<string>
     */
    public static function referencedIds(array $config, string $tenantId): array
    {
        $ids = [];
        foreach (['logoUrl', 'heroBannerImage', 'heroBannerMobileImage', 'aboutImage'] as $field) {
            $value = $config[$field] ?? null;
            if (is_string($value)) {
                $id = self::assetId($value, $tenantId);
                if ($id !== null) {
                    $ids[] = $id;
                }
            }
        }
        foreach (is_array($config['marketingBlocks'] ?? null) ? $config['marketingBlocks'] : [] as $block) {
            if (! is_array($block)) {
                continue;
            }
            foreach (['imageUrl', 'mobileImageUrl'] as $field) {
                $value = $block[$field] ?? null;
                if (is_string($value)) {
                    $id = self::assetId($value, $tenantId);
                    if ($id !== null) {
                        $ids[] = $id;
                    }
                }
            }
        }

        sort($ids, SORT_STRING);

        return array_values(array_unique($ids));
    }

    /**
     * Returns the strictest byte budget for every managed asset referenced by a bounded placement.
     * The same asset may be reused, but must satisfy every placement that references it.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, int>
     */
    public static function referenceBudgets(array $config, string $tenantId): array
    {
        $budgets = [];
        self::addBudget($budgets, $config['heroBannerImage'] ?? null, $tenantId, 2 * 1024 * 1024);
        self::addBudget($budgets, $config['heroBannerMobileImage'] ?? null, $tenantId, 1024 * 1024);

        $placementBudgets = [
            'hero_bento' => ['imageUrl' => 750 * 1024, 'mobileImageUrl' => 500 * 1024],
            'side_ad' => ['imageUrl' => 1024 * 1024, 'mobileImageUrl' => 600 * 1024],
            'discovery' => ['imageUrl' => 350 * 1024, 'mobileImageUrl' => 350 * 1024],
            'editorial_story' => ['imageUrl' => 900 * 1024, 'mobileImageUrl' => 500 * 1024],
        ];
        foreach (is_array($config['marketingBlocks'] ?? null) ? $config['marketingBlocks'] : [] as $block) {
            if (! is_array($block) || ! isset($placementBudgets[$block['placement'] ?? ''])) {
                continue;
            }
            foreach ($placementBudgets[$block['placement']] as $field => $limit) {
                self::addBudget($budgets, $block[$field] ?? null, $tenantId, $limit);
            }
        }
        ksort($budgets, SORT_STRING);

        return $budgets;
    }

    /** @param array<string, int> $budgets */
    private static function addBudget(array &$budgets, mixed $value, string $tenantId, int $limit): void
    {
        if (! is_string($value)) {
            return;
        }
        $id = self::assetId($value, $tenantId);
        if ($id !== null) {
            $budgets[$id] = isset($budgets[$id]) ? min($budgets[$id], $limit) : $limit;
        }
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
