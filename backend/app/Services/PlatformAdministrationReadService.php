<?php

namespace App\Services;

use App\Enums\PlatformAttentionQueue;
use App\Enums\ProvisioningState;
use App\Enums\PublicationStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\TenantVerificationStatus;
use App\Models\Tenant;
use App\Support\SqlLikePattern;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Connection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PlatformAdministrationReadService
{
    /**
     * @return array{
     *     generatedAt: string,
     *     stores: array{
     *         total: int,
     *         verification: array{pending: int, changesRequested: int, approved: int, rejected: int, suspended: int},
     *         provisioning: array{notStarted: int, queued: int, provisioning: int, retrying: int, active: int, failed: int},
     *         publication: array{requested: int, published: int, unpublished: int, rejected: int}
     *     },
     *     attention: array{review: int, provisioning: int, subscription: int, publication: int}
     * }
     */
    public function overview(): array
    {
        $central = $this->central();
        if ($central->transactionLevel() > 0) {
            $isolation = $central->selectOne('SHOW transaction_isolation');
            if (! is_object($isolation)
                || ! property_exists($isolation, 'transaction_isolation')
                || $isolation->transaction_isolation !== 'repeatable read') {
                throw new RuntimeException('The platform overview requires a repeatable-read transaction.');
            }

            return $this->overviewWithinSnapshot($central);
        }

        return $central->transaction(function () use ($central): array {
            $central->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

            return $this->overviewWithinSnapshot($central);
        });
    }

    /**
     * @return array{
     *     generatedAt: string,
     *     stores: array{
     *         total: int,
     *         verification: array{pending: int, changesRequested: int, approved: int, rejected: int, suspended: int},
     *         provisioning: array{notStarted: int, queued: int, provisioning: int, retrying: int, active: int, failed: int},
     *         publication: array{requested: int, published: int, unpublished: int, rejected: int}
     *     },
     *     attention: array{review: int, provisioning: int, subscription: int, publication: int}
     * }
     */
    private function overviewWithinSnapshot(Connection $central): array
    {
        $now = $this->databaseNow($central);
        $counts = Tenant::query()->selectRaw(<<<'SQL'
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE verification_status = 'pending') AS verification_pending,
                COUNT(*) FILTER (WHERE verification_status = 'changes_requested') AS verification_changes_requested,
                COUNT(*) FILTER (WHERE verification_status = 'approved') AS verification_approved,
                COUNT(*) FILTER (WHERE verification_status = 'rejected') AS verification_rejected,
                COUNT(*) FILTER (WHERE verification_status = 'suspended') AS verification_suspended,
                COUNT(*) FILTER (WHERE provisioning_status = 'not_started') AS provisioning_not_started,
                COUNT(*) FILTER (WHERE provisioning_status = 'queued') AS provisioning_queued,
                COUNT(*) FILTER (WHERE provisioning_status = 'provisioning') AS provisioning_provisioning,
                COUNT(*) FILTER (WHERE provisioning_status = 'retrying') AS provisioning_retrying,
                COUNT(*) FILTER (WHERE provisioning_status = 'active') AS provisioning_active,
                COUNT(*) FILTER (WHERE provisioning_status = 'failed') AS provisioning_failed,
                COUNT(*) FILTER (WHERE publication_status = 'requested') AS publication_requested,
                COUNT(*) FILTER (WHERE publication_status = 'published') AS publication_published,
                COUNT(*) FILTER (WHERE publication_status = 'unpublished') AS publication_unpublished,
                COUNT(*) FILTER (WHERE publication_status = 'rejected') AS publication_rejected
            SQL)->firstOrFail();

        $attention = [];
        foreach (PlatformAttentionQueue::cases() as $queue) {
            $attention[$queue->value] = $this->applyAttention(Tenant::query(), $queue, $now)->count();
        }

        return [
            'generatedAt' => $now->toIso8601String(),
            'stores' => [
                'total' => (int) $counts->getAttribute('total'),
                'verification' => [
                    'pending' => (int) $counts->getAttribute('verification_pending'),
                    'changesRequested' => (int) $counts->getAttribute('verification_changes_requested'),
                    'approved' => (int) $counts->getAttribute('verification_approved'),
                    'rejected' => (int) $counts->getAttribute('verification_rejected'),
                    'suspended' => (int) $counts->getAttribute('verification_suspended'),
                ],
                'provisioning' => [
                    'notStarted' => (int) $counts->getAttribute('provisioning_not_started'),
                    'queued' => (int) $counts->getAttribute('provisioning_queued'),
                    'provisioning' => (int) $counts->getAttribute('provisioning_provisioning'),
                    'retrying' => (int) $counts->getAttribute('provisioning_retrying'),
                    'active' => (int) $counts->getAttribute('provisioning_active'),
                    'failed' => (int) $counts->getAttribute('provisioning_failed'),
                ],
                'publication' => [
                    'requested' => (int) $counts->getAttribute('publication_requested'),
                    'published' => (int) $counts->getAttribute('publication_published'),
                    'unpublished' => (int) $counts->getAttribute('publication_unpublished'),
                    'rejected' => (int) $counts->getAttribute('publication_rejected'),
                ],
            ],
            'attention' => [
                'review' => $attention[PlatformAttentionQueue::Review->value],
                'provisioning' => $attention[PlatformAttentionQueue::Provisioning->value],
                'subscription' => $attention[PlatformAttentionQueue::Subscription->value],
                'publication' => $attention[PlatformAttentionQueue::Publication->value],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  list<string>  $relations
     * @return LengthAwarePaginator<int, Tenant>
     */
    public function stores(array $filters, array $relations): LengthAwarePaginator
    {
        $query = Tenant::query()->with($relations);
        $now = $this->databaseNow($this->central());

        if (isset($filters['search'])) {
            $search = SqlLikePattern::containsLiteral((string) $filters['search']);
            $query->where(function (Builder $searchQuery) use ($search): void {
                $searchQuery->whereLike('store_name', $search, caseSensitive: false)
                    ->orWhereLike('owner_name', $search, caseSensitive: false)
                    ->orWhereLike('owner_email', $search, caseSensitive: false);
            });
        }
        if (isset($filters['verification'])) {
            $query->where('verification_status', (string) $filters['verification']);
        }
        if (isset($filters['provisioning'])) {
            $query->where('provisioning_status', (string) $filters['provisioning']);
        }
        if (isset($filters['publication'])) {
            $query->where('publication_status', (string) $filters['publication']);
        }
        if (isset($filters['attention'])) {
            $this->applyAttention($query, PlatformAttentionQueue::from((string) $filters['attention']), $now);
        }

        return $query->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['perPage'] ?? 25));
    }

    /**
     * @param  Builder<Tenant>  $query
     * @return Builder<Tenant>
     */
    private function applyAttention(Builder $query, PlatformAttentionQueue $attention, CarbonImmutable $now): Builder
    {
        return match ($attention) {
            PlatformAttentionQueue::Review => $query->where(
                'verification_status',
                TenantVerificationStatus::Pending->value,
            ),
            PlatformAttentionQueue::Provisioning => $query->where(
                'provisioning_status',
                ProvisioningState::Failed->value,
            ),
            PlatformAttentionQueue::Subscription => $query->whereHas(
                'currentPublicationRequest.subscription',
                function (Builder $subscription) use ($now): void {
                    $subscription->where(function (Builder $needsAction) use ($now): void {
                        $needsAction->whereIn('status', [
                            SubscriptionStatus::PendingActivation->value,
                            SubscriptionStatus::Expired->value,
                        ])->orWhere(function (Builder $active) use ($now): void {
                            $active->where('status', SubscriptionStatus::Active->value)
                                ->whereNotNull('ends_at')
                                ->where('ends_at', '<=', $now);
                        });
                    });
                },
            ),
            PlatformAttentionQueue::Publication => $query
                ->where('verification_status', TenantVerificationStatus::Approved->value)
                ->where('provisioning_status', ProvisioningState::Active->value)
                ->whereIn('publication_status', [
                    PublicationStatus::Requested->value,
                    PublicationStatus::Unpublished->value,
                    PublicationStatus::Rejected->value,
                ]),
        };
    }

    private function central(): Connection
    {
        return DB::connection((string) config('tenancy.database.central_connection'));
    }

    private function databaseNow(Connection $connection): CarbonImmutable
    {
        $row = $connection->selectOne('SELECT transaction_timestamp() AS generated_at');
        if (! is_object($row) || ! property_exists($row, 'generated_at')) {
            throw new RuntimeException('Unable to read the central database timestamp.');
        }

        return CarbonImmutable::parse((string) $row->generated_at)->utc();
    }
}
