<?php

namespace App\Console\Commands;

use App\Services\PlatformAssetService;
use Illuminate\Console\Command;

class PrunePlatformAssets extends Command
{
    protected $signature = 'platform-assets:prune';

    protected $description = 'Quarantine replaced platform assets and delete them after the recovery window.';

    public function handle(PlatformAssetService $service): int
    {
        $result = $service->prune();
        $this->info("Quarantined {$result['quarantined']} and deleted {$result['deleted']} platform asset(s).");

        return self::SUCCESS;
    }
}
