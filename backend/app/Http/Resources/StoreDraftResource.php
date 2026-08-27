<?php

namespace App\Http\Resources;

use App\Enums\StoreOnboardingStage;
use App\Models\StoreDraft;
use App\Services\StoreApplicationService;
use App\Services\StoreOnboardingReadiness;
use App\Support\StorefrontSectionLayout;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin StoreDraft */
class StoreDraftResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $savedAt = $this->getAttribute('saved_at');
        $submittedAt = $this->getAttribute('submitted_at');
        $stage = $this->getAttribute('onboarding_stage');
        $readiness = app(StoreOnboardingReadiness::class)->inspect($this->resource);

        return [
            'id' => $this->getKey(),
            'tenantId' => $this->getAttribute('tenant_id'),
            'status' => $this->getAttribute('status')->value,
            'revision' => (int) $this->getAttribute('revision'),
            'onboardingStage' => $stage instanceof StoreOnboardingStage ? $stage->value : null,
            'onboardingReadiness' => $readiness === null ? null : [
                'business' => $readiness['business'],
                'design' => $readiness['design'],
                'review' => $readiness['review'],
                'blockers' => $readiness['blockers'],
            ],
            'nextRequiredStep' => $readiness['nextRequiredStep'] ?? null,
            'storeName' => $this->getAttribute('store_name'),
            'businessType' => $this->getAttribute('business_type'),
            'themeStyle' => $this->getAttribute('theme_style'),
            'handle' => $this->getAttribute('handle'),
            'planKey' => $this->getAttribute('plan_key'),
            'config' => StorefrontSectionLayout::withoutLayout((array) $this->getAttribute('config')),
            'savedAt' => $savedAt instanceof CarbonInterface ? $savedAt->toIso8601String() : null,
            'submittedAt' => $submittedAt instanceof CarbonInterface ? $submittedAt->toIso8601String() : null,
            'application' => app(StoreApplicationService::class)->summary($this->resource),
        ];
    }
}
