<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Exceptions\OrderConflict;
use App\Http\Requests\UpdateOrderStatusRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantOrderController extends Controller
{
    public function index(Request $request, Tenant $tenant, OrderService $orders): JsonResponse
    {
        $validated = validator($request->query(), [
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:100'],
            'status' => ['nullable', 'string', 'in:submitted,accepted,processing,completed,cancelled,expired'],
            'query' => ['nullable', 'string', 'max:50', 'regex:/^[A-Za-z0-9-]+$/'],
        ])->validate();

        return $this->respond(fn (): array => $orders->list(
            $tenant,
            $this->actor($request),
            (int) ($validated['page'] ?? 1),
            (int) ($validated['perPage'] ?? 25),
            isset($validated['status']) ? OrderStatus::from((string) $validated['status']) : null,
            isset($validated['query']) ? mb_strtoupper(trim((string) $validated['query'])) : null,
        ));
    }

    public function show(Request $request, Tenant $tenant, string $order, OrderService $orders): JsonResponse
    {
        return $this->respond(fn (): array => $orders->detail($tenant, $this->actor($request), $order));
    }

    public function updateStatus(UpdateOrderStatusRequest $request, Tenant $tenant, string $order, OrderService $orders): JsonResponse
    {
        $validated = $request->validated();

        return $this->respond(fn (): array => $orders->transition(
            $tenant,
            $this->actor($request),
            $order,
            OrderStatus::from((string) $validated['status']),
            (string) $validated['reasonCode'],
            (string) $validated['idempotencyKey'],
            isset($validated['requestId']) ? (string) $validated['requestId'] : null,
        ));
    }

    /** @param callable(): array<string, mixed> $operation */
    private function respond(callable $operation): JsonResponse
    {
        try {
            return response()->json(['data' => $operation()]);
        } catch (OrderConflict $exception) {
            return response()->json(['message' => $exception->getMessage(), 'code' => $exception->errorCode], $exception->httpStatus);
        }
    }

    private function actor(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
