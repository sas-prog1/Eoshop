<?php

namespace Tests\Integration;

use App\Enums\ApplicationEvidenceReviewStatus;
use App\Enums\SystemRole;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Models\AdminAuditLog;
use App\Models\Role;
use App\Models\StoreApplicationEvent;
use App\Models\StoreApplicationEvidence;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RoleAssignmentService;
use App\Support\StoreOnboardingBaseline;
use Database\Seeders\IdentitySeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class PlatformStoreReviewWorkspaceTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
        Storage::fake('local');
        config()->set('store_application.disk', 'local');
        config()->set('queue.default', 'database');
        config()->set('queue.connections.database.connection', config('tenancy.database.central_connection'));
        config()->set('queue.connections.database.after_commit', false);
    }

    public function test_reviewer_uses_detailed_dossier_and_cannot_approve_unreviewed_evidence(): void
    {
        [$tenant, $owner] = $this->submittedStore('review-workspace');
        $reviewer = $this->platformReviewer();
        $evidence = StoreApplicationEvidence::query()->where('tenant_id', $tenant->id)->orderBy('requirement_key')->get();
        $evidence->each->forceFill(['review_status' => ApplicationEvidenceReviewStatus::Pending])->each->save();
        $uploaded = $evidence->firstWhere('requirement_key', 'owner_identity');
        Storage::disk('local')->put((string) $uploaded->path, 'private identity evidence');

        Auth::forgetGuards();
        $this->flushSession();
        $this->getJson("/api/admin/stores/{$tenant->id}")->assertUnauthorized();
        $this->asUser($owner)->getJson("/api/admin/stores/{$tenant->id}")->assertForbidden();

        $detail = $this->asUser($reviewer)
            ->getJson("/api/admin/stores/{$tenant->id}")
            ->assertOk()
            ->assertJsonPath('data.applicationWorkspace.snapshot.handle', 'review-workspace')
            ->assertJsonPath('data.applicationWorkspace.snapshot.planKey', 'starter')
            ->assertJsonPath('data.applicationWorkspace.decisionReady', false)
            ->assertJsonPath('data.operations.tenant.id', $tenant->id)
            ->assertJsonCount(2, 'data.applicationWorkspace.checklist');

        $downloadUrl = collect($detail->json('data.applicationWorkspace.dossier.requirements'))
            ->firstWhere('key', 'owner_identity')['evidence']['downloadUrl'];
        $this->asUser($reviewer)->get((string) $downloadUrl)
            ->assertOk()
            ->assertHeader('cache-control', 'no-store, private');

        $this->asUser($reviewer)
            ->patchJson("/api/admin/stores/{$tenant->id}/status", ['status' => TenantVerificationStatus::Approved->value])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('application');

        foreach ($evidence as $item) {
            $this->asUser($reviewer)
                ->patchJson("/api/admin/stores/{$tenant->id}/application/evidence/{$item->id}", [
                    'status' => ApplicationEvidenceReviewStatus::Accepted->value,
                ])
                ->assertOk();
        }

        $this->asUser($reviewer)
            ->getJson("/api/admin/stores/{$tenant->id}")
            ->assertOk()
            ->assertJsonPath('data.applicationWorkspace.decisionReady', true)
            ->assertJsonPath('data.applicationWorkspace.dossier.reviewBlockers', []);
        $this->asUser($reviewer)
            ->patchJson("/api/admin/stores/{$tenant->id}/status", ['status' => TenantVerificationStatus::Approved->value])
            ->assertOk()
            ->assertJsonPath('data.verificationStatus', TenantVerificationStatus::Approved->value);

        $this->assertSame(2, AdminAuditLog::query()
            ->where('tenant_id', $tenant->id)
            ->where('action', 'platform.store_application.evidence_reviewed')
            ->count());
        $this->assertSame(2, StoreApplicationEvent::query()
            ->where('tenant_id', $tenant->id)
            ->where('event_type', 'document_accepted')
            ->count());
    }

    public function test_evidence_review_and_download_are_scoped_to_the_route_tenant(): void
    {
        [$first] = $this->submittedStore('review-isolation-a');
        [$second] = $this->submittedStore('review-isolation-b');
        $reviewer = $this->platformReviewer('review-isolation@example.test');
        $evidence = StoreApplicationEvidence::query()->where('tenant_id', $first->id)->firstOrFail();

        $this->asUser($reviewer)
            ->get("/api/admin/stores/{$second->id}/application/evidence/{$evidence->id}")
            ->assertNotFound();
        $this->asUser($reviewer)
            ->patchJson("/api/admin/stores/{$second->id}/application/evidence/{$evidence->id}", [
                'status' => ApplicationEvidenceReviewStatus::Accepted->value,
            ])->assertNotFound();
    }

    /** @return array{Tenant, User} */
    private function submittedStore(string $handle): array
    {
        $owner = User::query()->create([
            'name' => 'WP 5.24 merchant',
            'email' => $handle.'@example.test',
            'password' => 'secure-pass-123',
            'status' => UserStatus::Active,
        ]);
        $payload = $this->readyStoreSubmissionPayload($owner, [
            'storeName' => 'متجر مراجعة المنصة',
            'businessType' => 'retail',
            'themeStyle' => 'elegant',
            'handle' => $handle,
            'planKey' => 'starter',
            'config' => StoreOnboardingBaseline::make('متجر مراجعة المنصة'),
        ]);
        $response = $this->asUser($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/register-store', $payload)
            ->assertCreated();

        return [Tenant::query()->findOrFail((string) $response->json('data.id')), $owner];
    }

    private function platformReviewer(string $email = 'wp524-reviewer@example.test'): User
    {
        $reviewer = User::query()->firstOrCreate(['email' => $email], [
            'name' => 'WP 5.24 reviewer',
            'password' => 'secure-pass-123',
            'status' => UserStatus::Active,
        ]);
        app(RoleAssignmentService::class)->assignPlatformRole(
            $reviewer,
            Role::query()->where('key', SystemRole::PlatformReviewer->value)->firstOrFail(),
            $reviewer,
        );

        return $reviewer->refresh();
    }

    private function asUser(User $user): static
    {
        Auth::forgetGuards();
        $this->flushSession();

        return $this->actingAs($user);
    }
}
