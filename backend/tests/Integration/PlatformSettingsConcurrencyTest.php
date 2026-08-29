<?php

namespace Tests\Integration;

use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Exceptions\PlatformSettingsConflict;
use App\Models\PlatformSetting;
use App\Models\Role;
use App\Models\User;
use App\Services\PlatformSettingsService;
use App\Services\PlatformUserLifecycleService;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;
use Throwable;

#[Group('database')]
class PlatformSettingsConcurrencyTest extends TestCase
{
    /** @var list<string> */
    private array $userIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
    }

    protected function tearDown(): void
    {
        $centralName = (string) config('tenancy.database.central_connection');
        DB::purge($centralName);
        $central = DB::connection($centralName);
        if ($this->userIds !== []) {
            $central->table('admin_audit_logs')->where(function ($query): void {
                $query->whereIn('actor_user_id', $this->userIds)
                    ->orWhereIn('subject_id', $this->userIds);
            })->delete();
        }
        $central->table('platform_settings')->where('id', PlatformSetting::SINGLETON_ID)->update([
            'revision' => 1,
            'platform_name' => 'مبتكر',
            'updated_by_user_id' => null,
            'updated_at' => now(),
        ]);
        if ($this->userIds !== []) {
            $central->table('role_user')->whereIn('user_id', $this->userIds)->delete();
            $central->table('users')->whereIn('id', $this->userIds)->delete();
        }

        parent::tearDown();
    }

    public function test_two_writers_from_one_revision_have_one_winner_and_one_conflict(): void
    {
        $first = $this->operator('settings-concurrent-a@example.test');
        $second = $this->operator('settings-concurrent-b@example.test');

        $outcomes = $this->runConcurrent([
            fn () => app(PlatformSettingsService::class)->update(
                [...$this->payload(), 'platformName' => 'هوية الكاتب الأول'],
                $first,
                Request::create('/api/admin/platform-settings', 'PUT'),
            ),
            fn () => app(PlatformSettingsService::class)->update(
                [...$this->payload(), 'platformName' => 'هوية الكاتب الثاني'],
                $second,
                Request::create('/api/admin/platform-settings', 'PUT'),
            ),
        ]);

        $this->assertSame(['conflict', 'ok'], collect($outcomes)->sort()->values()->all());
        $setting = PlatformSetting::query()->findOrFail(PlatformSetting::SINGLETON_ID);
        $this->assertSame(2, $setting->revision);
        $this->assertContains($setting->platform_name, ['هوية الكاتب الأول', 'هوية الكاتب الثاني']);
        $this->assertSame(1, DB::table('admin_audit_logs')->where('action', 'platform.settings.updated')->count());
    }

    public function test_settings_write_and_actor_suspension_serialize_on_the_actor_row(): void
    {
        $writer = $this->operator('settings-status-writer@example.test');
        $manager = $this->operator('settings-status-manager@example.test');

        $outcomes = $this->runConcurrent([
            fn () => app(PlatformSettingsService::class)->update(
                [...$this->payload(), 'platformName' => 'هوية قبل التعليق'],
                $writer,
                Request::create('/api/admin/platform-settings', 'PUT'),
            ),
            fn () => app(PlatformUserLifecycleService::class)->changeStatus(
                $writer,
                UserStatus::Active,
                UserStatus::Suspended,
                $manager,
                Request::create('/api/admin/users/status', 'PATCH'),
            ),
        ]);

        $this->assertContains(collect($outcomes)->sort()->values()->all(), [
            ['ok', 'ok'],
            ['forbidden', 'ok'],
        ]);
        $this->assertSame(UserStatus::Suspended, $writer->fresh()->status);
        $setting = PlatformSetting::query()->findOrFail(PlatformSetting::SINGLETON_ID);
        $this->assertContains($setting->revision, [1, 2]);
        if ($setting->revision === 1) {
            $this->assertSame('مبتكر', $setting->platform_name);
        } else {
            $this->assertSame('هوية قبل التعليق', $setting->platform_name);
        }
    }

    /**
     * @param  list<callable(): mixed>  $operations
     * @return list<string>
     */
    private function runConcurrent(array $operations): array
    {
        if (! function_exists('pcntl_fork') || ! function_exists('stream_socket_pair')) {
            $this->fail('The database gate requires pcntl and socket pairs for platform settings concurrency.');
        }

        $workers = [];
        foreach ($operations as $operation) {
            $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            if ($sockets === false) {
                $this->fail('Unable to create the platform settings concurrency barrier.');
            }
            [$parentSocket, $childSocket] = $sockets;
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('Unable to fork a platform settings worker.');
            }
            if ($pid === 0) {
                fclose($parentSocket);
                fread($childSocket, 1);
                try {
                    $central = (string) config('tenancy.database.central_connection');
                    DB::purge('tenant');
                    DB::purge($central);
                    DB::setDefaultConnection($central);
                    $operation();
                    $result = 'ok';
                } catch (PlatformSettingsConflict) {
                    $result = 'conflict';
                } catch (AuthorizationException) {
                    $result = 'forbidden';
                } catch (Throwable $exception) {
                    $result = 'error:'.$exception::class.':'.$exception->getMessage();
                }
                fwrite($childSocket, $result);
                fclose($childSocket);
                exit(0);
            }
            fclose($childSocket);
            $workers[] = ['pid' => $pid, 'socket' => $parentSocket];
        }

        foreach ($workers as $worker) {
            fwrite($worker['socket'], '1');
        }

        $results = [];
        foreach ($workers as $worker) {
            $result = (string) stream_get_contents($worker['socket']);
            fclose($worker['socket']);
            pcntl_waitpid($worker['pid'], $status);
            $this->assertTrue(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
            $this->assertFalse(str_starts_with($result, 'error:'), $result);
            $results[] = $result;
        }
        DB::purge((string) config('tenancy.database.central_connection'));

        return $results;
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

    private function operator(string $email): User
    {
        $user = User::query()->create([
            'name' => 'Concurrent Settings Operator',
            'email' => $email,
            'password' => 'secure-platform-pass-123',
            'status' => UserStatus::Active,
        ]);
        $this->userIds[] = (string) $user->getKey();
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', SystemRole::PlatformSuperAdmin->value)->firstOrFail(),
            $user,
        );

        return $user;
    }
}
