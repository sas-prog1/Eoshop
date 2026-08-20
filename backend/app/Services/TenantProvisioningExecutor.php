<?php

namespace App\Services;

use App\Exceptions\ProvisioningFailure;
use App\Models\Plan;
use App\Models\PublicationRequest;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Support\StoreAssetSchema;
use App\Support\StoreWorkspaceContract;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TenantProvisioningExecutor
{
    public function __construct(private readonly StoreWorkspaceService $workspaces) {}

    public function migrate(Tenant $tenant): void
    {
        $exitCode = Artisan::call('tenants:migrate', [
            '--tenants' => [$tenant->getKey()],
            '--force' => true,
            '--no-interaction' => true,
        ]);

        if ($exitCode !== 0) {
            throw new ProvisioningFailure('tenant_migrations_failed', 'Tenant database migrations did not complete.');
        }
    }

    public function initializeConfig(Tenant $tenant, StoreSubmission $submission): void
    {
        DB::connection((string) config('tenancy.database.central_connection'))->transaction(function () use ($tenant, $submission): void {
            $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
            $lockedSubmission = StoreSubmission::query()->whereKey($submission->getKey())->lockForUpdate()->firstOrFail();
            $publication = PublicationRequest::query()
                ->whereKey($lockedTenant->getAttribute('publication_request_id'))
                ->where('tenant_id', $lockedTenant->getKey())
                ->lockForUpdate()
                ->firstOrFail();
            $subscription = TenantSubscription::query()
                ->whereKey($publication->getAttribute('tenant_subscription_id'))
                ->where('tenant_id', $lockedTenant->getKey())
                ->lockForUpdate()
                ->firstOrFail();
            $plan = Plan::query()->whereKey($subscription->getAttribute('plan_key'))->lockForUpdate()->firstOrFail();
            $payload = $lockedSubmission->getAttribute('payload_snapshot');
            $config = is_array($payload) ? ($payload['config'] ?? null) : null;

            if (! is_array($config)) {
                throw new ProvisioningFailure('initial_config_missing', 'The initial store configuration is unavailable.');
            }

            $validator = StoreWorkspaceContract::validator(
                $config,
                $plan->getAttribute('max_products') === null ? null : (int) $plan->getAttribute('max_products'),
            );
            if ($validator->fails()) {
                throw new ProvisioningFailure('initial_config_invalid', 'The initial store configuration does not satisfy the current server contract.');
            }

            $lockedTenant->run(function () use ($lockedTenant, $lockedSubmission, $config): void {
                $this->workspaces->initialize(
                    $lockedTenant,
                    (string) $lockedSubmission->getAttribute('initial_config_id'),
                    $config,
                );
            });
        });
    }

    public function assertReady(Tenant $tenant, StoreSubmission $submission): void
    {
        $ready = $tenant->run(static fn (): bool => Schema::hasTable('store_configs')
            && Schema::hasTable('products')
            && Schema::hasTable('catalog_settings')
            && Schema::hasTable('product_media')
            && StoreAssetSchema::ready()
            && DB::table('catalog_settings')->where('id', 1)->count() === 1
            && DB::table('store_configs')
                ->where('id', $submission->getAttribute('initial_config_id'))
                ->where('is_current', true)
                ->where('products_materialized', true)
                ->exists());

        if (! $ready) {
            throw new ProvisioningFailure('tenant_readiness_failed', 'The tenant database did not pass its readiness check.');
        }
    }
}
