<?php

return [
    'disk' => env('PLATFORM_ASSET_DISK', 'local'),
    'max_bytes' => 5 * 1024 * 1024,
    'min_width' => 320,
    'min_height' => 180,
    'max_width' => 6000,
    'max_height' => 6000,
    'max_pixels' => 25_000_000,
    'max_assets' => 32,
    'max_total_bytes' => 100 * 1024 * 1024,
    'orphan_retention_hours' => 24,
    'recovery_days' => 30,
];
