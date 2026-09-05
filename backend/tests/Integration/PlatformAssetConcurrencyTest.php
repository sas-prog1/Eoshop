<?php

namespace Tests\Integration;

use App\Enums\RoleScope;
use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Exceptions\PlatformAssetConflict;
use App\Models\Role;
use App\Models\User;
use App\Services\PlatformAssetService;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;
use Throwable;

#[Group('database')]
class PlatformAssetConcurrencyTest extends TestCase
{
    /** @var list<string> */
    private array $userIds = [];

    private int $originalMaxAssets;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
        $this->originalMaxAssets = (int) config('platform_assets.max_assets');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        config(['platform_assets.max_assets' => $this->originalMaxAssets]);
        $central = (string) config('tenancy.database.central_connection');
        DB::purge($central);
        $connection = DB::connection($central);
        $assets = $this->userIds === [] ? collect() : $connection->table('platform_assets')
            ->whereIn('uploaded_by_user_id', $this->userIds)->get();
        foreach ($assets as $asset) {
            foreach (array_filter([(string) $asset->path, $asset->quarantine_path ? (string) $asset->quarantine_path : null]) as $path) {
                Storage::disk((string) $asset->disk)->delete($path);
            }
        }
        if ($this->userIds !== []) {
            $connection->table('platform_assets')->whereIn('uploaded_by_user_id', $this->userIds)->delete();
            $connection->table('admin_audit_logs')->where(function ($query): void {
                $query->whereIn('actor_user_id', $this->userIds)->orWhereIn('subject_id', $this->userIds);
            })->delete();
            $connection->table('role_user')->whereIn('user_id', $this->userIds)->delete();
            $connection->table('users')->whereIn('id', $this->userIds)->delete();
        }
        DB::purge($central);

        parent::tearDown();
    }

    public function test_two_managers_cannot_race_past_the_global_asset_quota(): void
    {
        config(['platform_assets.max_assets' => 1]);
        $first = $this->operator('asset-quota-a@example.test');
        $second = $this->operator('asset-quota-b@example.test');

        $outcomes = $this->runConcurrent([
            fn (): string => $this->uploadOutcome($first, 'landing_hero'),
            fn (): string => $this->uploadOutcome($second, 'authentication'),
        ]);

        $this->assertSame(['ok', 'platform_asset_quota_exceeded'], collect($outcomes)->sort()->values()->all());
        DB::purge((string) config('tenancy.database.central_connection'));
        $this->assertSame(1, DB::table('platform_assets')->whereIn('state', ['staging', 'ready'])->count());
        $this->assertSame(1, DB::table('platform_assets')->where('state', 'ready')->count());
    }

    public function test_restore_and_prune_serialize_to_a_consistent_file_and_row_outcome(): void
    {
        $manager = $this->operator('asset-prune-restore@example.test');
        $asset = app(PlatformAssetService::class)->upload(
            $manager,
            UploadedFile::fake()->image('race.png', 640, 360),
            'landing_hero',
            (string) Str::uuid(),
        );
        DB::table('platform_assets')->where('id', $asset['id'])->update(['orphaned_at' => now()->utc()->subHours(25)]);
        $this->assertSame(1, app(PlatformAssetService::class)->prune()['quarantined']);

        $fixedNow = now()->utc()->startOfSecond();
        DB::table('platform_assets')->where('id', $asset['id'])->update(['recoverable_until' => $fixedNow]);
        Carbon::setTestNow($fixedNow);
        $outcomes = collect($this->runConcurrent([
            fn (): string => 'prune:'.app(PlatformAssetService::class)->prune()['deleted'],
            fn (): string => 'restore:'.(app(PlatformAssetService::class)->restore($asset['id']) ? '1' : '0'),
        ]))->sort()->values()->all();

        $this->assertContains($outcomes, [
            ['prune:0', 'restore:1'],
            ['prune:1', 'restore:0'],
        ]);
        DB::purge((string) config('tenancy.database.central_connection'));
        $row = DB::table('platform_assets')->where('id', $asset['id'])->first();
        if ($row === null) {
            $this->assertFalse(Storage::disk('local')->exists('platform-assets/'.substr($asset['id'], 0, 2).'/'.$asset['id'].'.png'));
        } else {
            $this->assertSame('ready', $row->state);
            Storage::disk((string) $row->disk)->assertExists((string) $row->path);
        }
    }

    private function uploadOutcome(User $actor, string $purpose): string
    {
        try {
            app(PlatformAssetService::class)->upload(
                $actor,
                UploadedFile::fake()->image($purpose.'.png', 640, 360),
                $purpose,
                (string) Str::uuid(),
            );

            return 'ok';
        } catch (PlatformAssetConflict $exception) {
            return $exception->errorCode;
        }
    }

    /**
     * @param  list<callable(): string>  $operations
     * @return list<string>
     */
    private function runConcurrent(array $operations): array
    {
        if (! function_exists('pcntl_fork') || ! function_exists('stream_socket_pair')) {
            $this->fail('The database gate requires pcntl and socket pairs for platform asset concurrency.');
        }

        $workers = [];
        foreach ($operations as $operation) {
            $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            if ($sockets === false) {
                $this->fail('Unable to create the platform asset concurrency barrier.');
            }
            [$parentSocket, $childSocket] = $sockets;
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('Unable to fork a platform asset worker.');
            }
            if ($pid === 0) {
                fclose($parentSocket);
                fread($childSocket, 1);
                try {
                    $central = (string) config('tenancy.database.central_connection');
                    DB::purge('tenant');
                    DB::purge($central);
                    DB::setDefaultConnection($central);
                    $result = $operation();
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

    private function operator(string $email): User
    {
        $user = User::query()->create([
            'name' => 'Concurrent Platform Asset Manager',
            'email' => $email,
            'password' => 'secure-platform-pass-123',
            'status' => UserStatus::Active,
        ]);
        $this->userIds[] = (string) $user->getKey();
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', SystemRole::PlatformSuperAdmin->value)
                ->where('scope', RoleScope::Platform)->firstOrFail(),
            $user,
        );

        return $user;
    }
}
