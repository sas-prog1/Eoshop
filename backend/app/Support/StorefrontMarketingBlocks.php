<?php

namespace App\Support;

use App\Exceptions\StoreWorkspaceConflict;
use App\Exceptions\StoreWorkspaceValidation;
use DateTimeImmutable;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class StorefrontMarketingBlocks
{
    /** @var array<string, int> */
    public const PLACEMENT_LIMITS = [
        'hero_bento' => 5,
        'side_ad' => 2,
        'discovery' => 10,
    ];

    /** @return list<string> */
    public static function keys(): array
    {
        return [
            'id', 'placement', 'position', 'enabled', 'contentType', 'title', 'subtitle', 'badge',
            'ctaLabel', 'imageUrl', 'mobileImageUrl', 'altText', 'backgroundColor', 'textColor',
            'overlayOpacity', 'focalPointX', 'focalPointY', 'targetType', 'targetValue', 'disclosure',
            'sponsorName', 'startsAt', 'endsAt',
        ];
    }

    /** @return array<string, list<mixed>> */
    public static function rules(?string $tenantId, string $prefix = 'config.'): array
    {
        $base = $prefix.'marketingBlocks';
        $managedPath = self::managedPathRule($tenantId);

        return [
            $prefix.'heroBannerMobileImage' => ['nullable', 'string', 'max:2048', $managedPath],
            $prefix.'heroBannerTargetType' => ['nullable', Rule::in(['products', 'category', 'product'])],
            $prefix.'heroBannerTargetValue' => ['nullable', 'string', 'max:255'],
            $prefix.'heroBannerFocalPointX' => ['nullable', 'integer', 'min:0', 'max:100'],
            $prefix.'heroBannerFocalPointY' => ['nullable', 'integer', 'min:0', 'max:100'],
            $base => ['sometimes', 'array', 'max:17'],
            $base.'.*' => ['required', 'array:'.implode(',', self::keys())],
            $base.'.*.id' => ['required', 'uuid', 'distinct:strict'],
            $base.'.*.placement' => ['required', Rule::in(array_keys(self::PLACEMENT_LIMITS))],
            $base.'.*.position' => ['required', 'integer', 'min:1', 'max:10'],
            $base.'.*.enabled' => ['required', 'boolean'],
            $base.'.*.contentType' => ['required', Rule::in(['category', 'product', 'campaign'])],
            $base.'.*.title' => ['required', 'string', 'min:2', 'max:80'],
            $base.'.*.subtitle' => ['nullable', 'string', 'max:180'],
            $base.'.*.badge' => ['nullable', 'string', 'max:40'],
            $base.'.*.ctaLabel' => ['required', 'string', 'min:2', 'max:40'],
            $base.'.*.imageUrl' => ['required', 'string', 'max:2048', $managedPath],
            $base.'.*.mobileImageUrl' => ['nullable', 'string', 'max:2048', $managedPath],
            $base.'.*.altText' => ['required', 'string', 'min:2', 'max:160'],
            $base.'.*.backgroundColor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            $base.'.*.textColor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            $base.'.*.overlayOpacity' => ['nullable', 'integer', 'min:0', 'max:100'],
            $base.'.*.focalPointX' => ['nullable', 'integer', 'min:0', 'max:100'],
            $base.'.*.focalPointY' => ['nullable', 'integer', 'min:0', 'max:100'],
            $base.'.*.targetType' => ['required', Rule::in(['products', 'category', 'product', 'external'])],
            $base.'.*.targetValue' => ['nullable', 'string', 'max:2048'],
            $base.'.*.disclosure' => ['required', Rule::in(['none', 'ad', 'sponsored'])],
            $base.'.*.sponsorName' => ['nullable', 'string', 'max:80'],
            $base.'.*.startsAt' => ['nullable', 'string', 'max:40'],
            $base.'.*.endsAt' => ['nullable', 'string', 'max:40'],
        ];
    }

    /** @param array<string, mixed> $config */
    public static function appendErrors(
        Validator $validator,
        array $config,
        array $products = [],
        array $archiveProductIds = [],
        bool $validateCatalogTargets = true,
    ): void {
        self::appendHeroTargetErrors($validator, $config, $products, $archiveProductIds, $validateCatalogTargets);
        $blocks = $config['marketingBlocks'] ?? null;
        if (! is_array($blocks)) {
            return;
        }
        if (! array_is_list($blocks)) {
            $validator->errors()->add('config.marketingBlocks', 'The marketing blocks must be a JSON list.');

            return;
        }

        $byPlacement = [];
        foreach ($blocks as $index => $block) {
            if (! is_array($block)) {
                continue;
            }
            $placement = $block['placement'] ?? null;
            if (is_string($placement) && array_key_exists($placement, self::PLACEMENT_LIMITS)) {
                $byPlacement[$placement][] = $block['position'] ?? null;
            }
            self::appendBlockErrors($validator, $block, $index, $products, $archiveProductIds, $validateCatalogTargets);
        }

        foreach (self::PLACEMENT_LIMITS as $placement => $limit) {
            $positions = $byPlacement[$placement] ?? [];
            if (count($positions) > $limit) {
                $validator->errors()->add('config.marketingBlocks', "The {$placement} placement may contain at most {$limit} blocks.");

                continue;
            }
            sort($positions, SORT_NUMERIC);
            if ($positions !== [] && $positions !== range(1, count($positions))) {
                $validator->errors()->add('config.marketingBlocks', "The {$placement} positions must be unique and contiguous from 1.");
            }
        }
    }

    /** @param array<string, mixed> $config */
    public static function forProvisioning(array $config): array
    {
        $config['marketingBlocks'] = [];

        return $config;
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>  $current
     * @param  list<array<string, mixed>>  $products
     * @param  list<string>  $archiveProductIds
     * @return array<string, mixed>
     */
    public static function forWrite(
        array $incoming,
        array $current,
        string $tenantId,
        array $products,
        array $archiveProductIds,
    ): array {
        $currentHasBlocks = array_key_exists('marketingBlocks', $current);
        if ($currentHasBlocks && ! self::isValid($current, $tenantId, [], [], false)) {
            throw new StoreWorkspaceConflict(
                'The stored storefront marketing block contract is invalid.',
                'workspace_marketing_blocks_invalid',
            );
        }
        if (! array_key_exists('marketingBlocks', $incoming)) {
            if ($currentHasBlocks) {
                throw new StoreWorkspaceValidation(
                    'The client must preserve the current storefront marketing blocks.',
                    'workspace_marketing_blocks_required',
                );
            }
            $incoming['marketingBlocks'] = [];
        }
        if (! self::isValid($incoming, $tenantId, $products, $archiveProductIds, true)) {
            throw new StoreWorkspaceValidation(
                'The submitted storefront marketing blocks are invalid.',
                'workspace_marketing_blocks_invalid',
            );
        }

        return $incoming;
    }

    /**
     * @param  array<string, mixed>  $config
     * @param  list<array<string, mixed>>  $products
     * @return array<string, mixed>
     */
    public static function forProjection(array $config, string $tenantId, array $products, bool $public): array
    {
        if (! array_key_exists('marketingBlocks', $config)) {
            $config['marketingBlocks'] = [];

            return $config;
        }
        if (! self::isValid($config, $tenantId, [], [], false)) {
            throw new StoreWorkspaceConflict(
                'The stored storefront marketing block contract is invalid.',
                'workspace_marketing_blocks_invalid',
            );
        }
        if ($public) {
            $config['marketingBlocks'] = array_values(array_filter(
                $config['marketingBlocks'],
                static fn (array $block): bool => self::isPubliclyVisible($block, $products),
            ));
            if (! self::catalogTargetExists(
                $config['heroBannerTargetType'] ?? 'products',
                trim((string) ($config['heroBannerTargetValue'] ?? '')),
                $products,
                [],
                true,
            )) {
                $config['heroBannerTargetType'] = 'products';
                unset($config['heroBannerTargetValue']);
            }
        }

        return $config;
    }

    /** @param array<string, mixed> $config */
    private static function isValid(
        array $config,
        string $tenantId,
        array $products,
        array $archiveProductIds,
        bool $validateCatalogTargets,
    ): bool {
        $validator = ValidatorFacade::make(
            ['config' => $config],
            self::rules($tenantId),
        );
        $validator->after(static function (Validator $validator) use ($config, $products, $archiveProductIds, $validateCatalogTargets): void {
            self::appendErrors($validator, $config, $products, $archiveProductIds, $validateCatalogTargets);
        });

        return ! $validator->fails();
    }

    private static function appendBlockErrors(
        Validator $validator,
        array $block,
        int $index,
        array $products,
        array $archiveProductIds,
        bool $validateCatalogTargets,
    ): void {
        $path = "config.marketingBlocks.{$index}";
        $targetType = $block['targetType'] ?? null;
        $targetValue = is_string($block['targetValue'] ?? null) ? trim($block['targetValue']) : '';
        foreach (['title' => [2, 80], 'ctaLabel' => [2, 40], 'altText' => [2, 160]] as $field => [$min, $max]) {
            $length = mb_strlen(trim((string) ($block[$field] ?? '')));
            if ($length < $min || $length > $max) {
                $validator->errors()->add($path.'.'.$field, "The {$field} length is invalid after trimming.");
            }
        }
        if ($targetType === 'products' && $targetValue !== '') {
            $validator->errors()->add($path.'.targetValue', 'The products target must not have a target value.');
        }
        if (in_array($targetType, ['category', 'product', 'external'], true) && $targetValue === '') {
            $validator->errors()->add($path.'.targetValue', 'The selected target requires a target value.');
        }
        if ($targetType === 'product' && $targetValue !== '' && ! Str::isUuid($targetValue)) {
            $validator->errors()->add($path.'.targetValue', 'Product targets must use a UUID.');
        }
        if ($targetType === 'external') {
            if (($block['contentType'] ?? null) !== 'campaign') {
                $validator->errors()->add($path.'.contentType', 'External targets are allowed only for campaign blocks.');
            }
            if (! self::isSafeHttpsUrl($targetValue)) {
                $validator->errors()->add($path.'.targetValue', 'External targets must be safe HTTPS URLs without credentials.');
            }
            if (($block['disclosure'] ?? null) === 'none' || trim((string) ($block['sponsorName'] ?? '')) === '') {
                $validator->errors()->add($path.'.disclosure', 'External campaigns require an advertising disclosure and sponsor name.');
            }
        }
        if (in_array($block['disclosure'] ?? null, ['ad', 'sponsored'], true)
            && trim((string) ($block['sponsorName'] ?? '')) === '') {
            $validator->errors()->add($path.'.sponsorName', 'Advertising disclosures require a sponsor name.');
        }

        $startsAt = self::date($block['startsAt'] ?? null);
        $endsAt = self::date($block['endsAt'] ?? null);
        if (($block['startsAt'] ?? null) !== null && $startsAt === null) {
            $validator->errors()->add($path.'.startsAt', 'The schedule must be an RFC3339 timestamp with a timezone.');
        }
        if (($block['endsAt'] ?? null) !== null && $endsAt === null) {
            $validator->errors()->add($path.'.endsAt', 'The schedule must be an RFC3339 timestamp with a timezone.');
        }
        if ($startsAt !== null && $endsAt !== null && $startsAt >= $endsAt) {
            $validator->errors()->add($path.'.endsAt', 'The end time must be later than the start time.');
        }

        if (! $validateCatalogTargets || ! in_array($targetType, ['product', 'category'], true)) {
            return;
        }
        if (! self::catalogTargetExists($targetType, $targetValue, $products, $archiveProductIds, false)) {
            $validator->errors()->add($path.'.targetValue', 'The target must resolve to a non-archived submitted catalog item.');
        }
    }

    private static function appendHeroTargetErrors(
        Validator $validator,
        array $config,
        array $products,
        array $archiveProductIds,
        bool $validateCatalogTargets,
    ): void {
        $type = $config['heroBannerTargetType'] ?? null;
        $value = trim((string) ($config['heroBannerTargetValue'] ?? ''));
        if (($type === null || $type === 'products') && $value !== '') {
            $validator->errors()->add('config.heroBannerTargetValue', 'The products hero target must not have a target value.');
        }
        if (in_array($type, ['category', 'product'], true) && $value === '') {
            $validator->errors()->add('config.heroBannerTargetValue', 'The selected hero target requires a target value.');
        }
        if ($type === 'product' && $value !== '' && ! Str::isUuid($value)) {
            $validator->errors()->add('config.heroBannerTargetValue', 'Product hero targets must use a UUID.');
        }
        if ($validateCatalogTargets && in_array($type, ['category', 'product'], true)
            && ! self::catalogTargetExists($type, $value, $products, $archiveProductIds, false)) {
            $validator->errors()->add('config.heroBannerTargetValue', 'The hero target must resolve to a non-archived submitted catalog item.');
        }
    }

    private static function catalogTargetExists(
        mixed $targetType,
        string $targetValue,
        array $products,
        array $archiveProductIds,
        bool $publishedOnly,
    ): bool {
        if (! in_array($targetType, ['product', 'category'], true)) {
            return true;
        }
        $archiveLookup = array_fill_keys($archiveProductIds, true);
        foreach ($products as $product) {
            if (! is_array($product) || ($product['status'] ?? 'published') === 'archived'
                || ($publishedOnly && ($product['status'] ?? 'published') !== 'published')
                || isset($archiveLookup[(string) ($product['id'] ?? '')])) {
                continue;
            }
            if (($targetType === 'product' && (string) ($product['id'] ?? '') === $targetValue)
                || ($targetType === 'category' && trim((string) ($product['category'] ?? '')) === $targetValue)) {
                return true;
            }
        }

        return false;
    }

    /** @param list<array<string, mixed>> $products */
    private static function isPubliclyVisible(array $block, array $products): bool
    {
        if (($block['enabled'] ?? false) !== true) {
            return false;
        }
        $now = new DateTimeImmutable('now');
        $startsAt = self::date($block['startsAt'] ?? null);
        $endsAt = self::date($block['endsAt'] ?? null);
        if (($startsAt !== null && $startsAt > $now) || ($endsAt !== null && $endsAt <= $now)) {
            return false;
        }
        $targetType = $block['targetType'] ?? null;
        $targetValue = trim((string) ($block['targetValue'] ?? ''));
        if (! in_array($targetType, ['product', 'category'], true)) {
            return true;
        }
        foreach ($products as $product) {
            if (($product['status'] ?? 'published') !== 'published') {
                continue;
            }
            if (($targetType === 'product' && (string) ($product['id'] ?? '') === $targetValue)
                || ($targetType === 'category' && trim((string) ($product['category'] ?? '')) === $targetValue)) {
                return true;
            }
        }

        return false;
    }

    private static function isSafeHttpsUrl(string $value): bool
    {
        if ($value === '' || strlen($value) > 2048 || str_contains($value, '\\')
            || preg_match('/[\x00-\x1F\x7F]/', $value) === 1 || filter_var($value, FILTER_VALIDATE_URL) === false) {
            return false;
        }
        $parts = parse_url($value);

        return is_array($parts) && mb_strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && trim((string) ($parts['host'] ?? '')) !== ''
            && ! isset($parts['user']) && ! isset($parts['pass']);
    }

    private static function date(mixed $value): ?DateTimeImmutable
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/', $value) !== 1) {
            return null;
        }
        try {
            $date = new DateTimeImmutable($value);

            return $date->getOffset() === 0 ? $date : null;
        } catch (\Exception) {
            return null;
        }
    }

    private static function managedPathRule(?string $tenantId): \Closure
    {
        return static function (string $attribute, mixed $value, \Closure $fail) use ($tenantId): void {
            if (! is_string($value) || ! StoreAssetPath::acceptsManaged($value, $tenantId)) {
                $fail('The '.$attribute.' field must be an exact same-store managed asset path.');
            }
        };
    }
}
