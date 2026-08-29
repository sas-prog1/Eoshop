<?php

namespace Tests\Integration;

use App\Enums\DomainKind;
use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Models\AdminAuditLog;
use App\Models\PlatformSetting;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Services\PlatformSettingsService;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Mockery;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Tests\TestCase;

#[Group('database')]
class PlatformSettingsTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
    }

    public function test_public_projection_is_deterministic_safe_and_known_host_only(): void
    {
        $this->getJson('http://localhost/api/platform-settings')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.platformName', 'مبتكر')
            ->assertJsonPath('data.primaryColor', '#0284C7')
            ->assertJsonPath('data.brandPrimaryColor', '#081725')
            ->assertJsonPath('data.brandAccentColor', '#B18A46')
            ->assertJsonPath('data.brandSurfaceColor', '#F8F6F1')
            ->assertJsonPath('data.brandFontFamily', 'Tajawal')
            ->assertJsonPath('data.landingHeroImageUrl', null)
            ->assertJsonPath('data.authImageUrl', null)
            ->assertJsonPath('data.navigationItems.0.key', 'templates')
            ->assertJsonPath('data.navigationItems.2.key', 'pricing')
            ->assertJsonMissingPath('data.updatedAt')
            ->assertJsonMissingPath('data.updatedByUserId');

        $this->getJson('http://unknown.example.test/api/platform-settings')->assertNotFound();

        $pending = Tenant::query()->create([
            'id' => 'wp512-pending-host',
            'store_name' => 'Pending settings host',
            'owner_name' => 'Pending owner',
            'owner_email' => 'pending-settings@example.test',
            'business_type' => 'retail',
        ]);
        $pending->domains()->create([
            'domain' => 'settings-pending.example.test',
            'kind' => DomainKind::PublicSubdomain,
        ]);
        $this->getJson('http://settings-pending.example.test/api/platform-settings')->assertNotFound();

        PlatformSetting::query()->whereKey(1)->update(['logo_url' => 'data:image/svg+xml,unsafe']);
        $this->getJson('http://localhost/api/platform-settings')
            ->assertOk()
            ->assertJsonPath('data.logoUrl', null);
    }

    public function test_admin_read_and_write_are_permission_owned_and_closed(): void
    {
        $manager = $this->operator('settings-manager@example.test', SystemRole::PlatformSuperAdmin);
        $reviewer = $this->operator('settings-reviewer@example.test', SystemRole::PlatformReviewer);
        $merchant = $this->user('settings-merchant@example.test');

        $this->getJson('/api/admin/platform-settings')->assertUnauthorized();
        $this->actingAs($merchant)->getJson('/api/admin/platform-settings')->assertForbidden();
        $this->actingAs($reviewer)->getJson('/api/admin/platform-settings')->assertForbidden();
        $this->actingAs($reviewer)->putJson('/api/admin/platform-settings', [
            'logoUrl' => ['not-a-string'],
        ])->assertForbidden();
        $this->actingAs($manager)->getJson('/api/admin/platform-settings')
            ->assertOk()->assertJsonPath('data.revision', 1);

        $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
            ...$this->payload(),
            'secret' => 'must-not-be-accepted',
        ])->assertUnprocessable();
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
            ...$this->payload(),
            'logoUrl' => 'https://cdn.example.test/x/../api/%2573tore-assets/tenant/file',
        ])->assertUnprocessable()->assertJsonValidationErrors('logoUrl');
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
            ...$this->payload(),
            'logoUrl' => ['not-a-string'],
        ])->assertUnprocessable()->assertJsonValidationErrors('logoUrl');
        $deepPath = '/api/store-assets/tenant/file';
        for ($depth = 0; $depth < 9; $depth++) {
            $deepPath = rawurlencode($deepPath);
        }
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
            ...$this->payload(),
            'logoUrl' => 'https://cdn.example.test/'.$deepPath,
        ])->assertUnprocessable()->assertJsonValidationErrors('logoUrl');
        foreach ([
            'https://cdn.example.test/logo%zz.png',
            'https://cdn.example.test/logo%FF.png',
            'https://cdn.example.test/logo%25zz.png',
            'https://cdn.example.test/logo%2525zz.png',
            'https://cdn.example.test/logo%25FF.png',
        ] as $malformedLogoUrl) {
            $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
                ...$this->payload(),
                'logoUrl' => $malformedLogoUrl,
            ])->assertUnprocessable()->assertJsonValidationErrors('logoUrl');
        }
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
            ...$this->payload(),
            'brandFontFamily' => 'Remote Font',
        ])->assertUnprocessable()->assertJsonValidationErrors('brandFontFamily');
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
            ...$this->payload(),
            'brandAccentColor' => 'gold',
        ])->assertUnprocessable()->assertJsonValidationErrors('brandAccentColor');
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
            ...$this->payload(),
            'authImageUrl' => 'data:image/png;base64,unsafe',
        ])->assertUnprocessable()->assertJsonValidationErrors('authImageUrl');
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
            ...$this->payload(),
            'showPricing' => false,
        ])->assertUnprocessable()->assertJsonValidationErrors('navigationItems');
        $this->assertDatabaseHas('platform_settings', ['id' => 1, 'revision' => 1]);
        $this->assertDatabaseMissing('admin_audit_logs', ['action' => 'platform.settings.updated']);
    }

    public function test_real_update_is_atomic_audited_and_stale_write_fails_without_side_effects(): void
    {
        $manager = $this->operator('settings-update@example.test', SystemRole::PlatformSuperAdmin);
        $payload = [
            ...$this->payload(),
            'platformName' => 'متاجر اليمن',
            'primaryColor' => '#0F766E',
            'brandPrimaryColor' => '#102A43',
            'brandAccentColor' => '#C79A43',
            'brandSurfaceColor' => '#FAF7F0',
            'brandFontFamily' => 'IBM Plex Sans Arabic',
            'landingHeroImageUrl' => 'https://cdn.example.test/platform/landing.jpg',
            'authImageUrl' => 'https://cdn.example.test/platform/auth.jpg',
            'announcementEnabled' => true,
            'announcementText' => 'مرحبًا بكم في النسخة التجريبية.',
            'supportEmail' => ' SUPPORT@EXAMPLE.TEST ',
        ];

        $this->actingAs($manager)->putJson('/api/admin/platform-settings', $payload)
            ->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.platformName', 'متاجر اليمن')
            ->assertJsonPath('data.brandPrimaryColor', '#102A43')
            ->assertJsonPath('data.brandFontFamily', 'IBM Plex Sans Arabic')
            ->assertJsonPath('data.authImageUrl', 'https://cdn.example.test/platform/auth.jpg')
            ->assertJsonPath('data.supportEmail', 'support@example.test')
            ->assertJsonPath('data.updatedByUserId', $manager->id);
        $this->assertDatabaseHas('platform_settings', [
            'id' => 1,
            'revision' => 2,
            'platform_name' => 'متاجر اليمن',
            'brand_primary_color' => '#102A43',
            'brand_font_family' => 'IBM Plex Sans Arabic',
            'updated_by_user_id' => $manager->id,
        ]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'platform.settings.updated',
            'actor_user_id' => $manager->id,
            'subject_type' => PlatformSetting::class,
            'subject_id' => '1',
        ]);

        $auditCount = AdminAuditLog::query()->where('action', 'platform.settings.updated')->count();
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', $payload)
            ->assertConflict()->assertJsonPath('code', 'platform_settings_revision_conflict');
        $this->assertSame($auditCount, AdminAuditLog::query()->where('action', 'platform.settings.updated')->count());
        $this->assertSame('متاجر اليمن', PlatformSetting::query()->findOrFail(1)->platform_name);
    }

    public function test_exact_noop_keeps_revision_and_writes_no_audit(): void
    {
        $manager = $this->operator('settings-noop@example.test', SystemRole::PlatformSuperAdmin);

        $this->actingAs($manager)->putJson('/api/admin/platform-settings', $this->payload())
            ->assertOk()->assertJsonPath('data.revision', 1);
        $this->assertDatabaseMissing('admin_audit_logs', ['action' => 'platform.settings.updated']);
    }

    public function test_service_rechecks_actor_status_inside_the_locked_transaction(): void
    {
        $manager = $this->operator('settings-suspended@example.test', SystemRole::PlatformSuperAdmin);
        $manager->forceFill(['status' => UserStatus::Suspended])->save();

        try {
            app(PlatformSettingsService::class)->update(
                [...$this->payload(), 'platformName' => 'لا يجب حفظه'],
                $manager,
                Request::create('/api/admin/platform-settings', 'PUT'),
            );
            $this->fail('A suspended actor must fail closed under the central lock.');
        } catch (AuthorizationException) {
            $this->assertSame(1, PlatformSetting::query()->findOrFail(1)->revision);
            $this->assertDatabaseMissing('admin_audit_logs', ['action' => 'platform.settings.updated']);
        }
    }

    public function test_populated_platform_settings_migration_refuses_destructive_rollback(): void
    {
        PlatformSetting::query()->whereKey(1)->update(['platform_name' => 'هوية تشغيلية']);
        $migration = require database_path('migrations/system/2026_08_22_000012_create_platform_settings.php');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('cannot be removed safely');
        $migration->down();
    }

    public function test_changed_visual_identity_refuses_destructive_rollback(): void
    {
        PlatformSetting::query()->whereKey(1)->update(['auth_image_url' => 'https://cdn.example.test/platform/auth.jpg']);
        $migration = require database_path('migrations/system/2026_08_28_000015_add_platform_visual_identity.php');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('auth_image_url has changed and cannot be removed safely');
        $migration->down();
    }

    public function test_database_rejects_invalid_visual_identity_color(): void
    {
        $this->expectException(QueryException::class);
        DB::table('platform_settings')->where('id', 1)->update(['brand_primary_color' => '#xyzxyz']);
    }

    public function test_database_rejects_unapproved_visual_identity_font(): void
    {
        $this->expectException(QueryException::class);
        DB::table('platform_settings')->where('id', 1)->update(['brand_font_family' => 'Remote Font']);
    }

    public function test_changed_navigation_refuses_destructive_rollback(): void
    {
        DB::table('platform_navigation_items')->where('item_key', 'pricing')->update(['label' => 'تسعير تشغيلي']);
        $migration = require database_path('migrations/system/2026_08_22_000012_create_platform_settings.php');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('platform navigation has changed');
        $migration->down();
    }

    public function test_unexpected_settings_permission_assignment_refuses_destructive_rollback(): void
    {
        $permissionId = DB::table('permissions')->where('key', PermissionKey::PlatformSettingsManage->value)->value('id');
        $reviewerRoleId = DB::table('roles')->where('key', SystemRole::PlatformReviewer->value)->value('id');
        DB::table('permission_role')->insert([
            'permission_id' => $permissionId,
            'role_id' => $reviewerRoleId,
            'scope' => RoleScope::Platform->value,
        ]);
        $migration = require database_path('migrations/system/2026_08_22_000012_create_platform_settings.php');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('assigned outside the system super-admin role');
        $migration->down();
    }

    public function test_audit_failure_rolls_back_settings_and_navigation(): void
    {
        $manager = $this->operator('settings-audit-failure@example.test', SystemRole::PlatformSuperAdmin);
        $audit = Mockery::mock(AdminAuditService::class);
        $audit->shouldReceive('record')->once()->andThrow(new RuntimeException('audit unavailable'));
        $this->app->instance(AdminAuditService::class, $audit);
        $this->withoutExceptionHandling();

        try {
            $this->actingAs($manager)->putJson('/api/admin/platform-settings', [
                ...$this->payload(),
                'platformName' => 'اسم يجب أن يتراجع',
                'navigationItems' => [
                    ['key' => 'pricing', 'label' => 'الأسعار', 'isVisible' => true, 'position' => 1],
                    ['key' => 'templates', 'label' => 'القوالب', 'isVisible' => true, 'position' => 2],
                    ['key' => 'how_it_works', 'label' => 'كيف تعمل؟', 'isVisible' => true, 'position' => 3],
                ],
            ]);
            $this->fail('The audit failure should escape the request.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit unavailable', $exception->getMessage());
        }

        $setting = PlatformSetting::query()->with('navigationItems')->findOrFail(1);
        $this->assertSame(1, $setting->revision);
        $this->assertSame('مبتكر', $setting->platform_name);
        $this->assertSame(['templates', 'how_it_works', 'pricing'], $setting->navigationItems->pluck('item_key')->all());
    }

    public function test_database_constraints_reject_incomplete_navigation_and_invalid_singleton_values(): void
    {
        $connection = DB::connection((string) config('tenancy.database.central_connection'));

        $connection->statement('SAVEPOINT platform_settings_constraint');
        try {
            $connection->table('platform_navigation_items')->where('item_key', 'pricing')->delete();
            $connection->statement('SET CONSTRAINTS platform_navigation_complete IMMEDIATE');
            $this->fail('The deferred exact-three constraint should reject a missing item.');
        } catch (QueryException) {
            $connection->statement('ROLLBACK TO SAVEPOINT platform_settings_constraint');
            $connection->statement('SET CONSTRAINTS platform_navigation_complete DEFERRED');
        }

        $this->expectException(QueryException::class);
        $connection->table('platform_settings')->where('id', 1)->update(['revision' => 0]);
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        return [
            'expectedRevision' => 1,
            'platformName' => 'مبتكر',
            'tagline' => 'منصة المتاجر الرقمية',
            'logoUrl' => null,
            'primaryColor' => '#0284C7',
            'brandPrimaryColor' => '#081725',
            'brandAccentColor' => '#B18A46',
            'brandSurfaceColor' => '#F8F6F1',
            'brandFontFamily' => 'Tajawal',
            'landingHeroImageUrl' => null,
            'authImageUrl' => null,
            'landingHeadline' => 'أنشئ متجرك الإلكتروني بذكاء وسرعة',
            'landingDescription' => 'صمم هوية متجرك واختر قالبًا قابلًا للتخصيص، ثم أرسل طلبك للمراجعة والتجهيز قبل النشر.',
            'announcementEnabled' => false,
            'announcementText' => null,
            'supportEmail' => null,
            'supportPhone' => null,
            'supportWhatsapp' => null,
            'showHowItWorks' => true,
            'showPricing' => true,
            'storefrontAttributionEnabled' => true,
            'storefrontAttributionText' => 'متجر إلكتروني مدعوم من منصة مبتكر.',
            'navigationItems' => [
                ['key' => 'templates', 'label' => 'القوالب', 'isVisible' => true, 'position' => 1],
                ['key' => 'how_it_works', 'label' => 'كيف تعمل المنصة؟', 'isVisible' => true, 'position' => 2],
                ['key' => 'pricing', 'label' => 'الباقات والأسعار', 'isVisible' => true, 'position' => 3],
            ],
        ];
    }

    private function user(string $email): User
    {
        return User::query()->create([
            'name' => 'Platform Settings User',
            'email' => $email,
            'status' => UserStatus::Active,
        ]);
    }

    private function operator(string $email, SystemRole $role): User
    {
        $user = $this->user($email);
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', $role->value)->where('scope', RoleScope::Platform)->firstOrFail(),
            $user,
        );

        return $user;
    }
}
