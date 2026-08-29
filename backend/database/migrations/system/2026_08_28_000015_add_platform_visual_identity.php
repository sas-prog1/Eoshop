<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, string|null> */
    private const DEFAULTS = [
        'brand_primary_color' => '#081725',
        'brand_accent_color' => '#B18A46',
        'brand_surface_color' => '#F8F6F1',
        'brand_font_family' => 'Tajawal',
        'landing_hero_image_url' => null,
        'auth_image_url' => null,
    ];

    public function up(): void
    {
        Schema::table('platform_settings', function (Blueprint $table): void {
            $table->char('brand_primary_color', 7)->default('#081725');
            $table->char('brand_accent_color', 7)->default('#B18A46');
            $table->char('brand_surface_color', 7)->default('#F8F6F1');
            $table->string('brand_font_family', 32)->default('Tajawal');
            $table->string('landing_hero_image_url', 2048)->nullable();
            $table->string('auth_image_url', 2048)->nullable();
        });

        DB::statement("ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_brand_primary_color CHECK (brand_primary_color ~ '^#[0-9A-F]{6}$')");
        DB::statement("ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_brand_accent_color CHECK (brand_accent_color ~ '^#[0-9A-F]{6}$')");
        DB::statement("ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_brand_surface_color CHECK (brand_surface_color ~ '^#[0-9A-F]{6}$')");
        DB::statement("ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_brand_font_family CHECK (brand_font_family IN ('Cairo', 'Tajawal', 'IBM Plex Sans Arabic'))");
    }

    public function down(): void
    {
        $settings = DB::table('platform_settings')->where('id', 1)->first(array_keys(self::DEFAULTS));
        if ($settings === null) {
            throw new RuntimeException('The platform settings singleton is missing and visual identity cannot be rolled back safely.');
        }
        foreach (self::DEFAULTS as $column => $expected) {
            if ($settings->{$column} !== $expected) {
                throw new RuntimeException("Platform visual identity {$column} has changed and cannot be removed safely.");
            }
        }

        DB::statement('ALTER TABLE platform_settings DROP CONSTRAINT platform_settings_brand_primary_color');
        DB::statement('ALTER TABLE platform_settings DROP CONSTRAINT platform_settings_brand_accent_color');
        DB::statement('ALTER TABLE platform_settings DROP CONSTRAINT platform_settings_brand_surface_color');
        DB::statement('ALTER TABLE platform_settings DROP CONSTRAINT platform_settings_brand_font_family');
        Schema::table('platform_settings', function (Blueprint $table): void {
            $table->dropColumn(array_keys(self::DEFAULTS));
        });
    }
};
