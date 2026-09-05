<?php

namespace App\Console\Commands;

use App\Services\PlatformAssetService;
use Illuminate\Console\Command;

class RestorePlatformAsset extends Command
{
    protected $signature = 'platform-assets:restore {asset : Platform asset UUID}';

    protected $description = 'Restore a quarantined platform asset within its recovery window.';

    public function handle(PlatformAssetService $service): int
    {
        if (! $service->restore((string) $this->argument('asset'))) {
            $this->error('The platform asset could not be restored.');

            return self::FAILURE;
        }
        $this->info('The platform asset was restored as an unbound managed asset.');

        return self::SUCCESS;
    }
}
