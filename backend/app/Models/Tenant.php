<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains;

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'publication_requested_at' => 'immutable_datetime',
            'published_at' => 'immutable_datetime',
            'active_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return HasMany<Domain, $this>
     */
    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class, 'tenant_id');
    }

    /**
     * @return BelongsToMany<User, $this, TenantMembership, 'pivot'>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'tenant_user')
            ->using(TenantMembership::class)
            ->withPivot(['role_id', 'role_scope', 'status', 'invited_by', 'joined_at'])
            ->withTimestamps();
    }

    /** @return HasOne<StoreSubmission, $this> */
    public function submission(): HasOne
    {
        return $this->hasOne(StoreSubmission::class, 'tenant_id');
    }

    /** @return HasOne<StoreDraft, $this> */
    public function draft(): HasOne
    {
        return $this->hasOne(StoreDraft::class, 'tenant_id');
    }

    /** @return HasMany<StoreCorrectionRequest, $this> */
    public function correctionRequests(): HasMany
    {
        return $this->hasMany(StoreCorrectionRequest::class, 'tenant_id');
    }

    /** @return HasMany<ProvisioningRun, $this> */
    public function provisioningRuns(): HasMany
    {
        return $this->hasMany(ProvisioningRun::class, 'tenant_id');
    }

    /** @return HasOne<ProvisioningRun, $this> */
    public function latestProvisioningRun(): HasOne
    {
        // PostgreSQL intentionally has no MAX(uuid), which Laravel's
        // latestOfMany() uses as a tie-breaker. Run numbers are monotonic per
        // tenant, so ordering the has-one relation is deterministic here.
        return $this->hasOne(ProvisioningRun::class, 'tenant_id')->orderByDesc('run_number');
    }

    /** @return HasMany<DomainReservation, $this> */
    public function domainReservations(): HasMany
    {
        return $this->hasMany(DomainReservation::class, 'tenant_id');
    }

    /** @return HasMany<TenantSubscription, $this> */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class, 'tenant_id');
    }

    /** @return BelongsTo<PublicationRequest, $this> */
    public function currentPublicationRequest(): BelongsTo
    {
        return $this->belongsTo(PublicationRequest::class, 'publication_request_id');
    }

    /** @return BelongsTo<Domain, $this> */
    public function publishedDomain(): BelongsTo
    {
        return $this->belongsTo(Domain::class, 'published_domain_id');
    }

    /** @return BelongsTo<TenantSubscription, $this> */
    public function publicationSubscription(): BelongsTo
    {
        return $this->belongsTo(TenantSubscription::class, 'publication_subscription_id');
    }

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'store_name',
            'owner_name',
            'owner_email',
            'owner_phone',
            'business_type',
            'verification_status',
            'provisioning_status',
            'publication_status',
            'publication_requested_at',
            'published_at',
            'publication_request_id',
            'published_domain_id',
            'publication_subscription_id',
            'active_at',
            'rejection_reason',
            'theme_style',
            'created_at',
            'updated_at',
        ];
    }
}
