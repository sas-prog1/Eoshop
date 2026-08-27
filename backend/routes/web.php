<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\PlatformOverviewController;
use App\Http\Controllers\Admin\PlatformSettingsController as AdminPlatformSettingsController;
use App\Http\Controllers\Admin\PlatformStoreController;
use App\Http\Controllers\Admin\PlatformUserController;
use App\Http\Controllers\Auth\AuthenticationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\CatalogMediaController;
use App\Http\Controllers\DomainAvailabilityController;
use App\Http\Controllers\MerchantCatalogMediaController;
use App\Http\Controllers\MerchantDashboardController;
use App\Http\Controllers\MerchantInventoryController;
use App\Http\Controllers\MerchantOrderController;
use App\Http\Controllers\MerchantProductCatalogController;
use App\Http\Controllers\MerchantStoreApplicationController;
use App\Http\Controllers\MerchantStoreAssetController;
use App\Http\Controllers\MerchantStoreController;
use App\Http\Controllers\MerchantStoreDraftController;
use App\Http\Controllers\MerchantStoreLifecycleController;
use App\Http\Controllers\MerchantWorkspaceController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\PlatformController;
use App\Http\Controllers\PlatformSettingsController;
use App\Http\Controllers\StoreAssetController;
use App\Http\Controllers\StoreGeneratorController;
use App\Http\Controllers\StoreSubmissionController;
use App\Models\AdminAuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Route;

Route::middleware('known.domain')->prefix('api/auth')->group(function (): void {
    Route::get('/csrf', [AuthenticationController::class, 'csrf']);
    Route::get('/session', [AuthenticationController::class, 'current']);
    Route::post('/login', [AuthenticationController::class, 'login'])->middleware('throttle:auth.login');
    Route::post('/forgot-password', [PasswordResetController::class, 'requestLink'])->middleware('throttle:auth.password-link');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:auth.password-reset');
    Route::post('/logout', [AuthenticationController::class, 'logout'])->middleware('auth');
});

Route::get('/api/catalog-media/{tenant}/{media}', [CatalogMediaController::class, 'show'])
    ->middleware('known.domain')
    ->whereUuid('media');

Route::get('/api/store-assets/{tenant}/{asset}', [StoreAssetController::class, 'show'])
    ->middleware('known.domain')
    ->whereUuid('asset');

Route::get('/api/platform-settings', [PlatformSettingsController::class, 'show'])
    ->middleware('known.domain');

Route::middleware('central.domain')->group(function (): void {
    Route::get('/api/plans', [PlanController::class, 'index']);

    Route::post('/api/auth/register', [AuthenticationController::class, 'register'])
        ->middleware('throttle:auth.register');

    Route::prefix('api/admin')->middleware('auth')->group(function (): void {
        Route::get('/platform-settings', [AdminPlatformSettingsController::class, 'show']);
        Route::put('/platform-settings', [AdminPlatformSettingsController::class, 'update'])
            ->middleware('throttle:admin.mutations');
        Route::get('/platform-roles', [PlatformUserController::class, 'roles'])
            ->can('viewAny', User::class);
        Route::get('/users', [PlatformUserController::class, 'index'])
            ->can('viewAny', User::class);
        Route::post('/users', [PlatformUserController::class, 'store'])
            ->can('create', User::class)
            ->middleware('throttle:admin.mutations');
        Route::put('/users/{user}/roles', [PlatformUserController::class, 'replaceRoles'])
            ->can('update', 'user')
            ->middleware('throttle:admin.mutations');
        Route::patch('/users/{user}/status', [PlatformUserController::class, 'updateStatus'])
            ->can('update', 'user')
            ->middleware('throttle:admin.mutations');
        Route::post('/users/{user}/invitation', [PlatformUserController::class, 'resendInvitation'])
            ->can('update', 'user')
            ->middleware('throttle:admin.mutations');
        Route::get('/overview', [PlatformOverviewController::class, 'show'])
            ->can('viewAny', Tenant::class);
        Route::get('/stores', [PlatformStoreController::class, 'index'])
            ->can('viewAny', Tenant::class);
        Route::get('/stores/{tenant}', [PlatformStoreController::class, 'show'])
            ->can('view', 'tenant');
        Route::get('/stores/{tenant}/application/evidence/{evidence}', [PlatformStoreController::class, 'downloadEvidence'])
            ->can('view', 'tenant')
            ->whereUuid('evidence');
        Route::patch('/stores/{tenant}/application/evidence/{evidence}', [PlatformStoreController::class, 'reviewEvidence'])
            ->can('changeAnyStatus', 'tenant')
            ->whereUuid('evidence')
            ->middleware('throttle:admin.mutations');
        Route::patch('/stores/{tenant}', [PlatformStoreController::class, 'update'])
            ->can('update', 'tenant')
            ->middleware('throttle:admin.mutations');
        Route::patch('/stores/{tenant}/status', [PlatformStoreController::class, 'updateStatus'])
            ->can('changeAnyStatus', 'tenant')
            ->middleware('throttle:admin.mutations');
        Route::post('/stores/{tenant}/provisioning/retry', [PlatformStoreController::class, 'retryProvisioning'])
            ->can('retryProvisioning', 'tenant')
            ->middleware('throttle:admin.mutations');
        Route::post('/stores/{tenant}/subscription/activate', [PlatformStoreController::class, 'activateSubscription'])
            ->can('activateSubscription', 'tenant')
            ->middleware('throttle:admin.mutations');
        Route::post('/stores/{tenant}/publication/publish', [PlatformStoreController::class, 'publish'])
            ->can('publish', 'tenant')
            ->middleware('throttle:admin.mutations');
        Route::post('/stores/{tenant}/publication/unpublish', [PlatformStoreController::class, 'unpublish'])
            ->can('publish', 'tenant')
            ->middleware('throttle:admin.mutations');
        Route::get('/audit-logs', [AuditLogController::class, 'index'])
            ->can('viewAny', AdminAuditLog::class);
    });

    Route::prefix('api')->middleware('auth')->group(function (): void {
        Route::put('/account/profile', [AccountController::class, 'updateProfile'])
            ->middleware('throttle:merchant.mutations');
        Route::put('/account/password', [AccountController::class, 'changePassword'])
            ->middleware('throttle:auth.password-reset');
        Route::get('/domains/availability', [DomainAvailabilityController::class, 'show'])
            ->middleware('throttle:domain.availability');
        Route::get('/merchant/stores', [MerchantStoreController::class, 'index']);
        Route::get('/merchant/store-drafts/{draft}/submission', [MerchantStoreController::class, 'recoverSubmission'])
            ->whereUuid('draft');
        Route::get('/merchant/store-draft', [MerchantStoreDraftController::class, 'current']);
        Route::get('/merchant/store-drafts/{draft}/application', [MerchantStoreApplicationController::class, 'show'])
            ->whereUuid('draft');
        Route::post('/merchant/store-drafts/{draft}/evidence/{requirement}', [MerchantStoreApplicationController::class, 'upload'])
            ->whereUuid('draft')
            ->middleware('throttle:merchant.mutations');
        Route::put('/merchant/store-drafts/{draft}/exemptions/{requirement}', [MerchantStoreApplicationController::class, 'exempt'])
            ->whereUuid('draft')
            ->middleware('throttle:merchant.mutations');
        Route::get('/merchant/store-drafts/{draft}/evidence/{evidence}', [MerchantStoreApplicationController::class, 'download'])
            ->whereUuid('draft')
            ->whereUuid('evidence');
        Route::put('/merchant/store-draft/business', [MerchantStoreDraftController::class, 'saveBusiness'])
            ->middleware('throttle:merchant.mutations');
        Route::put('/merchant/store-draft/design', [MerchantStoreDraftController::class, 'saveDesign'])
            ->middleware('throttle:merchant.mutations');
        Route::put('/merchant/store-draft/review', [MerchantStoreDraftController::class, 'saveReview'])
            ->middleware('throttle:merchant.mutations');
        Route::get('/merchant/stores/{tenant}/draft', [MerchantStoreDraftController::class, 'correction'])
            ->can('editStoreDraft', 'tenant');
        Route::patch('/merchant/stores/{tenant}/draft', [MerchantStoreDraftController::class, 'saveCorrection'])
            ->can('editStoreDraft', 'tenant')
            ->middleware('throttle:merchant.mutations');
        Route::post('/merchant/stores/{tenant}/resubmit', [MerchantStoreLifecycleController::class, 'resubmit'])
            ->can('ownStore', 'tenant')
            ->middleware('throttle:merchant.mutations');
        Route::post('/merchant/stores/{tenant}/publication/publish', [MerchantStoreLifecycleController::class, 'publish'])
            ->can('managePublication', 'tenant')
            ->middleware('throttle:merchant.mutations');
        Route::post('/merchant/stores/{tenant}/publication/unpublish', [MerchantStoreLifecycleController::class, 'unpublish'])
            ->can('managePublication', 'tenant')
            ->middleware('throttle:merchant.mutations');
        Route::get('/merchant/stores/{tenant}/publication', [MerchantStoreController::class, 'show'])
            ->can('viewMerchant', 'tenant');
        Route::get('/merchant/stores/{tenant}/dashboard', [MerchantDashboardController::class, 'show'])
            ->can('viewMerchant', 'tenant');
        Route::get('/merchant/stores/{tenant}/workspace', [MerchantWorkspaceController::class, 'show'])
            ->can('viewMerchant', 'tenant');
        Route::patch('/merchant/stores/{tenant}/workspace', [MerchantWorkspaceController::class, 'update'])
            ->can('updateStoreWorkspace', 'tenant')
            ->middleware('throttle:merchant.mutations');
        Route::post('/merchant/stores/{tenant}/assets', [MerchantStoreAssetController::class, 'store'])
            ->can('updateStoreConfig', 'tenant')
            ->middleware('throttle:merchant.mutations');
        Route::get('/merchant/stores/{tenant}/catalog', [MerchantProductCatalogController::class, 'show'])
            ->can('viewMerchant', 'tenant');
        Route::patch('/merchant/stores/{tenant}/catalog', [MerchantProductCatalogController::class, 'update'])
            ->can('updateProductCatalog', 'tenant')
            ->middleware('throttle:merchant.mutations');
        Route::post('/merchant/stores/{tenant}/catalog/media', [MerchantCatalogMediaController::class, 'store'])
            ->can('updateProductCatalog', 'tenant')
            ->middleware('throttle:merchant.mutations');
        Route::get('/merchant/stores/{tenant}/inventory', [MerchantInventoryController::class, 'index'])
            ->can('viewInventory', 'tenant');
        Route::get('/merchant/stores/{tenant}/inventory/movements', [MerchantInventoryController::class, 'movements'])
            ->can('viewInventory', 'tenant');
        Route::post('/merchant/stores/{tenant}/inventory/adjustments', [MerchantInventoryController::class, 'adjust'])
            ->can('updateInventory', 'tenant')
            ->middleware('throttle:merchant.mutations');
        Route::patch('/merchant/stores/{tenant}/inventory/products/{product}/policy', [MerchantInventoryController::class, 'updatePolicy'])
            ->can('updateInventory', 'tenant')
            ->whereUuid('product')
            ->middleware('throttle:merchant.mutations');
        Route::get('/merchant/stores/{tenant}/orders', [MerchantOrderController::class, 'index'])
            ->can('viewOrders', 'tenant');
        Route::get('/merchant/stores/{tenant}/orders/{order}', [MerchantOrderController::class, 'show'])
            ->can('viewOrders', 'tenant')
            ->whereUuid('order');
        Route::patch('/merchant/stores/{tenant}/orders/{order}/status', [MerchantOrderController::class, 'updateStatus'])
            ->can('updateOrders', 'tenant')
            ->whereUuid('order')
            ->middleware('throttle:merchant.mutations');
        Route::post('/generate-store-ideas', [StoreGeneratorController::class, 'generate'])
            ->middleware('throttle:ai.generate');
        Route::post('/register-store', [StoreSubmissionController::class, 'store'])
            ->middleware('throttle:store.register');
    });

    Route::get('/', [PlatformController::class, 'index']);
    Route::get('/up', [PlatformController::class, 'health']);
});
