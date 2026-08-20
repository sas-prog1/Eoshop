<?php

namespace App\Support;

use Illuminate\Support\Facades\Schema;

final class StoreAssetSchema
{
    /** @var list<string> */
    public const COLUMNS = [
        'id',
        'state',
        'disk',
        'path',
        'mime_type',
        'byte_size',
        'checksum_sha256',
        'uploaded_by_user_id',
        'upload_idempotency_key',
        'orphaned_at',
        'cleanup_started_at',
        'created_at',
        'updated_at',
    ];

    public static function ready(): bool
    {
        return Schema::hasTable('store_assets')
            && Schema::hasColumns('store_assets', self::COLUMNS);
    }
}
