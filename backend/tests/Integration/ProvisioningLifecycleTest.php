<?php

namespace Tests\Integration;

use App\Enums\ProvisioningState;
use App\Enums\SystemRole;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Exceptions\ProvisioningFailure;
use App\Jobs\ProvisionTenant;
use App\Models\ProvisioningRun;
use App\Models\Role;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RoleAssignmentService;
use App\Services\TenantProvisioner;
use App\Services\TenantProvisioningExecutor;
use App\Support\StorefrontSectionLayout;
use Database\Seeders\IdentitySeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Mockery;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Tests\TestCase;

#[Group('database')]
class ProvisioningLifecycleTest extends TestCase
{
    /** @var list<string> */
    private array $tenantIds = [];

    /** @var list<string> */
    private array $userIds = [];

    /** @var list<string> */
    private array $schemas = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
        config()->set('queue.default', 'database');
        config()->set('queue.connections.database.connection', config('tenancy.database.central_connection'));
        config()->set('queue.connections.database.after_commit', false);
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }

        DB::setDefaultConnection((string) config('tenancy.database.central_connection'));
        DB::purge('tenant');
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        $central->table('jobs')->delete();
        $central->table('failed_jobs')->delete();

        foreach ($this->tenantIds as $tenantId) {
            $central->table('tenant_user')->where('tenant_id', $tenantId)->delete();
            $central->table('admin_audit_logs')->where('tenant_id', $tenantId)->delete();
            $central->table('tenants')->where('id', $tenantId)->delete();
        }
        foreach (array_unique($this->schemas) as $schema) {
            $central->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
        }
        foreach ($this->userIds as $userId) {
            $central->table('role_user')->where('user_id', $userId)->delete();
            $central->table('admin_audit_logs')->where('actor_user_id', $userId)->delete();
            $central->table('users')->where('id', $userId)->delete();
        }

        parent::tearDown();
    }

    public function test_submission_is_central_atomic_idempotent_and_does_not_create_a_schema(): void
    {
        $merchant = $this->createUser('merchant-submit@example.test');
        $key = (string) Str::uuid();
        $payload = $this->readyStoreSubmissionPayload($merchant, $this->submissionPayload('atomic-store'));

        $response = $this->actingAs($merchant)
            ->withHeader('Idempotency-Key', $key)
            ->postJson('/api/register-store', $payload)
            ->assertCreated()
            ->assertJsonPath('data.verificationStatus', TenantVerificationStatus::Pending->value)
            ->assertJsonPath('data.provisioningStatus', ProvisioningState::NotStarted->value)
            ->assertJsonPath('meta.replayed', false);

        $tenantId = (string) $response->json('data.id');
        $this->tenantIds[] = $tenantId;
        $tenant = Tenant::query()->findOrFail($tenantId);
        $schema = (string) $tenant->database()->getName();
        $this->schemas[] = $schema;

        $this->assertSame($merchant->name, $tenant->owner_name);
        $this->assertSame($merchant->email, $tenant->owner_email);
        $this->assertFalse($tenant->database()->manager()->databaseExists($schema));
        $this->assertDatabaseHas('tenant_user', ['tenant_id' => $tenantId, 'user_id' => $merchant->id]);

        $this->actingAs($merchant)
            ->withHeader('Idempotency-Key', $key)
            ->postJson('/api/register-store', $payload)
            ->assertOk()
            ->assertJsonPath('data.id', $tenantId)
            ->assertJsonPath('meta.replayed', true);

        $this->actingAs($merchant)
            ->withHeader('Idempotency-Key', $key)
            ->postJson('/api/register-store', [...$payload, 'storeName' => 'Different payload'])
            ->assertStatus(409);

        $this->assertSame(1, DB::table('store_submissions')->where('submitted_by_user_id', $merchant->id)->count());
    }

    public function test_approval_atomically_queues_one_database_job_and_duplicate_approval_is_a_noop(): void
    {
        [$tenant, $merchant] = $this->submitStore('approval-store');
        $reviewer = $this->createPlatformUser('reviewer-approve@example.test', SystemRole::PlatformReviewer);

        $this->startBrowserSessionAs($reviewer);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Approved->value,
        ])->assertOk()->assertJsonPath('data.provisioningStatus', ProvisioningState::Queued->value);

        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseHas('provisioning_runs', [
            'tenant_id' => $tenant->id,
            'status' => ProvisioningState::Queued->value,
            'run_number' => 1,
        ]);

        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Approved->value,
        ])->assertOk();

        $this->assertDatabaseCount('jobs', 1);
        $this->assertSame(1, ProvisioningRun::query()->where('tenant_id', $tenant->id)->count());
        $this->assertSame($merchant->id, DB::table('store_submissions')->where('tenant_id', $tenant->id)->value('submitted_by_user_id'));
    }

    public function test_approval_rolls_back_status_run_audit_and_job_when_atomic_queue_is_unavailable(): void
    {
        [$tenant] = $this->submitStore('queue-rollback-store');
        $reviewer = $this->createPlatformUser('reviewer-queue-rollback@example.test', SystemRole::PlatformReviewer);
        $this->startBrowserSessionAs($reviewer);
        config()->set('queue.default', 'sync');

        try {
            $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
                'status' => TenantVerificationStatus::Approved->value,
            ])->assertStatus(500);
        } finally {
            config()->set('queue.default', 'database');
        }

        $this->assertSame(TenantVerificationStatus::Pending->value, $tenant->refresh()->verification_status);
        $this->assertSame(ProvisioningState::NotStarted->value, $tenant->provisioning_status);
        $this->assertDatabaseMissing('provisioning_runs', ['tenant_id' => $tenant->id]);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseMissing('admin_audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'platform.store.verification_status.changed',
        ]);
    }

    public function test_wp22_rollback_refuses_to_erase_nonempty_provisioning_records(): void
    {
        [$tenant] = $this->submitStore('rollback-guard-store');
        $migration = require database_path('migrations/system/2026_08_14_000007_create_tenant_provisioning_lifecycle.php');

        try {
            $migration->down();
            $this->fail('A populated provisioning lifecycle must not be rolled back.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('cannot be rolled back', $exception->getMessage());
        }

        $this->assertTrue(Schema::hasTable('store_submissions'));
        $this->assertDatabaseHas('store_submissions', ['tenant_id' => $tenant->id]);
    }

    public function test_real_database_queue_worker_consumes_the_job_and_activates_the_tenant(): void
    {
        [$tenant] = $this->submitAndApprove('worker-store');
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $this->schemas[] = (string) $run->schema_name;

        $this->assertDatabaseCount('jobs', 1);
        $this->runOneQueuedJob();

        $this->assertDatabaseCount('jobs', 0);
        $this->assertSame(ProvisioningState::Active, $run->refresh()->status);
        $this->assertSame(ProvisioningState::Active->value, $tenant->refresh()->provisioning_status);
        $stepCount = $run->steps()->count();
        (new ProvisionTenant((string) $run->id))->failed(new RuntimeException('late terminal callback'));
        $this->assertSame(ProvisioningState::Active, $run->refresh()->status);
        $this->assertSame(ProvisioningState::Active->value, $tenant->refresh()->provisioning_status);
        $this->assertSame($stepCount, $run->steps()->count());
        $this->getJson('http://'.$tenant->domains()->firstOrFail()->domain.'/api/store/config')
            ->assertNotFound();
    }

    public function test_unowned_schema_fails_closed_and_exhausted_worker_job_is_quarantined(): void
    {
        [$tenant] = $this->submitAndApprove('unowned-store');
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $schema = (string) $run->schema_name;
        $this->schemas[] = $schema;
        DB::connection((string) config('tenancy.database.central_connection'))
            ->statement('CREATE SCHEMA "'.$schema.'"');

        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $this->runOneQueuedJob();
            if ($attempt < 3) {
                DB::table('jobs')->update(['available_at' => now()->subMinute()->getTimestamp()]);
            }
        }

        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseCount('failed_jobs', 1);
        $this->assertTrue($tenant->database()->manager()->databaseExists($schema));
        $this->assertNull($run->refresh()->schema_created_at);
        $this->assertSame('schema_not_owned', $run->last_error_code);
        $this->assertSame(ProvisioningState::Failed->value, $tenant->refresh()->provisioning_status);
        $this->getJson('http://'.$tenant->domains()->firstOrFail()->domain.'/api/store/config')->assertNotFound();
    }

    public function test_provisioner_creates_migrates_seeds_activates_and_runtime_resolves_the_host(): void
    {
        [$tenant] = $this->submitAndApprove('active-store');
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $schema = (string) $run->schema_name;
        $this->schemas[] = $schema;

        app(TenantProvisioner::class)->provision((string) $run->id, 1, 3);

        $this->assertSame(ProvisioningState::Active, $run->refresh()->status);
        $this->assertSame(ProvisioningState::Active->value, $tenant->refresh()->provisioning_status);
        $this->assertNotNull($run->schema_created_at);
        $this->assertSame(4, $run->steps()->count());

        $this->getJson('http://'.$tenant->domains()->firstOrFail()->domain.'/api/store/config')
            ->assertNotFound();
        $this->assertFalse(tenancy()->initialized);
        $this->assertSame((string) config('tenancy.database.central_connection'), DB::getDefaultConnection());
    }

    public function test_worker_revalidates_a_legacy_queued_submission_against_the_locked_plan(): void
    {
        [$tenant] = $this->submitAndApprove('legacy-over-limit');
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $schema = (string) $run->schema_name;
        $this->schemas[] = $schema;
        $submission = StoreSubmission::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $payload = $submission->payload_snapshot;
        $payload['config']['products'] = array_map(fn (int $index): array => $this->product("LEGACY-{$index}"), range(1, 11));
        $submission->forceFill(['payload_snapshot' => $payload])->save();

        try {
            app(TenantProvisioner::class)->provision((string) $run->id, 1, 3);
            $this->fail('The worker materialized a legacy payload above the locked plan limit.');
        } catch (ProvisioningFailure $failure) {
            $this->assertSame('initial_config_invalid', $failure->errorCode);
        }

        $this->assertSame(ProvisioningState::Retrying, $run->refresh()->status);
        $this->assertSame(ProvisioningState::Retrying->value, $tenant->refresh()->provisioning_status);
        $this->assertSame(0, $tenant->run(static fn (): int => DB::table('store_configs')->count()));
    }

    public function test_worker_ignores_central_layout_claims_and_initializes_the_server_default(): void
    {
        [$tenant] = $this->submitAndApprove('central-layout-ignored');
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $this->schemas[] = (string) $run->schema_name;
        $submission = StoreSubmission::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $payload = $submission->payload_snapshot;
        $payload['config']['homeSections'] = [
            ['id' => 'about', 'visible' => true],
            ['id' => 'featured_products', 'visible' => false],
            ['id' => 'categories', 'visible' => false],
            ['id' => 'trust', 'visible' => false],
            ['id' => 'hero', 'visible' => false],
        ];
        $submission->forceFill(['payload_snapshot' => $payload])->save();

        app(TenantProvisioner::class)->provision((string) $run->id, 1, 3);

        $tenant->run(function (): void {
            $stored = json_decode((string) DB::table('store_configs')->where('is_current', true)->value('config_json'), true, 512, JSON_THROW_ON_ERROR);
            $this->assertSame(StorefrontSectionLayout::defaults(), $stored['homeSections']);
        });
    }

    public function test_worker_rejects_malformed_media_in_a_legacy_queued_submission(): void
    {
        [$tenant] = $this->submitAndApprove('legacy-unsafe-media');
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $schema = (string) $run->schema_name;
        $this->schemas[] = $schema;
        $submission = StoreSubmission::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $payload = $submission->payload_snapshot;
        $unsafe = $this->product('UNSAFE-1');
        $unsafe['imageUrl'] = 'data:image/png;base64,unsafe';
        $payload['config']['products'] = [$unsafe];
        $submission->forceFill(['payload_snapshot' => $payload])->save();

        try {
            app(TenantProvisioner::class)->provision((string) $run->id, 1, 3);
            $this->fail('The worker materialized unsafe media from a legacy payload.');
        } catch (ProvisioningFailure $failure) {
            $this->assertSame('initial_config_invalid', $failure->errorCode);
        }

        $this->assertSame(0, $tenant->run(static fn (): int => DB::table('products')->count()));
    }

    public function test_failure_retains_owned_schema_and_retry_completes_without_duplicate_config(): void
    {
        [$tenant] = $this->submitAndApprove('retry-store');
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $schema = (string) $run->schema_name;
        $this->schemas[] = $schema;

        $failingExecutor = Mockery::mock(TenantProvisioningExecutor::class)->makePartial();
        $failingExecutor->shouldReceive('migrate')->once()->andThrow(new RuntimeException('raw database detail must not persist'));
        $provisioner = new TenantProvisioner($failingExecutor);

        try {
            $provisioner->provision((string) $run->id, 1, 3);
            $this->fail('Provisioning failure was not propagated.');
        } catch (ProvisioningFailure $failure) {
            $this->assertSame('migrations_failed', $failure->errorCode);
        }

        $this->assertTrue($tenant->database()->manager()->databaseExists($schema));
        $this->assertSame(ProvisioningState::Retrying, $run->refresh()->status);
        $this->assertStringNotContainsString('raw database detail', (string) $run->last_error_message);

        (new TenantProvisioner(app(TenantProvisioningExecutor::class)))->provision((string) $run->id, 2, 3);

        $this->assertSame(ProvisioningState::Active, $run->refresh()->status);
        $count = $tenant->run(static fn (): int => DB::table('store_configs')->count());
        $this->assertSame(1, $count);
    }

    public function test_failed_retry_is_manage_only_and_creates_a_new_run(): void
    {
        [$tenant] = $this->submitAndApprove('manual-retry-store');
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $schema = (string) $run->schema_name;
        $this->schemas[] = $schema;
        $failingExecutor = Mockery::mock(TenantProvisioningExecutor::class)->makePartial();
        $failingExecutor->shouldReceive('migrate')->once()->andThrow(new RuntimeException('forced'));

        try {
            (new TenantProvisioner($failingExecutor))->provision((string) $run->id, 3, 3);
        } catch (ProvisioningFailure) {
        }

        $this->assertSame(ProvisioningState::Failed->value, $tenant->refresh()->provisioning_status);
        $reviewer = $this->createPlatformUser('reviewer-retry@example.test', SystemRole::PlatformReviewer);
        $manager = $this->createPlatformUser('manager-retry@example.test', SystemRole::PlatformSuperAdmin);

        $this->startBrowserSessionAs($reviewer);
        $this->postJson("/api/admin/stores/{$tenant->id}/provisioning/retry")
            ->assertForbidden();
        $this->startBrowserSessionAs($manager);
        $this->postJson("/api/admin/stores/{$tenant->id}/provisioning/retry")
            ->assertOk()
            ->assertJsonPath('data.provisioningStatus', ProvisioningState::Retrying->value);

        $this->assertSame(2, ProvisioningRun::query()->where('tenant_id', $tenant->id)->count());
        $this->assertSame(2, DB::table('jobs')->count());

        $this->runOneQueuedJob();
        $this->assertDatabaseCount('jobs', 1);
        $this->assertSame(ProvisioningState::Failed, $run->refresh()->status);
        $this->assertSame(ProvisioningState::Retrying->value, $tenant->refresh()->provisioning_status);

        $retryRun = ProvisioningRun::query()->where('tenant_id', $tenant->id)->orderByDesc('run_number')->firstOrFail();
        $this->runOneQueuedJob();
        $this->assertDatabaseCount('jobs', 0);
        $this->assertSame(ProvisioningState::Active, $retryRun->refresh()->status);
        $this->assertSame($run->schema_origin, $retryRun->schema_origin);
        $this->assertSame($run->schema_created_at?->toJSON(), $retryRun->schema_created_at?->toJSON());
        $retryStepCount = $retryRun->steps()->count();
        (new ProvisionTenant((string) $run->id))->failed(new RuntimeException('stale callback'));
        $this->assertSame(ProvisioningState::Active, $retryRun->refresh()->status);
        $this->assertSame(ProvisioningState::Active->value, $tenant->refresh()->provisioning_status);
        $this->assertSame($retryStepCount, $retryRun->steps()->count());
        $this->getJson('http://'.$tenant->domains()->firstOrFail()->domain.'/api/store/config')
            ->assertNotFound();
    }

    public function test_lock_contention_and_its_failed_callback_do_not_mutate_the_current_run(): void
    {
        [$tenant] = $this->submitAndApprove('lock-contention-store');
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $centralName = (string) config('tenancy.database.central_connection');
        config()->set('database.connections.provisioning_lock_test', config('database.connections.'.$centralName));
        $lockConnection = DB::connection('provisioning_lock_test');
        $lockKey = 'tenant-provisioning:'.$tenant->id;
        $acquired = (bool) ($lockConnection->selectOne(
            'SELECT pg_try_advisory_lock(hashtextextended(?, 0)) AS acquired',
            [$lockKey],
        )->acquired ?? false);
        $this->assertTrue($acquired);

        try {
            $failure = null;
            try {
                app(TenantProvisioner::class)->provision((string) $run->id, 3, 3);
                $this->fail('The second worker must not acquire the tenant provisioning lock.');
            } catch (ProvisioningFailure $exception) {
                $failure = $exception;
                $this->assertSame('provisioning_lock_busy', $exception->errorCode);
            }

            (new ProvisionTenant((string) $run->id))->failed($failure);
            $this->assertSame(ProvisioningState::Queued, $run->refresh()->status);
            $this->assertSame(ProvisioningState::Queued->value, $tenant->refresh()->provisioning_status);
            $this->assertSame(0, $run->steps()->count());
        } finally {
            $lockConnection->selectOne('SELECT pg_advisory_unlock(hashtextextended(?, 0)) AS released', [$lockKey]);
            DB::purge('provisioning_lock_test');
        }
    }

    /** @return array{Tenant, User} */
    private function submitStore(string $label): array
    {
        $merchant = $this->createUser($label.'@example.test');
        $payload = $this->readyStoreSubmissionPayload($merchant, $this->submissionPayload($label));
        $response = $this->actingAs($merchant)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/register-store', $payload)
            ->assertCreated();
        $tenant = Tenant::query()->findOrFail((string) $response->json('data.id'));
        $this->tenantIds[] = $tenant->id;

        return [$tenant, $merchant];
    }

    /** @return array{Tenant, User} */
    private function submitAndApprove(string $label): array
    {
        [$tenant, $merchant] = $this->submitStore($label);
        $reviewer = $this->createPlatformUser($label.'-reviewer@example.test', SystemRole::PlatformReviewer);
        $this->startBrowserSessionAs($reviewer);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Approved->value,
        ])->assertOk();

        return [$tenant, $merchant];
    }

    private function startBrowserSessionAs(User $user): void
    {
        $this->flushSession();
        $this->actingAs($user);
    }

    private function runOneQueuedJob(): void
    {
        $exitCode = Artisan::call('queue:work', [
            'connection' => 'database',
            '--queue' => 'provisioning',
            '--once' => true,
            '--tries' => 3,
            '--timeout' => 120,
            '--no-interaction' => true,
        ]);

        $this->assertSame(0, $exitCode, Artisan::output());
    }

    private function createUser(string $email): User
    {
        $user = User::query()->create([
            'name' => 'WP 2.2 User',
            'email' => $email,
            'password' => 'secure-pass-123',
            'status' => UserStatus::Active,
        ]);
        $this->userIds[] = $user->id;

        return $user;
    }

    private function createPlatformUser(string $email, SystemRole $systemRole): User
    {
        $user = $this->createUser($email);
        $role = Role::query()->where('key', $systemRole->value)->firstOrFail();
        app(RoleAssignmentService::class)->assignPlatformRole($user, $role, $user);

        return $user;
    }

    /** @return array<string, mixed> */
    private function submissionPayload(string $label): array
    {
        return [
            'storeName' => 'Store '.$label,
            'businessType' => 'retail',
            'themeStyle' => 'elegant',
            'handle' => $label,
            'planKey' => 'starter',
            'config' => $this->storeConfig($label),
            'ownerEmail' => 'forged-owner@example.test',
        ];
    }

    /** @return array<string, mixed> */
    private function storeConfig(string $label): array
    {
        return [
            'storeName' => 'Store '.$label,
            'slogan' => 'Test slogan',
            'logoIcon' => 'S',
            'primaryColor' => '#112233',
            'secondaryColor' => '#334455',
            'themeStyle' => 'elegant',
            'bannerText' => 'Test banner',
            'products' => [],
            'fontFamily' => 'Cairo',
            'phone' => '+967700000000',
            'currency' => 'YER',
        ];
    }

    /** @return array<string, mixed> */
    private function product(string $sku): array
    {
        return [
            'name' => 'Legacy product',
            'price' => '12.50',
            'description' => 'Legacy product description',
            'category' => 'General',
            'imageKeyword' => 'product',
            'imageUrl' => 'https://images.example.test/product.jpg',
            'stockQuantity' => 10,
            'manageStock' => true,
            'sku' => $sku,
            'lowStockThreshold' => 3,
        ];
    }
}
