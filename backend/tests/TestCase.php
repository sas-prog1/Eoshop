<?php

namespace Tests;

use App\Enums\ApplicationEvidenceResolution;
use App\Enums\ApplicationEvidenceReviewStatus;
use App\Enums\StoreDraftStatus;
use App\Enums\StoreOnboardingStage;
use App\Http\Middleware\EnsureActiveUserSession;
use App\Models\StoreApplicationEvidence;
use App\Models\StoreDraft;
use Illuminate\Contracts\Auth\Authenticatable as UserContract;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    public function actingAs(UserContract $user, $guard = null): static
    {
        parent::actingAs($user, $guard);

        $generation = method_exists($user, 'getAttribute')
            ? $user->getAttribute('session_generation')
            : null;

        if (is_int($generation)) {
            $this->withSession([
                EnsureActiveUserSession::SESSION_GENERATION_KEY => $generation,
            ]);
        }

        return $this;
    }

    /**
     * Prepare an application-ready server draft for integration tests whose
     * primary concern is downstream submission, provisioning, or workspace behavior.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    protected function readyStoreSubmissionPayload(UserContract $owner, array $payload): array
    {
        $draft = StoreDraft::query()->create([
            'owner_user_id' => $owner->getAuthIdentifier(),
            'tenant_id' => null,
            'status' => StoreDraftStatus::Draft,
            'revision' => 1,
            'onboarding_stage' => StoreOnboardingStage::Review,
            'onboarding_stage_baseline' => StoreOnboardingStage::Review,
            'store_name' => $payload['storeName'],
            'business_type' => $payload['businessType'],
            'theme_style' => $payload['themeStyle'],
            'handle' => $payload['handle'],
            'plan_key' => $payload['planKey'],
            'config' => $payload['config'],
            'saved_at' => now(),
        ]);

        $this->resolveStoreApplicationRequirements($draft, $owner);

        return $payload + [
            'draftId' => $draft->getKey(),
            'expectedDraftRevision' => 1,
        ];
    }

    protected function resolveStoreApplicationRequirements(StoreDraft $draft, UserContract $owner): void
    {
        StoreApplicationEvidence::query()->create([
            'store_draft_id' => $draft->getKey(),
            'owner_user_id' => $owner->getAuthIdentifier(),
            'tenant_id' => null,
            'requirement_key' => 'owner_identity',
            'resolution' => ApplicationEvidenceResolution::Uploaded,
            'review_status' => ApplicationEvidenceReviewStatus::Accepted,
            'original_name' => 'identity.pdf',
            'disk' => 'local',
            'path' => 'integration-fixtures/'.$draft->getKey().'/identity.pdf',
            'mime_type' => 'application/pdf',
            'byte_size' => 32,
            'checksum_sha256' => str_repeat('a', 64),
            'upload_idempotency_key' => (string) Str::uuid(),
            'uploaded_at' => now(),
        ]);
        StoreApplicationEvidence::query()->create([
            'store_draft_id' => $draft->getKey(),
            'owner_user_id' => $owner->getAuthIdentifier(),
            'tenant_id' => null,
            'requirement_key' => 'commercial_registration',
            'resolution' => ApplicationEvidenceResolution::Exempted,
            'review_status' => ApplicationEvidenceReviewStatus::Accepted,
            'exemption_reason' => 'Integration fixture for an unregistered small retail activity.',
        ]);
    }
}
