<?php

namespace App\Models;

use App\Enums\StoreDraftStatus;
use App\Enums\StoreOnboardingStage;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class StoreDraft extends Model
{
    use CentralConnection, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => StoreDraftStatus::class,
            'revision' => 'integer',
            'onboarding_stage' => StoreOnboardingStage::class,
            'onboarding_stage_baseline' => StoreOnboardingStage::class,
            'config' => 'array',
            'saved_at' => 'immutable_datetime',
            'submitted_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /** @return BelongsTo<Plan, $this> */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_key');
    }

    /** @return HasMany<StoreApplicationEvidence, $this> */
    public function applicationEvidence(): HasMany
    {
        return $this->hasMany(StoreApplicationEvidence::class, 'store_draft_id');
    }

    /** @return HasMany<StoreApplicationEvent, $this> */
    public function applicationEvents(): HasMany
    {
        return $this->hasMany(StoreApplicationEvent::class, 'store_draft_id')->orderBy('occurred_at');
    }

    /** @return HasOne<StoreCorrectionRequest, $this> */
    public function openCorrectionRequest(): HasOne
    {
        return $this->hasOne(StoreCorrectionRequest::class, 'store_draft_id')
            ->where('status', 'open')
            ->orderByDesc('requested_at');
    }
}
