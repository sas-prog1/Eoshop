<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\PlatformStoreController;
use App\Http\Controllers\Auth\AuthenticationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\CatalogMediaController;
use App\Http\Controllers\DomainAvailabilityController;
use App\Http\Controllers\MerchantCatalogMediaController;
use App\Http\Controllers\MerchantInventoryController;
use App\Http\Controllers\MerchantOrderController;
use App\Http\Controllers\MerchantProductCatalogController;
use App\Http\Controllers\MerchantStoreAssetController;
use App\Http\Controllers\MerchantStoreController;
use App\Http\Controllers\MerchantStoreDraftController;
use App\Http\Controllers\MerchantStoreLifecycleController;
use App\Http\Controllers\MerchantWorkspaceController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\PlatformController;
use App\Http\Controllers\StoreAssetController;
use App\Http\Controllers\StoreGeneratorController;
use App\Http\Controllers\StoreSubmissionController;
use App\Models\AdminAuditLog;
use App\Models\Tenant;
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

Route::middleware('central.domain')->group(function (): void {
    Route::get('/api/plans', [PlanController::class, 'index']);

    Route::post('/api/auth/register', [AuthenticationController::class, 'register'])
        ->middleware('throttle:auth.register');

    Route::prefix('api/admin')->middleware('auth')->group(function (): void {
        Route::get('/stores', [PlatformStoreController::class, 'index'])
            ->can('viewAny', Tenant::class);
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
        Route::get('/domains/availability', [DomainAvailabilityController::class, 'show'])
            ->middleware('throttle:domain.availability');
        Route::get('/merchant/stores', [MerchantStoreController::class, 'index']);
        Route::get('/merchant/store-draft', [MerchantStoreDraftController::class, 'current']);
        Route::put('/merchant/store-draft', [MerchantStoreDraftController::class, 'saveCurrent'])
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
