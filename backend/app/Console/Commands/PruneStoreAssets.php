<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\StoreAssetService;
use App\Support\TenantWorkspaceReadiness;
use Illuminate\Console\Command;
use Throwable;

class PruneStoreAssets extends Command
{
    protected $signature = 'store-assets:prune {--tenant=* : Limit cleanup to tenant IDs}';

    protected $description = 'Delete safely expired, unreferenced managed store assets.';

    public function handle(StoreAssetService $service): int
    {
        $ids = array_values(array_filter($this->option('tenant'), 'is_string'));
        $query = Tenant::query()->orderBy('id');
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }
        $deleted = 0;
        $failures = 0;
        $query->each(function (Tenant $tenant) use ($service, &$deleted, &$failures): void {
            if (! TenantWorkspaceReadiness::maintenanceCheck($tenant)) {
                $this->line("Skipped tenant {$tenant->getKey()}: store assets are not ready.");

                return;
            }
            try {
                $deleted += $service->pruneOrphans($tenant);
            } catch (Throwable $exception) {
                $failures++;
                report($exception);
                $this->warn("Failed to prune store assets for tenant {$tenant->getKey()}.");
            }
        });
        $this->info("Deleted {$deleted} expired store asset(s).");

        return $failures === 0 ? self::SUCCESS : self::FAILURE;
    }
}
