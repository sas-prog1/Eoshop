<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class PlatformSetting extends Model
{
    use CentralConnection;

    public const SINGLETON_ID = 1;

    protected $fillable = [
        'revision',
        'platform_name',
        'tagline',
        'logo_url',
        'primary_color',
        'brand_primary_color',
        'brand_accent_color',
        'brand_surface_color',
        'brand_font_family',
        'landing_hero_image_url',
        'auth_image_url',
        'landing_headline',
        'landing_description',
        'announcement_enabled',
        'announcement_text',
        'support_email',
        'support_phone',
        'support_whatsapp',
        'show_how_it_works',
        'show_pricing',
        'storefront_attribution_enabled',
        'storefront_attribution_text',
        'updated_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'revision' => 'integer',
            'announcement_enabled' => 'boolean',
            'show_how_it_works' => 'boolean',
            'show_pricing' => 'boolean',
            'storefront_attribution_enabled' => 'boolean',
        ];
    }

    /** @return HasMany<PlatformNavigationItem, $this> */
    public function navigationItems(): HasMany
    {
        return $this->hasMany(PlatformNavigationItem::class, 'platform_setting_id')->orderBy('position');
    }
}
