<?php

namespace App\Support;

use App\Enums\ProvisioningState;
use App\Enums\TenantVerificationStatus;
use App\Models\ProvisioningRun;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class TenantWorkspaceReadiness
{
    public static function check(Tenant $tenant): bool
    {
        if ($tenant->getAttribute('verification_status') !== TenantVerificationStatus::Approved->value
            || ! self::maintenanceCheck($tenant)) {
            return false;
        }

        $editorReady = static fn (): bool => Schema::hasColumns('store_configs', [
            'revision', 'products_materialized', 'is_current',
        ]) && DB::table('store_configs')->where('is_current', true)->count() === 1;

        if (tenancy()->initialized && (string) tenant('id') === (string) $tenant->getKey()) {
            return $editorReady();
        }

        return $tenant->run($editorReady);
    }

    public static function maintenanceCheck(Tenant $tenant): bool
    {
        $tenant->loadMissing('latestProvisioningRun');
        $run = $tenant->latestProvisioningRun;
        $tenantId = (string) $tenant->getKey();
        $schema = TenantSchemaName::for($tenantId);
        $alreadyInitialized = tenancy()->initialized && (string) tenant('id') === $tenantId;

        $provenanceReady = $tenant->getAttribute('provisioning_status') === ProvisioningState::Active->value
            && $run instanceof ProvisioningRun
            && $run->getAttribute('tenant_id') === $tenantId
            && $run->getAttribute('status') === ProvisioningState::Active
            && $run->getAttribute('schema_name') === $schema
            && $run->getAttribute('schema_origin') !== null
            && $run->getAttribute('schema_created_at') !== null
            && ($alreadyInitialized || $tenant->database()->manager()->databaseExists($schema));

        if (! $provenanceReady) {
            return false;
        }

        $catalogReady = static fn (): bool => Schema::hasColumns('products', [
            'image_urls', 'position', 'status', 'base_price_minor', 'sale_price_minor', 'revision',
            'reserved_quantity', 'inventory_revision',
        ])
            && Schema::hasTable('catalog_settings')
            && Schema::hasTable('product_media')
            && StoreAssetSchema::ready()
            && Schema::hasTable('inventory_operations')
            && Schema::hasTable('inventory_movements')
            && Schema::hasTable('inventory_reservations')
            && Schema::hasTable('inventory_reservation_items')
            && Schema::hasTable('inventory_policy_changes')
            && Schema::hasTable('inventory_application_receipts')
            && Schema::hasTable('inventory_operation_results')
            && Schema::hasColumn('product_media', 'cleanup_started_at')
            && DB::table('catalog_settings')->where('id', 1)->count() === 1;

        return $alreadyInitialized ? $catalogReady() : $tenant->run($catalogReady);
    }

    public static function isMaterialized(Tenant $tenant): bool
    {
        if (! self::check($tenant)) {
            return false;
        }

        $materialized = static fn (): bool => DB::table('store_configs')
            ->where('is_current', true)
            ->where('products_materialized', true)
            ->exists();

        return tenancy()->initialized && (string) tenant('id') === (string) $tenant->getKey()
            ? $materialized()
            : $tenant->run($materialized);
    }
}
