<?php

namespace App\Enums;

enum ApplicationEvidenceReviewStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
}
