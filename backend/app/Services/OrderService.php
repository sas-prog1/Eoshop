<?php

namespace App\Services;

use App\Enums\InventoryActorType;
use App\Enums\OrderActorType;
use App\Enums\OrderOperationKind;
use App\Enums\OrderStatus;
use App\Enums\PermissionKey;
use App\Enums\ProductStatus;
use App\Enums\TenantMembershipStatus;
use App\Exceptions\InventoryConflict;
use App\Exceptions\OrderConflict;
use App\Models\Tenant;
use App\Models\User;
use App\Support\CheckoutPresentation;
use App\Support\OrderIdentity;
use App\Support\OrderReadiness;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderService
{
    public function __construct(
        private readonly OrderOperationService $operations,
        private readonly OrderPricingService $pricing,
        private readonly InventoryReservationService $reservations,
    ) {}

    /** @param array<string, mixed> $payload @return array<string, mixed> */
    public function create(Tenant $tenant, array $payload): array
    {
        return $this->withLockedTenant($tenant, function (Tenant $lockedTenant) use ($payload): array {
            $this->assertReady($lockedTenant);

            return $this->inTenant($lockedTenant, fn (): array => DB::transaction(function () use ($lockedTenant, $payload): array {
                $canonical = [
                    'workspaceRevision' => (int) $payload['workspaceRevision'],
                    'catalogRevision' => (int) $payload['catalogRevision'],
                    'lines' => collect($payload['lines'])->map(fn (array $line): array => [
                        'productId' => (string) $line['productId'],
                        'quantity' => (int) $line['quantity'],
                    ])->sortBy('productId')->values()->all(),
                    'couponCode' => isset($payload['couponCode']) ? mb_strtoupper(trim((string) $payload['couponCode'])) : null,
                    'payment' => $payload['payment'],
                    'customer' => $payload['customer'],
                    'address' => $payload['address'],
                ];
                $claim = $this->operations->claim(
                    OrderOperationKind::Create,
                    'public_checkout',
                    (string) $payload['idempotencyKey'],
                    $canonical,
                    OrderActorType::Guest,
                    null,
                    $payload['requestId'] ?? null,
                );
                if ($claim['replayed']) {
                    return $this->withPresentationFallback(
                        $this->operations->replayResult((string) $claim['operation']->id),
                    );
                }

                $configRow = DB::table('store_configs')->where('is_current', true)->lockForUpdate()->first();
                $settings = DB::table('catalog_settings')->where('id', 1)->lockForUpdate()->first();
                if ($configRow === null || $settings === null
                    || (int) $configRow->revision !== $canonical['workspaceRevision']
                    || (int) $settings->revision !== $canonical['catalogRevision']) {
                    throw new OrderConflict('The storefront changed. Refresh the quote before ordering.', 'order_quote_stale');
                }
                $products = DB::table('products')->whereIn('id', array_column($canonical['lines'], 'productId'))
                    ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
                if ($products->count() !== count($canonical['lines'])) {
                    throw new OrderConflict('One or more products are unavailable.', 'order_product_unavailable', 422);
                }
                $pricedLines = [];
                foreach ($canonical['lines'] as $line) {
                    $product = $products->get($line['productId']);
                    if ($product->status !== ProductStatus::Published->value) {
                        throw new OrderConflict('One or more products are unavailable.', 'order_product_unavailable', 422);
                    }
                    $pricedLines[] = [...$line, 'product' => $product];
                }
                $config = json_decode((string) $configRow->config_json, true, 512, JSON_THROW_ON_ERROR);
                if (($config['requireEmail'] ?? false) === true && empty($canonical['customer']['email'])) {
                    throw new OrderConflict('An email address is required by this store.', 'order_customer_invalid', 422);
                }
                if (($config['requireAddressDetails'] ?? false) === true && empty($canonical['address']['details'])) {
                    throw new OrderConflict('Address details are required by this store.', 'order_address_invalid', 422);
                }
                if (($config['enableCustomerNotes'] ?? true) !== true && ! empty($canonical['customer']['notes'])) {
                    throw new OrderConflict('Customer notes are not accepted by this store.', 'order_customer_invalid', 422);
                }
                $quote = $this->pricing->quote(
                    $pricedLines,
                    $config,
                    (string) $settings->currency_code,
                    $canonical['couponCode'],
                    (string) $canonical['payment']['method'],
                    isset($canonical['payment']['channelId']) ? (string) $canonical['payment']['channelId'] : null,
                );
                $orderId = (string) Str::uuid();
                $trackedLines = array_values(array_map(
                    static fn (array $line): array => ['productId' => $line['productId'], 'quantity' => $line['quantity']],
                    array_filter($quote['items'], static fn (array $line): bool => $line['tracked']),
                ));
                $reservationId = null;
                $clock = CarbonImmutable::parse((string) DB::selectOne('SELECT clock_timestamp() AS current_time')->current_time);
                $expiresAt = $clock->addSeconds((int) config('orders.reservation_ttl_seconds'));
                if ($trackedLines !== []) {
                    try {
                        $reservation = $this->reservations->reserveWithinTransaction(
                            $lockedTenant,
                            'order',
                            $orderId,
                            $trackedLines,
                            (int) config('orders.reservation_ttl_seconds'),
                            (string) $claim['operation']->id,
                            InventoryActorType::System,
                            null,
                            'order_checkout',
                            $payload['requestId'] ?? null,
                        );
                        $reservationId = (string) $reservation['reservation']['id'];
                    } catch (InventoryConflict $exception) {
                        throw new OrderConflict('Requested stock is no longer available.', 'order_stock_conflict');
                    }
                }

                DB::statement("SELECT set_config('eoshop.order_create_operation_id', ?, true)", [(string) $claim['operation']->id]);

                DB::table('orders')->insert([
                    'id' => $orderId,
                    'order_number' => 'EO-'.mb_strtoupper(substr(str_replace('-', '', $orderId), 0, 20)),
                    'status' => OrderStatus::Submitted->value,
                    'payment_state' => $quote['paymentState'],
                    'currency_code' => $quote['currencyCode'],
                    'workspace_revision' => $canonical['workspaceRevision'],
                    'catalog_revision' => $canonical['catalogRevision'],
                    'items_subtotal_minor' => $quote['itemsSubtotalMinor'],
                    'discount_minor' => $quote['discountMinor'],
                    'shipping_minor' => $quote['shippingMinor'],
                    'tax_minor' => $quote['taxMinor'],
                    'payment_fee_minor' => $quote['paymentFeeMinor'],
                    'grand_total_minor' => $quote['grandTotalMinor'],
                    'coupon_code' => $quote['couponCode'],
                    'coupon_basis_points' => $quote['couponBasisPoints'],
                    'payment_method' => $quote['paymentMethod'],
                    'payment_channel_id' => $quote['paymentChannelId'],
                    'customer_encrypted' => Crypt::encryptString(json_encode($canonical['customer'], JSON_THROW_ON_ERROR)),
                    'reservation_id' => $reservationId,
                    'create_operation_id' => $claim['operation']->id,
                    'expires_at' => $trackedLines === [] ? null : $expiresAt,
                    'created_at' => $clock,
                    'updated_at' => $clock,
                ]);
                foreach ($quote['items'] as $item) {
                    DB::table('order_items')->insert([
                        'order_id' => $orderId,
                        'product_id' => $item['productId'],
                        'product_name' => $item['name'],
                        'sku' => $item['sku'],
                        'unit_price_minor' => $item['unitPriceMinor'],
                        'quantity' => $item['quantity'],
                        'line_total_minor' => $item['lineTotalMinor'],
                        'tracked_at_submission' => $item['tracked'],
                        'created_at' => $clock,
                    ]);
                }
                DB::table('order_addresses')->insert([
                    'order_id' => $orderId,
                    'encrypted_payload' => Crypt::encryptString(json_encode($canonical['address'], JSON_THROW_ON_ERROR)),
                    'created_at' => $clock,
                ]);
                DB::table('payment_attempts')->insert([
                    'id' => (string) Str::uuid(),
                    'order_id' => $orderId,
                    'method' => $quote['paymentMethod'],
                    'state' => $quote['paymentState'],
                    'channel_id' => $quote['paymentChannelId'],
                    'channel_label' => $quote['paymentChannelLabel'],
                    'encrypted_reference' => empty($canonical['payment']['reference']) ? null : Crypt::encryptString((string) $canonical['payment']['reference']),
                    'created_at' => $clock,
                ]);
                DB::table('order_status_history')->insert([
                    'id' => (string) Str::uuid(),
                    'order_id' => $orderId,
                    'operation_id' => $claim['operation']->id,
                    'sequence' => 1,
                    'from_status' => null,
                    'to_status' => OrderStatus::Submitted->value,
                    'actor_type' => OrderActorType::Guest->value,
                    'actor_user_id' => null,
                    'reason_code' => 'checkout_submitted',
                    'request_id' => $payload['requestId'] ?? null,
                    'created_at' => $clock,
                ]);

                $receipt = $this->resource(DB::table('orders')->where('id', $orderId)->firstOrFail(), false);
                $receipt['items'] = $quote['items'];
                $receipt['checkoutPresentation'] = CheckoutPresentation::fromConfig($config);

                return $this->operations->storeResult((string) $claim['operation']->id, [
                    'replayed' => false,
                    'order' => $receipt,
                ]);
            }));
        });
    }

    /** @param array<string, mixed> $result @return array<string, mixed> */
    private function withPresentationFallback(array $result): array
    {
        if (! isset($result['order']) || ! is_array($result['order'])) {
            return $result;
        }

        if (! isset($result['order']['checkoutPresentation']) || ! is_array($result['order']['checkoutPresentation'])) {
            $result['order']['checkoutPresentation'] = CheckoutPresentation::fallback();
        }

        return $result;
    }

    /** @return array<string, mixed> */
    public function list(
        Tenant $tenant,
        User $actor,
        int $page,
        int $perPage,
        ?OrderStatus $status = null,
        ?string $query = null,
    ): array {
        return $this->withLockedMembership($tenant, $actor, PermissionKey::TenantOrdersView, function (Tenant $lockedTenant) use ($page, $perPage, $query, $status): array {
            $this->assertOperationalReady($lockedTenant);

            return $this->inTenant($lockedTenant, fn (): array => DB::connection('tenant')->transaction(function () use ($page, $perPage, $query, $status): array {
                DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                $orders = DB::table('orders')
                    ->when($status !== null, fn ($builder) => $builder->where('status', $status->value))
                    ->when($query !== null && $query !== '', fn ($builder) => $builder->where('order_number', 'like', $query.'%'));
                $total = (clone $orders)->count();
                $items = $orders->orderByDesc('created_at')->orderByDesc('id')->forPage($page, $perPage)->get()->map(
                    fn (object $order): array => $this->resource($order, false, false, true),
                )->all();

                return [
                    'items' => $items,
                    'pagination' => [
                        'page' => $page,
                        'perPage' => $perPage,
                        'total' => $total,
                        'lastPage' => max(1, (int) ceil($total / $perPage)),
                    ],
                    'filters' => [
                        'status' => $status?->value,
                        'query' => $query,
                    ],
                ];
            }));
        });
    }

    /** @return array<string, mixed> */
    public function detail(Tenant $tenant, User $actor, string $orderId): array
    {
        return $this->withLockedMembership($tenant, $actor, PermissionKey::TenantOrdersView, function (Tenant $lockedTenant) use ($actor, $orderId): array {
            $this->assertOperationalReady($lockedTenant);
            $canManage = $actor->hasTenantPermission($lockedTenant, PermissionKey::TenantOrdersManage);

            return $this->inTenant($lockedTenant, fn (): array => DB::connection('tenant')->transaction(function () use ($canManage, $orderId): array {
                DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                $order = DB::table('orders')->where('id', $orderId)->first();
                if ($order === null) {
                    throw new OrderConflict('The order does not exist.', 'order_missing', 404);
                }

                return $this->resource($order, true, $canManage, true);
            }));
        });
    }

    /** @return array<string, mixed> */
    public function transition(Tenant $tenant, User $actor, string $orderId, OrderStatus $target, string $reasonCode, string $idempotencyKey, ?string $requestId): array
    {
        return $this->withLockedMembership($tenant, $actor, PermissionKey::TenantOrdersManage, function (Tenant $lockedTenant) use ($actor, $orderId, $target, $reasonCode, $idempotencyKey, $requestId): array {
            $this->assertOperationalReady($lockedTenant);

            return $this->inTenant($lockedTenant, fn (): array => DB::transaction(function () use ($lockedTenant, $actor, $orderId, $target, $reasonCode, $idempotencyKey, $requestId): array {
                $order = DB::table('orders')->where('id', $orderId)->lockForUpdate()->first();
                if ($order === null) {
                    throw new OrderConflict('The order does not exist.', 'order_missing', 404);
                }
                $from = OrderStatus::from((string) $order->status);
                $payload = ['orderId' => $orderId, 'to' => $target->value, 'reasonCode' => $reasonCode];
                $claim = $this->operations->claim(OrderOperationKind::Transition, 'order:'.$orderId, $idempotencyKey, $payload, OrderActorType::User, (string) $actor->getKey(), $requestId);
                if ($claim['replayed']) {
                    return $this->operations->replayResult((string) $claim['operation']->id);
                }
                if (! $this->transitionAllowed($from, $target)) {
                    throw new OrderConflict('The requested order transition is not allowed.', 'order_transition_invalid', 422);
                }
                if ($order->reservation_id !== null && $from === OrderStatus::Submitted) {
                    try {
                        if ($target === OrderStatus::Accepted) {
                            $this->reservations->commitWithinTransaction($lockedTenant, (string) $order->reservation_id, (string) $claim['operation']->id, InventoryActorType::User, (string) $actor->getKey(), 'order_transition', $requestId);
                        } elseif ($target === OrderStatus::Cancelled) {
                            $this->reservations->releaseWithinTransaction($lockedTenant, (string) $order->reservation_id, (string) $claim['operation']->id, InventoryActorType::User, (string) $actor->getKey(), 'order_transition', $requestId);
                        }
                    } catch (InventoryConflict) {
                        throw new OrderConflict('The order inventory state is inconsistent.', 'order_inventory_conflict');
                    }
                }
                $clock = CarbonImmutable::parse((string) DB::selectOne('SELECT clock_timestamp() AS current_time')->current_time);
                DB::table('order_status_history')->insert([
                    'id' => (string) Str::uuid(), 'order_id' => $orderId, 'operation_id' => $claim['operation']->id,
                    'sequence' => ((int) DB::table('order_status_history')->where('order_id', $orderId)->max('sequence')) + 1,
                    'from_status' => $from->value, 'to_status' => $target->value, 'actor_type' => OrderActorType::User->value,
                    'actor_user_id' => (string) $actor->getKey(), 'reason_code' => $reasonCode, 'request_id' => $requestId, 'created_at' => $clock,
                ]);
                DB::statement("SELECT set_config('eoshop.order_operation_id', ?, true)", [(string) $claim['operation']->id]);
                DB::table('orders')->where('id', $orderId)->update([
                    'status' => $target->value,
                    ...$this->statusTimestamp($target, $clock),
                    'updated_at' => $clock,
                ]);

                return $this->operations->storeResult((string) $claim['operation']->id, [
                    'replayed' => false,
                    'order' => $this->resource(DB::table('orders')->where('id', $orderId)->firstOrFail(), false, true, true),
                ]);
            }));
        });
    }

    public function expireDueBatch(Tenant $tenant, int $limit = 100): int
    {
        if (! OrderReadiness::maintenanceCheck($tenant)) {
            return 0;
        }
        $ids = $this->withLockedTenant($tenant, fn (Tenant $locked): array => $this->inTenant($locked, fn (): array => DB::transaction(
            fn (): array => DB::table('orders')
                ->where('status', OrderStatus::Submitted->value)
                ->whereNotNull('reservation_id')
                ->where('expires_at', '<=', DB::raw('clock_timestamp()'))
                ->orderBy('expires_at')->orderBy('id')->lock('FOR UPDATE SKIP LOCKED')
                ->limit(max(1, min($limit, 500)))->pluck('id')->map('strval')->all(),
        )));
        $expired = 0;
        foreach ($ids as $id) {
            $expired += $this->expireOne($tenant, $id) ? 1 : 0;
        }

        return $expired;
    }

    private function expireOne(Tenant $tenant, string $orderId): bool
    {
        return $this->withLockedTenant($tenant, function (Tenant $lockedTenant) use ($orderId): bool {
            if (! OrderReadiness::maintenanceCheck($lockedTenant)) {
                return false;
            }

            return $this->inTenant($lockedTenant, fn (): bool => DB::transaction(function () use ($lockedTenant, $orderId): bool {
                $order = DB::table('orders')->where('id', $orderId)->lockForUpdate()->first();
                if ($order === null || $order->status !== OrderStatus::Submitted->value || $order->reservation_id === null) {
                    return false;
                }
                $clock = CarbonImmutable::parse((string) DB::selectOne('SELECT clock_timestamp() AS current_time')->current_time);
                if ($order->expires_at === null || $clock->lt(CarbonImmutable::parse((string) $order->expires_at))) {
                    return false;
                }
                $key = OrderIdentity::expiration($orderId);
                $payload = ['orderId' => $orderId, 'from' => OrderStatus::Submitted->value, 'to' => OrderStatus::Expired->value];
                $claim = $this->operations->claim(OrderOperationKind::Expire, 'order:'.$orderId, $key, $payload, OrderActorType::System, null, null);
                if ($claim['replayed']) {
                    return false;
                }
                try {
                    $this->reservations->expireWithinTransaction($lockedTenant, (string) $order->reservation_id);
                } catch (InventoryConflict) {
                    throw new OrderConflict('The order inventory state is inconsistent.', 'order_inventory_conflict');
                }
                DB::table('order_status_history')->insert([
                    'id' => (string) Str::uuid(), 'order_id' => $orderId, 'operation_id' => $claim['operation']->id,
                    'sequence' => ((int) DB::table('order_status_history')->where('order_id', $orderId)->max('sequence')) + 1,
                    'from_status' => OrderStatus::Submitted->value, 'to_status' => OrderStatus::Expired->value,
                    'actor_type' => OrderActorType::System->value, 'actor_user_id' => null,
                    'reason_code' => 'checkout_reservation_expired', 'request_id' => null, 'created_at' => $clock,
                ]);
                DB::statement("SELECT set_config('eoshop.order_operation_id', ?, true)", [(string) $claim['operation']->id]);
                DB::table('orders')->where('id', $orderId)->update([
                    'status' => OrderStatus::Expired->value, 'expired_at' => $clock, 'updated_at' => $clock,
                ]);
                $this->operations->storeResult((string) $claim['operation']->id, [
                    'replayed' => false,
                    'order' => $this->resource(DB::table('orders')->where('id', $orderId)->firstOrFail(), false),
                ]);

                return true;
            }));
        });
    }

    private function assertReady(Tenant $tenant): void
    {
        if (! OrderReadiness::check($tenant)) {
            throw new OrderConflict('Checkout is temporarily unavailable.', 'order_checkout_unavailable', 503);
        }
    }

    private function assertOperationalReady(Tenant $tenant): void
    {
        if (! OrderReadiness::operationalCheck($tenant)) {
            throw new OrderConflict('Order management is temporarily unavailable.', 'order_not_ready', 503);
        }
    }

    private function transitionAllowed(OrderStatus $from, OrderStatus $to): bool
    {
        return in_array($to, $this->allowedTransitions($from), true);
    }

    /** @return list<OrderStatus> */
    private function allowedTransitions(OrderStatus $from): array
    {
        return match ($from) {
            OrderStatus::Submitted => [OrderStatus::Accepted, OrderStatus::Cancelled],
            OrderStatus::Accepted => [OrderStatus::Processing, OrderStatus::Completed],
            OrderStatus::Processing => [OrderStatus::Completed],
            default => [],
        };
    }

    /** @return array<string, mixed> */
    private function statusTimestamp(OrderStatus $status, CarbonImmutable $clock): array
    {
        return match ($status) {
            OrderStatus::Accepted => ['accepted_at' => $clock],
            OrderStatus::Processing => ['processing_at' => $clock],
            OrderStatus::Completed => ['completed_at' => $clock],
            OrderStatus::Cancelled => ['cancelled_at' => $clock],
            OrderStatus::Expired => ['expired_at' => $clock],
            default => [],
        };
    }

    /** @return array<string, mixed> */
    private function resource(
        object $order,
        bool $includePrivate,
        bool $includeAllowedTransitions = false,
        bool $includeCustomerSummary = false,
    ): array {
        $resource = [
            'id' => (string) $order->id,
            'number' => (string) $order->order_number,
            'status' => (string) $order->status,
            'paymentState' => (string) $order->payment_state,
            'currencyCode' => (string) $order->currency_code,
            'workspaceRevision' => (int) $order->workspace_revision,
            'catalogRevision' => (int) $order->catalog_revision,
            'totals' => [
                'itemsSubtotalMinor' => (int) $order->items_subtotal_minor,
                'discountMinor' => (int) $order->discount_minor,
                'shippingMinor' => (int) $order->shipping_minor,
                'taxMinor' => (int) $order->tax_minor,
                'paymentFeeMinor' => (int) $order->payment_fee_minor,
                'grandTotalMinor' => (int) $order->grand_total_minor,
            ],
            'couponCode' => $order->coupon_code,
            'paymentMethod' => (string) $order->payment_method,
            'createdAt' => (string) $order->created_at,
            'allowedTransitions' => $includeAllowedTransitions
                ? array_map(static fn (OrderStatus $status): string => $status->value, $this->allowedTransitions(OrderStatus::from((string) $order->status)))
                : [],
        ];
        $customer = null;
        if ($includePrivate || $includeCustomerSummary) {
            $customer = json_decode(Crypt::decryptString((string) $order->customer_encrypted), true, 512, JSON_THROW_ON_ERROR);
        }
        if ($includeCustomerSummary) {
            $resource['customerName'] = is_array($customer) && isset($customer['name']) ? (string) $customer['name'] : '';
        }
        if (! $includePrivate) {
            return $resource;
        }
        $resource['items'] = DB::table('order_items')->where('order_id', $order->id)->orderBy('product_id')->get()->map(fn (object $item): array => [
            'productId' => (string) $item->product_id, 'name' => (string) $item->product_name, 'sku' => (string) $item->sku,
            'unitPriceMinor' => (int) $item->unit_price_minor, 'quantity' => (int) $item->quantity,
            'lineTotalMinor' => (int) $item->line_total_minor, 'tracked' => (bool) $item->tracked_at_submission,
        ])->all();
        $address = DB::table('order_addresses')->where('order_id', $order->id)->first();
        $resource['customer'] = $customer;
        $resource['address'] = $address === null ? null : json_decode(Crypt::decryptString((string) $address->encrypted_payload), true, 512, JSON_THROW_ON_ERROR);
        $payment = DB::table('payment_attempts')->where('order_id', $order->id)->orderByDesc('created_at')->orderByDesc('id')->first();
        $resource['payment'] = $payment === null ? null : [
            'method' => (string) $payment->method,
            'state' => (string) $payment->state,
            'channelId' => $payment->channel_id,
            'channelLabel' => $payment->channel_label,
            'reference' => $payment->encrypted_reference === null ? null : Crypt::decryptString((string) $payment->encrypted_reference),
        ];
        $resource['history'] = DB::table('order_status_history')->where('order_id', $order->id)->orderBy('sequence')->get()->map(fn (object $row): array => [
            'from' => $row->from_status, 'to' => (string) $row->to_status, 'reasonCode' => (string) $row->reason_code, 'createdAt' => (string) $row->created_at,
        ])->all();

        return $resource;
    }

    /**
     * @template T
     *
     * @param  callable(Tenant): T  $callback
     * @return T
     */
    private function withLockedTenant(Tenant $tenant, callable $callback): mixed
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($tenant, $callback): mixed {
            $locked = Tenant::query()->whereKey($tenant->getKey())->sharedLock()->first();
            if (! $locked instanceof Tenant) {
                throw new OrderConflict('The store no longer exists.', 'order_not_ready', 503);
            }

            return $callback($locked);
        });
    }

    /**
     * @template T
     *
     * @param  callable(Tenant): T  $callback
     * @return T
     */
    private function withLockedMembership(Tenant $tenant, User $actor, PermissionKey $permission, callable $callback): mixed
    {
        return $this->withLockedTenant($tenant, function (Tenant $locked) use ($actor, $permission, $callback): mixed {
            $central = DB::connection((string) config('tenancy.database.central_connection'));
            $membership = $central->table('tenant_user')->where('tenant_id', $locked->getKey())->where('user_id', $actor->getKey())->sharedLock()->first();
            if ($membership === null || $membership->status !== TenantMembershipStatus::Active->value || ! $actor->hasTenantPermission($locked, $permission)) {
                throw new AuthorizationException('The order permission is required.');
            }

            return $callback($locked);
        });
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    private function inTenant(Tenant $tenant, callable $callback): mixed
    {
        return tenancy()->initialized && (string) tenant('id') === (string) $tenant->getKey()
            ? $callback()
            : $tenant->run($callback);
    }
}
