<?php

namespace App\Services;

use App\Enums\UserStatus;
use App\Exceptions\PlatformSettingsConflict;
use App\Models\PlatformNavigationItem;
use App\Models\PlatformSetting;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use RuntimeException;

class PlatformSettingsService
{
    public function __construct(
        private readonly AdminAuditService $audit,
        private readonly PlatformAssetService $assets,
    ) {}

    public function current(): PlatformSetting
    {
        $setting = PlatformSetting::query()
            ->with('navigationItems')
            ->whereKey(PlatformSetting::SINGLETON_ID)
            ->firstOrFail();
        $this->assertNavigation($setting);

        return $setting;
    }

    /** @param array<string, mixed> $payload */
    public function update(array $payload, User $actor, Request $request): PlatformSetting
    {
        $connection = DB::connection((string) config('tenancy.database.central_connection'));

        return $connection->transaction(function () use ($payload, $actor, $request): PlatformSetting {
            $lockedActor = User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->first();
            if (! $lockedActor instanceof User || $lockedActor->trashed()
                || $lockedActor->getAttribute('status') !== UserStatus::Active) {
                throw new AuthorizationException('The platform settings actor is no longer active.');
            }

            $setting = PlatformSetting::query()->whereKey(PlatformSetting::SINGLETON_ID)->lockForUpdate()->firstOrFail();
            $navigation = PlatformNavigationItem::query()
                ->where('platform_setting_id', PlatformSetting::SINGLETON_ID)
                ->orderBy('position')
                ->lockForUpdate()
                ->get();
            $setting->setRelation('navigationItems', $navigation);
            $this->assertNavigation($setting);
            Gate::forUser($lockedActor)->authorize('update', $setting);

            if ((int) $setting->revision !== (int) $payload['expectedRevision']) {
                throw new PlatformSettingsConflict;
            }

            $current = $this->snapshot($setting);
            $desired = $this->desiredSnapshot($payload);
            if ($current === $desired) {
                return $setting;
            }

            $this->assets->syncReferences(
                $current['landingHeroImageUrl'],
                $current['authImageUrl'],
                $desired['landingHeroImageUrl'],
                $desired['authImageUrl'],
            );

            $setting->fill([
                'revision' => (int) $setting->revision + 1,
                'platform_name' => $desired['platformName'],
                'tagline' => $desired['tagline'],
                'logo_url' => $desired['logoUrl'],
                'primary_color' => $desired['primaryColor'],
                'brand_primary_color' => $desired['brandPrimaryColor'],
                'brand_accent_color' => $desired['brandAccentColor'],
                'brand_surface_color' => $desired['brandSurfaceColor'],
                'brand_font_family' => $desired['brandFontFamily'],
                'landing_hero_image_url' => $desired['landingHeroImageUrl'],
                'auth_image_url' => $desired['authImageUrl'],
                'landing_headline' => $desired['landingHeadline'],
                'landing_description' => $desired['landingDescription'],
                'announcement_enabled' => $desired['announcementEnabled'],
                'announcement_text' => $desired['announcementText'],
                'support_email' => $desired['supportEmail'],
                'support_phone' => $desired['supportPhone'],
                'support_whatsapp' => $desired['supportWhatsapp'],
                'show_how_it_works' => $desired['showHowItWorks'],
                'show_pricing' => $desired['showPricing'],
                'storefront_attribution_enabled' => $desired['storefrontAttributionEnabled'],
                'storefront_attribution_text' => $desired['storefrontAttributionText'],
                'updated_by_user_id' => $lockedActor->getKey(),
            ])->save();

            PlatformNavigationItem::query()->where('platform_setting_id', PlatformSetting::SINGLETON_ID)->delete();
            PlatformNavigationItem::query()->insert(array_map(
                static fn (array $item): array => [
                    'platform_setting_id' => PlatformSetting::SINGLETON_ID,
                    'item_key' => $item['key'],
                    'label' => $item['label'],
                    'is_visible' => $item['isVisible'],
                    'position' => $item['position'],
                ],
                $desired['navigationItems'],
            ));

            $setting->refresh();
            $setting->setRelation('navigationItems', PlatformNavigationItem::query()
                ->where('platform_setting_id', PlatformSetting::SINGLETON_ID)
                ->orderBy('position')->get());
            $this->assertNavigation($setting);
            $this->audit->record(
                request: $request,
                actor: $lockedActor,
                action: 'platform.settings.updated',
                subject: $setting,
                tenant: null,
                oldValues: $current,
                newValues: $this->snapshot($setting),
            );

            return $setting;
        });
    }

    private function assertNavigation(PlatformSetting $setting): void
    {
        $items = $setting->navigationItems;
        if ($items->count() !== 3
            || $items->pluck('item_key')->sort()->values()->all() !== ['how_it_works', 'pricing', 'templates']
            || $items->pluck('position')->sort()->values()->all() !== [1, 2, 3]) {
            throw new RuntimeException('The platform navigation invariant is incomplete.');
        }
    }

    /** @return array<string, mixed> */
    private function snapshot(PlatformSetting $setting): array
    {
        return [
            'platformName' => (string) $setting->platform_name,
            'tagline' => $setting->tagline,
            'logoUrl' => $setting->logo_url,
            'primaryColor' => (string) $setting->primary_color,
            'brandPrimaryColor' => (string) $setting->brand_primary_color,
            'brandAccentColor' => (string) $setting->brand_accent_color,
            'brandSurfaceColor' => (string) $setting->brand_surface_color,
            'brandFontFamily' => (string) $setting->brand_font_family,
            'landingHeroImageUrl' => $setting->landing_hero_image_url,
            'authImageUrl' => $setting->auth_image_url,
            'landingHeadline' => (string) $setting->landing_headline,
            'landingDescription' => (string) $setting->landing_description,
            'announcementEnabled' => (bool) $setting->announcement_enabled,
            'announcementText' => $setting->announcement_text,
            'supportEmail' => $setting->support_email,
            'supportPhone' => $setting->support_phone,
            'supportWhatsapp' => $setting->support_whatsapp,
            'showHowItWorks' => (bool) $setting->show_how_it_works,
            'showPricing' => (bool) $setting->show_pricing,
            'storefrontAttributionEnabled' => (bool) $setting->storefront_attribution_enabled,
            'storefrontAttributionText' => $setting->storefront_attribution_text,
            'navigationItems' => $setting->navigationItems->sortBy('position')->values()->map(static fn ($item): array => [
                'key' => (string) $item->item_key,
                'label' => (string) $item->label,
                'isVisible' => (bool) $item->is_visible,
                'position' => (int) $item->position,
            ])->all(),
        ];
    }

    /** @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function desiredSnapshot(array $payload): array
    {
        $desired = $payload;
        unset($desired['expectedRevision']);
        usort($desired['navigationItems'], static fn (array $left, array $right): int => $left['position'] <=> $right['position']);

        return $desired;
    }
}
