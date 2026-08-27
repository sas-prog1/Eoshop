<?php

namespace Tests\Integration;

use App\Enums\StoreDraftStatus;
use App\Enums\StoreOnboardingStage;
use App\Enums\SystemRole;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Models\Role;
use App\Models\StoreApplicationEvent;
use App\Models\StoreApplicationEvidence;
use App\Models\StoreCorrectionRequest;
use App\Models\StoreDraft;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RoleAssignmentService;
use App\Support\StoreOnboardingBaseline;
use Database\Seeders\IdentitySeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class StoreApplicationDossierTest extends TestCase
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

    public function test_owner_completes_private_dossier_before_submission_and_other_accounts_are_isolated(): void
    {
        $owner = $this->user('dossier-owner@example.test');
        $outsider = $this->user('dossier-outsider@example.test');
        $draft = $this->draft($owner, 'dossier-store');

        $this->actingAs($owner)
            ->getJson("/api/merchant/store-drafts/{$draft->id}/application")
            ->assertOk()
            ->assertJsonPath('data.ready', false)
            ->assertJsonPath('data.blockers.0', 'owner_identity')
            ->assertJsonPath('data.blockers.1', 'commercial_registration');

        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/register-store', $this->submissionPayload($draft, 1))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('application');

        $upload = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/store-drafts/{$draft->id}/evidence/owner_identity", [
                'expectedRevision' => 1,
                'document' => UploadedFile::fake()->createWithContent(
                    'identity.pdf',
                    "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF",
                ),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.draftRevision', 2)
            ->assertJsonPath('data.ready', false);
        $downloadUrl = (string) $upload->json('data.requirements.0.evidence.downloadUrl');

        $completed = $this->actingAs($owner)
            ->putJson("/api/merchant/store-drafts/{$draft->id}/exemptions/commercial_registration", [
                'expectedRevision' => 2,
                'reason' => 'نشاط تجريبي صغير غير مسجل تجاريًا في الوقت الحالي.',
            ])
            ->assertOk()
            ->assertJsonPath('data.draftRevision', 3)
            ->assertJsonPath('data.ready', true)
            ->assertJsonPath('data.blockers', []);

        $this->actingAs($owner)->get($downloadUrl)
            ->assertOk()
            ->assertHeader('cache-control', 'no-store, private');
        $this->flushSession();
        $this->actingAs($outsider)->getJson("/api/merchant/store-drafts/{$draft->id}/application")
            ->assertForbidden();
        $this->actingAs($outsider)->get($downloadUrl)->assertForbidden();

        $this->flushSession();
        $response = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/register-store', $this->submissionPayload($draft->refresh(), (int) $completed->json('data.draftRevision')))
            ->assertCreated()
            ->assertJsonPath('data.verificationStatus', TenantVerificationStatus::Pending->value);
        $tenantId = (string) $response->json('data.id');

        $this->assertSame(2, StoreApplicationEvidence::query()->where('tenant_id', $tenantId)->count());
        $this->assertCount(2, StoreSubmission::query()->where('tenant_id', $tenantId)->firstOrFail()->payload_snapshot['applicationEvidence']);
        $this->assertSame(
            ['document_uploaded', 'exemption_declared', 'submitted'],
            StoreApplicationEvent::query()->where('tenant_id', $tenantId)->orderBy('occurred_at')->pluck('event_type')->all(),
        );
    }

    public function test_targeted_correction_requires_a_real_change_and_final_rejection_is_not_an_edit_loop(): void
    {
        $owner = $this->user('correction-owner-wp523@example.test');
        $payload = $this->readyStoreSubmissionPayload($owner, $this->payload('correction-store'));
        $created = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/register-store', $payload)
            ->assertCreated();
        $tenant = Tenant::query()->findOrFail((string) $created->json('data.id'));
        $draft = StoreDraft::query()->findOrFail((string) $payload['draftId']);
        $reviewer = $this->platformUser('dossier-reviewer@example.test', SystemRole::PlatformReviewer);

        $this->flushSession();
        $this->actingAs($reviewer)
            ->patchJson("/api/admin/stores/{$tenant->id}/status", [
                'status' => TenantVerificationStatus::ChangesRequested->value,
                'reason' => 'أعد رفع إثبات الهوية بصورة كاملة وواضحة.',
                'requestedFields' => ['documents.owner_identity'],
            ])
            ->assertOk()
            ->assertJsonPath('data.verificationStatus', TenantVerificationStatus::ChangesRequested->value)
            ->assertJsonPath('data.application.ready', false)
            ->assertJsonPath('data.application.correctionRequest.requestedFields.0', 'documents.owner_identity');

        $correctionRevision = (int) $draft->refresh()->revision;
        $this->flushSession();
        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/merchant/stores/{$tenant->id}/resubmit", ['expectedRevision' => $correctionRevision])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('application');

        $corrected = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/store-drafts/{$draft->id}/evidence/owner_identity", [
                'expectedRevision' => $correctionRevision,
                'document' => UploadedFile::fake()->createWithContent(
                    'corrected-identity.pdf',
                    "%PDF-1.4\n2 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
                ),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.ready', true);
        $correctedRevision = (int) $corrected->json('data.draftRevision');

        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/merchant/stores/{$tenant->id}/resubmit", ['expectedRevision' => $correctedRevision])
            ->assertOk()
            ->assertJsonPath('data.verificationStatus', TenantVerificationStatus::Pending->value)
            ->assertJsonPath('data.application.correctionRequest', null);
        $this->assertDatabaseHas('store_correction_requests', [
            'tenant_id' => $tenant->id,
            'status' => 'resolved',
        ]);

        $this->flushSession();
        $this->actingAs($reviewer)
            ->patchJson("/api/admin/stores/{$tenant->id}/status", [
                'status' => TenantVerificationStatus::Rejected->value,
                'reason' => 'تعذر التحقق النهائي من أهلية النشاط بعد الاستكمال.',
            ])
            ->assertOk()
            ->assertJsonPath('data.verificationStatus', TenantVerificationStatus::Rejected->value);

        $this->assertSame(StoreDraftStatus::Submitted, $draft->refresh()->status);
        $this->assertSame(0, StoreCorrectionRequest::query()->where('tenant_id', $tenant->id)->where('status', 'open')->count());
        $this->flushSession();
        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/store-drafts/{$draft->id}/evidence/owner_identity", [
                'expectedRevision' => (int) $draft->revision,
                'document' => UploadedFile::fake()->createWithContent('late.pdf', "%PDF-1.4\n%%EOF"),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable();
        $this->assertTrue(StoreApplicationEvent::query()->where('tenant_id', $tenant->id)->where('event_type', 'rejected')->exists());
    }

    private function user(string $email): User
    {
        return User::query()->create([
            'name' => 'WP 5.23 merchant',
            'email' => $email,
            'password' => 'secure-pass-123',
            'status' => UserStatus::Active,
        ]);
    }

    private function platformUser(string $email, SystemRole $role): User
    {
        $user = $this->user($email);
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', $role->value)->firstOrFail(),
            $user,
        );

        return $user->refresh();
    }

    private function draft(User $owner, string $handle): StoreDraft
    {
        return StoreDraft::query()->create([
            'owner_user_id' => $owner->id,
            'tenant_id' => null,
            'status' => StoreDraftStatus::Draft,
            'revision' => 1,
            'onboarding_stage' => StoreOnboardingStage::Review,
            'onboarding_stage_baseline' => StoreOnboardingStage::Review,
            'store_name' => 'متجر ملف الطلب',
            'business_type' => 'retail',
            'theme_style' => 'elegant',
            'handle' => $handle,
            'plan_key' => 'starter',
            'config' => StoreOnboardingBaseline::make('متجر ملف الطلب'),
            'saved_at' => now(),
        ]);
    }

    /** @return array<string, mixed> */
    private function payload(string $handle): array
    {
        return [
            'storeName' => 'متجر التصحيح',
            'businessType' => 'retail',
            'themeStyle' => 'elegant',
            'handle' => $handle,
            'planKey' => 'starter',
            'config' => StoreOnboardingBaseline::make('متجر التصحيح'),
        ];
    }

    /** @return array<string, mixed> */
    private function submissionPayload(StoreDraft $draft, int $revision): array
    {
        return [
            'draftId' => $draft->id,
            'expectedDraftRevision' => $revision,
            'storeName' => $draft->store_name,
            'businessType' => $draft->business_type,
            'themeStyle' => $draft->theme_style,
            'handle' => $draft->handle,
            'planKey' => $draft->plan_key,
            'config' => $draft->config,
        ];
    }
}
