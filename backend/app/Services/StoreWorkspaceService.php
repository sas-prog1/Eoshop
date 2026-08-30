<?php

namespace App\Services;

use App\Enums\PermissionKey;
use App\Enums\SubscriptionStatus;
use App\Enums\TenantMembershipStatus;
use App\Exceptions\StoreWorkspaceConflict;
use App\Models\Plan;
use App\Models\PublicationRequest;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Support\CheckoutPolicyContract;
use App\Support\StoreContactTarget;
use App\Support\StorefrontMarketingBlocks;
use App\Support\StorefrontSectionLayout;
use App\Support\TenantWorkspaceReadiness;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class StoreWorkspaceService
{
    public function __construct(
        private readonly ProductCatalogService $catalogs,
        private readonly StoreAssetService $assets,
    ) {}

    /** @return array{tenantId: string, revision: int, catalogRevision: int, config: array<string, mixed>, updatedAt: ?string} */
    public function read(Tenant $tenant, User $actor): array
    {
        return $this->withLockedMembership($tenant, $actor, false, function (Tenant $lockedTenant) use ($actor): array {
            $this->assertReady($lockedTenant);

            $workspace = $lockedTenant->run(fn (): array => $this->composeSnapshot($lockedTenant, false));
            $workspace['config']['products'] = $this->catalogs->projectProductsForActor(
                $workspace['config']['products'],
                $lockedTenant,
                $actor,
            );
            $workspace['capabilities'] = $this->inventoryCapabilities($lockedTenant, $actor);

            return $workspace;
        });
    }

    /** @return array{tenantId: string, revision: int, catalogRevision: int, config: array<string, mixed>, updatedAt: ?string} */
    public function readPublic(Tenant $tenant): array
    {
        $this->assertReady($tenant);
        if (! TenantWorkspaceReadiness::isMaterialized($tenant)) {
            throw new StoreWorkspaceConflict(
                'The public catalog is not materialized.',
                'workspace_not_ready',
            );
        }

        if (tenancy()->initialized && (string) tenant('id') === (string) $tenant->getKey()) {
            return $this->composeSnapshot($tenant, true);
        }

        return $tenant->run(fn (): array => $this->composeSnapshot($tenant, true));
    }

    /**
     * @param  array{revision: int, catalogRevision: int, config: array<string, mixed>, archiveProductIds?: list<string>}  $payload
     * @return array{tenantId: string, revision: int, catalogRevision: int, config: array<string, mixed>, updatedAt: ?string}
     */
    public function update(Tenant $tenant, User $actor, array $payload): array
    {
        return $this->withLockedMembership($tenant, $actor, true, function (Tenant $lockedTenant) use ($actor, $payload): array {
            $this->assertReady($lockedTenant);
            $limit = $this->lockedProductLimit($lockedTenant);
            $products = $payload['config']['products'];

            $liveProductCount = count(array_filter($products, static fn (mixed $product): bool => is_array($product)
                && ($product['status'] ?? 'published') !== 'archived'));
            if ($limit !== null && $liveProductCount > $limit) {
                throw new StoreWorkspaceConflict(
                    "The selected plan allows at most {$limit} products.",
                    'workspace_quota_exceeded',
                );
            }

            $workspace = $lockedTenant->run(function () use ($lockedTenant, $payload, $products, $limit): array {
                return DB::transaction(function () use ($lockedTenant, $payload, $products, $limit): array {
                    $record = $this->currentConfig(true);

                    if ((int) $record->revision !== (int) $payload['revision']) {
                        throw new StoreWorkspaceConflict(
                            'The store workspace changed on another device. Reload it before saving.',
                            'workspace_revision_conflict',
                        );
                    }

                    $currentFullConfig = json_decode((string) $record->config_json, true, 512, JSON_THROW_ON_ERROR);
                    $incomingConfig = StorefrontSectionLayout::forWrite($payload['config'], $currentFullConfig);
                    $incomingConfig = StorefrontMarketingBlocks::forWrite(
                        $incomingConfig,
                        $currentFullConfig,
                        (string) $lockedTenant->getKey(),
                        $products,
                        $payload['archiveProductIds'] ?? [],
                    );
                    $this->assets->syncReferences($lockedTenant, $currentFullConfig, $incomingConfig);

                    $catalog = $this->catalogs->mutate($lockedTenant, [
                        'catalogRevision' => $payload['catalogRevision'],
                        'currencyCode' => $incomingConfig['currency'],
                        'products' => $products,
                        'archiveProductIds' => $payload['archiveProductIds'] ?? [],
                    ], $limit, false, true);
                    $storedConfig = Arr::except($incomingConfig, ['products', 'currency']);
                    $currentConfig = Arr::except($currentFullConfig, ['products', 'currency']);
                    $workspaceChanged = $currentConfig !== $storedConfig || ! (bool) $record->products_materialized;
                    if ($workspaceChanged) {
                        DB::table('store_configs')->where('id', $record->id)->update([
                            'config_json' => json_encode($storedConfig, JSON_THROW_ON_ERROR),
                            'revision' => (int) $record->revision + 1,
                            'products_materialized' => true,
                            'updated_at' => now(),
                        ]);
                    }

                    return $this->compose($lockedTenant, $catalog);
                });
            });
            $workspace['config']['products'] = $this->catalogs->projectProductsForActor(
                $workspace['config']['products'],
                $lockedTenant,
                $actor,
            );
            $workspace['capabilities'] = $this->inventoryCapabilities($lockedTenant, $actor);

            return $workspace;
        });
    }

    /** @param array<string, mixed> $config */
    public function initialize(Tenant $tenant, string $configId, array $config): void
    {
        $config = StorefrontSectionLayout::forProvisioning($config);
        $config = StorefrontMarketingBlocks::forProvisioning($config);
        DB::transaction(function () use ($tenant, $configId, $config): void {
            DB::table('store_configs')->where('is_current', true)->update(['is_current' => false]);
            $now = now();
            DB::table('store_configs')->updateOrInsert(
                ['id' => $configId],
                [
                    'config_json' => json_encode(Arr::except($config, ['products', 'currency']), JSON_THROW_ON_ERROR),
                    'revision' => 1,
                    'products_materialized' => true,
                    'is_current' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
            $this->catalogs->mutate($tenant, [
                'catalogRevision' => (int) DB::table('catalog_settings')->where('id', 1)->value('revision'),
                'currencyCode' => $config['currency'] ?? 'YER',
                'products' => is_array($config['products'] ?? null) ? $config['products'] : [],
                'archiveProductIds' => [],
            ], null, false, true);
        });
    }

    private function assertReady(Tenant $tenant): void
    {
        if (! TenantWorkspaceReadiness::check($tenant)) {
            throw new StoreWorkspaceConflict(
                'The tenant workspace is not ready for server-backed editing.',
                'workspace_not_ready',
            );
        }
    }

    private function lockedProductLimit(Tenant $tenant): ?int
    {
        $publication = PublicationRequest::query()
            ->whereKey($tenant->getAttribute('publication_request_id'))
            ->where('tenant_id', $tenant->getKey())
            ->lockForUpdate()
            ->first();
        if (! $publication instanceof PublicationRequest) {
            throw new StoreWorkspaceConflict('The store has no current publication request.', 'workspace_not_ready');
        }

        $subscription = TenantSubscription::query()
            ->whereKey($publication->getAttribute('tenant_subscription_id'))
            ->where('tenant_id', $tenant->getKey())
            ->lockForUpdate()
            ->first();
        if (! $subscription instanceof TenantSubscription) {
            throw new StoreWorkspaceConflict('The store has no server-owned product entitlement.', 'workspace_entitlement_unavailable');
        }

        $status = $subscription->getAttribute('status');
        $entitled = $status === SubscriptionStatus::PendingActivation
            || ($status === SubscriptionStatus::Active && $subscription->isCurrentlyActive());
        if (! $entitled) {
            throw new StoreWorkspaceConflict(
                'The selected product entitlement is not active or awaiting activation.',
                'workspace_entitlement_unavailable',
            );
        }

        $plan = Plan::query()->whereKey($subscription->getAttribute('plan_key'))->lockForUpdate()->first();
        if (! $plan instanceof Plan) {
            throw new StoreWorkspaceConflict('The selected product plan is unavailable.', 'workspace_entitlement_unavailable');
        }

        $limit = $plan->getAttribute('max_products');

        return $limit === null ? null : (int) $limit;
    }

    /**
     * Lock order is tenant, membership, publication request, subscription, plan, then tenant-schema rows.
     *
     * @template T
     *
     * @param  callable(Tenant): T  $operation
     * @return T
     */
    private function withLockedMembership(Tenant $tenant, User $actor, bool $write, callable $operation): mixed
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($central, $tenant, $actor, $write, $operation): mixed {
            $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
            $membership = $central->table('tenant_user')
                ->where('tenant_id', $lockedTenant->getKey())
                ->where('user_id', $actor->getKey())
                ->lockForUpdate()
                ->first();

            if ($membership === null || $membership->status !== TenantMembershipStatus::Active->value) {
                throw new AuthorizationException('The active tenant membership is required.');
            }
            if ($write && (! $actor->hasTenantPermission($lockedTenant, PermissionKey::TenantStoreManage)
                || ! $actor->hasTenantPermission($lockedTenant, PermissionKey::TenantProductsManage))) {
                throw new AuthorizationException('Both store and product management permissions are required.');
            }

            return $operation($lockedTenant);
        });
    }

    /**
     * @param  array{tenantId: string, revision: int, currencyCode: string, products: list<array<string, mixed>>}|null  $catalog
     * @return array{tenantId: string, revision: int, catalogRevision: int, config: array<string, mixed>, updatedAt: ?string}
     */
    private function compose(Tenant $tenant, ?array $catalog = null, bool $public = false): array
    {
        $record = $this->currentConfig();
        $config = StorefrontSectionLayout::forProjection(
            json_decode((string) $record->config_json, true, 512, JSON_THROW_ON_ERROR),
        );

        $catalog ??= $this->catalogs->compose($tenant, $public);
        $config['products'] = $catalog['products'];
        $config['currency'] = $catalog['currencyCode'];
        $config = StorefrontMarketingBlocks::forProjection(
            $config,
            (string) $tenant->getKey(),
            $catalog['products'],
            $public,
        );
        if ($public) {
            unset($config['customCoupons']);
            $config['enableOnlineCard'] = false;
            $config['enableApplePay'] = false;
            $config['enableStcPay'] = false;
            if (! CheckoutPolicyContract::bankIsUsable($config)) {
                $config['enableBankTransfer'] = false;
                unset($config['bankName'], $config['bankAccountName'], $config['bankIban'], $config['bankAccountNumber']);
            }
            $seenWalletIds = [];
            $wallets = array_values(array_filter(
                is_array($config['customWallets'] ?? null) ? $config['customWallets'] : [],
                static function (mixed $wallet) use (&$seenWalletIds): bool {
                    if (! is_array($wallet) || ! CheckoutPolicyContract::walletIsUsable($wallet)) {
                        return false;
                    }
                    $id = mb_strtolower(trim((string) $wallet['id']));
                    if (isset($seenWalletIds[$id])) {
                        return false;
                    }
                    $seenWalletIds[$id] = true;

                    return true;
                },
            ));
            if (($config['enableEWallets'] ?? false) !== true || $wallets === []) {
                $config['enableEWallets'] = false;
                unset($config['customWallets']);
            } else {
                $config['customWallets'] = $wallets;
            }
            foreach (['phone', 'whatsapp'] as $field) {
                $normalized = StoreContactTarget::normalize($config[$field] ?? null);
                if ($normalized === null) {
                    unset($config[$field]);
                } else {
                    $config[$field] = $normalized;
                }
            }
            if (filter_var($config['email'] ?? null, FILTER_VALIDATE_EMAIL) === false) {
                unset($config['email']);
            }
            foreach (['address', 'workingHours'] as $field) {
                if (trim((string) ($config[$field] ?? '')) === '') {
                    unset($config[$field]);
                }
            }
        }

        return [
            'tenantId' => (string) $tenant->getKey(),
            'revision' => (int) $record->revision,
            'catalogRevision' => $catalog['revision'],
            'config' => $config,
            'updatedAt' => $record->updated_at === null ? null : (string) $record->updated_at,
        ];
    }

    /** @return array{tenantId: string, revision: int, catalogRevision: int, config: array<string, mixed>, updatedAt: ?string} */
    private function composeSnapshot(Tenant $tenant, bool $public): array
    {
        return DB::connection('tenant')->transaction(function () use ($tenant, $public): array {
            DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

            return $this->compose($tenant, null, $public);
        });
    }

    private function currentConfig(bool $lock = false): object
    {
        $query = DB::table('store_configs')->where('is_current', true);
        if ($lock) {
            $query->lockForUpdate();
        }

        $record = $query->first();
        if ($record === null) {
            throw new StoreWorkspaceConflict(
                'The tenant workspace has no current configuration record.',
                'workspace_not_ready',
            );
        }

        return $record;
    }

    /** @return array{inventoryView: bool, inventoryManage: bool} */
    private function inventoryCapabilities(Tenant $tenant, User $actor): array
    {
        return [
            'inventoryView' => $actor->hasTenantPermission($tenant, PermissionKey::TenantInventoryView),
            'inventoryManage' => $actor->hasTenantPermission($tenant, PermissionKey::TenantInventoryManage),
        ];
    }
}
