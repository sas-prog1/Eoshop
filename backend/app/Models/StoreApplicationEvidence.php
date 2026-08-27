<?php

namespace App\Models;

use App\Enums\ApplicationEvidenceResolution;
use App\Enums\ApplicationEvidenceReviewStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class StoreApplicationEvidence extends Model
{
    use CentralConnection, HasUuids;

    protected $table = 'store_application_evidence';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'resolution' => ApplicationEvidenceResolution::class,
            'review_status' => ApplicationEvidenceReviewStatus::class,
            'byte_size' => 'integer',
            'uploaded_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<StoreDraft, $this> */
    public function draft(): BelongsTo
    {
        return $this->belongsTo(StoreDraft::class, 'store_draft_id');
    }
}
