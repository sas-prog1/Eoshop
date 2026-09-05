<?php

namespace App\Support;

final class PlatformIdentityImageUrl
{
    private const MANAGED_PATTERN = '#^/api/platform-assets/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$#D';

    public static function accepts(?string $value): bool
    {
        return $value === null || self::managedAssetId($value) !== null || PlatformLogoUrl::accepts($value);
    }

    public static function managedAssetId(?string $value): ?string
    {
        if (! is_string($value) || preg_match(self::MANAGED_PATTERN, $value, $matches) !== 1) {
            return null;
        }

        return $matches[1];
    }

    public static function url(string $assetId): string
    {
        return '/api/platform-assets/'.$assetId;
    }
}
