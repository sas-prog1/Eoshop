<?php

namespace App\Http\Resources;

use App\Models\PlatformSetting;
use App\Support\PlatformIdentityImageUrl;
use App\Support\PlatformLogoUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use RuntimeException;

/** @mixin PlatformSetting */
class PlatformSettingsResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $navigation = $this->navigationItems->sortBy('position')->values();
        $keys = $navigation->pluck('item_key')->sort()->values()->all();
        if ($navigation->count() !== 3 || $keys !== ['how_it_works', 'pricing', 'templates']) {
            throw new RuntimeException('The platform navigation invariant is incomplete.');
        }

        return [
            'revision' => (int) $this->revision,
            'platformName' => $this->platform_name,
            'tagline' => $this->tagline,
            'logoUrl' => is_string($this->logo_url) && PlatformLogoUrl::accepts($this->logo_url) ? $this->logo_url : null,
            'primaryColor' => $this->primary_color,
            'brandPrimaryColor' => $this->brand_primary_color,
            'brandAccentColor' => $this->brand_accent_color,
            'brandSurfaceColor' => $this->brand_surface_color,
            'brandFontFamily' => $this->brand_font_family,
            'landingHeroImageUrl' => is_string($this->landing_hero_image_url) && PlatformIdentityImageUrl::accepts($this->landing_hero_image_url) ? $this->landing_hero_image_url : null,
            'authImageUrl' => is_string($this->auth_image_url) && PlatformIdentityImageUrl::accepts($this->auth_image_url) ? $this->auth_image_url : null,
            'landingHeadline' => $this->landing_headline,
            'landingDescription' => $this->landing_description,
            'announcementEnabled' => (bool) $this->announcement_enabled,
            'announcementText' => $this->announcement_text,
            'supportEmail' => $this->support_email,
            'supportPhone' => $this->support_phone,
            'supportWhatsapp' => $this->support_whatsapp,
            'showHowItWorks' => (bool) $this->show_how_it_works,
            'showPricing' => (bool) $this->show_pricing,
            'storefrontAttributionEnabled' => (bool) $this->storefront_attribution_enabled,
            'storefrontAttributionText' => $this->storefront_attribution_text,
            'navigationItems' => $navigation->map(static fn ($item): array => [
                'key' => $item->item_key,
                'label' => $item->label,
                'isVisible' => (bool) $item->is_visible,
                'position' => (int) $item->position,
            ])->all(),
        ];
    }
}
