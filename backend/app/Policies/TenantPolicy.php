<?php

namespace App\Policies;

use App\Enums\PermissionKey;
use App\Enums\ProvisioningState;
use App\Enums\PublicationStatus;
use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\TenantVerificationStatus;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class TenantPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresView);
    }

    public function view(User $user, Tenant $tenant): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresView);
    }

    public function changeAnyStatus(User $user, Tenant $tenant): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresReview)
            || $user->hasPlatformPermission(PermissionKey::PlatformStoresManage);
    }

    public function changeStatus(User $user, Tenant $tenant, TenantVerificationStatus $status): bool
    {
        $currentStatus = TenantVerificationStatus::from((string) $tenant->getAttribute('verification_status'));

        if ($currentStatus === $status) {
            return $user->hasPlatformPermission(PermissionKey::PlatformStoresManage);
        }

        return match ([$currentStatus, $status]) {
            [TenantVerificationStatus::Pending, TenantVerificationStatus::Approved],
            [TenantVerificationStatus::Pending, TenantVerificationStatus::ChangesRequested],
            [TenantVerificationStatus::Pending, TenantVerificationStatus::Rejected] => $user->hasPlatformPermission(PermissionKey::PlatformStoresReview),
            [TenantVerificationStatus::Approved, TenantVerificationStatus::Suspended],
            [TenantVerificationStatus::Suspended, TenantVerificationStatus::Approved] => $user->hasPlatformPermission(PermissionKey::PlatformStoresManage),
            default => false,
        };
    }

    public function update(User $user, Tenant $tenant): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresManage);
    }

    public function delete(User $user, Tenant $tenant): bool
    {
        return false;
    }

    public function retryProvisioning(User $user, Tenant $tenant): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresManage);
    }

    public function activateSubscription(User $user, Tenant $tenant): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresManage);
    }

    public function publish(User $user, Tenant $tenant): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresManage);
    }

    public function viewMerchant(User $user, Tenant $tenant): bool
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->table('tenant_user')
            ->where('tenant_id', $tenant->getKey())
            ->where('user_id', $user->getKey())
            ->where('status', TenantMembershipStatus::Active->value)
            ->exists();
    }

    public function updateStoreConfig(User $user, Tenant $tenant): bool
    {
        return $user->hasTenantPermission($tenant, PermissionKey::TenantStoreManage);
    }

    public function updateStoreWorkspace(User $user, Tenant $tenant): bool
    {
        return $user->hasTenantPermission($tenant, PermissionKey::TenantStoreManage)
            && $user->hasTenantPermission($tenant, PermissionKey::TenantProductsManage);
    }

    public function editStoreDraft(User $user, Tenant $tenant): bool
    {
        return in_array($tenant->getAttribute('verification_status'), [
            TenantVerificationStatus::ChangesRequested->value,
            TenantVerificationStatus::Rejected->value,
        ], true)
            && $tenant->getAttribute('provisioning_status') === ProvisioningState::NotStarted->value
            && $this->hasActiveOwnerMembership($user, $tenant);
    }

    public function ownStore(User $user, Tenant $tenant): bool
    {
        return $this->hasActiveOwnerMembership($user, $tenant);
    }

    public function resubmitStore(User $user, Tenant $tenant): bool
    {
        return $this->editStoreDraft($user, $tenant);
    }

    public function managePublication(User $user, Tenant $tenant): bool
    {
        return $this->hasActiveOwnerMembership($user, $tenant)
            && $user->hasTenantPermission($tenant, PermissionKey::TenantPublicationManage);
    }

    public function publishMerchant(User $user, Tenant $tenant): bool
    {
        return $this->managePublication($user, $tenant)
            && $tenant->getAttribute('verification_status') === TenantVerificationStatus::Approved->value
            && $tenant->getAttribute('provisioning_status') === ProvisioningState::Active->value
            && $tenant->getAttribute('publication_status') !== PublicationStatus::Published->value;
    }

    public function unpublishMerchant(User $user, Tenant $tenant): bool
    {
        return $this->managePublication($user, $tenant)
            && $tenant->getAttribute('publication_status') === PublicationStatus::Published->value;
    }

    public function updateProductCatalog(User $user, Tenant $tenant): bool
    {
        return $user->hasTenantPermission($tenant, PermissionKey::TenantProductsManage);
    }

    public function viewInventory(User $user, Tenant $tenant): bool
    {
        return $user->hasTenantPermission($tenant, PermissionKey::TenantInventoryView);
    }

    public function updateInventory(User $user, Tenant $tenant): bool
    {
        return $user->hasTenantPermission($tenant, PermissionKey::TenantInventoryManage);
    }

    public function viewOrders(User $user, Tenant $tenant): bool
    {
        return $user->hasTenantPermission($tenant, PermissionKey::TenantOrdersView);
    }

    public function updateOrders(User $user, Tenant $tenant): bool
    {
        return $user->hasTenantPermission($tenant, PermissionKey::TenantOrdersManage);
    }

    private function hasActiveOwnerMembership(User $user, Tenant $tenant): bool
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->table('tenant_user')
            ->join('roles', 'roles.id', '=', 'tenant_user.role_id')
            ->where('tenant_user.tenant_id', $tenant->getKey())
            ->where('tenant_user.user_id', $user->getKey())
            ->where('tenant_user.status', TenantMembershipStatus::Active->value)
            ->where('roles.key', SystemRole::MerchantOwner->value)
            ->exists();
    }
}
