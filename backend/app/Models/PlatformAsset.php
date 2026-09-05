<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class PlatformAsset extends Model
{
    use CentralConnection, HasUuids;

    protected $fillable = [
        'purpose', 'state', 'disk', 'path', 'quarantine_path', 'mime_type', 'byte_size',
        'width', 'height', 'checksum_sha256', 'uploaded_by_user_id', 'upload_idempotency_key',
        'orphaned_at', 'quarantined_at', 'recoverable_until',
    ];

    protected function casts(): array
    {
        return [
            'byte_size' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'orphaned_at' => 'immutable_datetime',
            'quarantined_at' => 'immutable_datetime',
            'recoverable_until' => 'immutable_datetime',
        ];
    }
}
