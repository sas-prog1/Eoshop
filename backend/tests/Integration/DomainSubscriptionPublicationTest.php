<?php

namespace Tests\Integration;

use App\Enums\DomainReservationStatus;
use App\Enums\ProvisioningState;
use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Models\DomainReservation;
use App\Models\ProvisioningRun;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Services\RoleAssignmentService;
use App\Services\TenantProvisioner;
use Database\Seeders\IdentitySeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Tests\TestCase;

#[Group('database')]
class DomainSubscriptionPublicationTest extends TestCase
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
            $central->table('store_drafts')->where('owner_user_id', $userId)->delete();
            $central->table('users')->where('id', $userId)->delete();
        }

        DB::purge('domain_lock_probe');
        parent::tearDown();
    }

    public function test_plan_catalog_submission_and_domain_conflict_are_server_owned(): void
    {
        $this->getJson('/api/plans')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.key', 'starter')
            ->assertJsonPath('data.0.priceMinor', 0)
            ->assertJsonPath('data.1.activationMode', 'manual');

        $merchant = $this->createUser('catalog-owner@example.test');
        $this->actingAs($merchant)->getJson('/api/domains/availability?handle=green-shop')
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.domain', 'green-shop.'.config('tenancy.tenant_base_domain'));
        $this->actingAs($merchant)->getJson('/api/domains/availability?handle=store-admin')
            ->assertUnprocessable();

        $tenant = $this->submitStore($merchant, 'green-shop', 'starter', 'catalog-store');
        $this->assertSame(ProvisioningState::NotStarted->value, $tenant->provisioning_status);
        $this->assertDatabaseHas('tenant_subscriptions', [
            'tenant_id' => $tenant->id,
            'plan_key' => 'starter',
            'status' => 'active',
            'activation_source' => 'automatic_free',
        ]);
        $this->assertDatabaseHas('domain_reservations', [
            'tenant_id' => $tenant->id,
            'handle' => 'green-shop',
            'status' => 'reserved',
        ]);

        $other = $this->createUser('catalog-other@example.test');
        $this->startBrowserSessionAs($other);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/register-store', $this->readyStoreSubmissionPayload(
                $other,
                $this->payload('catalog-conflict', 'green-shop', 'starter'),
            ))
            ->assertStatus(409);
        $this->assertSame(1, Tenant::query()->where('store_name', 'like', 'Store catalog%')->count());
    }

    public function test_store_is_routable_only_after_explicit_publication_and_current_entitlement(): void
    {
        $merchant = $this->createUser('publish-owner@example.test');
        $tenant = $this->submitStore($merchant, 'publish-shop', 'starter', 'publish-store');
        $reviewer = $this->createPlatformUser('publish-reviewer@example.test', SystemRole::PlatformReviewer);
        $manager = $this->createPlatformUser('publish-manager@example.test', SystemRole::PlatformSuperAdmin);

        $this->startBrowserSessionAs($reviewer);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Approved->value,
        ])->assertOk();
        $this->provision($tenant);

        $tenant->run(fn () => DB::table('store_configs')
            ->where('is_current', true)
            ->update(['products_materialized' => false]));
        $this->startBrowserSessionAs($merchant);
        $this->getJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/publication")
            ->assertOk()
            ->assertJsonPath('data.publicationBlockers', fn (array $blockers): bool => in_array('workspace_not_ready', $blockers, true));
        $this->startBrowserSessionAs($manager);
        $this->postJson("http://127.0.0.1/api/admin/stores/{$tenant->id}/publication/publish")
            ->assertConflict();
        $tenant->run(fn () => DB::table('store_configs')
            ->where('is_current', true)
            ->update(['products_materialized' => true]));

        $internalHost = (string) $tenant->domains()->where('kind', 'internal')->firstOrFail()->domain;
        $publicHost = 'publish-shop.'.config('tenancy.tenant_base_domain');
        $this->getJson('http://'.$internalHost.'/api/store/config')->assertNotFound();
        $this->getJson('http://'.$publicHost.'/api/store/config')->assertNotFound();
        $this->startBrowserSessionAs($reviewer);
        $this->postJson("http://127.0.0.1/api/admin/stores/{$tenant->id}/publication/publish")
            ->assertForbidden();

        $this->startBrowserSessionAs($manager);
        $this->postJson("http://127.0.0.1/api/admin/stores/{$tenant->id}/publication/publish")
            ->assertOk()
            ->assertJsonPath('data.publicationStatus', 'published')
            ->assertJsonPath('data.publicDomain', $publicHost);
        $this->startBrowserSessionAs($merchant);
        $this->getJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/publication")
            ->assertOk()
            ->assertJsonPath('data.verificationStatus', 'approved')
            ->assertJsonPath('data.provisioningStatus', 'active')
            ->assertJsonPath('data.publicationStatus', 'published')
            ->assertJsonPath('data.reviewFeedback', null)
            ->assertJsonMissingPath('data.rejectionReason')
            ->assertJsonPath('data.capabilities.workspaceManage', true)
            ->assertJsonPath('data.publicDomain', $publicHost)
            ->assertJsonPath('data.publicationBlockers', [])
            ->assertJsonPath('data.activeAt', fn ($value): bool => is_string($value) && $value !== '')
            ->assertJsonPath('data.publishedAt', fn ($value): bool => is_string($value) && $value !== '');
        $this->getJson('http://'.$publicHost.'/api/store/config')
            ->assertOk()
            ->assertJsonPath('data.config.storeName', 'Store publish-store');
        $this->getJson('http://'.$internalHost.'/api/store/config')->assertNotFound();

        $this->startBrowserSessionAs($manager);
        $this->postJson("http://127.0.0.1/api/admin/stores/{$tenant->id}/publication/unpublish")
            ->assertOk()
            ->assertJsonPath('data.publicationStatus', 'unpublished');
        $this->getJson('http://'.$publicHost.'/api/store/config')->assertNotFound();
        $this->postJson("http://127.0.0.1/api/admin/stores/{$tenant->id}/publication/publish")
            ->assertOk();

        $ownSubscription = TenantSubscription::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $otherOwner = $this->createUser('runtime-integrity-other@example.test');
        $otherTenant = $this->submitStore($otherOwner, 'runtime-integrity-other', 'starter', 'runtime-integrity-other');
        $otherSubscription = TenantSubscription::query()->where('tenant_id', $otherTenant->id)->firstOrFail();
        Tenant::query()->whereKey($tenant->id)->update([
            'publication_subscription_id' => $otherSubscription->id,
        ]);
        $this->getJson('http://'.$publicHost.'/api/store/config')->assertNotFound();
        Tenant::query()->whereKey($tenant->id)->update([
            'publication_subscription_id' => $ownSubscription->id,
        ]);

        TenantSubscription::query()->where('tenant_id', $tenant->id)->update([
            'starts_at' => now('UTC')->subHours(2),
            'ends_at' => now('UTC')->subMinute(),
        ]);
        $this->getJson('http://'.$publicHost.'/api/store/config')->assertNotFound();
    }

    public function test_paid_package_requires_manager_activation_before_publication(): void
    {
        $merchant = $this->createUser('paid-owner@example.test');
        $tenant = $this->submitStore($merchant, 'paid-shop', 'pro', 'paid-store');
        $reviewer = $this->createPlatformUser('paid-reviewer@example.test', SystemRole::PlatformReviewer);
        $manager = $this->createPlatformUser('paid-manager@example.test', SystemRole::PlatformSuperAdmin);

        $this->startBrowserSessionAs($reviewer);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Approved->value,
        ])->assertOk();
        $this->provision($tenant);

        $this->startBrowserSessionAs($manager);
        $this->postJson("/api/admin/stores/{$tenant->id}/publication/publish")
            ->assertStatus(409);
        $endsAt = now()->addMonth()->startOfSecond()->toIso8601String();
        $this->startBrowserSessionAs($reviewer);
        $this->postJson("/api/admin/stores/{$tenant->id}/subscription/activate", ['endsAt' => $endsAt])
            ->assertForbidden();
        $this->startBrowserSessionAs($manager);
        $this->postJson("/api/admin/stores/{$tenant->id}/subscription/activate", ['endsAt' => $endsAt])
            ->assertOk()
            ->assertJsonPath('data.subscription.status', 'active')
            ->assertJsonPath('data.subscription.plan.key', 'pro');
        $publishResponse = $this->postJson("/api/admin/stores/{$tenant->id}/publication/publish");
        $this->assertSame(200, $publishResponse->status(), $publishResponse->getContent());
        $this->getJson('http://paid-shop.'.config('tenancy.tenant_base_domain').'/api/store/config')->assertOk();
    }

    public function test_expired_manual_entitlement_can_be_renewed_by_a_manager(): void
    {
        $merchant = $this->createUser('renew-owner@example.test');
        $tenant = $this->submitStore($merchant, 'renew-shop', 'pro', 'renew-store');
        $manager = $this->createPlatformUser('renew-manager@example.test', SystemRole::PlatformSuperAdmin);
        $this->startBrowserSessionAs($manager);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Approved->value,
        ])->assertOk();
        $this->provision($tenant);
        $subscription = TenantSubscription::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $subscription->forceFill([
            'status' => 'active',
            'activation_source' => 'manual_admin',
            'starts_at' => now('UTC')->subMonth(),
            'ends_at' => now('UTC')->subMinute(),
        ])->save();

        $newEnd = now('UTC')->addMonths(2)->startOfSecond();
        $this->startBrowserSessionAs($manager);
        $this->postJson("/api/admin/stores/{$tenant->id}/subscription/activate", [
            'endsAt' => $newEnd->toIso8601String(),
        ])->assertOk()
            ->assertJsonPath('data.subscription.status', 'active');

        $subscription->refresh();
        $this->assertTrue($subscription->isCurrentlyActive());
        $this->assertSame($newEnd->timestamp, $subscription->ends_at?->timestamp);
        $this->assertDatabaseHas('admin_audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'platform.store.subscription.renewed',
        ]);
        $this->postJson("/api/admin/stores/{$tenant->id}/publication/publish")->assertOk();
        $this->getJson('http://renew-shop.'.config('tenancy.tenant_base_domain').'/api/store/config')
            ->assertOk()
            ->assertJsonPath('data.config.storeName', 'Store renew-store');
    }

    public function test_rejection_releases_handle_and_failed_reopen_rolls_back_review_state(): void
    {
        $firstOwner = $this->createUser('release-first@example.test');
        $first = $this->submitStore($firstOwner, 'shared-shop', 'starter', 'release-first');
        $reviewer = $this->createPlatformUser('release-reviewer@example.test', SystemRole::PlatformReviewer);
        $manager = $this->createPlatformUser('release-manager@example.test', SystemRole::PlatformSuperAdmin);

        $this->startBrowserSessionAs($reviewer);
        $this->patchJson("/api/admin/stores/{$first->id}/status", [
            'status' => TenantVerificationStatus::Rejected->value,
            'reason' => 'The initial submission is incomplete.',
        ])->assertOk();
        $this->assertDatabaseHas('domain_reservations', [
            'tenant_id' => $first->id,
            'handle' => 'shared-shop',
            'status' => DomainReservationStatus::Released->value,
        ]);
        $this->startBrowserSessionAs($firstOwner);
        $this->getJson("/api/merchant/stores/{$first->id}/publication")
            ->assertOk()
            ->assertJsonPath('data.reviewFeedback', 'The initial submission is incomplete.')
            ->assertJsonMissingPath('data.rejectionReason');

        $secondOwner = $this->createUser('release-second@example.test');
        $second = $this->submitStore($secondOwner, 'shared-shop', 'starter', 'release-second');
        $this->assertNotSame($first->id, $second->id);

        $this->startBrowserSessionAs($manager);
        $this->patchJson("/api/admin/stores/{$first->id}/status", [
            'status' => TenantVerificationStatus::Pending->value,
        ])->assertForbidden();
        $this->assertSame(TenantVerificationStatus::Rejected->value, $first->refresh()->verification_status);
        $this->assertSame('rejected', $first->publication_status);
        $this->assertSame(1, DomainReservation::query()
            ->where('tenant_id', $first->id)
            ->where('status', DomainReservationStatus::Released)
            ->count());
    }

    public function test_platform_cannot_reopen_a_rejected_legacy_submission(): void
    {
        $tenant = Tenant::query()->create([
            'id' => 'legacy-rejected-reopen',
            'store_name' => 'Legacy rejected store',
            'owner_name' => 'Legacy Owner',
            'owner_email' => 'legacy-rejected@example.test',
            'business_type' => 'retail',
            'verification_status' => TenantVerificationStatus::Rejected,
            'provisioning_status' => ProvisioningState::NotStarted,
            'publication_status' => 'rejected',
            'theme_style' => 'elegant',
        ]);
        $this->tenantIds[] = $tenant->id;
        $subscriptionId = (string) Str::uuid();
        $reservationId = (string) Str::uuid();
        $requestId = (string) Str::uuid();
        DB::table('tenant_subscriptions')->insert([
            'id' => $subscriptionId,
            'tenant_id' => $tenant->id,
            'plan_key' => 'starter',
            'status' => 'active',
            'activation_source' => 'wp23_adopted',
            'starts_at' => now('UTC'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('domain_reservations')->insert([
            'id' => $reservationId,
            'tenant_id' => $tenant->id,
            'domain' => 'x.example.test',
            'handle' => 'x',
            'status' => 'active',
            'origin' => 'wp22_internal',
            'reserved_at' => now(),
            'activated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('publication_requests')->insert([
            'id' => $requestId,
            'tenant_id' => $tenant->id,
            'domain_reservation_id' => $reservationId,
            'tenant_subscription_id' => $subscriptionId,
            'status' => 'rejected',
            'origin' => 'wp23_adopted',
            'requested_at' => now(),
            'decided_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $tenant->forceFill(['publication_request_id' => $requestId])->save();

        $manager = $this->createPlatformUser('legacy-reopen-manager@example.test', SystemRole::PlatformSuperAdmin);
        $this->startBrowserSessionAs($manager);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Pending->value,
        ])->assertForbidden();

        $this->assertSame(TenantVerificationStatus::Rejected->value, $tenant->refresh()->verification_status);
        $this->assertSame(0, DB::table('publication_requests')
            ->where('tenant_id', $tenant->id)
            ->where('status', 'requested')
            ->count());
        $this->assertSame(1, DB::table('publication_requests')->where('tenant_id', $tenant->id)->count());
    }

    public function test_merchant_recovery_endpoints_enforce_active_exact_membership(): void
    {
        $owner = $this->createUser('recovery-owner@example.test');
        $tenant = $this->submitStore($owner, 'recovery-shop', 'starter', 'recovery-store');
        $outsider = $this->createUser('recovery-outsider@example.test');
        $staff = $this->createUser('recovery-staff@example.test');
        $staffRole = Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail();
        app(RoleAssignmentService::class)->assignTenantRole($tenant, $staff, $staffRole, $owner);

        $this->startBrowserSessionAs($owner);
        $this->getJson('/api/merchant/stores')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $tenant->id)
            ->assertJsonPath('data.0.requestedDomain', 'recovery-shop.'.config('tenancy.tenant_base_domain'))
            ->assertJsonPath('data.0.reviewFeedback', null)
            ->assertJsonMissingPath('data.0.rejectionReason')
            ->assertJsonPath('data.0.capabilities.workspaceManage', true)
            ->assertJsonPath('data.0.capabilities.catalogManage', true)
            ->assertJsonPath('data.0.publicDomain', null)
            ->assertJsonPath('data.0.activeAt', null)
            ->assertJsonPath('data.0.publishedAt', null);
        $this->getJson("/api/merchant/stores/{$tenant->id}/publication")
            ->assertOk()
            ->assertJsonPath('data.id', $tenant->id);
        $this->startBrowserSessionAs($staff);
        $this->getJson('/api/merchant/stores')
            ->assertOk()
            ->assertJsonPath('data.0.capabilities.workspaceManage', false)
            ->assertJsonPath('data.0.capabilities.catalogManage', true)
            ->assertJsonPath('data.0.capabilities.inventoryManage', true)
            ->assertJsonPath('data.0.capabilities.ordersManage', true);
        $this->startBrowserSessionAs($outsider);
        $this->getJson("/api/merchant/stores/{$tenant->id}/publication")
            ->assertForbidden();

        DB::table('tenant_user')->where('tenant_id', $tenant->id)->where('user_id', $owner->id)
            ->update(['status' => TenantMembershipStatus::Suspended->value]);
        $this->startBrowserSessionAs($owner);
        $this->getJson('/api/merchant/stores')->assertJsonCount(0, 'data');
        $this->getJson("/api/merchant/stores/{$tenant->id}/publication")
            ->assertForbidden();
    }

    public function test_hostname_lock_and_database_constraints_are_the_final_conflict_guards(): void
    {
        $owner = $this->createUser('locking-owner@example.test');
        $tenant = $this->submitStore($owner, 'locking-shop', 'starter', 'locking-store');
        $centralName = (string) config('tenancy.database.central_connection');
        config()->set('database.connections.domain_lock_probe', config('database.connections.'.$centralName));
        $probe = DB::connection('domain_lock_probe');
        $domain = 'locking-shop.'.config('tenancy.tenant_base_domain');
        $central = DB::connection($centralName);

        $central->beginTransaction();
        try {
            $central->selectOne('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['domain-reservation:'.$domain]);
            $acquired = (bool) ($probe->selectOne(
                'SELECT pg_try_advisory_xact_lock(hashtextextended(?, 0)) AS acquired',
                ['domain-reservation:'.$domain],
            )->acquired ?? false);
            $this->assertFalse($acquired);
        } finally {
            $central->rollBack();
        }

        try {
            DB::table('domain_reservations')->insert([
                'id' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'domain' => $domain,
                'handle' => 'locking-shop',
                'status' => 'reserved',
                'origin' => 'user_selected',
                'reserved_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->fail('The partial unique constraints must reject a second live reservation.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('domain_reservations_current_', (string) ($exception->errorInfo[2] ?? ''));
        }

        $otherOwner = $this->createUser('integrity-other@example.test');
        $other = $this->submitStore($otherOwner, 'integrity-other', 'starter', 'integrity-other');
        $otherSubscription = TenantSubscription::query()->where('tenant_id', $other->id)->firstOrFail();
        $tenantReservation = DomainReservation::query()->where('tenant_id', $tenant->id)->firstOrFail();
        try {
            DB::table('publication_requests')->insert([
                'id' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'domain_reservation_id' => $tenantReservation->id,
                'tenant_subscription_id' => $otherSubscription->id,
                'status' => 'rejected',
                'origin' => 'user_selected',
                'requested_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->fail('A publication request must not borrow another tenant subscription.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString(
                'publication_requests_subscription_tenant_foreign',
                (string) ($exception->errorInfo[2] ?? ''),
            );
        }
    }

    public function test_schema_mismatch_is_visible_and_blocks_publication(): void
    {
        $merchant = $this->createUser('schema-mismatch-owner@example.test');
        $tenant = $this->submitStore($merchant, 'schema-mismatch', 'starter', 'schema-mismatch');
        $manager = $this->createPlatformUser('schema-mismatch-manager@example.test', SystemRole::PlatformSuperAdmin);
        $this->startBrowserSessionAs($manager);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Approved->value,
        ])->assertOk();
        $this->provision($tenant);
        ProvisioningRun::query()->where('tenant_id', $tenant->id)->update([
            'schema_name' => 'tenant_schema_mismatch_does_not_exist',
        ]);

        $this->getJson('/api/admin/stores')
            ->assertOk()
            ->assertJsonFragment(['publicationBlockers' => ['provisioning_not_ready']]);
        $this->postJson("/api/admin/stores/{$tenant->id}/publication/publish")
            ->assertStatus(409);
        $this->getJson('http://schema-mismatch.'.config('tenancy.tenant_base_domain').'/api/store/config')
            ->assertNotFound();
    }

    public function test_wp23_rollback_refuses_to_erase_user_publication_history(): void
    {
        $owner = $this->createUser('rollback-owner@example.test');
        $tenant = $this->submitStore($owner, 'rollback-shop', 'starter', 'rollback-store');
        $migration = require database_path('migrations/system/2026_08_15_000008_create_domain_subscription_publication_lifecycle.php');

        try {
            $migration->down();
            $this->fail('A populated publication lifecycle must not be rolled back.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('cannot be rolled back', $exception->getMessage());
        }

        $this->assertTrue(Schema::hasTable('domain_reservations'));
        $this->assertDatabaseHas('publication_requests', ['tenant_id' => $tenant->id]);
    }

    private function provision(Tenant $tenant): void
    {
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->latest('run_number')->firstOrFail();
        $this->schemas[] = (string) $run->schema_name;
        app(TenantProvisioner::class)->provision((string) $run->id, 1, 3);
    }

    private function submitStore(User $merchant, string $handle, string $plan, string $label): Tenant
    {
        $this->startBrowserSessionAs($merchant);
        $payload = $this->readyStoreSubmissionPayload($merchant, $this->payload($label, $handle, $plan));
        $response = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/register-store', $payload)
            ->assertCreated()
            ->assertJsonPath('data.requestedDomain', $handle.'.'.config('tenancy.tenant_base_domain'))
            ->assertJsonPath('data.plan.key', $plan);
        $tenant = Tenant::query()->findOrFail((string) $response->json('data.id'));
        $this->tenantIds[] = $tenant->id;

        return $tenant;
    }

    private function startBrowserSessionAs(User $user): void
    {
        $this->flushSession();
        $this->actingAs($user);
    }

    private function createUser(string $email): User
    {
        $user = User::query()->create([
            'name' => 'WP 2.3 User',
            'email' => $email,
            'password' => 'secure-pass-123',
            'status' => UserStatus::Active,
        ]);
        $this->userIds[] = $user->id;

        return $user;
    }

    private function createPlatformUser(string $email, SystemRole $roleKey): User
    {
        $user = $this->createUser($email);
        $role = Role::query()->where('key', $roleKey->value)->firstOrFail();
        app(RoleAssignmentService::class)->assignPlatformRole($user, $role, $user);

        return $user;
    }

    /** @return array<string, mixed> */
    private function payload(string $label, string $handle, string $plan): array
    {
        return [
            'storeName' => 'Store '.$label,
            'businessType' => 'retail',
            'themeStyle' => 'elegant',
            'handle' => $handle,
            'planKey' => $plan,
            'config' => $this->storeConfig($label),
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
}
