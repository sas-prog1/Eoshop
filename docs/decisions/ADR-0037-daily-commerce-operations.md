# ADR 0037 — Daily commerce operations boundary

## Status

Accepted for WP 5.25 on 2026-08-27.

## Context

The tenant database already owns exact catalog prices, inventory balances and reservations, immutable order snapshots, encrypted customer/address payloads, idempotent checkout and bounded order transitions. The merchant interface exposes product editing, inventory adjustment and compact order cards, but it does not yet use the protected order-detail projection or give the merchant a professional daily processing flow.

## Decision

1. The existing tenant-scoped catalog, inventory and order services remain authoritative. WP 5.25 does not introduce a parallel commerce writer or browser-owned business state.
2. The merchant order list becomes a bounded operational queue with server-side status and order-number filters, pagination metadata and a minimal customer display name. Phone, email, address, notes, items and history remain outside list rows.
3. Opening an order loads its protected detail endpoint. The detail contains the immutable item/price snapshot, encrypted-at-rest customer and delivery data, payment facts and status history.
4. The server returns allowed transitions on the detail only when the actor has order-management permission. Read-only members may inspect authorized order facts but cannot receive or invoke management actions.
5. Status transitions remain idempotent and server-validated. The interface must never guess a transition, update inventory optimistically or replace an ambiguous result with invented state.
6. Accepting a tracked order commits its reservation; cancelling a submitted order releases it; completing an accepted/processing order does not apply a second stock deduction. Existing ledger and database guards remain unchanged.
7. Product lifecycle continues through the canonical catalog snapshot writer and explicit archive semantics. Inventory continues through its revisioned ledger and policy endpoints. WP 5.25 adds only usability needed to complete the launch journey.
8. The release gate is one cross-layer scenario: a public customer creates an order on one tenant, the correct merchant finds and inspects it, advances it to completion, and the authoritative stock and other tenants remain correct.

## Consequences

- Merchants can operate real orders without database or terminal access.
- List responses stay small and avoid broad PII disclosure; sensitive facts are loaded only for the selected order.
- Existing encryption, idempotency, reservation and tenant-isolation guarantees are reused instead of reimplemented.
- Advanced fulfillment, returns, refunds, customer CRM, bulk actions, exports and platform access to customer PII remain outside the launch boundary.
