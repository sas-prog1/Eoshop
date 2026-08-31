<?php

namespace Tests\Integration;

use App\Enums\DomainKind;
use App\Enums\DomainReservationOrigin;
use App\Enums\DomainReservationStatus;
use App\Enums\InventoryActorType;
use App\Enums\OrderStatus;
use App\Enums\PermissionKey;
use App\Enums\ProvisioningSchemaOrigin;
use App\Enums\ProvisioningState;
use App\Enums\PublicationRequestOrigin;
use App\Enums\PublicationRequestStatus;
use App\Enums\PublicationStatus;
use App\Enums\RoleScope;
use App\Enums\SubscriptionActivationSource;
use App\Enums\SubscriptionStatus;
use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Exceptions\InventoryConflict;
use App\Exceptions\OrderConflict;
use App\Exceptions\ProductCatalogConflict;
use App\Exceptions\ProvisioningFailure;
use App\Exceptions\StoreAssetConflict;
use App\Models\DomainReservation;
use App\Models\Permission;
use App\Models\ProvisioningRun;
use App\Models\PublicationRequest;
use App\Models\Role;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Services\InventoryLedgerService;
use App\Services\InventoryReservationService;
use App\Services\OrderService;
use App\Services\ProductCatalogService;
use App\Services\RoleAssignmentService;
use App\Services\StoreAssetService;
use App\Services\StoreWorkspaceService;
use App\Services\TenantProvisioningExecutor;
use App\Support\StorefrontSectionLayout;
use App\Support\TenantWorkspaceReadiness;
use Carbon\CarbonImmutable;
use Database\Seeders\IdentitySeeder;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class StoreWorkspaceTest extends TestCase
{
    /** @var list<string> */
    private array $tenantIds = [];

    /** @var list<string> */
    private array $schemas = [];

    /** @var list<string> */
    private array $userIds = [];

    /** @var list<int> */
    private array $roleIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }
        DB::setDefaultConnection((string) config('tenancy.database.central_connection'));
        DB::purge('tenant');
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        foreach ($this->tenantIds as $tenantId) {
            $central->table('tenant_user')->where('tenant_id', $tenantId)->delete();
            $central->table('admin_audit_logs')->where('tenant_id', $tenantId)->delete();
            $central->table('tenants')->where('id', $tenantId)->delete();
        }
        foreach ($this->schemas as $schema) {
            $central->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
        }
        foreach ($this->userIds as $userId) {
            $central->table('role_user')->where('user_id', $userId)->delete();
            $central->table('admin_audit_logs')->where('actor_user_id', $userId)->delete();
            $central->table('store_drafts')->where('owner_user_id', $userId)->delete();
            $central->table('users')->where('id', $userId)->delete();
        }
        foreach ($this->roleIds as $roleId) {
            $central->table('roles')->where('id', $roleId)->delete();
        }

        parent::tearDown();
    }

    public function test_legacy_workspace_materializes_atomically_and_rejects_a_stale_revision(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('legacy-workspace');

        $initial = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.catalogRevision', 1)
            ->assertJsonPath('data.config.products.0.sku', 'LEGACY-SKU')
            ->json('data');

        $updatedProduct = [
            ...$this->product('SKU-1'),
            'id' => $initial['config']['products'][0]['id'],
            'revision' => $initial['config']['products'][0]['revision'],
        ];
        $payload = [
            'revision' => 1,
            'catalogRevision' => 1,
            'config' => $this->config('Server Store', [$updatedProduct]),
        ];
        $saved = $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", $payload)
            ->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.catalogRevision', 2)
            ->assertJsonPath('data.config.storeName', 'Server Store')
            ->assertJsonPath('data.config.products.0.price', '12.50')
            ->json('data');

        $this->assertTrue(Str::isUuid($saved['config']['products'][0]['id']));
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", $payload)
            ->assertConflict()
            ->assertJsonPath('code', 'workspace_revision_conflict');

        $tenant->run(function (): void {
            $this->assertDatabaseHas('store_configs', [
                'revision' => 2,
                'products_materialized' => true,
                'is_current' => true,
            ], 'tenant');
            $this->assertSame(1, DB::table('products')->count());
            $config = json_decode((string) DB::table('store_configs')->where('is_current', true)->value('config_json'), true, 512, JSON_THROW_ON_ERROR);
            $this->assertArrayNotHasKey('products', $config);
            $config['enableOnlineCard'] = true;
            $config['enableApplePay'] = true;
            $config['enableStcPay'] = true;
            $config['phone'] = '0500000000';
            $config['whatsapp'] = '770000000';
            $config['email'] = 'not-an-email';
            DB::table('store_configs')->where('is_current', true)->update([
                'config_json' => json_encode($config, JSON_THROW_ON_ERROR),
            ]);
        });

        $public = $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonPath('data.config.storeName', 'Server Store')
            ->assertJsonPath('data.config.products.0.sku', 'SKU-1')
            ->json('data.config');
        $this->assertArrayNotHasKey('customCoupons', $public);
        $this->assertFalse($public['enableBankTransfer']);
        $this->assertFalse($public['enableOnlineCard']);
        $this->assertFalse($public['enableApplePay']);
        $this->assertFalse($public['enableStcPay']);
        $this->assertArrayNotHasKey('phone', $public);
        $this->assertArrayNotHasKey('whatsapp', $public);
        $this->assertArrayNotHasKey('email', $public);
        $this->assertSame((string) config('tenancy.database.central_connection'), DB::getDefaultConnection());
        $this->assertFalse(tenancy()->initialized);
    }

    public function test_storefront_layout_adopts_legacy_once_and_rejects_old_client_omission_after_customization(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('storefront-layout');

        $legacy = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()
            ->assertJsonPath('data.config.homeSections', StorefrontSectionLayout::defaults())
            ->json('data');
        $tenant->run(function (): void {
            $stored = json_decode((string) DB::table('store_configs')->where('is_current', true)->value('config_json'), true, 512, JSON_THROW_ON_ERROR);
            $this->assertArrayNotHasKey('homeSections', $stored);
        });

        $firstWrite = $this->config('Legacy adoption', [[
            ...$this->product('LAYOUT-1'),
            'id' => $legacy['config']['products'][0]['id'],
            'revision' => $legacy['config']['products'][0]['revision'],
        ]]);
        $adopted = $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => $legacy['revision'],
            'catalogRevision' => $legacy['catalogRevision'],
            'config' => $firstWrite,
        ])->assertOk()->assertJsonPath('data.config.homeSections', StorefrontSectionLayout::defaults())->json('data');

        $customLayout = [
            ['id' => 'featured_products', 'visible' => true],
            ['id' => 'hero', 'visible' => false],
            ['id' => 'categories', 'visible' => true],
            ['id' => 'trust', 'visible' => true],
            ['id' => 'about', 'visible' => true],
        ];
        $customConfig = $adopted['config'];
        $customConfig['homeSections'] = $customLayout;
        $saved = $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => $adopted['revision'],
            'catalogRevision' => $adopted['catalogRevision'],
            'config' => $customConfig,
        ])->assertOk()->assertJsonPath('data.config.homeSections', $customLayout)->json('data');

        $oldClientConfig = $saved['config'];
        unset($oldClientConfig['homeSections']);
        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => $saved['revision'],
            'catalogRevision' => $saved['catalogRevision'],
            'config' => $oldClientConfig,
        ])->assertUnprocessable()->assertJsonPath('code', 'workspace_layout_required');

        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => $saved['revision'],
            'catalogRevision' => $saved['catalogRevision'],
            'config' => [...$saved['config'], 'homeSections' => [
                ['id' => 'hero', 'visible' => false],
                ['id' => 'trust', 'visible' => false],
                ['id' => 'categories', 'visible' => false],
                ['id' => 'featured_products', 'visible' => false],
                ['id' => 'about', 'visible' => false],
            ]],
        ])->assertUnprocessable()->assertJsonPath('code', 'workspace_validation_failed');

        $invalidLayouts = [
            array_slice(StorefrontSectionLayout::defaults(), 0, 4),
            [
                ['id' => 'hero', 'visible' => true],
                ['id' => 'hero', 'visible' => false],
                ['id' => 'categories', 'visible' => true],
                ['id' => 'featured_products', 'visible' => true],
                ['id' => 'about', 'visible' => true],
            ],
            [
                ['id' => 'unknown', 'visible' => true],
                ['id' => 'trust', 'visible' => true],
                ['id' => 'categories', 'visible' => true],
                ['id' => 'featured_products', 'visible' => true],
                ['id' => 'about', 'visible' => true],
            ],
        ];
        foreach ($invalidLayouts as $invalidLayout) {
            $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => $saved['revision'],
                'catalogRevision' => $saved['catalogRevision'],
                'config' => [...$saved['config'], 'homeSections' => $invalidLayout],
            ])->assertUnprocessable()->assertJsonPath('code', 'workspace_validation_failed');
        }

        $tenant->run(function () use ($saved): void {
            $record = DB::table('store_configs')->where('is_current', true)->firstOrFail();
            $this->assertSame($saved['revision'], (int) $record->revision);
            $stored = json_decode((string) $record->config_json, true, 512, JSON_THROW_ON_ERROR);
            $stored['homeSections'] = [['id' => 'hero', 'visible' => true]];
            DB::table('store_configs')->where('id', $record->id)->update(['config_json' => json_encode($stored, JSON_THROW_ON_ERROR)]);
        });
        $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertConflict()->assertJsonPath('code', 'workspace_layout_invalid');
        $this->getJson("http://{$domain}/api/store/config")->assertNotFound();
    }

    public function test_workspace_rejects_enabled_demo_payment_accounts(): void
    {
        [$tenant, $owner] = $this->readyTenant('payment-policy');
        $initial = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()
            ->json('data');
        $product = [
            ...$this->product('PAYMENT-SKU'),
            'id' => $initial['config']['products'][0]['id'],
            'revision' => $initial['config']['products'][0]['revision'],
        ];
        $config = $this->config('Payment Policy Store', [$product]);
        $config['enableBankTransfer'] = true;
        $config['bankName'] = 'Demo Bank';
        $config['bankAccountName'] = 'Demo Merchant';
        $config['bankAccountNumber'] = '123456789012';

        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => $initial['revision'],
                'catalogRevision' => $initial['catalogRevision'],
                'config' => $config,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('config.bankAccountNumber');
        $tenant->run(fn () => $this->assertSame(1, (int) DB::table('store_configs')->where('is_current', true)->value('revision')));
    }

    public function test_workspace_rejects_overprecise_coupons_and_a_saved_precise_coupon_prices_checkout(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('coupon-precision');
        $initial = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()
            ->json('data');
        $product = [
            ...$this->product('COUPON-PRECISION'),
            'id' => $initial['config']['products'][0]['id'],
            'revision' => $initial['config']['products'][0]['revision'],
        ];
        $invalid = $this->config('Coupon precision', [$product]);
        $invalid['customCoupons'][0]['discountPercent'] = 10.123;

        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => $initial['revision'],
                'catalogRevision' => $initial['catalogRevision'],
                'config' => $invalid,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('config.customCoupons.0.discountPercent');

        $valid = $invalid;
        $valid['customCoupons'][0]['discountPercent'] = 10.12;
        $saved = $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => $initial['revision'],
                'catalogRevision' => $initial['catalogRevision'],
                'config' => $valid,
            ])
            ->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.catalogRevision', 2)
            ->json('data');

        $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", [
                'workspaceRevision' => $saved['revision'],
                'catalogRevision' => $saved['catalogRevision'],
                'lines' => [['productId' => $saved['config']['products'][0]['id'], 'quantity' => 1]],
                'couponCode' => 'SAVE10',
                'payment' => ['method' => 'cod'],
                'customer' => ['name' => 'Coupon Customer', 'phone' => '+967700000002'],
                'address' => ['city' => 'Sanaa', 'area' => 'Old City', 'details' => 'Gate 2'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.order.totals.itemsSubtotalMinor', 1250)
            ->assertJsonPath('data.order.totals.discountMinor', 127)
            ->assertJsonPath('data.order.totals.grandTotalMinor', 1891);
    }

    public function test_inventory_adjustment_is_atomic_revisioned_and_idempotent(): void
    {
        [$tenant, $owner] = $this->readyTenant('inventory-adjust');
        $inventory = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/inventory")
            ->assertOk()->assertJsonPath('data.items.0.onHand', 10)
            ->assertJsonPath('data.items.0.reserved', 0)->json('data');
        $product = $inventory['items'][0];
        $key = (string) Str::uuid();
        $payload = [
            'reasonCode' => 'stock_received',
            'note' => 'Supplier delivery',
            'lines' => [[
                'productId' => $product['productId'],
                'expectedInventoryRevision' => $product['inventoryRevision'],
                'movementKind' => 'receive',
                'delta' => 5,
            ]],
        ];

        $this->postJson("/api/merchant/stores/{$tenant->id}/inventory/adjustments", $payload, ['Idempotency-Key' => $key])
            ->assertOk()->assertJsonPath('data.replayed', false)
            ->assertJsonPath('data.items.0.onHand', 15)
            ->assertJsonPath('data.items.0.inventoryRevision', 2);
        $this->postJson("/api/merchant/stores/{$tenant->id}/inventory/adjustments", $payload, ['Idempotency-Key' => $key])
            ->assertOk()->assertJsonPath('data.replayed', true)
            ->assertJsonPath('data.items.0.onHand', 15);
        $payload['lines'][0]['delta'] = 6;
        $this->postJson("/api/merchant/stores/{$tenant->id}/inventory/adjustments", $payload, ['Idempotency-Key' => $key])
            ->assertConflict()->assertJsonPath('code', 'inventory_idempotency_conflict');

        $tenant->run(function (): void {
            $this->assertSame(2, DB::table('inventory_operations')->count());
            $this->assertSame(2, DB::table('inventory_movements')->count());
        });
    }

    public function test_public_checkout_rejects_a_product_owned_by_another_tenant_without_leaking_it(): void
    {
        [$tenant, , $domain] = $this->readyTenant('order-product-isolation');
        [$foreignTenant, , $foreignDomain] = $this->readyTenant('order-product-foreign');
        $bootstrap = $this->getJson("http://{$domain}/api/store/config")->assertOk()->json('data');
        $foreignProductId = $this->getJson("http://{$foreignDomain}/api/store/config")
            ->assertOk()
            ->json('data.config.products.0.id');

        $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", [
                'workspaceRevision' => (int) $bootstrap['workspaceRevision'],
                'catalogRevision' => (int) $bootstrap['catalogRevision'],
                'lines' => [['productId' => $foreignProductId, 'quantity' => 1]],
                'payment' => ['method' => 'cod'],
                'customer' => ['name' => 'Isolation Customer', 'phone' => '+967700000003'],
                'address' => ['city' => 'Sanaa', 'area' => 'Center', 'details' => 'Isolation gate'],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'order_product_unavailable');

        $tenant->run(fn () => $this->assertSame(0, DB::table('orders')->count()));
        $foreignTenant->run(fn () => $this->assertSame(0, DB::table('orders')->count()));
    }

    public function test_public_checkout_prices_reserves_replays_and_merchant_accepts_atomically(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('order-checkout');
        $bootstrap = $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonPath('data.workspaceRevision', 1)
            ->assertJsonPath('data.catalogRevision', 1)
            ->json('data');
        $productId = (string) $bootstrap['config']['products'][0]['id'];
        $key = (string) Str::uuid();
        $payload = [
            'workspaceRevision' => 1,
            'catalogRevision' => 1,
            'lines' => [['productId' => $productId, 'quantity' => 2]],
            'couponCode' => 'SAVE10',
            'payment' => ['method' => 'cod'],
            'customer' => ['name' => 'Checkout Customer', 'phone' => '+967700000001'],
            'address' => ['city' => 'Sanaa', 'area' => 'Old City', 'details' => 'Gate 1'],
        ];

        $created = $this->withHeaders(['Idempotency-Key' => $key])
            ->postJson("http://{$domain}/api/store/orders", $payload)
            ->assertCreated()
            ->assertJsonPath('data.replayed', false)
            ->assertJsonPath('data.order.status', OrderStatus::Submitted->value)
            ->assertJsonPath('data.order.totals.itemsSubtotalMinor', 2500)
            ->assertJsonPath('data.order.totals.discountMinor', 250)
            ->assertJsonPath('data.order.totals.shippingMinor', 500)
            ->assertJsonPath('data.order.totals.taxMinor', 338)
            ->assertJsonPath('data.order.totals.paymentFeeMinor', 100)
            ->assertJsonPath('data.order.totals.grandTotalMinor', 3188)
            ->assertJsonPath('data.order.checkoutPresentation.title', 'Original receipt title')
            ->assertJsonPath('data.order.checkoutPresentation.message', 'Original receipt message')
            ->assertJsonPath('data.order.checkoutPresentation.whatsappTarget', '+967700000000')
            ->json('data');
        $orderId = (string) $created['order']['id'];
        $additionalProductId = $this->addInventoryProduct($tenant, 'ORDER-APPEND-GUARD', 5);

        $outsider = $this->user('order-outsider@example.test');
        $centralOrdersUrl = "http://127.0.0.1/api/merchant/stores/{$tenant->id}/orders";
        $this->getJson($centralOrdersUrl)->assertUnauthorized();
        $this->actingAs($outsider)->getJson($centralOrdersUrl)->assertForbidden();
        Auth::forgetGuards();
        $this->flushSession();

        $foreignTenant = Tenant::query()->create([
            'id' => 'wp32-order-foreign',
            'store_name' => 'Foreign order store',
            'owner_name' => 'Foreign Owner',
            'owner_email' => 'foreign-order-owner@example.test',
            'business_type' => 'retail',
            'verification_status' => TenantVerificationStatus::Approved->value,
            'provisioning_status' => ProvisioningState::Active->value,
            'publication_status' => PublicationStatus::Published->value,
            'theme_style' => 'elegant',
            'active_at' => now(),
        ]);
        $this->tenantIds[] = $foreignTenant->id;
        $foreignOwner = $this->user('foreign-order-owner@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $foreignTenant,
            $foreignOwner,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $foreignOwner,
        );
        $this->actingAs($foreignOwner)->getJson($centralOrdersUrl)->assertForbidden();
        $this->actingAs($foreignOwner)
            ->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->patchJson("{$centralOrdersUrl}/{$orderId}/status", [
                'status' => OrderStatus::Accepted->value,
                'reasonCode' => 'cross_tenant_attempt',
            ])
            ->assertForbidden();
        Auth::forgetGuards();
        $this->flushSession();

        $tenant->run(function (): void {
            $row = DB::table('store_configs')->where('is_current', true)->firstOrFail();
            $config = json_decode((string) $row->config_json, true, 512, JSON_THROW_ON_ERROR);
            $config['thankYouTitle'] = 'Changed after checkout';
            $config['thankYouMessage'] = 'Changed message';
            $config['enableWhatsAppNotification'] = false;
            DB::table('store_configs')->where('id', $row->id)->update([
                'config_json' => json_encode($config, JSON_THROW_ON_ERROR),
                'revision' => 2,
            ]);
        });

        $this->withHeaders(['Idempotency-Key' => $key])
            ->postJson("http://{$domain}/api/store/orders", $payload)
            ->assertCreated()
            ->assertJsonPath('data.replayed', true)
            ->assertJsonPath('data.order.id', $orderId)
            ->assertJsonPath('data.order.checkoutPresentation.title', 'Original receipt title')
            ->assertJsonPath('data.order.checkoutPresentation.message', 'Original receipt message')
            ->assertJsonPath('data.order.checkoutPresentation.whatsappTarget', '+967700000000');

        $tenant->run(function () use ($orderId, $productId): void {
            $this->assertSame(1, DB::table('orders')->where('id', $orderId)->count());
            $this->assertSame(2, (int) DB::table('products')->where('id', $productId)->value('reserved_quantity'));
            $this->assertSame('active', DB::table('inventory_reservations')->where('reference_id', $orderId)->value('status'));
            $this->assertStringNotContainsString('Checkout Customer', (string) DB::table('orders')->where('id', $orderId)->value('customer_encrypted'));
            $this->assertStringNotContainsString('Gate 1', (string) DB::table('order_addresses')->where('order_id', $orderId)->value('encrypted_payload'));
        });

        $list = $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->getJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/orders")
            ->assertOk()
            ->assertJsonPath('data.items.0.id', $orderId)
            ->assertJsonPath('data.items.0.customerName', 'Checkout Customer')
            ->assertJsonPath('data.items.0.allowedTransitions', [])
            ->assertJsonPath('data.pagination.page', 1)
            ->assertJsonPath('data.pagination.lastPage', 1)
            ->assertJsonPath('data.filters.status', null)
            ->assertJsonPath('data.filters.query', null)
            ->json('data.items.0');
        $this->assertArrayNotHasKey('customer', $list);
        $this->assertArrayNotHasKey('address', $list);
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->getJson("{$centralOrdersUrl}?status=submitted&query=".urlencode(substr((string) $list['number'], 0, 8)))
            ->assertOk()
            ->assertJsonPath('data.pagination.total', 1)
            ->assertJsonPath('data.filters.status', OrderStatus::Submitted->value);
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->getJson("{$centralOrdersUrl}?status=completed")
            ->assertOk()
            ->assertJsonPath('data.pagination.total', 0);

        $viewer = $this->user('order-viewer@example.test');
        $viewerRole = Role::query()->create([
            'key' => 'tenant_order_viewer_'.Str::lower(Str::random(8)),
            'name' => 'Tenant order viewer',
            'scope' => RoleScope::Tenant,
            'system' => false,
        ]);
        $this->roleIds[] = (int) $viewerRole->id;
        $viewerRole->permissions()->attach(
            Permission::query()->where('key', PermissionKey::TenantOrdersView->value)->firstOrFail(),
            ['scope' => RoleScope::Tenant->value],
        );
        app(RoleAssignmentService::class)->assignTenantRole($tenant, $viewer, $viewerRole, $owner);
        Auth::forgetGuards();
        $this->flushSession();
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($viewer)
            ->getJson($centralOrdersUrl)
            ->assertOk()
            ->assertJsonPath('data.items.0.allowedTransitions', []);
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($viewer)
            ->getJson("{$centralOrdersUrl}/{$orderId}")
            ->assertOk()
            ->assertJsonPath('data.customer.name', 'Checkout Customer')
            ->assertJsonPath('data.allowedTransitions', []);
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($viewer)
            ->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->patchJson("{$centralOrdersUrl}/{$orderId}/status", [
                'status' => OrderStatus::Accepted->value,
                'reasonCode' => 'viewer_must_not_transition',
            ])
            ->assertForbidden();
        Auth::forgetGuards();
        $this->flushSession();

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->getJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/orders/{$orderId}")
            ->assertOk()
            ->assertJsonPath('data.customer.name', 'Checkout Customer')
            ->assertJsonPath('data.address.details', 'Gate 1')
            ->assertJsonPath('data.payment.method', 'cod')
            ->assertJsonPath('data.payment.reference', null)
            ->assertJsonPath('data.history.0.to', OrderStatus::Submitted->value)
            ->assertJsonPath('data.allowedTransitions.0', OrderStatus::Accepted->value)
            ->assertJsonPath('data.allowedTransitions.1', OrderStatus::Cancelled->value);
        $transitionKey = (string) Str::uuid();
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->withHeaders(['Idempotency-Key' => $transitionKey])
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/orders/{$orderId}/status", [
                'status' => OrderStatus::Accepted->value,
                'reasonCode' => 'merchant_accepted',
            ])
            ->assertOk()
            ->assertJsonPath('data.replayed', false)
            ->assertJsonPath('data.order.status', OrderStatus::Accepted->value)
            ->assertJsonPath('data.order.allowedTransitions.0', OrderStatus::Processing->value)
            ->assertJsonPath('data.order.allowedTransitions.1', OrderStatus::Completed->value);
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->withHeaders(['Idempotency-Key' => $transitionKey])
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/orders/{$orderId}/status", [
                'status' => OrderStatus::Accepted->value,
                'reasonCode' => 'merchant_accepted',
            ])
            ->assertOk()
            ->assertJsonPath('data.replayed', true)
            ->assertJsonPath('data.order.status', OrderStatus::Accepted->value)
            ->assertJsonPath('data.order.allowedTransitions.0', OrderStatus::Processing->value)
            ->assertJsonPath('data.order.allowedTransitions.1', OrderStatus::Completed->value);
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->withHeaders(['Idempotency-Key' => $transitionKey])
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/orders/{$orderId}/status", [
                'status' => OrderStatus::Processing->value,
                'reasonCode' => 'different_operation',
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'order_idempotency_conflict');

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/orders/{$orderId}/status", [
                'status' => OrderStatus::Processing->value,
                'reasonCode' => 'merchant_started_processing',
            ])
            ->assertOk()
            ->assertJsonPath('data.replayed', false)
            ->assertJsonPath('data.order.status', OrderStatus::Processing->value)
            ->assertJsonPath('data.order.allowedTransitions.0', OrderStatus::Completed->value);

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/orders/{$orderId}/status", [
                'status' => OrderStatus::Completed->value,
                'reasonCode' => 'merchant_completed_order',
            ])
            ->assertOk()
            ->assertJsonPath('data.replayed', false)
            ->assertJsonPath('data.order.status', OrderStatus::Completed->value)
            ->assertJsonPath('data.order.allowedTransitions', []);

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->getJson("{$centralOrdersUrl}?status=completed")
            ->assertOk()
            ->assertJsonPath('data.pagination.total', 1)
            ->assertJsonPath('data.items.0.id', $orderId)
            ->assertJsonPath('data.items.0.status', OrderStatus::Completed->value)
            ->assertJsonPath('data.items.0.allowedTransitions', []);

        $tenant->run(function () use ($additionalProductId, $orderId, $owner, $productId): void {
            $this->assertSame(8, (int) DB::table('products')->where('id', $productId)->value('stock_quantity'));
            $this->assertSame(0, (int) DB::table('products')->where('id', $productId)->value('reserved_quantity'));
            $this->assertSame('committed', DB::table('inventory_reservations')->value('status'));
            $this->assertSame(OrderStatus::Completed->value, DB::table('orders')->where('id', $orderId)->value('status'));
            $this->assertSame([1, 2, 3, 4], DB::table('order_status_history')->where('order_id', $orderId)->orderBy('sequence')->pluck('sequence')->map('intval')->all());
            try {
                DB::table('order_items')->update(['product_name' => 'tampered']);
                $this->fail('Immutable order snapshots must reject direct database mutation.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('order history and snapshots are immutable', $exception->getMessage());
            }

            try {
                DB::table('order_items')->insert([
                    'order_id' => $orderId,
                    'product_id' => $additionalProductId,
                    'product_name' => 'Injected free item',
                    'sku' => 'ORDER-APPEND-GUARD',
                    'unit_price_minor' => 0,
                    'quantity' => 1,
                    'line_total_minor' => 0,
                    'tracked_at_submission' => false,
                    'created_at' => now(),
                ]);
                $this->fail('A committed order must reject appended snapshot items.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('order snapshots may only be inserted by their bound create operation', $exception->getMessage());
            }

            try {
                DB::transaction(function () use ($orderId, $owner): void {
                    $operationId = (string) Str::uuid();
                    DB::table('order_operations')->insert([
                        'id' => $operationId,
                        'kind' => 'transition',
                        'idempotency_scope' => 'negative-consistency-test',
                        'idempotency_key' => (string) Str::uuid(),
                        'request_fingerprint' => hash('sha256', 'negative-consistency-test'),
                        'actor_type' => 'user',
                        'actor_user_id' => (string) $owner->id,
                        'created_at' => now()->addSecond(),
                    ]);
                    DB::table('order_status_history')->insert([
                        'id' => (string) Str::uuid(),
                        'order_id' => $orderId,
                        'operation_id' => $operationId,
                        'sequence' => 5,
                        'from_status' => OrderStatus::Processing->value,
                        'to_status' => OrderStatus::Completed->value,
                        'actor_type' => 'user',
                        'actor_user_id' => (string) $owner->id,
                        'reason_code' => 'unbound_direct_sql',
                        'created_at' => now()->addSecond(),
                    ]);
                });
                $this->fail('A child history insert must not diverge from the authoritative order status.');
            } catch (\PDOException|QueryException $exception) {
                $this->assertStringContainsString('order status history is inconsistent', $exception->getMessage());
            }
            $this->assertSame(4, DB::table('order_status_history')->where('order_id', $orderId)->count());
        });
    }

    public function test_merchant_dashboard_is_authoritative_permission_scoped_and_excludes_customer_pii(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('merchant-dashboard');
        $dashboardUrl = "http://127.0.0.1/api/merchant/stores/{$tenant->id}/dashboard";

        $this->getJson($dashboardUrl)->assertUnauthorized();
        $outsider = $this->user('merchant-dashboard-outsider@example.test');
        $this->actingAs($outsider)->getJson($dashboardUrl)->assertForbidden();

        $restricted = $this->user('merchant-dashboard-restricted@example.test');
        $restrictedRole = Role::query()->create([
            'key' => 'tenant_dashboard_restricted_'.Str::lower(Str::random(8)),
            'name' => 'Tenant dashboard restricted',
            'scope' => RoleScope::Tenant,
            'system' => false,
        ]);
        $this->roleIds[] = (int) $restrictedRole->id;
        app(RoleAssignmentService::class)->assignTenantRole($tenant, $restricted, $restrictedRole, $owner);
        Auth::forgetGuards();
        $this->flushSession();
        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($restricted)
            ->getJson($dashboardUrl)
            ->assertOk()
            ->assertJsonPath('data.visibility.orders', false)
            ->assertJsonPath('data.visibility.inventory', false)
            ->assertJsonPath('data.visibility.analytics', false)
            ->assertJsonPath('data.visibility.productsManage', false)
            ->assertJsonPath('data.visibility.workspaceManage', false)
            ->assertJsonPath('data.metrics.publishedProducts', null)
            ->assertJsonPath('data.metrics.draftProducts', null)
            ->assertJsonPath('data.metrics.ordersToday', null)
            ->assertJsonPath('data.metrics.salesTodayMinor', null)
            ->assertJsonPath('data.metrics.lowStockProducts', null)
            ->assertJsonPath('data.tasks', [])
            ->assertJsonPath('data.recentOrders', []);

        $bootstrap = $this->getJson("http://{$domain}/api/store/config")->assertOk()->json('data');
        $productId = (string) $bootstrap['config']['products'][0]['id'];
        $created = $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", [
                'workspaceRevision' => (int) $bootstrap['workspaceRevision'],
                'catalogRevision' => (int) $bootstrap['catalogRevision'],
                'lines' => [['productId' => $productId, 'quantity' => 1]],
                'payment' => ['method' => 'cod'],
                'customer' => ['name' => 'Private dashboard customer', 'phone' => '+967700000009'],
                'address' => ['city' => 'Sanaa', 'area' => 'Center', 'details' => 'Private address'],
            ])
            ->assertCreated()
            ->json('data.order');

        Auth::forgetGuards();
        $this->flushSession();
        $response = $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->getJson($dashboardUrl)
            ->assertOk()
            ->assertJsonPath('data.tenantId', $tenant->id)
            ->assertJsonPath('data.visibility.orders', true)
            ->assertJsonPath('data.visibility.inventory', true)
            ->assertJsonPath('data.visibility.analytics', true)
            ->assertJsonPath('data.visibility.productsManage', true)
            ->assertJsonPath('data.visibility.workspaceManage', true)
            ->assertJsonPath('data.metrics.ordersToday', 1)
            ->assertJsonPath('data.metrics.openOrders', 1)
            ->assertJsonPath('data.metrics.publishedProducts', 1)
            ->assertJsonPath('data.metrics.draftProducts', 0)
            ->assertJsonPath('data.metrics.lowStockProducts', 0)
            ->assertJsonPath('data.metrics.salesTodayMinor', 0)
            ->assertJsonPath('data.tasks.0.code', 'orders_new')
            ->assertJsonPath('data.tasks.0.count', 1)
            ->assertJsonPath('data.recentOrders.0.id', $created['id'])
            ->assertJsonPath('data.recentOrders.0.grandTotalMinor', $created['totals']['grandTotalMinor']);

        $recentOrder = $response->json('data.recentOrders.0');
        $this->assertArrayNotHasKey('customer', $recentOrder);
        $this->assertArrayNotHasKey('address', $recentOrder);
        $this->assertStringNotContainsString('Private dashboard customer', json_encode($response->json(), JSON_THROW_ON_ERROR));
        $this->assertCount(7, $response->json('data.salesSeries'));
        $tenant->run(function (): void {
            $dashboardIndexes = DB::table('pg_indexes')
                ->where('schemaname', DB::raw('current_schema()'))
                ->whereIn('indexname', [
                    'orders_created_at_id_index',
                    'orders_status_completed_at_index',
                    'products_status_index',
                    'products_managed_active_inventory_index',
                ])->pluck('indexname')->sort()->values()->all();
            $this->assertSame([
                'orders_created_at_id_index',
                'orders_status_completed_at_index',
                'products_managed_active_inventory_index',
                'products_status_index',
            ], $dashboardIndexes);
        });
    }

    public function test_merchant_dashboard_uses_the_configured_business_day_boundary(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('merchant-dashboard-timezone');
        $bootstrap = $this->getJson("http://{$domain}/api/store/config")->assertOk()->json('data');
        $productId = (string) $bootstrap['config']['products'][0]['id'];
        $orderPayload = [
            'workspaceRevision' => (int) $bootstrap['workspaceRevision'],
            'catalogRevision' => (int) $bootstrap['catalogRevision'],
            'lines' => [['productId' => $productId, 'quantity' => 1]],
            'payment' => ['method' => 'cod'],
            'customer' => ['name' => 'Boundary customer', 'phone' => '+967700000008'],
            'address' => ['city' => 'Sanaa', 'area' => 'Center', 'details' => 'Boundary'],
        ];

        $previousBusinessDayOrder = $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", $orderPayload)
            ->assertCreated()
            ->json('data.order.id');

        $currentBusinessDayOrder = $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", $orderPayload)
            ->assertCreated()
            ->json('data.order.id');

        $tenant->run(function () use ($previousBusinessDayOrder, $currentBusinessDayOrder): void {
            DB::statement('ALTER TABLE orders DISABLE TRIGGER orders_guarded_update');
            try {
                DB::table('orders')->where('id', $previousBusinessDayOrder)->update([
                    'created_at' => CarbonImmutable::parse('2026-08-27T20:59:00Z'),
                ]);
                DB::table('orders')->where('id', $currentBusinessDayOrder)->update([
                    'created_at' => CarbonImmutable::parse('2026-08-27T21:00:30Z'),
                ]);
            } finally {
                DB::statement('ALTER TABLE orders ENABLE TRIGGER orders_guarded_update');
            }
        });

        $this->travelTo(CarbonImmutable::parse('2026-08-27T21:01:00Z'));

        Auth::forgetGuards();
        $this->flushSession();
        $response = $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($owner)
            ->getJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/dashboard")
            ->assertOk()
            ->assertJsonPath('data.metrics.ordersToday', 1)
            ->assertJsonPath('data.salesSeries.6.date', '2026-08-28');

        $this->assertSame('2026-08-28T00:01:00+03:00', $response->json('data.generatedAt'));
        $this->travelBack();
    }

    public function test_checkout_rejects_stale_quotes_client_totals_and_insufficient_stock_without_side_effects(): void
    {
        [$tenant, , $domain] = $this->readyTenant('order-boundaries');
        $bootstrap = $this->getJson("http://{$domain}/api/store/config")->assertOk()->json('data');
        $productId = (string) $bootstrap['config']['products'][0]['id'];
        $base = [
            'workspaceRevision' => 999,
            'catalogRevision' => 1,
            'lines' => [['productId' => $productId, 'quantity' => 1]],
            'payment' => ['method' => 'cod'],
            'customer' => ['name' => 'Boundary Customer', 'phone' => '+967700000002'],
            'address' => ['city' => 'Sanaa', 'area' => 'Center', 'details' => 'Gate 2'],
        ];
        $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", $base)
            ->assertConflict()->assertJsonPath('code', 'order_quote_stale');
        $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", [...$base, 'workspaceRevision' => 1, 'grandTotal' => 1])
            ->assertUnprocessable();
        $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", [
                ...$base,
                'workspaceRevision' => 1,
                'payment' => ['method' => 'cod', 'reference' => 'must-not-be-accepted'],
            ])->assertUnprocessable()->assertJsonValidationErrors('payment.reference');
        $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", [
                ...$base,
                'workspaceRevision' => 1,
                'payment' => ['method' => 'bank_transfer'],
            ])->assertUnprocessable()->assertJsonValidationErrors('payment.reference');
        $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", [
                ...$base,
                'workspaceRevision' => 1,
                'lines' => [['productId' => $productId, 'quantity' => 11]],
            ])->assertConflict()->assertJsonPath('code', 'order_stock_conflict');
        $tenant->run(function (): void {
            $this->assertSame(0, DB::table('orders')->count());
            $this->assertSame(0, DB::table('inventory_reservations')->where('reference_type', 'order')->count());
        });
    }

    public function test_legacy_order_result_without_checkout_presentation_replays_neutral_fallback(): void
    {
        [$tenant, , $domain] = $this->readyTenant('order-legacy-presentation');
        $bootstrap = $this->getJson("http://{$domain}/api/store/config")->assertOk()->json('data');
        $key = (string) Str::uuid();
        $payload = [
            'workspaceRevision' => 1,
            'catalogRevision' => 1,
            'lines' => [['productId' => $bootstrap['config']['products'][0]['id'], 'quantity' => 1]],
            'payment' => ['method' => 'cod'],
            'customer' => ['name' => 'Legacy Result Customer', 'phone' => '+967700000011'],
            'address' => ['city' => 'Sanaa', 'area' => 'Center', 'details' => 'Legacy result gate'],
        ];

        $this->withHeaders(['Idempotency-Key' => $key])
            ->postJson("http://{$domain}/api/store/orders", $payload)
            ->assertCreated()
            ->assertJsonPath('data.replayed', false);

        $tenant->run(function () use ($key): void {
            $operationId = (string) DB::table('order_operations')->where('idempotency_key', $key)->value('id');
            $stored = DB::table('order_operation_results')->where('operation_id', $operationId)->value('response_json');
            $result = is_array($stored) ? $stored : json_decode((string) $stored, true, 512, JSON_THROW_ON_ERROR);
            unset($result['order']['checkoutPresentation']);

            DB::unprepared('ALTER TABLE order_operation_results DISABLE TRIGGER order_operation_results_immutable');
            try {
                DB::table('order_operation_results')->where('operation_id', $operationId)->update([
                    'response_json' => json_encode($result, JSON_THROW_ON_ERROR),
                ]);
            } finally {
                DB::unprepared('ALTER TABLE order_operation_results ENABLE TRIGGER order_operation_results_immutable');
            }
        });

        $this->withHeaders(['Idempotency-Key' => $key])
            ->postJson("http://{$domain}/api/store/orders", $payload)
            ->assertCreated()
            ->assertJsonPath('data.replayed', true)
            ->assertJsonPath('data.order.checkoutPresentation.title', 'تم استلام طلبك')
            ->assertJsonPath('data.order.checkoutPresentation.message', 'احتفظ برقم الطلب للمتابعة مع المتجر.')
            ->assertJsonPath('data.order.checkoutPresentation.whatsappTarget', null);
    }

    public function test_checkout_flag_does_not_take_storefront_browsing_offline(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('order-feature-flag');
        $bootstrap = $this->getJson("http://{$domain}/api/store/config")->assertOk()->json('data');
        $original = config('orders.checkout_enabled');

        try {
            config(['orders.checkout_enabled' => false]);
            $this->getJson("http://{$domain}/api/store/config")
                ->assertOk()
                ->assertJsonPath('data.workspaceRevision', 1);
            $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
                ->postJson("http://{$domain}/api/store/orders", [
                    'workspaceRevision' => 1,
                    'catalogRevision' => 1,
                    'lines' => [['productId' => $bootstrap['config']['products'][0]['id'], 'quantity' => 1]],
                    'payment' => ['method' => 'cod'],
                    'customer' => ['name' => 'Feature Flag Customer', 'phone' => '+967700000003'],
                    'address' => ['city' => 'Sanaa', 'area' => 'Center', 'details' => 'Gate 3'],
                ])
                ->assertStatus(503)
                ->assertJsonPath('code', 'order_checkout_unavailable');
            $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
                ->actingAs($owner)
                ->getJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/orders")
                ->assertOk()
                ->assertJsonPath('data.pagination.total', 0);
            $tenant->run(fn () => $this->assertSame(0, DB::table('orders')->count()));
        } finally {
            config(['orders.checkout_enabled' => $original]);
        }
    }

    public function test_order_create_rolls_back_all_effects_when_result_persistence_fails(): void
    {
        [$tenant, , $domain] = $this->readyTenant('order-failure-injection');
        $bootstrap = $this->getJson("http://{$domain}/api/store/config")->assertOk()->json('data');
        $productId = (string) $bootstrap['config']['products'][0]['id'];

        $tenant->run(function (): void {
            DB::unprepared(<<<'SQL'
                CREATE FUNCTION wp43_reject_operation_result() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'injected operation result failure';
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER wp43_reject_operation_result
                    BEFORE INSERT ON order_operation_results
                    FOR EACH ROW EXECUTE FUNCTION wp43_reject_operation_result();
                SQL);
        });

        try {
            $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
                ->postJson("http://{$domain}/api/store/orders", [
                    'workspaceRevision' => 1,
                    'catalogRevision' => 1,
                    'lines' => [['productId' => $productId, 'quantity' => 1]],
                    'payment' => ['method' => 'cod'],
                    'customer' => ['name' => 'Rollback Customer', 'phone' => '+967700000006'],
                    'address' => ['city' => 'Sanaa', 'area' => 'Center', 'details' => 'Rollback gate'],
                ])->assertServerError();
        } finally {
            $tenant->run(function () use ($productId): void {
                DB::unprepared('DROP TRIGGER IF EXISTS wp43_reject_operation_result ON order_operation_results');
                DB::unprepared('DROP FUNCTION IF EXISTS wp43_reject_operation_result()');
                $this->assertSame(0, DB::table('orders')->count());
                $this->assertSame(0, DB::table('order_operations')->count());
                $this->assertSame(0, DB::table('inventory_reservations')->where('reference_type', 'order')->count());
                $this->assertSame(0, (int) DB::table('products')->where('id', $productId)->value('reserved_quantity'));
            });
        }
    }

    public function test_concurrent_last_unit_checkout_has_exactly_one_winner(): void
    {
        [$tenant, $owner] = $this->readyTenant('order-last-unit');
        $product = $tenant->run(fn (): object => DB::table('products')->firstOrFail());
        $productId = (string) $product->id;
        $inventoryRevision = (int) $product->inventory_revision;
        app(InventoryLedgerService::class)->adjust(
            $tenant,
            $owner,
            [
                'lines' => [['productId' => $productId, 'expectedInventoryRevision' => $inventoryRevision, 'movementKind' => 'correction', 'delta' => -9]],
                'reasonCode' => 'prepare_last_unit_race',
            ],
            (string) Str::uuid(),
            (string) Str::uuid(),
        );
        $payload = fn (): array => [
            'workspaceRevision' => 1,
            'catalogRevision' => 1,
            'lines' => [['productId' => $productId, 'quantity' => 1]],
            'payment' => ['method' => 'cod'],
            'customer' => ['name' => 'Concurrent Customer', 'phone' => '+967700000007'],
            'address' => ['city' => 'Sanaa', 'area' => 'Center', 'details' => 'Race gate'],
            'idempotencyKey' => (string) Str::uuid(),
            'requestId' => (string) Str::uuid(),
        ];
        $first = $payload();
        $second = $payload();

        $outcomes = $this->runConcurrentInventoryOperations([
            fn (): array => app(OrderService::class)->create($tenant, $first),
            fn (): array => app(OrderService::class)->create($tenant, $second),
        ]);

        $this->assertSame(['conflict', 'ok'], collect($outcomes)->pluck('status')->sort()->values()->all());
        $this->assertSame(['order_stock_conflict'], collect($outcomes)->where('status', 'conflict')->pluck('code')->all());
        $tenant->run(function () use ($productId): void {
            $this->assertSame(1, DB::table('orders')->count());
            $this->assertSame(1, (int) DB::table('products')->where('id', $productId)->value('reserved_quantity'));
        });
    }

    public function test_due_order_expiry_releases_stock_and_appends_system_history_atomically(): void
    {
        [$tenant, , $domain] = $this->readyTenant('order-expiry');
        $bootstrap = $this->getJson("http://{$domain}/api/store/config")->assertOk()->json('data');
        $productId = (string) $bootstrap['config']['products'][0]['id'];
        $created = $this->withHeaders(['Idempotency-Key' => (string) Str::uuid()])
            ->postJson("http://{$domain}/api/store/orders", [
                'workspaceRevision' => 1,
                'catalogRevision' => 1,
                'lines' => [['productId' => $productId, 'quantity' => 3]],
                'payment' => ['method' => 'cod'],
                'customer' => ['name' => 'Expiry Customer', 'phone' => '+967700000004'],
                'address' => ['city' => 'Sanaa', 'area' => 'Center', 'details' => 'Gate 4'],
            ])->assertCreated()->json('data.order');
        $orderId = (string) $created['id'];

        $tenant->run(function () use ($orderId): void {
            DB::statement('SET session_replication_role = replica');
            try {
                DB::table('orders')->where('id', $orderId)->update([
                    'expires_at' => DB::raw("clock_timestamp() - interval '1 minute'"),
                ]);
                DB::table('inventory_reservations')->where('reference_id', $orderId)->update([
                    'created_at' => DB::raw("clock_timestamp() - interval '3 minutes'"),
                    'updated_at' => DB::raw("clock_timestamp() - interval '3 minutes'"),
                    'expires_at' => DB::raw("clock_timestamp() - interval '1 minute'"),
                ]);
            } finally {
                DB::statement('SET session_replication_role = origin');
            }
        });

        $this->assertSame(1, app(OrderService::class)->expireDueBatch($tenant));
        $tenant->run(function () use ($orderId, $productId): void {
            $this->assertSame(OrderStatus::Expired->value, DB::table('orders')->where('id', $orderId)->value('status'));
            $this->assertSame('expired', DB::table('inventory_reservations')->where('reference_id', $orderId)->value('status'));
            $this->assertSame(10, (int) DB::table('products')->where('id', $productId)->value('stock_quantity'));
            $this->assertSame(0, (int) DB::table('products')->where('id', $productId)->value('reserved_quantity'));
            $this->assertSame(1, DB::table('order_status_history')->where('order_id', $orderId)->where('to_status', OrderStatus::Expired->value)->where('actor_type', 'system')->count());
        });
    }

    public function test_internal_reservation_hold_commit_and_public_available_stock_are_consistent(): void
    {
        [$tenant, $owner] = $this->readyTenant('inventory-reserve');
        $productId = $tenant->run(fn (): string => (string) DB::table('products')->value('id'));
        $service = app(InventoryReservationService::class);
        $reserveKey = (string) Str::uuid();
        $reserved = $service->reserve(
            $tenant,
            'wp43_order_draft',
            'draft-1',
            [['productId' => $productId, 'quantity' => 3]],
            300,
            $reserveKey,
            InventoryActorType::User,
            (string) $owner->id,
            'integration_test',
        );
        $this->assertSame('active', $reserved['reservation']['status']);
        $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/inventory")
            ->assertOk()->assertJsonPath('data.items.0.onHand', 10)
            ->assertJsonPath('data.items.0.reserved', 3)
            ->assertJsonPath('data.items.0.available', 7);

        $committed = $service->commit(
            $tenant,
            $reserved['reservation']['id'],
            (string) Str::uuid(),
            InventoryActorType::User,
            (string) $owner->id,
            'integration_test',
        );
        $this->assertSame('committed', $committed['reservation']['status']);
        $replayedReserve = $service->reserve(
            $tenant,
            'wp43_order_draft',
            'draft-1',
            [['productId' => $productId, 'quantity' => 3]],
            300,
            $reserveKey,
            InventoryActorType::User,
            (string) $owner->id,
            'integration_test',
        );
        $this->assertTrue($replayedReserve['replayed']);
        $this->assertSame('active', $replayedReserve['reservation']['status'], 'Creation replay must not drift to the later terminal state.');
        $tenant->run(function () use ($productId): void {
            $product = DB::table('products')->where('id', $productId)->first();
            $this->assertSame(7, (int) $product->stock_quantity);
            $this->assertSame(0, (int) $product->reserved_quantity);
            $this->assertSame(3, (int) $product->inventory_revision);
            $this->assertSame(1, DB::table('inventory_movements')->where('product_id', $productId)->where('kind', 'opening')->count());
            $this->assertSame(1, DB::table('inventory_movements')->where('product_id', $productId)->where('kind', 'reserve')->count());
            $this->assertSame(1, DB::table('inventory_movements')->where('product_id', $productId)->where('kind', 'commit')->count());
        });
        $public = app(StoreWorkspaceService::class)->readPublic($tenant);
        $this->assertSame(7, $public['config']['products'][0]['stockQuantity']);
        $this->assertArrayNotHasKey('reservedQuantity', $public['config']['products'][0]);
    }

    public function test_inventory_reservations_are_atomic_and_terminal_transitions_fail_closed(): void
    {
        [$tenant, $owner] = $this->readyTenant('inventory-atomic');
        $primaryId = $tenant->run(fn (): string => (string) DB::table('products')->value('id'));
        $secondaryId = $this->addInventoryProduct($tenant, 'ATOMIC-2', 1);
        $service = app(InventoryReservationService::class);

        try {
            $service->reserve(
                $tenant,
                'wp43_order_draft',
                'atomic-failure',
                [
                    ['productId' => $primaryId, 'quantity' => 2],
                    ['productId' => $secondaryId, 'quantity' => 2],
                ],
                300,
                (string) Str::uuid(),
                InventoryActorType::User,
                (string) $owner->id,
                'integration_test',
            );
            $this->fail('A multi-product reservation must roll back when any line lacks stock.');
        } catch (InventoryConflict $exception) {
            $this->assertSame('inventory_insufficient_available', $exception->errorCode);
        }

        $tenant->run(function () use ($primaryId, $secondaryId): void {
            $this->assertSame([0, 0], DB::table('products')->whereIn('id', [$primaryId, $secondaryId])
                ->orderBy('id')->pluck('reserved_quantity')->map('intval')->all());
            $this->assertSame(0, DB::table('inventory_reservations')->count());
            $this->assertSame(0, DB::table('inventory_operations')->where('kind', 'reservation_create')
                ->where('idempotency_scope', 'integration_test')->count());
        });

        $held = $service->reserve(
            $tenant,
            'wp43_order_draft',
            'terminal-race',
            [['productId' => $primaryId, 'quantity' => 1]],
            300,
            (string) Str::uuid(),
            InventoryActorType::User,
            (string) $owner->id,
            'integration_test',
        );
        $reservationId = (string) $held['reservation']['id'];

        try {
            app(InventoryLedgerService::class)->adjust($tenant, $owner, [
                'reasonCode' => 'reserved_floor',
                'lines' => [[
                    'productId' => $primaryId,
                    'expectedInventoryRevision' => 2,
                    'movementKind' => 'issue',
                    'delta' => -10,
                ]],
            ], (string) Str::uuid(), null);
            $this->fail('An adjustment must not reduce on-hand below an active hold.');
        } catch (InventoryConflict $exception) {
            $this->assertSame('inventory_insufficient_available', $exception->errorCode);
        }
        try {
            app(InventoryLedgerService::class)->updatePolicy(
                $tenant,
                $owner,
                $primaryId,
                2,
                false,
                3,
                (string) Str::uuid(),
                null,
            );
            $this->fail('Tracking must not be disabled while a hold is active.');
        } catch (InventoryConflict $exception) {
            $this->assertSame('inventory_tracking_conflict', $exception->errorCode);
        }
        try {
            $service->expire($tenant, $reservationId);
            $this->fail('A reservation must not expire before the database clock reaches its deadline.');
        } catch (InventoryConflict $exception) {
            $this->assertSame('inventory_reservation_not_due', $exception->errorCode);
        }

        $releaseKey = (string) Str::uuid();
        $released = $service->release(
            $tenant,
            $reservationId,
            $releaseKey,
            InventoryActorType::User,
            (string) $owner->id,
            'integration_test',
        );
        $this->assertSame('released', $released['reservation']['status']);
        $this->assertTrue($service->release(
            $tenant,
            $reservationId,
            $releaseKey,
            InventoryActorType::User,
            (string) $owner->id,
            'integration_test',
        )['replayed']);
        try {
            $service->commit(
                $tenant,
                $reservationId,
                (string) Str::uuid(),
                InventoryActorType::User,
                (string) $owner->id,
                'integration_test',
            );
            $this->fail('Only one terminal reservation transition may win.');
        } catch (InventoryConflict $exception) {
            $this->assertSame('inventory_reservation_terminal', $exception->errorCode);
        }

        $tenant->run(function () use ($primaryId): void {
            $product = DB::table('products')->where('id', $primaryId)->firstOrFail();
            $this->assertSame(10, (int) $product->stock_quantity);
            $this->assertSame(0, (int) $product->reserved_quantity);
            $this->assertSame(3, (int) $product->inventory_revision);
            $this->assertSame(1, DB::table('inventory_operations')->where('kind', 'reservation_release')->count());
            $this->assertSame(0, DB::table('inventory_operations')->where('kind', 'reservation_commit')->count());
        });
    }

    public function test_independent_connections_serialize_the_final_unit_before_conflict(): void
    {
        [$tenant, $owner] = $this->readyTenant('inventory-final-unit');
        $productId = $tenant->run(fn (): string => (string) DB::table('products')->value('id'));
        $tenantId = (string) $tenant->getKey();
        $ownerId = (string) $owner->getKey();
        $outcomes = $this->runConcurrentInventoryOperations([
            fn (): array => app(InventoryReservationService::class)->reserve(
                Tenant::query()->findOrFail($tenantId), 'wp43_order_draft', 'last-unit-a',
                [['productId' => $productId, 'quantity' => 10]], 300, (string) Str::uuid(),
                InventoryActorType::User, $ownerId, 'integration_test',
            ),
            fn (): array => app(InventoryReservationService::class)->reserve(
                Tenant::query()->findOrFail($tenantId), 'wp43_order_draft', 'last-unit-b',
                [['productId' => $productId, 'quantity' => 10]], 300, (string) Str::uuid(),
                InventoryActorType::User, $ownerId, 'integration_test',
            ),
        ]);
        $this->assertCount(1, array_filter($outcomes, fn (array $outcome): bool => $outcome['status'] === 'ok'));
        $this->assertCount(1, array_filter($outcomes, fn (array $outcome): bool => ($outcome['code'] ?? null) === 'inventory_insufficient_available'));
        $tenant->run(function () use ($productId): void {
            $product = DB::table('products')->where('id', $productId)->firstOrFail();
            $this->assertSame(10, (int) $product->stock_quantity);
            $this->assertSame(10, (int) $product->reserved_quantity);
            $this->assertSame(0, (int) $product->stock_quantity - (int) $product->reserved_quantity);
            $this->assertSame(1, DB::table('inventory_reservations')->where('status', 'active')->count());
        });

        $reservationId = $tenant->run(fn (): string => (string) DB::table('inventory_reservations')->value('id'));
        $terminal = $this->runConcurrentInventoryOperations([
            fn (): array => app(InventoryReservationService::class)->release(
                Tenant::query()->findOrFail($tenantId), $reservationId, (string) Str::uuid(),
                InventoryActorType::User, $ownerId, 'integration_test',
            ),
            fn (): array => app(InventoryReservationService::class)->commit(
                Tenant::query()->findOrFail($tenantId), $reservationId, (string) Str::uuid(),
                InventoryActorType::User, $ownerId, 'integration_test',
            ),
        ]);
        $this->assertCount(1, array_filter($terminal, fn (array $outcome): bool => $outcome['status'] === 'ok'));
        $this->assertCount(1, array_filter($terminal, fn (array $outcome): bool => ($outcome['code'] ?? null) === 'inventory_reservation_terminal'));

        [$oppositeTenant, $oppositeOwner] = $this->readyTenant('inventory-opposite-lock-order');
        $firstId = $oppositeTenant->run(fn (): string => (string) DB::table('products')->value('id'));
        $secondId = $this->addInventoryProduct($oppositeTenant, 'OPPOSITE-2', 10);
        $oppositeTenantId = (string) $oppositeTenant->getKey();
        $oppositeOwnerId = (string) $oppositeOwner->getKey();
        $opposite = $this->runConcurrentInventoryOperations([
            fn (): array => app(InventoryReservationService::class)->reserve(
                Tenant::query()->findOrFail($oppositeTenantId), 'wp43_order_draft', 'opposite-a',
                [['productId' => $firstId, 'quantity' => 1], ['productId' => $secondId, 'quantity' => 1]],
                300, (string) Str::uuid(), InventoryActorType::User, $oppositeOwnerId, 'integration_test',
            ),
            fn (): array => app(InventoryReservationService::class)->reserve(
                Tenant::query()->findOrFail($oppositeTenantId), 'wp43_order_draft', 'opposite-b',
                [['productId' => $secondId, 'quantity' => 1], ['productId' => $firstId, 'quantity' => 1]],
                300, (string) Str::uuid(), InventoryActorType::User, $oppositeOwnerId, 'integration_test',
            ),
        ]);
        $this->assertCount(2, array_filter($opposite, fn (array $outcome): bool => $outcome['status'] === 'ok'));
        $oppositeTenant->run(function () use ($firstId, $secondId): void {
            $this->assertSame([2, 2], DB::table('products')->whereIn('id', [$firstId, $secondId])
                ->orderBy('id')->pluck('reserved_quantity')->map('intval')->all());
        });
    }

    public function test_inventory_history_count_and_page_share_one_repeatable_read_snapshot(): void
    {
        [$tenant, $owner] = $this->readyTenant('inventory-history-snapshot');
        $productId = $tenant->run(fn (): string => (string) DB::table('products')->value('id'));
        $writerConfig = $tenant->run(static fn (): array => config('database.connections.tenant'));
        config()->set('database.connections.inventory_history_writer', $writerConfig);
        $writer = DB::connection('inventory_history_writer');
        $writeCommitted = false;

        DB::listen(function (QueryExecuted $query) use ($writer, $productId, &$writeCommitted): void {
            $sql = mb_strtolower($query->sql);
            if ($writeCommitted || $query->connectionName !== 'tenant'
                || ! str_contains($sql, 'count(*) as aggregate')
                || ! str_contains($sql, 'inventory_movements')) {
                return;
            }
            $writeCommitted = true;
            $writer->transaction(function () use ($writer, $productId): void {
                $product = $writer->table('products')->where('id', $productId)->lockForUpdate()->firstOrFail();
                $operationId = (string) Str::uuid();
                $writer->table('inventory_operations')->insert([
                    'id' => $operationId,
                    'kind' => 'manual_adjustment',
                    'idempotency_scope' => 'system:history-snapshot',
                    'idempotency_key' => (string) Str::uuid(),
                    'request_fingerprint' => str_repeat('a', 64),
                    'actor_type' => 'system',
                    'source' => 'integration_test',
                    'reason_code' => 'snapshot_probe',
                    'created_at' => now(),
                ]);
                $writer->table('inventory_movements')->insert([
                    'id' => (string) Str::uuid(),
                    'operation_id' => $operationId,
                    'product_id' => $productId,
                    'kind' => 'correction',
                    'before_on_hand' => (int) $product->stock_quantity,
                    'before_reserved' => (int) $product->reserved_quantity,
                    'on_hand_delta' => 1,
                    'reserved_delta' => 0,
                    'after_on_hand' => (int) $product->stock_quantity + 1,
                    'after_reserved' => (int) $product->reserved_quantity,
                    'before_inventory_revision' => (int) $product->inventory_revision,
                    'after_inventory_revision' => (int) $product->inventory_revision + 1,
                    'created_at' => now(),
                ]);
                $writer->selectOne("SELECT set_config('eoshop.inventory_operation_id', ?, true)", [$operationId]);
                $writer->table('products')->where('id', $productId)->update([
                    'stock_quantity' => (int) $product->stock_quantity + 1,
                    'inventory_revision' => (int) $product->inventory_revision + 1,
                    'updated_at' => now(),
                ]);
            });
        });

        try {
            $snapshot = app(InventoryLedgerService::class)->history($tenant, $owner, null, 1, 20);
            $this->assertTrue($writeCommitted);
            $this->assertSame(1, $snapshot['total']);
            $this->assertCount(1, $snapshot['data']);

            $latest = app(InventoryLedgerService::class)->history($tenant, $owner, null, 1, 20);
            $this->assertSame(2, $latest['total']);
            $this->assertCount(2, $latest['data']);
        } finally {
            DB::purge('inventory_history_writer');
        }
    }

    public function test_inventory_database_guards_reject_direct_snapshot_and_history_mutation(): void
    {
        [$tenant, $owner] = $this->readyTenant('inventory-guards');
        $secondaryId = $this->addInventoryProduct($tenant, 'GUARD-2', 5);
        $held = app(InventoryReservationService::class)->reserve(
            $tenant, 'wp43_order_draft', 'late-item',
            [['productId' => $tenant->run(fn (): string => (string) DB::table('products')->orderBy('position')->value('id')), 'quantity' => 1]],
            300, (string) Str::uuid(), InventoryActorType::User, (string) $owner->id, 'integration_test',
        );
        $tenant->run(function () use ($secondaryId, $held): void {
            $productId = (string) DB::table('products')->value('id');
            try {
                DB::table('products')->where('id', $productId)->update(['stock_quantity' => 999]);
                $this->fail('Direct inventory snapshot mutation must be rejected.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('inventory snapshot update requires an operation', $exception->getMessage());
            }
            try {
                DB::table('products')->where('id', $productId)->update(['reserved_quantity' => 11]);
                $this->fail('The database must reject over-reserved product snapshots.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('inventory snapshot update requires an operation', $exception->getMessage());
            }
            $movementId = (string) DB::table('inventory_movements')->value('id');
            $movement = DB::table('inventory_movements')->where('id', $movementId)->firstOrFail();
            try {
                DB::table('inventory_application_receipts')->insert([
                    'id' => (string) Str::uuid(),
                    'operation_id' => $movement->operation_id,
                    'product_id' => $movement->product_id,
                    'movement_id' => $movementId,
                    'created_at' => now(),
                ]);
                $this->fail('Application code must not forge a ledger application receipt.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('inventory application receipts are trigger-owned', $exception->getMessage());
            }
            try {
                DB::table('inventory_movements')->where('id', $movementId)->delete();
                $this->fail('Inventory history deletion must be rejected.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('inventory history is append-only', $exception->getMessage());
            }
            $operationId = (string) DB::table('inventory_operations')->where('kind', 'opening')->value('id');
            try {
                DB::table('inventory_reservations')->insert([
                    'id' => (string) Str::uuid(),
                    'status' => 'active',
                    'reference_type' => 'invalid',
                    'reference_id' => 'invalid-ttl',
                    'expires_at' => now()->addYear(),
                    'created_by_operation_id' => $operationId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $this->fail('The database must enforce the reservation TTL boundary.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('inventory_reservations_ttl_valid', $exception->getMessage());
            }
            try {
                DB::table('inventory_reservation_items')->insert([
                    'reservation_id' => $held['reservation']['id'],
                    'product_id' => $secondaryId,
                    'quantity' => 1,
                ]);
                $this->fail('Reservation items must not be appended after reservation creation commits.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('reservation items may only be inserted by their creation operation', $exception->getMessage());
            }

            $openingOperationId = (string) Str::uuid();
            DB::table('inventory_operations')->insert([
                'id' => $openingOperationId,
                'kind' => 'opening',
                'idempotency_scope' => 'system:duplicate-opening',
                'idempotency_key' => (string) Str::uuid(),
                'request_fingerprint' => str_repeat('b', 64),
                'actor_type' => 'system',
                'source' => 'integration_test',
                'reason_code' => 'duplicate_opening',
                'created_at' => now(),
            ]);
            $product = DB::table('products')->where('id', $productId)->firstOrFail();
            try {
                DB::table('inventory_movements')->insert([
                    'id' => (string) Str::uuid(), 'operation_id' => $openingOperationId,
                    'product_id' => $productId, 'kind' => 'opening',
                    'before_on_hand' => 0, 'before_reserved' => 0,
                    'on_hand_delta' => (int) $product->stock_quantity, 'reserved_delta' => 0,
                    'after_on_hand' => (int) $product->stock_quantity,
                    'after_reserved' => (int) $product->reserved_quantity,
                    'before_inventory_revision' => (int) $product->inventory_revision,
                    'after_inventory_revision' => (int) $product->inventory_revision,
                    'created_at' => now(),
                ]);
                $this->fail('Each product must have exactly one opening movement.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('inventory_movements_one_opening_per_product', $exception->getMessage());
            }

            try {
                DB::transaction(function () use ($productId, $product): void {
                    $operationId = (string) Str::uuid();
                    DB::table('inventory_operations')->insert([
                        'id' => $operationId, 'kind' => 'manual_adjustment',
                        'idempotency_scope' => 'system:wrong-policy-kind',
                        'idempotency_key' => (string) Str::uuid(),
                        'request_fingerprint' => str_repeat('c', 64),
                        'actor_type' => 'system', 'source' => 'integration_test',
                        'reason_code' => 'wrong_policy_kind', 'created_at' => now(),
                    ]);
                    DB::table('inventory_policy_changes')->insert([
                        'id' => (string) Str::uuid(), 'operation_id' => $operationId,
                        'product_id' => $productId,
                        'before_manage_stock' => (bool) $product->manage_stock,
                        'after_manage_stock' => ! (bool) $product->manage_stock,
                        'before_low_stock_threshold' => (int) $product->low_stock_threshold,
                        'after_low_stock_threshold' => (int) $product->low_stock_threshold,
                        'before_inventory_revision' => (int) $product->inventory_revision,
                        'after_inventory_revision' => (int) $product->inventory_revision + 1,
                        'created_at' => now(),
                    ]);
                });
                $this->fail('Policy history must be coupled to a policy operation.');
            } catch (QueryException|\PDOException $exception) {
                $this->assertStringContainsString('inventory policy change requires a policy operation', $exception->getMessage());
            }
        });
    }

    public function test_inventory_permissions_hide_private_projections_and_fail_closed(): void
    {
        [$tenant, $owner] = $this->readyTenant('inventory-permissions');
        $outsider = $this->user('inventory-outsider@example.test');

        $this->getJson("/api/merchant/stores/{$tenant->id}/inventory")->assertUnauthorized();
        $this->actingAs($outsider)->getJson("/api/merchant/stores/{$tenant->id}/inventory")->assertForbidden();

        $metadataRole = Role::query()->create([
            'key' => 'tenant_metadata_only_'.Str::lower(Str::random(8)),
            'name' => 'Tenant metadata only',
            'scope' => RoleScope::Tenant,
            'system' => false,
        ]);
        $this->roleIds[] = (int) $metadataRole->id;
        app(RoleAssignmentService::class)->assignTenantRole($tenant, $outsider, $metadataRole, $owner);

        $workspace = $this->actingAs($outsider)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()
            ->json('data.config.products.0');
        $this->actingAs($outsider)->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()
            ->assertJsonPath('data.capabilities.inventoryView', false)
            ->assertJsonPath('data.capabilities.inventoryManage', false);
        $catalog = $this->actingAs($outsider)
            ->getJson("/api/merchant/stores/{$tenant->id}/catalog")
            ->assertOk()
            ->json('data.products.0');
        foreach (['stockQuantity', 'reservedQuantity', 'availableQuantity', 'inventoryRevision', 'manageStock', 'lowStockThreshold'] as $field) {
            $this->assertArrayNotHasKey($field, $workspace);
            $this->assertArrayNotHasKey($field, $catalog);
        }
        $this->actingAs($outsider)->getJson("/api/merchant/stores/{$tenant->id}/inventory")->assertForbidden();

        DB::connection((string) config('tenancy.database.central_connection'))
            ->table('tenant_user')->where('tenant_id', $tenant->id)->where('user_id', $owner->id)
            ->update(['status' => TenantMembershipStatus::Suspended->value]);
        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/inventory")->assertForbidden();

        $routes = collect(app('router')->getRoutes()->getRoutes())->map(fn ($route): string => $route->uri())->all();
        $this->assertFalse(collect($routes)->contains(fn (string $uri): bool => str_contains($uri, 'reservation')));
        $this->assertSame(1, collect($routes)->filter(fn (string $uri): bool => $uri === 'api/store/orders')->count());
    }

    public function test_inventory_mutation_http_validation_authorization_and_throttle_boundaries(): void
    {
        [$tenant, $owner] = $this->readyTenant('inventory-http-boundaries');
        $outsider = $this->user('inventory-http-outsider@example.test');
        $product = $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/inventory")
            ->assertOk()->json('data.items.0');
        $valid = [
            'reasonCode' => 'boundary_probe',
            'lines' => [[
                'productId' => $product['productId'],
                'expectedInventoryRevision' => $product['inventoryRevision'],
                'movementKind' => 'receive',
                'delta' => 1,
            ]],
        ];

        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($outsider)
            ->postJson("/api/merchant/stores/{$tenant->id}/inventory/adjustments", $valid, ['Idempotency-Key' => (string) Str::uuid()])
            ->assertForbidden();
        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($owner)
            ->postJson("/api/merchant/stores/{$tenant->id}/inventory/adjustments", ['reasonCode' => 'invalid'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['idempotencyKey', 'lines']);

        for ($attempt = 2; $attempt <= 30; $attempt++) {
            $this->actingAs($owner)
                ->postJson("/api/merchant/stores/{$tenant->id}/inventory/adjustments", ['reasonCode' => 'invalid'])
                ->assertUnprocessable();
        }
        $this->actingAs($owner)
            ->postJson("/api/merchant/stores/{$tenant->id}/inventory/adjustments", ['reasonCode' => 'invalid'])
            ->assertTooManyRequests();
    }

    public function test_workspace_authorization_quota_and_media_validation_fail_closed(): void
    {
        [$tenant, $owner] = $this->readyTenant('workspace-boundaries');
        $outsider = $this->user('workspace-outsider@example.test');
        $staff = $this->user('workspace-staff@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $staff,
            Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail(),
            $owner,
        );

        $this->actingAs($outsider)->getJson("/api/merchant/stores/{$tenant->id}/workspace")->assertForbidden();
        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($staff)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
                'catalogRevision' => 1,
                'config' => $this->config('Staff write', []),
            ])
            ->assertForbidden();

        Auth::forgetGuards();
        $this->flushSession();
        $tooMany = array_map(fn (int $index): array => $this->product("SKU-{$index}"), range(1, 11));
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
                'catalogRevision' => 1,
                'config' => $this->config('Over quota', $tooMany),
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'workspace_quota_exceeded');

        Auth::forgetGuards();
        $this->flushSession();
        $invalidMedia = $this->product('SAFE-SKU');
        $invalidMedia['imageUrl'] = 'data:image/png;base64,unsafe';
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
                'catalogRevision' => 1,
                'config' => $this->config('Unsafe media', [$invalidMedia]),
            ])
            ->assertUnprocessable();

        Auth::forgetGuards();
        $this->flushSession();
        $invalidContact = $this->config('Invalid contact', []);
        $invalidContact['phone'] = '+()-----';
        $invalidContact['whatsapp'] = '+()-----';
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
                'catalogRevision' => 1,
                'config' => $invalidContact,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['config.phone', 'config.whatsapp']);

        DB::connection((string) config('tenancy.database.central_connection'))
            ->table('tenant_user')
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $owner->id)
            ->update(['status' => TenantMembershipStatus::Suspended->value]);
        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/workspace")->assertForbidden();
    }

    public function test_public_composition_uses_one_repeatable_read_snapshot_during_a_concurrent_write(): void
    {
        [$tenant, $owner] = $this->readyTenant('workspace-snapshot');
        $productId = $tenant->run(static fn (): string => (string) DB::table('products')->value('id'));
        $payload = [
            'revision' => 1,
            'catalogRevision' => 1,
            'config' => $this->config('Old snapshot', [[
                ...$this->product('SNAPSHOT-1'),
                'id' => $productId,
                'revision' => 1,
            ]]),
        ];
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", $payload)
            ->assertOk();

        $writerConfig = $tenant->run(static fn (): array => config('database.connections.tenant'));
        config()->set('database.connections.workspace_writer', $writerConfig);
        $writer = DB::connection('workspace_writer');
        $writeCommitted = false;

        DB::listen(function (QueryExecuted $query) use ($writer, &$writeCommitted): void {
            $sql = mb_strtolower($query->sql);
            if ($writeCommitted || $query->connectionName !== 'tenant'
                || ! str_contains($sql, 'select * from "catalog_settings"')) {
                return;
            }

            $writeCommitted = true;
            $writer->transaction(function () use ($writer): void {
                $record = $writer->table('store_configs')->where('is_current', true)->firstOrFail();
                $config = json_decode((string) $record->config_json, true, 512, JSON_THROW_ON_ERROR);
                $config['storeName'] = 'New snapshot';
                $writer->table('products')->update(['name' => 'New product']);
                $writer->table('store_configs')->where('id', $record->id)->update([
                    'config_json' => json_encode($config, JSON_THROW_ON_ERROR),
                    'revision' => 3,
                    'updated_at' => now(),
                ]);
            });
        });

        try {
            $snapshot = app(StoreWorkspaceService::class)->readPublic($tenant->refresh());
            $this->assertTrue($writeCommitted);
            $this->assertSame('Old snapshot', $snapshot['config']['storeName']);
            $this->assertSame('Server product', $snapshot['config']['products'][0]['name']);

            $latest = app(StoreWorkspaceService::class)->readPublic($tenant->refresh());
            $this->assertSame('New snapshot', $latest['config']['storeName']);
            $this->assertSame('New product', $latest['config']['products'][0]['name']);
        } finally {
            DB::purge('workspace_writer');
        }
    }

    public function test_merchant_catalog_read_uses_one_repeatable_read_snapshot_during_a_concurrent_write(): void
    {
        [$tenant, $owner] = $this->readyTenant('catalog-snapshot');
        $writerConfig = $tenant->run(static fn (): array => config('database.connections.tenant'));
        config()->set('database.connections.catalog_writer', $writerConfig);
        $writer = DB::connection('catalog_writer');
        $writeCommitted = false;

        DB::listen(function (QueryExecuted $query) use ($writer, &$writeCommitted): void {
            $sql = mb_strtolower($query->sql);
            if ($writeCommitted || $query->connectionName !== 'tenant'
                || ! str_contains($sql, 'select * from "catalog_settings"')) {
                return;
            }

            $writeCommitted = true;
            $writer->transaction(function () use ($writer): void {
                $writer->table('products')->update(['name' => 'New catalog product']);
                $writer->table('catalog_settings')->where('id', 1)->update([
                    'revision' => 2,
                    'updated_at' => now(),
                ]);
            });
        });

        try {
            $snapshot = app(ProductCatalogService::class)->read($tenant->refresh(), $owner);
            $this->assertTrue($writeCommitted);
            $this->assertSame(1, $snapshot['revision']);
            $this->assertSame('Server product', $snapshot['products'][0]['name']);

            $latest = app(ProductCatalogService::class)->read($tenant->refresh(), $owner);
            $this->assertSame(2, $latest['revision']);
            $this->assertSame('New catalog product', $latest['products'][0]['name']);
        } finally {
            DB::purge('catalog_writer');
        }
    }

    public function test_catalog_rejects_malformed_ids_and_existing_sku_owners_without_server_errors(): void
    {
        [$tenant, $owner] = $this->readyTenant('catalog-contract');
        $catalog = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/catalog")
            ->assertOk()
            ->json('data');

        $malformed = $catalog['products'][0];
        $malformed['id'] = 'legacy-client-id';
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 1,
                'currencyCode' => 'YER',
                'products' => [$malformed],
                'archiveProductIds' => [],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('products.0.id');

        $duplicate = $this->product('LEGACY-SKU');
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 1,
                'currencyCode' => 'YER',
                'products' => [$duplicate],
                'archiveProductIds' => [],
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_sku_conflict');
    }

    public function test_submission_rejects_product_limit_and_unmanaged_media_before_provisioning(): void
    {
        $merchant = $this->user('workspace-submit@example.test');
        $products = array_map(fn (int $index): array => $this->product("NEW-{$index}"), range(1, 11));
        $payload = $this->readyStoreSubmissionPayload($merchant, [
            'storeName' => 'Rejected before provisioning',
            'businessType' => 'retail',
            'themeStyle' => 'elegant',
            'handle' => 'rejected-workspace',
            'planKey' => 'starter',
            'config' => $this->config('Rejected before provisioning', $products),
        ]);

        $this->actingAs($merchant)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/register-store', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('config.products');

        $this->assertDatabaseMissing('tenants', ['store_name' => 'Rejected before provisioning']);
    }

    public function test_product_staff_manages_catalog_lifecycle_prices_and_archival_without_store_permission(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('catalog-lifecycle');
        $staff = $this->user('catalog-staff@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $staff,
            Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail(),
            $owner,
        );

        $catalog = $this->actingAs($staff)
            ->getJson("/api/merchant/stores/{$tenant->id}/catalog")
            ->assertOk()
            ->assertJsonPath('data.revision', 1)
            ->json('data');
        $product = $catalog['products'][0];
        $product['status'] = 'draft';
        $product['basePrice'] = '20.00';
        $product['salePrice'] = '15.00';

        $draft = $this->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 1,
                'currencyCode' => 'YER',
                'products' => [$product],
                'archiveProductIds' => [],
            ])
            ->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.products.0.status', 'draft')
            ->assertJsonPath('data.products.0.price', '15.00')
            ->json('data');

        $this->actingAs($staff)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
                'catalogRevision' => 2,
                'config' => $this->config('Forbidden store write', [$product]),
            ])
            ->assertForbidden();
        $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonCount(0, 'data.config.products');

        $published = $draft['products'][0];
        $published['status'] = 'published';
        $publishedCatalog = $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 2,
                'currencyCode' => 'YER',
                'products' => [$published],
                'archiveProductIds' => [],
            ])
            ->assertOk()
            ->assertJsonPath('data.revision', 3)
            ->assertJsonPath('data.products.0.status', 'published')
            ->json('data');
        $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonPath('data.config.products.0.price', '15.00');

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 2,
                'currencyCode' => 'YER',
                'products' => [$publishedCatalog['products'][0]],
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_revision_conflict');

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 3,
                'currencyCode' => 'SAR',
                'products' => [$publishedCatalog['products'][0]],
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_currency_locked');

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 3,
                'currencyCode' => 'YER',
                'products' => [],
                'archiveProductIds' => [$publishedCatalog['products'][0]['id']],
            ])
            ->assertOk()
            ->assertJsonPath('data.revision', 4)
            ->assertJsonPath('data.products.0.status', 'archived');
        $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonCount(0, 'data.config.products');

        $tenant->run(function (): void {
            try {
                DB::table('products')->update([
                    'sale_price_minor' => 2000,
                    'price' => '20.00',
                ]);
                $this->fail('The database accepted an invalid sale price.');
            } catch (QueryException) {
                $this->assertSame(1, DB::table('products')->where('sale_price_minor', 1500)->count());
            }
        });
    }

    public function test_direct_archive_transition_recovers_a_catalog_after_a_plan_downgrade(): void
    {
        [$tenant, $owner] = $this->readyTenant('catalog-downgrade');
        $catalog = $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/catalog")
            ->assertOk()->json('data');
        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
            'catalogRevision' => $catalog['revision'],
            'currencyCode' => 'YER',
            'products' => [[
                'status' => 'published',
                'name' => 'Second live product',
                'basePrice' => '9.00',
                'salePrice' => null,
                'sku' => 'SECOND-LIVE-SKU',
            ]],
            'archiveProductIds' => [],
        ])->assertOk()->assertJsonPath('data.revision', 2);

        DB::table('plans')->where('key', 'starter')->update(['max_products' => 1]);
        try {
            $overLimit = $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/catalog")
                ->assertOk()->json('data');
            $toArchive = $overLimit['products'][0];
            $toArchive['status'] = 'archived';

            $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => $overLimit['revision'],
                'currencyCode' => 'YER',
                'products' => [$toArchive],
                'archiveProductIds' => [],
            ])->assertOk()->assertJsonPath('data.revision', 3);

            $tenant->run(fn () => $this->assertSame(
                1,
                DB::table('products')->where('status', '!=', 'archived')->count(),
            ));
        } finally {
            DB::table('plans')->where('key', 'starter')->update(['max_products' => 10]);
        }
    }

    public function test_managed_store_asset_is_idempotent_private_until_bound_public_when_bound_and_pruned_after_detach(): void
    {
        Storage::fake('local');
        [$tenant, $owner, $domain] = $this->readyTenant('store-asset-lifecycle');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $key = (string) Str::uuid();

        $first = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('logo.png', $png),
            ])
            ->assertCreated()
            ->assertJsonPath('data.mimeType', 'image/png')
            ->json('data');
        $replay = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('same-logo.png', $png),
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame($first['id'], $replay['id']);

        $this->get("http://{$domain}{$first['url']}")->assertNotFound();
        $privatePreview = $this->actingAs($owner)->get("http://127.0.0.1{$first['url']}")
            ->assertOk()
            ->assertHeader('content-type', 'image/png');
        $this->assertStringContainsString('private', (string) $privatePreview->headers->get('cache-control'));
        $this->assertStringContainsString('no-store', (string) $privatePreview->headers->get('cache-control'));

        $workspace = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()->json('data');
        $workspace['config']['logoType'] = 'image';
        $workspace['config']['logoUrl'] = $first['url'];
        $workspace['config']['aboutImage'] = $first['url'];
        $bound = $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => $workspace['revision'],
                'catalogRevision' => $workspace['catalogRevision'],
                'config' => $workspace['config'],
            ])->assertOk()->json('data');
        $this->assertSame($first['url'], $bound['config']['aboutImage']);

        Auth::forgetGuards();
        $this->flushSession();
        $publicAsset = $this->get("http://{$domain}{$first['url']}")
            ->assertOk()
            ->assertHeader('content-type', 'image/png');
        $this->assertStringContainsString('no-store', (string) $publicAsset->headers->get('cache-control'));
        $this->get("http://127.0.0.1{$first['url']}")->assertNotFound();

        $tenant->forceFill(['publication_status' => PublicationStatus::Unpublished->value])->save();
        $this->get("http://{$domain}{$first['url']}")->assertNotFound();
        $tenant->forceFill(['publication_status' => PublicationStatus::Published->value])->save();

        $bound['config']['logoType'] = 'icon';
        $bound['config']['logoUrl'] = '';
        $bound['config']['aboutImage'] = '';
        $this->actingAs($owner)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => $bound['revision'],
                'catalogRevision' => $bound['catalogRevision'],
                'config' => $bound['config'],
            ])->assertOk();
        Auth::forgetGuards();
        $this->flushSession();
        $this->get("http://{$domain}{$first['url']}")->assertNotFound();

        $path = $tenant->run(function () use ($first): string {
            DB::table('store_assets')->where('id', $first['id'])->update(['orphaned_at' => now()->subDays(2)]);

            return (string) DB::table('store_assets')->where('id', $first['id'])->value('path');
        });
        $tenant->forceFill(['verification_status' => TenantVerificationStatus::Suspended->value])->save();
        $this->assertSame(0, Artisan::call('store-assets:prune', ['--tenant' => [$tenant->id]]));
        $tenant->run(fn () => $this->assertDatabaseMissing('store_assets', ['id' => $first['id']], 'tenant'));
        Storage::disk('local')->assertMissing($path);
    }

    public function test_store_asset_rejects_cross_tenant_paths_invalid_replays_and_rolls_back_binding_on_stale_catalog(): void
    {
        Storage::fake('local');
        [$tenantA, $ownerA, $domainA] = $this->readyTenant('store-asset-a');
        [$tenantB, $ownerB, $domainB] = $this->readyTenant('store-asset-b');
        $outsider = $this->user('store-asset-outsider@example.test');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $key = (string) Str::uuid();
        $asset = $this->actingAs($ownerA)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenantA->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('asset.png', $png),
            ])->assertCreated()->json('data');

        $this->actingAs($ownerA)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenantA->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('different.png', $png.'different'),
            ])->assertConflict()->assertJsonPath('code', 'store_asset_idempotency_conflict');
        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($outsider)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenantA->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('forbidden.png', $png),
            ])->assertForbidden();

        Auth::forgetGuards();
        $this->flushSession();
        $workspaceB = $this->actingAs($ownerB)
            ->getJson("/api/merchant/stores/{$tenantB->id}/workspace")->assertOk()->json('data');
        $workspaceB['config']['logoType'] = 'image';
        $workspaceB['config']['logoUrl'] = $asset['url'];
        $this->actingAs($ownerB)->patchJson("/api/merchant/stores/{$tenantB->id}/workspace", [
            'revision' => $workspaceB['revision'],
            'catalogRevision' => $workspaceB['catalogRevision'],
            'config' => $workspaceB['config'],
        ])->assertUnprocessable()->assertJsonPath('code', 'workspace_asset_path_invalid');

        Auth::forgetGuards();
        $this->flushSession();
        $workspaceA = $this->actingAs($ownerA)
            ->getJson("/api/merchant/stores/{$tenantA->id}/workspace")->assertOk()->json('data');
        foreach ([
            'https://127.0.0.1/api/store-assets/'.$tenantA->id.'/'.Str::uuid(),
            "https://{$domainA}/api/store-assets/{$tenantA->id}/".Str::uuid(),
            "https://{$domainB}/api/store-assets/{$tenantA->id}/".Str::uuid(),
            'https://cdn.example.test/api/%73tore-assets/'.$tenantA->id.'/'.Str::uuid(),
            'https://cdn.example.test//api/store-assets/'.$tenantA->id.'/'.Str::uuid(),
            'https://cdn.example.test/x/../api/store-assets/'.$tenantA->id.'/'.Str::uuid(),
            '//cdn.example.test/logo.png',
            'data:image/png;base64,unsafe',
            'blob:http://127.0.0.1/unsafe',
        ] as $invalidUrl) {
            $invalidConfig = $workspaceA['config'];
            $invalidConfig['heroBannerImage'] = $invalidUrl;
            $this->actingAs($ownerA)->patchJson("/api/merchant/stores/{$tenantA->id}/workspace", [
                'revision' => $workspaceA['revision'],
                'catalogRevision' => $workspaceA['catalogRevision'],
                'config' => $invalidConfig,
            ])->assertUnprocessable()->assertJsonPath('code', 'workspace_asset_path_invalid');
        }

        $missingConfig = $workspaceA['config'];
        $missingConfig['heroBannerImage'] = '/api/store-assets/'.$tenantA->id.'/'.Str::uuid();
        $this->actingAs($ownerA)->patchJson("/api/merchant/stores/{$tenantA->id}/workspace", [
            'revision' => $workspaceA['revision'],
            'catalogRevision' => $workspaceA['catalogRevision'],
            'config' => $missingConfig,
        ])->assertConflict()->assertJsonPath('code', 'workspace_asset_unavailable');

        $catalog = $this->actingAs($ownerA)
            ->getJson("/api/merchant/stores/{$tenantA->id}/catalog")->assertOk()->json('data');
        $catalog['products'][0]['description'] = 'A concurrent catalog update';
        $this->actingAs($ownerA)->patchJson("/api/merchant/stores/{$tenantA->id}/catalog", [
            'catalogRevision' => $catalog['revision'],
            'currencyCode' => $catalog['currencyCode'],
            'products' => $catalog['products'],
            'archiveProductIds' => [],
        ])->assertOk();

        $workspaceA['config']['logoType'] = 'image';
        $workspaceA['config']['logoUrl'] = $asset['url'];
        $this->actingAs($ownerA)->patchJson("/api/merchant/stores/{$tenantA->id}/workspace", [
            'revision' => $workspaceA['revision'],
            'catalogRevision' => $workspaceA['catalogRevision'],
            'config' => $workspaceA['config'],
        ])->assertConflict()->assertJsonPath('code', 'catalog_revision_conflict');
        $tenantA->run(function () use ($asset): void {
            $this->assertNotNull(DB::table('store_assets')->where('id', $asset['id'])->value('orphaned_at'));
            $config = json_decode((string) DB::table('store_configs')->where('is_current', true)->value('config_json'), true, 512, JSON_THROW_ON_ERROR);
            $this->assertNotSame($asset['url'], $config['logoUrl'] ?? null);
        });
    }

    public function test_store_asset_upload_enforces_content_and_tenant_quota_while_exact_replay_remains_available(): void
    {
        Storage::fake('local');
        [$tenant, $owner] = $this->readyTenant('store-asset-quota');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $key = (string) Str::uuid();
        $request = fn (string $requestKey, UploadedFile $file) => $this->actingAs($owner)
            ->withHeader('Idempotency-Key', $requestKey)
            ->post("/api/merchant/stores/{$tenant->id}/assets", ['image' => $file]);

        $request((string) Str::uuid(), UploadedFile::fake()->createWithContent('not-image.txt', 'not image'))
            ->assertConflict()->assertJsonPath('code', 'store_asset_invalid');
        config(['store_assets.max_pixels' => 0]);
        $request((string) Str::uuid(), UploadedFile::fake()->createWithContent('pixels.png', $png))
            ->assertConflict()->assertJsonPath('code', 'store_asset_invalid');
        config(['store_assets.max_pixels' => 25_000_000]);
        $request($key, UploadedFile::fake()->createWithContent('valid.png', $png))->assertCreated();
        config(['store_assets.max_assets_per_tenant' => 0]);
        $request($key, UploadedFile::fake()->createWithContent('replay.png', $png))->assertCreated();
        $request((string) Str::uuid(), UploadedFile::fake()->createWithContent('over-quota.png', $png))
            ->assertConflict()->assertJsonPath('code', 'store_asset_quota_exceeded');
    }

    public function test_store_asset_recovers_staging_counts_cleanup_tombstones_and_refuses_unsafe_or_destructive_database_changes(): void
    {
        Storage::fake('local');
        [$tenant, $owner] = $this->readyTenant('store-asset-recovery');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $key = (string) Str::uuid();
        $upload = $this->actingAs($owner)->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('recover.png', $png),
            ])->assertCreated()->json('data');

        $path = $tenant->run(function () use ($upload): string {
            $row = DB::table('store_assets')->where('id', $upload['id'])->firstOrFail();
            DB::table('store_assets')->where('id', $upload['id'])->update([
                'state' => 'staging',
                'orphaned_at' => now()->subDays(2),
                'updated_at' => now(),
            ]);

            return (string) $row->path;
        });
        Storage::disk('local')->delete($path);
        config(['store_assets.max_assets_per_tenant' => 1]);
        $this->actingAs($owner)->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('recover-again.png', $png),
            ])->assertCreated()->assertJsonPath('data.id', $upload['id']);
        Storage::disk('local')->assertExists($path);
        $tenant->run(function () use ($upload): void {
            $this->assertSame('ready', DB::table('store_assets')->where('id', $upload['id'])->value('state'));
            try {
                DB::table('store_assets')->where('id', $upload['id'])->update(['path' => '../unsafe.png']);
                $this->fail('The database accepted an unsafe store asset path.');
            } catch (QueryException) {
                $this->assertNotSame('../unsafe.png', DB::table('store_assets')->where('id', $upload['id'])->value('path'));
            }
            try {
                DB::table('store_assets')->where('id', $upload['id'])->update([
                    'state' => 'staging',
                    'orphaned_at' => null,
                    'cleanup_started_at' => null,
                ]);
                $this->fail('The database accepted a staging asset without an orphan timestamp.');
            } catch (QueryException) {
                $this->assertSame('ready', DB::table('store_assets')->where('id', $upload['id'])->value('state'));
            }
            DB::table('store_assets')->where('id', $upload['id'])->update([
                'state' => 'cleanup',
                'orphaned_at' => now()->subDays(2),
                'cleanup_started_at' => now(),
                'updated_at' => now(),
            ]);
            $migration = require database_path('migrations/tenant/2026_08_20_000008_create_store_assets.php');
            try {
                $migration->down();
                $this->fail('A populated managed asset table must refuse rollback.');
            } catch (\RuntimeException) {
                $this->assertTrue(Schema::hasTable('store_assets'));
            }
        });

        $this->actingAs($owner)->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('cleanup-replay.png', $png),
            ])->assertConflict()->assertJsonPath('code', 'workspace_asset_unavailable');
        $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('cleanup-counts.png', $png),
            ])->assertConflict()->assertJsonPath('code', 'store_asset_quota_exceeded');
    }

    public function test_store_asset_readiness_requires_the_complete_schema_for_runtime_and_provisioning(): void
    {
        [$tenant] = $this->readyTenant('store-asset-partial-schema');
        $submission = new StoreSubmission([
            'tenant_id' => $tenant->id,
            'initial_config_id' => $tenant->run(fn (): string => (string) DB::table('store_configs')
                ->where('is_current', true)->value('id')),
        ]);

        $tenant->run(static fn () => Schema::table('store_assets', static function ($table): void {
            $table->dropColumn('updated_at');
        }));

        $this->assertFalse(TenantWorkspaceReadiness::maintenanceCheck($tenant));
        try {
            app(TenantProvisioningExecutor::class)->assertReady($tenant, $submission);
            $this->fail('Provisioning accepted a partial store asset schema.');
        } catch (ProvisioningFailure $failure) {
            $this->assertSame('tenant_readiness_failed', $failure->errorCode);
        }
    }

    public function test_store_asset_bind_and_cleanup_serialize_across_real_connections_without_a_broken_reference(): void
    {
        Storage::fake('local');
        [$tenant, $owner] = $this->readyTenant('store-asset-race');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $asset = $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('race.png', $png),
            ])->assertCreated()->json('data');
        $workspace = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")->assertOk()->json('data');
        $workspace['config']['logoType'] = 'image';
        $workspace['config']['logoUrl'] = $asset['url'];
        $tenant->run(fn () => DB::table('store_assets')->where('id', $asset['id'])->update([
            'orphaned_at' => now()->subDays(2),
            'updated_at' => now()->subDays(2),
        ]));

        $tenantId = (string) $tenant->id;
        $ownerId = (string) $owner->id;
        $payload = [
            'revision' => $workspace['revision'],
            'catalogRevision' => $workspace['catalogRevision'],
            'config' => $workspace['config'],
        ];
        $results = $this->runConcurrentAssetOperations([
            static function () use ($tenantId, $ownerId, $payload): void {
                app(StoreWorkspaceService::class)->update(
                    Tenant::query()->findOrFail($tenantId),
                    User::query()->findOrFail($ownerId),
                    $payload,
                );
            },
            static function () use ($tenantId): void {
                app(StoreAssetService::class)->pruneOrphans(Tenant::query()->findOrFail($tenantId));
            },
        ]);
        $this->assertContains($results[0]['status'], ['ok', 'conflict']);
        $this->assertSame('ok', $results[1]['status']);

        $tenant->run(function () use ($asset): void {
            $config = json_decode((string) DB::table('store_configs')->where('is_current', true)->value('config_json'), true, 512, JSON_THROW_ON_ERROR);
            $referenced = ($config['logoUrl'] ?? null) === $asset['url'];
            $row = DB::table('store_assets')->where('id', $asset['id'])->first();
            if ($referenced) {
                $this->assertNotNull($row);
                $this->assertSame('ready', $row->state);
                $this->assertNull($row->cleanup_started_at);
                $this->assertTrue(Storage::disk((string) $row->disk)->exists((string) $row->path));
            } else {
                $this->assertNull($row);
            }
        });
    }

    public function test_managed_catalog_media_is_idempotent_private_until_attached_and_public_only_for_published_product(): void
    {
        Storage::fake('local');
        [$tenant, $owner, $domain] = $this->readyTenant('catalog-media');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $key = (string) Str::uuid();

        $first = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('product.png', $png),
            ])
            ->assertCreated()
            ->assertJsonPath('data.mimeType', 'image/png')
            ->json('data');
        $second = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('same.png', $png),
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame($first['id'], $second['id']);

        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('different.png', $png.'different'),
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'media_idempotency_conflict');
        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('not-image.txt', 'not an image'),
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_media_invalid');
        config(['catalog.max_media_pixels' => 0]);
        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('too-many-pixels.png', $png),
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_media_invalid');
        config(['catalog.max_media_pixels' => 25_000_000]);
        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->create('too-large.png', 5121, 'image/png'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('image');

        Auth::forgetGuards();
        $this->flushSession();
        $this->getJson($first['url'])->assertNotFound();

        $catalog = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/catalog")
            ->assertOk()
            ->json('data');
        $product = $catalog['products'][0];
        $product['imageUrl'] = $first['url'];
        $product['imageUrls'] = [$first['url']];
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 1,
                'currencyCode' => 'YER',
                'products' => [$product],
                'archiveProductIds' => [],
            ])
            ->assertOk();

        $this->actingAs($owner)->get($first['url'])->assertOk()->assertHeader('content-type', 'image/png');
        Auth::forgetGuards();
        $this->flushSession();
        $this->get("http://{$domain}{$first['url']}")->assertOk()->assertHeader('content-type', 'image/png');
        $this->get("http://127.0.0.1{$first['url']}")->assertNotFound();
    }

    public function test_media_tenant_ownership_and_suspended_store_cleanup_fail_closed(): void
    {
        Storage::fake('local');
        [$tenantA, $ownerA] = $this->readyTenant('media-owner-a');
        [$tenantB, $ownerB] = $this->readyTenant('media-owner-b');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $upload = function (Tenant $tenant, User $owner, string $suffix) use ($png): array {
            return $this->actingAs($owner)
                ->withHeader('Idempotency-Key', (string) Str::uuid())
                ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                    'image' => UploadedFile::fake()->createWithContent("{$suffix}.png", $png.$suffix),
                ])->assertCreated()->json('data');
        };
        $foreign = $upload($tenantA, $ownerA, 'foreign');
        $prunable = $upload($tenantA, $ownerA, 'prunable');
        $unsafe = $upload($tenantA, $ownerA, 'unsafe');
        $recoverable = $upload($tenantA, $ownerA, 'recoverable');

        Auth::forgetGuards();
        $this->flushSession();
        $catalogB = $this->actingAs($ownerB)->getJson("/api/merchant/stores/{$tenantB->id}/catalog")
            ->assertOk()->json('data');
        $productB = $catalogB['products'][0];
        $productB['imageUrl'] = $foreign['url'];
        $productB['imageUrls'] = [$foreign['url']];
        $this->actingAs($ownerB)->patchJson("/api/merchant/stores/{$tenantB->id}/catalog", [
            'catalogRevision' => $catalogB['revision'],
            'currencyCode' => 'YER',
            'products' => [$productB],
            'archiveProductIds' => [],
        ])->assertConflict()->assertJsonPath('code', 'catalog_media_tenant_mismatch');

        $paths = $tenantA->run(function () use ($prunable, $unsafe, $recoverable): array {
            $rows = DB::table('product_media')->whereIn('id', [
                $prunable['id'], $unsafe['id'], $recoverable['id'],
            ])->get()->keyBy('id');
            DB::table('product_media')->whereIn('id', [$prunable['id'], $unsafe['id']])->update([
                'created_at' => now()->subDays(2),
            ]);
            DB::table('product_media')->where('id', $unsafe['id'])->update(['disk' => 'unsafe-disk']);
            DB::table('product_media')->where('id', $recoverable['id'])->update(['cleanup_started_at' => now()]);

            try {
                DB::table('product_media')->where('id', $prunable['id'])->update(['path' => '../escape.png']);
                $this->fail('The database accepted an unsafe managed media path.');
            } catch (QueryException) {
                $this->assertSame($rows[$prunable['id']]->path, DB::table('product_media')
                    ->where('id', $prunable['id'])->value('path'));
            }

            return $rows->mapWithKeys(fn (object $row): array => [(string) $row->id => (string) $row->path])->all();
        });
        Storage::disk('local')->delete($paths[$recoverable['id']]);
        $tenantA->forceFill(['verification_status' => TenantVerificationStatus::Suspended->value])->save();

        $this->assertSame(0, Artisan::call('catalog:prune-media', ['--tenant' => [$tenantA->id]]));
        $tenantA->run(function () use ($prunable, $unsafe, $recoverable): void {
            $this->assertSame(0, DB::table('product_media')->whereIn('id', [
                $prunable['id'], $recoverable['id'],
            ])->count());
            $this->assertSame(1, DB::table('product_media')->where('id', $unsafe['id'])->count());
        });
        Storage::disk('local')->assertMissing($paths[$prunable['id']]);
    }

    public function test_storefront_marketing_blocks_round_trip_and_public_projection_are_server_owned(): void
    {
        Storage::fake('local');
        [$tenant, $owner, $domain] = $this->readyTenant('marketing-round-trip');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $asset = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('marketing.png', $png),
            ])->assertCreated()->json('data');
        $workspace = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()->json('data');
        $makeBlock = static fn (string $placement, int $position, array $overrides = []): array => [
            'id' => (string) Str::uuid(),
            'placement' => $placement,
            'position' => $position,
            'enabled' => true,
            'contentType' => 'category',
            'title' => 'واجهة تسويقية',
            'subtitle' => 'وصف موجز للمساحة',
            'badge' => 'جديد',
            'ctaLabel' => 'استكشف الآن',
            'imageUrl' => $asset['url'],
            'mobileImageUrl' => $asset['url'],
            'altText' => 'صورة مساحة تسويقية',
            'backgroundColor' => '#112233',
            'textColor' => '#ffffff',
            'overlayOpacity' => 30,
            'focalPointX' => 50,
            'focalPointY' => 45,
            'targetType' => 'products',
            'disclosure' => 'none',
            ...$overrides,
        ];
        $config = $workspace['config'];
        $config['heroBannerMobileImage'] = $asset['url'];
        $config['heroBannerTargetType'] = 'category';
        $config['heroBannerTargetValue'] = 'General';
        $config['heroBannerFocalPointX'] = 64;
        $config['heroBannerFocalPointY'] = 38;
        $config['marketingBlocks'] = [
            $makeBlock('hero_bento', 1, ['targetType' => 'category', 'targetValue' => 'General']),
            $makeBlock('editorial_story', 1, ['title' => 'قصة الموسم']),
            $makeBlock('side_ad', 1, ['enabled' => false]),
            $makeBlock('discovery', 1, ['startsAt' => '2099-01-01T00:00:00Z']),
        ];

        $saved = $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => $workspace['revision'],
                'catalogRevision' => $workspace['catalogRevision'],
                'config' => $config,
                'archiveProductIds' => [],
            ])->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonCount(4, 'data.config.marketingBlocks')
            ->assertJsonPath('data.config.heroBannerTargetType', 'category')
            ->assertJsonPath('data.config.heroBannerFocalPointX', 64)
            ->json('data');

        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => $saved['revision'],
                'catalogRevision' => $saved['catalogRevision'],
                'config' => $saved['config'],
                'archiveProductIds' => [],
            ])->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.catalogRevision', 1);

        Auth::forgetGuards();
        $this->flushSession();
        $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonCount(2, 'data.config.marketingBlocks')
            ->assertJsonPath('data.config.marketingBlocks.0.placement', 'hero_bento')
            ->assertJsonPath('data.config.marketingBlocks.1.placement', 'editorial_story');
    }

    public function test_storefront_marketing_blocks_reject_deletion_invalid_layout_targets_and_foreign_assets(): void
    {
        Storage::fake('local');
        [$tenant, $owner] = $this->readyTenant('marketing-validation');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $asset = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('validation.png', $png),
            ])->assertCreated()->json('data');
        $workspace = $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()->json('data');
        $block = [
            'id' => (string) Str::uuid(), 'placement' => 'hero_bento', 'position' => 1,
            'enabled' => true, 'contentType' => 'category', 'title' => 'مساحة صالحة',
            'ctaLabel' => 'استكشف الآن', 'imageUrl' => $asset['url'], 'altText' => 'صورة صالحة',
            'targetType' => 'category', 'targetValue' => 'General', 'disclosure' => 'none',
        ];
        $workspace['config']['marketingBlocks'] = [$block];
        $saved = $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => 1, 'catalogRevision' => 1, 'config' => $workspace['config'], 'archiveProductIds' => [],
        ])->assertOk()->json('data');

        $deleted = $saved['config'];
        unset($deleted['marketingBlocks']);
        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => 2, 'catalogRevision' => 1, 'config' => $deleted, 'archiveProductIds' => [],
        ])->assertUnprocessable()->assertJsonPath('code', 'workspace_marketing_blocks_required');

        $foreign = $saved['config'];
        $foreign['marketingBlocks'][0]['imageUrl'] = '/api/store-assets/another-tenant/'.Str::uuid();
        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => 2, 'catalogRevision' => 1, 'config' => $foreign, 'archiveProductIds' => [],
        ])->assertUnprocessable()->assertJsonPath('code', 'workspace_asset_path_invalid');

        $gapped = $saved['config'];
        $gapped['marketingBlocks'][] = [...$block, 'id' => (string) Str::uuid(), 'position' => 3];
        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => 2, 'catalogRevision' => 1, 'config' => $gapped, 'archiveProductIds' => [],
        ])->assertUnprocessable()->assertJsonPath('code', 'workspace_validation_failed');

        $unsafe = $saved['config'];
        $unsafe['marketingBlocks'][0] = [
            ...$block,
            'contentType' => 'campaign',
            'targetType' => 'external',
            'targetValue' => 'https://user:password@example.test/campaign',
            'disclosure' => 'sponsored',
            'sponsorName' => 'راعي الحملة',
        ];
        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => 2, 'catalogRevision' => 1, 'config' => $unsafe, 'archiveProductIds' => [],
        ])->assertUnprocessable()->assertJsonPath('code', 'workspace_validation_failed');
    }

    public function test_storefront_placement_asset_budgets_use_the_strictest_reference_limit(): void
    {
        Storage::fake('local');
        [$tenant, $owner] = $this->readyTenant('marketing-budgets');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $largePng = $png.str_repeat('x', 360 * 1024);
        $asset = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/assets", [
                'image' => UploadedFile::fake()->createWithContent('placement-budget.png', $largePng),
            ])->assertCreated()
            ->assertJsonPath('data.byteSize', strlen($largePng))
            ->json('data');
        $workspace = $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()->json('data');
        $block = static fn (string $placement): array => [
            'id' => (string) Str::uuid(), 'placement' => $placement, 'position' => 1,
            'enabled' => true, 'contentType' => 'campaign', 'title' => 'اختبار الميزانية',
            'ctaLabel' => 'استكشف الآن', 'imageUrl' => $asset['url'], 'altText' => 'صورة اختبار الميزانية',
            'targetType' => 'products', 'disclosure' => 'none',
        ];

        $discovery = $workspace['config'];
        $discovery['marketingBlocks'] = [$block('discovery')];
        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => 1, 'catalogRevision' => 1, 'config' => $discovery, 'archiveProductIds' => [],
        ])->assertConflict()->assertJsonPath('code', 'workspace_asset_budget_exceeded');

        $hero = $workspace['config'];
        $hero['marketingBlocks'] = [$block('editorial_story')];
        $saved = $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => 1, 'catalogRevision' => 1, 'config' => $hero, 'archiveProductIds' => [],
        ])->assertOk()->assertJsonPath('data.revision', 2)->json('data');

        $reused = $saved['config'];
        $reused['marketingBlocks'][] = $block('discovery');
        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
            'revision' => 2, 'catalogRevision' => 1, 'config' => $reused, 'archiveProductIds' => [],
        ])->assertConflict()->assertJsonPath('code', 'workspace_asset_budget_exceeded');

        $this->assertSame(64, (int) config('store_assets.max_assets_per_tenant'));
        $this->assertSame(75 * 1024 * 1024, (int) config('store_assets.max_total_bytes_per_tenant'));
    }

    public function test_workspace_migration_refuses_destructive_rollback_after_materialization(): void
    {
        [$tenant] = $this->readyTenant('workspace-rollback');

        $tenant->run(function (): void {
            DB::table('store_configs')->where('is_current', true)->update(['products_materialized' => true]);
            $migration = require database_path('migrations/tenant/2026_08_15_000004_harden_store_workspace.php');

            try {
                $migration->down();
                $this->fail('The workspace migration erased materialized server data.');
            } catch (\RuntimeException $exception) {
                $this->assertStringContainsString('Refusing to drop', $exception->getMessage());
            }

            $this->assertTrue(DB::getSchemaBuilder()->hasColumns('store_configs', [
                'revision', 'products_materialized', 'is_current',
            ]));
            $this->assertTrue(DB::getSchemaBuilder()->hasColumns('products', ['image_urls', 'position']));
        });
    }

    public function test_catalog_migration_adopts_legacy_exact_prices_currency_sku_and_media_without_losing_identity(): void
    {
        $tenant = Tenant::query()->create([
            'id' => 'wp41-legacy-adoption',
            'store_name' => 'Legacy catalog adoption',
            'owner_name' => 'Legacy Owner',
            'owner_email' => 'legacy-catalog@example.test',
            'business_type' => 'retail',
            'verification_status' => TenantVerificationStatus::Pending->value,
            'provisioning_status' => ProvisioningState::NotStarted->value,
            'publication_status' => PublicationStatus::Unpublished->value,
            'theme_style' => 'elegant',
        ]);
        $this->tenantIds[] = $tenant->id;
        $tenant->database()->manager()->createDatabase($tenant);
        $schema = (string) $tenant->database()->getName();
        $this->schemas[] = $schema;
        $productId = (string) Str::uuid();

        $tenant->run(function () use ($productId): void {
            foreach ([
                '2026_01_01_000001_create_store_configs_table.php',
                '2026_01_01_000002_create_products_table.php',
                '2026_01_01_000003_create_orders_table.php',
                '2026_08_15_000004_harden_store_workspace.php',
            ] as $file) {
                (require database_path('migrations/tenant/'.$file))->up();
            }
            DB::table('store_configs')->insert([
                'id' => (string) Str::uuid(),
                'config_json' => json_encode(['currency' => 'SAR', 'products' => []], JSON_THROW_ON_ERROR),
                'revision' => 1,
                'products_materialized' => true,
                'is_current' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('products')->insert([
                'id' => $productId,
                'name' => 'Legacy exact product',
                'price' => '12.34',
                'image_url' => 'https://images.example.test/legacy.jpg',
                'image_urls' => json_encode([
                    'https://images.example.test/legacy.jpg',
                    'https://images.example.test/second.jpg',
                ], JSON_THROW_ON_ERROR),
                'stock_quantity' => 3,
                'manage_stock' => true,
                'low_stock_threshold' => 1,
                'position' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $migration = require database_path('migrations/tenant/2026_08_16_000005_create_product_catalog_model.php');
            $migration->up();

            $adopted = DB::table('products')->where('id', $productId)->firstOrFail();
            $this->assertSame(1234, (int) $adopted->base_price_minor);
            $this->assertSame('published', $adopted->status);
            $this->assertStringStartsWith('LEGACY-', $adopted->sku);
            $this->assertSame('SAR', DB::table('catalog_settings')->where('id', 1)->value('currency_code'));
            $this->assertSame(2, DB::table('product_media')->where('product_id', $productId)->count());

            try {
                $migration->down();
                $this->fail('The catalog migration erased adopted authoritative data.');
            } catch (\RuntimeException $exception) {
                $this->assertStringContainsString('Refusing to erase', $exception->getMessage());
            }
            $this->assertSame(1, DB::table('products')->where('id', $productId)->count());
        });
    }

    public function test_inventory_migration_adopts_populated_products_refuses_history_loss_and_reapplies_when_empty(): void
    {
        $createLegacyTenant = function (string $id): Tenant {
            $tenant = Tenant::query()->create([
                'id' => $id,
                'store_name' => 'Inventory migration '.$id,
                'owner_name' => 'Migration Owner',
                'owner_email' => $id.'@example.test',
                'business_type' => 'retail',
                'verification_status' => TenantVerificationStatus::Pending->value,
                'provisioning_status' => ProvisioningState::NotStarted->value,
                'publication_status' => PublicationStatus::Unpublished->value,
                'theme_style' => 'elegant',
            ]);
            $this->tenantIds[] = $tenant->id;
            $tenant->database()->manager()->createDatabase($tenant);
            $this->schemas[] = (string) $tenant->database()->getName();

            return $tenant;
        };
        $migrateThroughCatalog = function (): void {
            foreach ([
                '2026_01_01_000001_create_store_configs_table.php',
                '2026_01_01_000002_create_products_table.php',
                '2026_01_01_000003_create_orders_table.php',
                '2026_08_15_000004_harden_store_workspace.php',
                '2026_08_16_000005_create_product_catalog_model.php',
            ] as $file) {
                (require database_path('migrations/tenant/'.$file))->up();
            }
        };

        $populated = $createLegacyTenant('wp42-ledger-adoption');
        $productId = (string) Str::uuid();
        $populated->run(function () use ($migrateThroughCatalog, $productId): void {
            $migrateThroughCatalog();
            DB::table('products')->insert([
                'id' => $productId, 'name' => 'Legacy inventory product', 'price' => '7.00',
                'base_price_minor' => 700, 'description' => '', 'category' => 'General',
                'image_keyword' => 'default', 'image_urls' => '[]', 'stock_quantity' => 7,
                'manage_stock' => true, 'sku' => 'LEGACY-INVENTORY', 'low_stock_threshold' => 2,
                'position' => 0, 'status' => 'published', 'revision' => 1,
                'published_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $migration = require database_path('migrations/tenant/2026_08_16_000006_create_inventory_ledger.php');
            $migration->up();

            $movement = DB::table('inventory_movements')->where('product_id', $productId)->where('kind', 'opening')->firstOrFail();
            $this->assertSame(7, (int) $movement->after_on_hand);
            $this->assertSame(0, (int) $movement->after_reserved);
            $this->assertSame(1, DB::table('inventory_application_receipts')->where('movement_id', $movement->id)->count());
            try {
                $migration->down();
                $this->fail('Inventory rollback must refuse to erase adopted opening provenance.');
            } catch (\RuntimeException $exception) {
                $this->assertStringContainsString('Refusing to erase authoritative inventory', $exception->getMessage());
            }
            $this->assertTrue(DB::getSchemaBuilder()->hasTable('inventory_movements'));
        });

        $empty = $createLegacyTenant('wp42-ledger-empty-reapply');
        $empty->run(function () use ($migrateThroughCatalog): void {
            $migrateThroughCatalog();
            $migration = require database_path('migrations/tenant/2026_08_16_000006_create_inventory_ledger.php');
            $migration->up();
            $this->assertSame(0, DB::table('inventory_operations')->count());
            $migration->down();
            $this->assertFalse(DB::getSchemaBuilder()->hasColumn('products', 'reserved_quantity'));
            $migration->up();
            $this->assertTrue(DB::getSchemaBuilder()->hasColumns('products', ['reserved_quantity', 'inventory_revision']));
            $this->assertSame(0, DB::table('inventory_operations')->count());
        });
    }

    public function test_order_migration_archives_legacy_rows_immutably_refuses_history_loss_and_reapplies_when_empty(): void
    {
        $createLegacyTenant = function (string $id): Tenant {
            $tenant = Tenant::query()->create([
                'id' => $id,
                'store_name' => 'Order migration '.$id,
                'owner_name' => 'Migration Owner',
                'owner_email' => $id.'@example.test',
                'business_type' => 'retail',
                'verification_status' => TenantVerificationStatus::Pending->value,
                'provisioning_status' => ProvisioningState::NotStarted->value,
                'publication_status' => PublicationStatus::Unpublished->value,
                'theme_style' => 'elegant',
            ]);
            $this->tenantIds[] = $tenant->id;
            $tenant->database()->manager()->createDatabase($tenant);
            $this->schemas[] = (string) $tenant->database()->getName();

            return $tenant;
        };
        $migrateThroughInventory = function (): void {
            foreach ([
                '2026_01_01_000001_create_store_configs_table.php',
                '2026_01_01_000002_create_products_table.php',
                '2026_01_01_000003_create_orders_table.php',
                '2026_08_15_000004_harden_store_workspace.php',
                '2026_08_16_000005_create_product_catalog_model.php',
                '2026_08_16_000006_create_inventory_ledger.php',
            ] as $file) {
                (require database_path('migrations/tenant/'.$file))->up();
            }
        };

        $populated = $createLegacyTenant('wp43-order-adoption');
        $legacyId = (string) Str::uuid();
        $populated->run(function () use ($legacyId, $migrateThroughInventory): void {
            $migrateThroughInventory();
            DB::table('orders')->insert([
                'id' => $legacyId,
                'customer_name' => 'Legacy Customer',
                'customer_phone' => '+967700001111',
                'customer_email' => 'legacy@example.test',
                'shipping_address' => 'Legacy address',
                'total_amount' => '12.34',
                'payment_method' => 'cod',
                'status' => 'pending',
                'items_json' => json_encode([['name' => 'Unverified item', 'price' => 12.34]], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $migration = require database_path('migrations/tenant/2026_08_16_000007_create_authoritative_orders.php');
            $migration->up();

            $archived = DB::table('legacy_orders_wp43')->where('id', $legacyId)->firstOrFail();
            $this->assertSame('legacy_unverified', $archived->origin);
            $this->assertSame(1234, (int) $archived->total_amount_minor_projection);
            $this->assertSame(0, DB::table('orders')->count());
            try {
                DB::table('legacy_orders_wp43')->where('id', $legacyId)->update(['status' => 'completed']);
                $this->fail('Archived legacy orders must remain immutable evidence.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('order history and snapshots are immutable', $exception->getMessage());
            }

            DB::table('order_operations')->insert([
                'id' => (string) Str::uuid(),
                'kind' => 'create',
                'idempotency_scope' => 'rollback-refusal',
                'idempotency_key' => (string) Str::uuid(),
                'request_fingerprint' => hash('sha256', 'rollback-refusal'),
                'actor_type' => 'guest',
                'actor_user_id' => null,
                'created_at' => now(),
            ]);
            try {
                $migration->down();
                $this->fail('Order rollback must refuse to erase authoritative operation history.');
            } catch (\RuntimeException $exception) {
                $this->assertStringContainsString('Refusing to erase authoritative order', $exception->getMessage());
            }
            $this->assertTrue(DB::getSchemaBuilder()->hasTable('order_operations'));
        });

        $empty = $createLegacyTenant('wp43-order-empty-reapply');
        $empty->run(function () use ($migrateThroughInventory): void {
            $migrateThroughInventory();
            $migration = require database_path('migrations/tenant/2026_08_16_000007_create_authoritative_orders.php');
            $migration->up();
            $this->assertSame(0, DB::table('order_operations')->count());
            $migration->down();
            $this->assertTrue(DB::getSchemaBuilder()->hasTable('orders'));
            $this->assertFalse(DB::getSchemaBuilder()->hasTable('order_operations'));
            $migration->up();
            $this->assertTrue(DB::getSchemaBuilder()->hasTable('order_operations'));
            $this->assertSame(0, DB::table('orders')->count());
        });
    }

    /** @return array{Tenant, User, string} */
    private function readyTenant(string $label): array
    {
        $tenant = Tenant::query()->create([
            'id' => 'wp32-'.$label,
            'store_name' => 'Store '.$label,
            'owner_name' => 'Workspace Owner',
            'owner_email' => "owner-{$label}@example.test",
            'business_type' => 'retail',
            'verification_status' => TenantVerificationStatus::Approved->value,
            'provisioning_status' => ProvisioningState::Active->value,
            'publication_status' => PublicationStatus::Published->value,
            'theme_style' => 'elegant',
            'active_at' => now(),
        ]);
        $this->tenantIds[] = $tenant->id;
        $domain = $label.'.example.test';
        $publishedDomain = $tenant->domains()->create(['domain' => $domain, 'kind' => DomainKind::PublicSubdomain]);
        $tenant->database()->manager()->createDatabase($tenant);
        $schema = (string) $tenant->database()->getName();
        $this->schemas[] = $schema;
        $this->assertSame(0, Artisan::call('tenants:migrate', [
            '--tenants' => [$tenant->id],
            '--force' => true,
            '--no-interaction' => true,
        ]));
        ProvisioningRun::query()->create([
            'tenant_id' => $tenant->id,
            'status' => ProvisioningState::Active,
            'run_number' => 1,
            'schema_name' => $schema,
            'schema_origin' => ProvisioningSchemaOrigin::PlatformCreated,
            'schema_created_at' => now(),
            'queued_at' => now(),
            'started_at' => now(),
            'completed_at' => now(),
        ]);
        $subscription = TenantSubscription::query()->create([
            'tenant_id' => $tenant->id,
            'plan_key' => 'starter',
            'status' => SubscriptionStatus::Active,
            'activation_source' => SubscriptionActivationSource::Wp23Adopted,
            'starts_at' => now('UTC')->subMinute(),
        ]);
        $reservation = DomainReservation::query()->create([
            'tenant_id' => $tenant->id,
            'domain' => $domain,
            'handle' => $label,
            'status' => DomainReservationStatus::Active,
            'origin' => DomainReservationOrigin::Wp22Internal,
            'reserved_at' => now(),
            'activated_at' => now(),
        ]);
        $publication = PublicationRequest::query()->create([
            'tenant_id' => $tenant->id,
            'domain_reservation_id' => $reservation->id,
            'tenant_subscription_id' => $subscription->id,
            'status' => PublicationRequestStatus::Published,
            'origin' => PublicationRequestOrigin::Wp23Adopted,
            'requested_at' => now(),
            'decided_at' => now(),
            'published_at' => now(),
        ]);
        $tenant->forceFill([
            'publication_request_id' => $publication->id,
            'published_domain_id' => $publishedDomain->id,
            'publication_subscription_id' => $subscription->id,
            'publication_requested_at' => now(),
            'published_at' => now(),
        ])->save();
        $tenant->run(function () use ($label, $tenant): void {
            DB::transaction(function () use ($label, $tenant): void {
                $productId = (string) Str::uuid();
                DB::table('store_configs')->insert([
                    'id' => (string) Str::uuid(),
                    'config_json' => json_encode(array_diff_key(
                        $this->config('Legacy '.$label, []),
                        ['products' => true, 'currency' => true],
                    ), JSON_THROW_ON_ERROR),
                    'revision' => 1,
                    'products_materialized' => true,
                    'is_current' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                DB::table('products')->insert([
                    'id' => $productId,
                    'name' => 'Server product',
                    'price' => '12.50',
                    'base_price_minor' => 1250,
                    'sale_price_minor' => null,
                    'description' => 'Product description',
                    'category' => 'General',
                    'image_keyword' => 'product',
                    'image_url' => 'https://images.example.test/product.jpg',
                    'image_urls' => json_encode(['https://images.example.test/product.jpg'], JSON_THROW_ON_ERROR),
                    'stock_quantity' => 0,
                    'reserved_quantity' => 0,
                    'manage_stock' => true,
                    'sku' => 'LEGACY-SKU',
                    'low_stock_threshold' => 3,
                    'position' => 0,
                    'status' => 'published',
                    'revision' => 1,
                    'inventory_revision' => 1,
                    'published_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                app(InventoryLedgerService::class)->recordOpening($tenant, $productId, 10);
                DB::table('product_media')->insert([
                    'id' => (string) Str::uuid(),
                    'product_id' => $productId,
                    'source_type' => 'external',
                    'external_url' => 'https://images.example.test/product.jpg',
                    'position' => 0,
                    'attached_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
        });
        $owner = $this->user("workspace-owner-{$label}@example.test");
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $owner,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $owner,
        );

        return [$tenant->refresh(), $owner, $domain];
    }

    private function user(string $email): User
    {
        $user = User::query()->create([
            'name' => 'Workspace User',
            'email' => $email,
            'password' => 'workspace-password',
            'status' => UserStatus::Active,
        ]);
        $this->userIds[] = $user->id;

        return $user;
    }

    private function addInventoryProduct(Tenant $tenant, string $sku, int $openingOnHand): string
    {
        return $tenant->run(function () use ($tenant, $sku, $openingOnHand): string {
            return DB::transaction(function () use ($tenant, $sku, $openingOnHand): string {
                $product = (array) DB::table('products')->orderBy('id')->firstOrFail();
                $productId = (string) Str::uuid();
                $product['id'] = $productId;
                $product['name'] = 'Inventory '.$sku;
                $product['sku'] = $sku;
                $product['position'] = (int) DB::table('products')->max('position') + 1;
                $product['stock_quantity'] = 0;
                $product['reserved_quantity'] = 0;
                $product['inventory_revision'] = 1;
                $product['created_at'] = now();
                $product['updated_at'] = now();
                DB::table('products')->insert($product);
                app(InventoryLedgerService::class)->recordOpening($tenant, $productId, $openingOnHand);

                return $productId;
            });
        });
    }

    /**
     * Start isolated PHP workers from the same committed fixture and release them together.
     * Each worker reconnects to PostgreSQL before calling the real inventory service.
     *
     * @param  list<callable(): array<string, mixed>>  $operations
     * @return list<array{status: string, code?: string}>
     */
    private function runConcurrentInventoryOperations(array $operations): array
    {
        if (! function_exists('pcntl_fork') || ! function_exists('stream_socket_pair')) {
            $this->fail('The database gate requires pcntl and socket pairs for real concurrent service calls.');
        }

        $workers = [];
        foreach ($operations as $operation) {
            $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            if ($sockets === false) {
                $this->fail('Unable to create the concurrency barrier socket.');
            }
            [$parentSocket, $childSocket] = $sockets;
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('Unable to fork an inventory concurrency worker.');
            }
            if ($pid === 0) {
                fclose($parentSocket);
                fread($childSocket, 1);
                try {
                    if (tenancy()->initialized) {
                        tenancy()->end();
                    }
                    $central = (string) config('tenancy.database.central_connection');
                    DB::purge('tenant');
                    DB::purge($central);
                    DB::setDefaultConnection($central);
                    $operation();
                    $result = ['status' => 'ok'];
                } catch (InventoryConflict|OrderConflict $exception) {
                    $result = ['status' => 'conflict', 'code' => $exception->errorCode];
                } catch (\Throwable $exception) {
                    $result = ['status' => 'error', 'code' => $exception::class.':'.$exception->getMessage()];
                }
                fwrite($childSocket, json_encode($result, JSON_THROW_ON_ERROR));
                fclose($childSocket);
                exit(0);
            }
            fclose($childSocket);
            $workers[] = ['pid' => $pid, 'socket' => $parentSocket];
        }

        foreach ($workers as $worker) {
            fwrite($worker['socket'], '1');
        }

        $results = [];
        foreach ($workers as $worker) {
            $payload = stream_get_contents($worker['socket']);
            fclose($worker['socket']);
            pcntl_waitpid($worker['pid'], $status);
            $this->assertTrue(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
            $decoded = json_decode((string) $payload, true, 512, JSON_THROW_ON_ERROR);
            $this->assertNotSame('error', $decoded['status'] ?? null, (string) ($decoded['code'] ?? 'unknown child error'));
            $results[] = $decoded;
        }

        return $results;
    }

    /**
     * Run store-asset operations on independent PostgreSQL connections behind one barrier.
     *
     * @param  list<callable(): void>  $operations
     * @return list<array{operation: int, status: string, code?: string}>
     */
    private function runConcurrentAssetOperations(array $operations): array
    {
        if (! function_exists('pcntl_fork') || ! function_exists('stream_socket_pair')) {
            $this->fail('The database gate requires pcntl and socket pairs for real concurrent asset calls.');
        }

        $workers = [];
        foreach ($operations as $index => $operation) {
            $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            if ($sockets === false) {
                $this->fail('Unable to create the store-asset concurrency barrier socket.');
            }
            [$parentSocket, $childSocket] = $sockets;
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('Unable to fork a store-asset concurrency worker.');
            }
            if ($pid === 0) {
                fclose($parentSocket);
                fread($childSocket, 1);
                try {
                    if (tenancy()->initialized) {
                        tenancy()->end();
                    }
                    $central = (string) config('tenancy.database.central_connection');
                    DB::purge('tenant');
                    DB::purge($central);
                    DB::setDefaultConnection($central);
                    $operation();
                    $result = ['operation' => $index, 'status' => 'ok'];
                } catch (StoreAssetConflict|ProductCatalogConflict $exception) {
                    $result = ['operation' => $index, 'status' => 'conflict', 'code' => $exception->errorCode];
                } catch (\Throwable $exception) {
                    $result = ['operation' => $index, 'status' => 'error', 'code' => $exception::class.':'.$exception->getMessage()];
                }
                fwrite($childSocket, json_encode($result, JSON_THROW_ON_ERROR));
                fclose($childSocket);
                exit(0);
            }
            fclose($childSocket);
            $workers[] = ['pid' => $pid, 'socket' => $parentSocket];
        }

        foreach ($workers as $worker) {
            fwrite($worker['socket'], '1');
        }

        $results = [];
        foreach ($workers as $worker) {
            $payload = stream_get_contents($worker['socket']);
            fclose($worker['socket']);
            pcntl_waitpid($worker['pid'], $status);
            $this->assertTrue(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
            $decoded = json_decode((string) $payload, true, 512, JSON_THROW_ON_ERROR);
            $this->assertNotSame('error', $decoded['status'] ?? null, (string) ($decoded['code'] ?? 'unknown child error'));
            $results[] = $decoded;
        }

        usort($results, static fn (array $left, array $right): int => $left['operation'] <=> $right['operation']);

        return $results;
    }

    /** @param list<array<string, mixed>> $products */
    private function config(string $name, array $products): array
    {
        return [
            'storeName' => $name,
            'slogan' => 'Server-owned workspace',
            'logoIcon' => 'S',
            'primaryColor' => '#112233',
            'secondaryColor' => '#334455',
            'themeStyle' => 'elegant',
            'bannerText' => 'Workspace banner',
            'products' => $products,
            'fontFamily' => 'Cairo',
            'phone' => '+967700000000',
            'currency' => 'YER',
            'requireEmail' => false,
            'requireAddressDetails' => true,
            'enableCustomerNotes' => true,
            'minOrderAmount' => 0,
            'freeShippingThreshold' => 100,
            'shippingFee' => 5,
            'taxRate' => 15,
            'enableCashOnDelivery' => true,
            'cashOnDeliveryFee' => 1,
            'enableBankTransfer' => false,
            'enableEWallets' => false,
            'enableCoupons' => true,
            'customCoupons' => [['code' => 'SAVE10', 'discountPercent' => 10, 'active' => true]],
            'thankYouTitle' => 'Original receipt title',
            'thankYouMessage' => 'Original receipt message',
            'enableWhatsAppNotification' => true,
            'whatsapp' => '+967700000000',
        ];
    }

    /** @return array<string, mixed> */
    private function product(string $sku): array
    {
        return [
            'name' => 'Server product',
            'price' => '12.50',
            'basePrice' => '12.50',
            'salePrice' => null,
            'status' => 'published',
            'description' => 'Product description',
            'category' => 'General',
            'imageKeyword' => 'product',
            'imageUrl' => 'https://images.example.test/product.jpg',
            'imageUrls' => ['https://images.example.test/product-2.jpg'],
            'stockQuantity' => 10,
            'manageStock' => true,
            'sku' => $sku,
            'lowStockThreshold' => 3,
        ];
    }
}
