<?php

namespace Tests\Integration;

use App\Enums\ProvisioningState;
use App\Enums\StoreDraftStatus;
use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Models\ProvisioningRun;
use App\Models\Role;
use App\Models\StoreDraft;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RoleAssignmentService;
use App\Services\StoreDraftService;
use App\Services\StoreSubmissionService;
use App\Services\TenantProvisioner;
use App\Support\StorefrontSectionLayout;
use App\Support\StoreOnboardingAppearance;
use App\Support\StoreOnboardingBaseline;
use Database\Seeders\IdentitySeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Tests\TestCase;

#[Group('database')]
class StoreDraftLifecycleTest extends TestCase
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
        $central->table('store_drafts')->whereIn('owner_user_id', $this->userIds)->whereNull('tenant_id')->delete();

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

    public function test_authenticated_draft_is_server_owned_and_revision_conflicts_fail_closed(): void
    {
        $owner = $this->createUser('draft-owner@example.test');
        $this->startBrowserSessionAs($owner);
        $this->getJson('/api/merchant/store-draft')->assertOk()->assertJsonPath('data', null);

        $saved = $this->putJson('/api/merchant/store-draft/business', [
            'expectedRevision' => 0,
            'storeName' => 'Store first',
            'businessType' => 'retail',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', StoreDraftStatus::Draft->value)
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.onboardingStage', 'business')
            ->assertJsonPath('data.storeName', 'Store first');
        $draftId = (string) $saved->json('data.id');

        $this->putJson('/api/merchant/store-draft/business', [
            'expectedRevision' => 0,
            'storeName' => 'Store stale',
            'businessType' => 'retail',
        ])
            ->assertConflict()
            ->assertJsonPath('code', 'draft_revision_conflict')
            ->assertJsonPath('current.id', $draftId)
            ->assertJsonPath('current.revision', 1);
        $this->assertDatabaseHas('store_drafts', [
            'id' => $draftId,
            'owner_user_id' => $owner->id,
            'tenant_id' => null,
            'revision' => 1,
            'store_name' => 'Store first',
        ]);

        try {
            DB::table('store_drafts')->where('id', $draftId)->update(['revision' => 0]);
            $this->fail('PostgreSQL must reject a non-positive draft revision.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('store_drafts_revision_positive', (string) ($exception->errorInfo[2] ?? ''));
        }
    }

    public function test_unbound_and_correction_drafts_never_become_storefront_layout_authorities(): void
    {
        $owner = $this->createUser('draft-layout-owner@example.test');
        $customLayout = [
            ['id' => 'about', 'visible' => true],
            ['id' => 'featured_products', 'visible' => false],
            ['id' => 'categories', 'visible' => false],
            ['id' => 'trust', 'visible' => false],
            ['id' => 'hero', 'visible' => false],
        ];
        $payload = $this->draftPayload('layout-unbound', 0, 'layout-unbound', 'starter');
        $payload['config']['homeSections'] = $customLayout;

        $draft = app(StoreDraftService::class)->saveUnbound(
            $payload,
            $owner,
            Request::create('/api/merchant/store-draft', 'PUT'),
        );

        $this->assertArrayNotHasKey('homeSections', $draft->config);
        $this->assertSame(StoreDraftStatus::Draft, $draft->status);
    }

    public function test_submission_revalidates_the_locked_user_and_enforces_exact_draft_tenant_integrity(): void
    {
        $suspended = $this->createUser('suspended-submit@example.test');
        $suspended->update(['status' => UserStatus::Suspended]);
        $before = Tenant::query()->count();

        try {
            app(StoreSubmissionService::class)->submit(
                $this->submissionPayload('suspended', 'suspended-submit', 'starter') + ['idempotencyKey' => (string) Str::uuid()],
                $suspended,
                Request::create('/api/register-store', 'POST'),
            );
            $this->fail('A suspended user must be rejected again under the central row lock.');
        } catch (AuthorizationException) {
            $this->assertSame($before, Tenant::query()->count());
        }

        $owner = $this->createUser('integrity-owner@example.test');
        $firstDraft = $this->saveDraft($owner, 'integrity-a', 'integrity-a', 'starter');
        $firstTenant = $this->submitDraft($owner, $firstDraft, 'integrity-a');
        $secondOwner = $this->createUser('integrity-second-owner@example.test');
        $secondDraft = $this->saveDraft($secondOwner, 'integrity-b', 'integrity-b', 'starter');
        $secondTenant = $this->submitDraft($secondOwner, $secondDraft, 'integrity-b');
        StoreSubmission::query()->where('tenant_id', $secondTenant->id)->delete();
        $firstSubmission = StoreSubmission::query()->where('tenant_id', $firstTenant->id)->firstOrFail();

        try {
            DB::table('store_submissions')->where('id', $firstSubmission->id)->update([
                'store_draft_id' => $secondDraft->id,
            ]);
            $this->fail('PostgreSQL must reject a draft that belongs to another tenant.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('store_submissions_draft_tenant_foreign', (string) ($exception->errorInfo[2] ?? ''));
        }
    }

    public function test_concurrent_first_submission_with_one_key_replays_the_single_committed_tenant(): void
    {
        $owner = $this->createUser('concurrent-submit@example.test');
        $draft = $this->saveDraft($owner, 'concurrent', 'concurrent-submit', 'starter');
        $this->resolveStoreApplicationRequirements($draft, $owner);
        $key = (string) Str::uuid();
        $payload = $this->submissionPayloadForDraft($draft) + [
            'draftId' => $draft->id,
            'expectedDraftRevision' => $draft->revision,
            'idempotencyKey' => $key,
        ];

        $outcomes = $this->runConcurrentSubmissions($owner, $payload, 2);
        $this->assertCount(2, $outcomes);
        $this->assertSame(['created', 'replayed'], collect($outcomes)->pluck('status')->sort()->values()->all());
        $this->assertCount(1, array_unique(collect($outcomes)->pluck('tenant_id')->all()));
        $tenantId = (string) $outcomes[0]['tenant_id'];
        $this->tenantIds[] = $tenantId;
        $this->assertSame(1, StoreSubmission::query()->where('submitted_by_user_id', $owner->id)->where('idempotency_key', $key)->count());
        $this->assertSame(StoreDraftStatus::Submitted, $draft->refresh()->status);
    }

    public function test_exact_submission_replay_is_rejected_after_the_owner_is_suspended(): void
    {
        $owner = $this->createUser('suspended-replay@example.test');
        $draft = $this->saveDraft($owner, 'suspended-replay', 'suspended-replay', 'starter');
        $key = (string) Str::uuid();
        $payload = $this->submissionPayloadForDraft($draft) + [
            'draftId' => $draft->id,
            'expectedDraftRevision' => $draft->revision,
            'idempotencyKey' => $key,
        ];

        $tenant = $this->submitDraft($owner, $draft, 'suspended-replay', $key);
        $this->assertDatabaseHas('store_submissions', [
            'tenant_id' => $tenant->id,
            'submitted_by_user_id' => $owner->id,
            'idempotency_key' => $key,
        ]);

        $owner->update(['status' => UserStatus::Suspended]);
        $this->expectException(AuthorizationException::class);
        app(StoreSubmissionService::class)->submit(
            $payload,
            $owner,
            Request::create('/api/register-store', 'POST'),
        );
    }

    public function test_committed_submission_is_recoverable_by_its_owner_draft_only(): void
    {
        $owner = $this->createUser('submission-recovery@example.test');
        $draft = $this->saveDraft($owner, 'recovery', 'submission-recovery', 'starter');
        $tenant = $this->submitDraft($owner, $draft, 'recovery');

        $this->startBrowserSessionAs($owner);
        $this->getJson("/api/merchant/store-drafts/{$draft->id}/submission")
            ->assertOk()
            ->assertJsonPath('data.id', $tenant->id)
            ->assertJsonPath('data.storeName', 'Store recovery');

        $outsider = $this->createUser('submission-recovery-outsider@example.test');
        $this->startBrowserSessionAs($outsider);
        $this->getJson("/api/merchant/store-drafts/{$draft->id}/submission")->assertNotFound();
    }

    public function test_rejection_requires_owner_correction_and_resubmission_is_exactly_replayable(): void
    {
        $owner = $this->createUser('correction-owner@example.test');
        $draft = $this->saveDraft($owner, 'initial', 'correction-shop', 'starter');
        $tenant = $this->submitDraft($owner, $draft, 'initial');
        $submittedRevision = (int) $draft->refresh()->revision;
        $reviewer = $this->createPlatformUser('correction-reviewer@example.test', SystemRole::PlatformReviewer);
        $manager = $this->createPlatformUser('correction-manager@example.test', SystemRole::PlatformSuperAdmin);

        $this->startBrowserSessionAs($reviewer);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::ChangesRequested->value,
            'reason' => 'Please correct the store identity.',
            'requestedFields' => ['business.store_name'],
        ])->assertOk();

        $draft->refresh();
        $this->assertSame(StoreDraftStatus::CorrectionRequired, $draft->status);
        $correctionRevision = $submittedRevision + 1;
        $this->assertSame($correctionRevision, $draft->revision);
        $this->startBrowserSessionAs($manager);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Pending->value,
        ])->assertForbidden();

        $this->startBrowserSessionAs($owner);
        $correctionPayload = $this->draftPayload(
            'corrected',
            $correctionRevision,
            'corrected-shop',
            'starter',
        );
        $correctionPayload['config']['homeSections'] = [
            ['id' => 'about', 'visible' => true],
            ['id' => 'featured_products', 'visible' => false],
            ['id' => 'categories', 'visible' => false],
            ['id' => 'trust', 'visible' => false],
            ['id' => 'hero', 'visible' => false],
        ];
        $corrected = $this->patchJson("/api/merchant/stores/{$tenant->id}/draft", $correctionPayload)->assertOk()
            ->assertJsonPath('data.revision', $correctionRevision + 1)
            ->assertJsonPath('data.status', StoreDraftStatus::CorrectionRequired->value);
        $this->assertSame('corrected-shop', $corrected->json('data.handle'));
        $this->assertArrayNotHasKey('homeSections', $draft->refresh()->config);

        $key = (string) Str::uuid();
        $correctedRevision = $correctionRevision + 1;
        $this->withHeader('Idempotency-Key', $key)
            ->postJson("/api/merchant/stores/{$tenant->id}/resubmit", ['expectedRevision' => $correctedRevision])
            ->assertOk()
            ->assertJsonPath('data.verificationStatus', TenantVerificationStatus::Pending->value)
            ->assertJsonPath('meta.replayed', false);
        $this->withHeader('Idempotency-Key', $key)
            ->postJson("/api/merchant/stores/{$tenant->id}/resubmit", ['expectedRevision' => $correctedRevision])
            ->assertOk()
            ->assertJsonPath('meta.replayed', true);
        $this->withHeader('Idempotency-Key', $key)
            ->postJson("/api/merchant/stores/{$tenant->id}/resubmit", ['expectedRevision' => $correctedRevision + 1])
            ->assertConflict()
            ->assertJsonPath('code', 'resubmission_idempotency_conflict');

        $submission = StoreSubmission::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $this->assertSame(2, $submission->revision);
        $this->assertSame('Store corrected', $submission->payload_snapshot['storeName']);
        $this->assertSame('corrected-shop', $submission->payload_snapshot['handle']);
        $this->assertSame(StorefrontSectionLayout::defaults(), $submission->payload_snapshot['config']['homeSections']);
        $this->assertArrayNotHasKey('homeSections', $draft->refresh()->config);
        $this->assertDatabaseCount('store_resubmissions', 1);
        $this->assertSame(StoreDraftStatus::Submitted, $draft->refresh()->status);
        $this->assertSame($correctedRevision + 1, $draft->revision);
    }

    public function test_any_active_exact_owner_can_correct_but_staff_outsiders_and_suspended_members_cannot(): void
    {
        $owner = $this->createUser('membership-owner@example.test');
        $draft = $this->saveDraft($owner, 'membership', 'membership-shop', 'starter');
        $tenant = $this->submitDraft($owner, $draft, 'membership');
        $reviewer = $this->createPlatformUser('membership-reviewer@example.test', SystemRole::PlatformReviewer);
        $this->startBrowserSessionAs($reviewer);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::ChangesRequested->value,
            'reason' => 'Correction required.',
            'requestedFields' => ['business.store_name'],
        ])->assertOk();
        $correctionRevision = (int) $draft->refresh()->revision;

        $staff = $this->createUser('membership-staff@example.test');
        $staffRole = Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail();
        app(RoleAssignmentService::class)->assignTenantRole($tenant, $staff, $staffRole, $owner);
        $outsider = $this->createUser('membership-outsider@example.test');
        foreach ([$staff, $outsider] as $denied) {
            $this->startBrowserSessionAs($denied);
            $this->getJson("/api/merchant/stores/{$tenant->id}/draft")->assertForbidden();
            $this->withHeader('Idempotency-Key', (string) Str::uuid())
                ->postJson("/api/merchant/stores/{$tenant->id}/resubmit", ['expectedRevision' => $correctionRevision])
                ->assertForbidden();
        }

        DB::table('tenant_user')
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $owner->id)
            ->update(['status' => TenantMembershipStatus::Suspended->value]);
        $this->startBrowserSessionAs($owner);
        $this->getJson("/api/merchant/stores/{$tenant->id}/draft")->assertForbidden();

        $coOwner = $this->createUser('membership-co-owner@example.test');
        $ownerRole = Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail();
        app(RoleAssignmentService::class)->assignTenantRole($tenant, $coOwner, $ownerRole, $coOwner);
        $this->startBrowserSessionAs($coOwner);
        $this->patchJson("/api/merchant/stores/{$tenant->id}/draft", $this->draftPayload(
            'co-owner-correction',
            $correctionRevision,
            'membership-shop',
            'starter',
        ))->assertOk()->assertJsonPath('data.revision', $correctionRevision + 1);
        $this->assertSame($owner->id, $draft->refresh()->owner_user_id);
    }

    public function test_plan_change_preserves_subscription_history_on_resubmission(): void
    {
        $owner = $this->createUser('plan-change-owner@example.test');
        $draft = $this->saveDraft($owner, 'starter', 'plan-change-shop', 'starter');
        $tenant = $this->submitDraft($owner, $draft, 'starter');
        $reviewer = $this->createPlatformUser('plan-change-reviewer@example.test', SystemRole::PlatformReviewer);
        $this->startBrowserSessionAs($reviewer);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::ChangesRequested->value,
            'reason' => 'Select the requested package.',
            'requestedFields' => ['subscription.plan'],
        ])->assertOk();
        $correctionRevision = (int) $draft->refresh()->revision;

        $this->startBrowserSessionAs($owner);
        $this->patchJson("/api/merchant/stores/{$tenant->id}/draft", $this->draftPayload(
            'pro',
            $correctionRevision,
            'plan-change-shop',
            'pro',
        ))->assertOk();
        $correctedRevision = $correctionRevision + 1;
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/merchant/stores/{$tenant->id}/resubmit", ['expectedRevision' => $correctedRevision])
            ->assertOk()
            ->assertJsonPath('data.plan.key', 'pro')
            ->assertJsonPath('data.subscriptionStatus', 'pending_activation');

        $this->assertDatabaseHas('tenant_subscriptions', [
            'tenant_id' => $tenant->id,
            'plan_key' => 'starter',
            'status' => 'cancelled',
        ]);
        $this->assertDatabaseHas('tenant_subscriptions', [
            'tenant_id' => $tenant->id,
            'plan_key' => 'pro',
            'status' => 'pending_activation',
        ]);
        $this->assertSame(2, DB::table('tenant_subscriptions')->where('tenant_id', $tenant->id)->count());
    }

    public function test_owner_publish_and_unpublish_are_server_authorized_and_idempotent(): void
    {
        $owner = $this->createUser('merchant-publish-owner@example.test');
        $draft = $this->saveDraft($owner, 'publish', 'merchant-publish-shop', 'starter');
        $tenant = $this->submitDraft($owner, $draft, 'publish');
        $reviewer = $this->createPlatformUser('merchant-publish-reviewer@example.test', SystemRole::PlatformReviewer);
        $this->startBrowserSessionAs($reviewer);
        $this->patchJson("/api/admin/stores/{$tenant->id}/status", [
            'status' => TenantVerificationStatus::Approved->value,
        ])->assertOk();
        $this->provision($tenant);

        $staff = $this->createUser('merchant-publish-staff@example.test');
        $staffRole = Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail();
        app(RoleAssignmentService::class)->assignTenantRole($tenant, $staff, $staffRole, $owner);
        $this->startBrowserSessionAs($staff);
        $this->postJson("/api/merchant/stores/{$tenant->id}/publication/publish")->assertForbidden();

        $publicHost = 'merchant-publish-shop.'.config('tenancy.tenant_base_domain');
        $this->startBrowserSessionAs($owner);
        $this->postJson("/api/merchant/stores/{$tenant->id}/publication/publish")
            ->assertOk()
            ->assertJsonPath('data.publicationStatus', 'published')
            ->assertJsonPath('data.capabilities.publish', false)
            ->assertJsonPath('data.capabilities.unpublish', true);
        $this->postJson("/api/merchant/stores/{$tenant->id}/publication/publish")->assertOk();
        $this->getJson('http://'.$publicHost.'/api/store/config')->assertOk();
        $this->assertSame(1, DB::table('admin_audit_logs')
            ->where('tenant_id', $tenant->id)
            ->where('action', 'merchant.store.published')
            ->count());

        $this->startBrowserSessionAs($owner);
        $this->postJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/publication/unpublish")
            ->assertOk()
            ->assertJsonPath('data.publicationStatus', 'unpublished');
        $this->postJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/publication/unpublish")->assertOk();
        $this->getJson('http://'.$publicHost.'/api/store/config')->assertNotFound();
        $this->assertSame(1, DB::table('admin_audit_logs')
            ->where('tenant_id', $tenant->id)
            ->where('action', 'merchant.store.unpublished')
            ->count());
    }

    public function test_wp55_rollback_refuses_to_erase_durable_draft_history(): void
    {
        $owner = $this->createUser('rollback-draft-owner@example.test');
        $this->saveDraft($owner, 'rollback', 'rollback-draft-shop', 'starter');
        $migration = require database_path('migrations/system/2026_08_19_000010_create_store_drafts_and_merchant_publication.php');

        try {
            $migration->down();
            $this->fail('A populated WP 5.5 lifecycle must not be rolled back.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('cannot be rolled back', $exception->getMessage());
        }

        $this->assertDatabaseHas('store_drafts', ['owner_user_id' => $owner->id]);
    }

    private function saveDraft(User $owner, string $label, string $handle, string $plan): StoreDraft
    {
        $this->startBrowserSessionAs($owner);
        $business = $this->putJson('/api/merchant/store-draft/business', [
            'expectedRevision' => 0,
            'storeName' => 'Store '.$label,
            'businessType' => 'retail',
        ])->assertOk();
        $design = $this->putJson('/api/merchant/store-draft/design', [
            'expectedRevision' => (int) $business->json('data.revision'),
            'themeStyle' => 'elegant',
            'config' => StoreOnboardingAppearance::extract($this->storeConfig($label)),
        ])->assertOk();
        $response = $this->putJson('/api/merchant/store-draft/review', [
            'expectedRevision' => (int) $design->json('data.revision'),
            'handle' => $handle,
            'planKey' => $plan,
        ])->assertOk()->assertJsonPath('data.onboardingStage', 'review');

        return StoreDraft::query()->findOrFail((string) $response->json('data.id'));
    }

    private function submitDraft(User $owner, StoreDraft $draft, string $label, ?string $idempotencyKey = null): Tenant
    {
        $this->startBrowserSessionAs($owner);
        if (! $draft->applicationEvidence()->exists()) {
            $this->resolveStoreApplicationRequirements($draft, $owner);
        }
        $payload = $this->submissionPayloadForDraft($draft) + [
            'draftId' => $draft->id,
            'expectedDraftRevision' => $draft->revision,
        ];
        $response = $this->withHeader('Idempotency-Key', $idempotencyKey ?? (string) Str::uuid())
            ->postJson('/api/register-store', $payload)
            ->assertCreated()
            ->assertJsonStructure([
                'data' => [
                    'internalDomain',
                    'requestedDomain',
                    'publicDomain',
                    'plan',
                    'subscriptionStatus',
                    'publicationBlockers',
                ],
                'meta' => ['replayed'],
            ]);
        $tenant = Tenant::query()->findOrFail((string) $response->json('data.id'));
        $this->tenantIds[] = $tenant->id;

        return $tenant;
    }

    private function provision(Tenant $tenant): void
    {
        $run = ProvisioningRun::query()->where('tenant_id', $tenant->id)->latest('run_number')->firstOrFail();
        $this->schemas[] = (string) $run->schema_name;
        app(TenantProvisioner::class)->provision((string) $run->id, 1, 3);
        $this->assertSame(ProvisioningState::Active->value, $tenant->refresh()->provisioning_status);
    }

    private function startBrowserSessionAs(User $user): void
    {
        $this->flushSession();
        $this->actingAs($user);
    }

    private function createUser(string $email): User
    {
        $user = User::query()->create([
            'name' => 'WP 5.5 User',
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

    /**
     * @param  array<string, mixed>  $payload
     * @return list<array{status: string, tenant_id: string}>
     */
    private function runConcurrentSubmissions(User $actor, array $payload, int $workers): array
    {
        if (! function_exists('pcntl_fork') || ! function_exists('stream_socket_pair')) {
            $this->fail('The database gate requires pcntl and socket pairs for real concurrent submissions.');
        }

        $children = [];
        for ($index = 0; $index < $workers; $index++) {
            $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            if ($sockets === false) {
                $this->fail('Unable to create the submission concurrency barrier.');
            }
            [$parentSocket, $childSocket] = $sockets;
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('Unable to fork a submission worker.');
            }
            if ($pid === 0) {
                fclose($parentSocket);
                fread($childSocket, 1);
                try {
                    if (tenancy()->initialized) {
                        tenancy()->end();
                    }
                    $central = (string) config('tenancy.database.central_connection');
                    DB::purge('tenant');
                    DB::purge($central);
                    DB::setDefaultConnection($central);
                    $result = app(StoreSubmissionService::class)->submit(
                        $payload,
                        $actor,
                        Request::create('/api/register-store', 'POST'),
                    );
                    $outcome = [
                        'status' => $result['replayed'] ? 'replayed' : 'created',
                        'tenant_id' => (string) $result['tenant']->getKey(),
                    ];
                } catch (\Throwable $exception) {
                    $outcome = ['status' => 'error', 'tenant_id' => $exception::class.':'.$exception->getMessage()];
                }
                fwrite($childSocket, json_encode($outcome, JSON_THROW_ON_ERROR));
                fclose($childSocket);
                exit(0);
            }
            fclose($childSocket);
            $children[] = ['pid' => $pid, 'socket' => $parentSocket];
        }

        foreach ($children as $child) {
            fwrite($child['socket'], '1');
        }

        $results = [];
        foreach ($children as $child) {
            $encoded = stream_get_contents($child['socket']);
            fclose($child['socket']);
            pcntl_waitpid($child['pid'], $status);
            $this->assertTrue(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
            $decoded = json_decode((string) $encoded, true, 512, JSON_THROW_ON_ERROR);
            $this->assertNotSame('error', $decoded['status'] ?? null, (string) ($decoded['tenant_id'] ?? 'unknown child error'));
            $results[] = $decoded;
        }

        DB::purge((string) config('tenancy.database.central_connection'));

        return $results;
    }

    /** @return array<string, mixed> */
    private function draftPayload(
        string $label,
        int $revision,
        ?string $handle = 'draft-shop',
        ?string $plan = 'starter',
    ): array {
        return [
            'expectedRevision' => $revision,
            'storeName' => 'Store '.$label,
            'businessType' => 'retail',
            'themeStyle' => 'elegant',
            'handle' => $handle,
            'planKey' => $plan,
            'config' => $this->storeConfig($label),
        ];
    }

    /** @return array<string, mixed> */
    private function submissionPayload(string $label, string $handle, string $plan): array
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
    private function submissionPayloadForDraft(StoreDraft $draft): array
    {
        return [
            'storeName' => $draft->store_name,
            'businessType' => $draft->business_type,
            'themeStyle' => (string) $draft->theme_style,
            'handle' => $draft->handle,
            'planKey' => $draft->plan_key,
            'config' => $draft->config,
        ];
    }

    /** @return array<string, mixed> */
    private function storeConfig(string $label): array
    {
        return array_replace(StoreOnboardingBaseline::make('Store '.$label), [
            'storeName' => 'Store '.$label,
            'slogan' => 'Server-owned draft',
            'logoIcon' => 'S',
            'primaryColor' => '#112233',
            'secondaryColor' => '#334455',
            'themeStyle' => 'elegant',
            'bannerText' => 'WP 5.5 '.$label,
            'fontFamily' => 'Cairo',
            'phone' => '+967700000000',
        ]);
    }
}
