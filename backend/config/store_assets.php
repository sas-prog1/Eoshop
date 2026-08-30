<?php

return [
    'disk' => env('STORE_ASSET_DISK', 'local'),
    'max_bytes' => (int) env('STORE_ASSET_MAX_BYTES', 5 * 1024 * 1024),
    'max_pixels' => (int) env('STORE_ASSET_MAX_PIXELS', 25_000_000),
    'max_assets_per_tenant' => (int) env('STORE_ASSET_MAX_COUNT', 64),
    'max_total_bytes_per_tenant' => (int) env('STORE_ASSET_MAX_TOTAL_BYTES', 75 * 1024 * 1024),
    'orphan_retention_hours' => (int) env('STORE_ASSET_ORPHAN_HOURS', 24),
];
