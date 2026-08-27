<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class StoreCorrectionRequest extends Model
{
    use CentralConnection, HasUuids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'requested_fields' => 'array',
            'requested_draft_revision' => 'integer',
            'requested_at' => 'immutable_datetime',
            'resolved_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<StoreDraft, $this> */
    public function draft(): BelongsTo
    {
        return $this->belongsTo(StoreDraft::class, 'store_draft_id');
    }
}
