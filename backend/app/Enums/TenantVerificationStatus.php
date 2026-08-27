<?php

namespace App\Enums;

enum TenantVerificationStatus: string
{
    case Pending = 'pending';
    case ChangesRequested = 'changes_requested';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Suspended = 'suspended';

    public function requiresReason(): bool
    {
        return $this === self::ChangesRequested || $this === self::Rejected || $this === self::Suspended;
    }
}
