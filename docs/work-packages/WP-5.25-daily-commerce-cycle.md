# WP 5.25 — Daily commerce cycle

| Field | Value |
|---|---|
| Phase | Phase 5 — Launch product completion |
| Work Package | WP 5.25 |
| Status | In progress |
| Started | 2026-08-27 |
| Branch | `codex/wp-5.25-daily-commerce-cycle` |
| Base | Protected `main` at `b015ec1` |
| Dependencies | WP 4.1–4.3, WP 5.6–5.7, WP 5.19–5.24 |
| Decision | [ADR 0037](../decisions/ADR-0037-daily-commerce-operations.md) |

## Objective

Close the launch-required daily commerce journey so a customer can place an order and the correct merchant can find, inspect and process it to completion while authoritative inventory remains correct.

## Scope

- Complete the merchant order queue with server filters, pagination facts and useful summaries.
- Load protected order details containing customer, delivery, immutable items/totals, payment and timeline facts.
- Expose only server-allowed status actions and preserve idempotent retry behavior.
- Verify the existing product create/edit/publish/archive and inventory adjustment/policy paths needed by the journey.
- Add a cross-layer tenant-isolated checkout-to-completion regression.
- Preserve the canonical store center and existing backend commerce services.

## Exclusions

- Refunds, returns, shipping-provider integration or fulfillment labels.
- Payment gateway capture, webhooks or transfer-proof verification.
- Customer CRM, bulk operations, exports, advanced reports or notification integrations.
- Product variants, multi-warehouse inventory or destructive product deletion.
- Platform-operator access to customer order PII.
- Broad visual refinement; WP 5.26.

## T0–T5

### T0 — Scope and baseline

- [x] Trace existing product, inventory, checkout and order-management contracts.
- [x] Confirm the tenant database and existing services remain authoritative.
- [x] Identify the merchant order-detail gap as the primary launch blocker.

### T1 — Design

- [x] Record the daily commerce boundary in ADR 0037.
- [x] Separate minimal list summaries from sensitive selected-order detail.
- [x] Define one end-to-end checkout-to-completion gate.

### T2 — Implementation

- [x] Add bounded server list filters and permission-aware detail transitions.
- [x] Extend the strict frontend order contract with list/query/detail projections.
- [x] Build the merchant queue, filters, detail workspace and status timeline.
- [x] Verify the canonical product and inventory modules expose the required launch actions; no second writer or journey-blocking gap was found.

### T3 — Verification

- [x] Add backend filter, detail permission, isolation and full journey coverage.
- [x] Add frontend contract, queue, detail, transition and cancellation-confirmation regressions.
- [ ] Pass locked backend, frontend and isolated container gates.

### T4 — Pilot

- [ ] Deploy merged images without replacing the retained Pilot database.
- [ ] Verify product setup, public checkout, merchant order processing and stock results.

### T5 — Delivery

- [ ] Record implementation commit, protected PR and required CI.
- [ ] Merge through protected `main` after all four required checks pass.
- [ ] Record merged Pilot evidence in a closeout PR.

## Acceptance criteria

- A public customer can submit one real order and receive the server receipt.
- The order appears only in the owning merchant's queue and can be filtered and opened.
- The merchant sees customer, address, items, totals, payment and history from the protected detail API.
- Only actors with management permission receive and can execute status actions.
- The order progresses through allowed server transitions to completion without duplicate effects.
- Reservation acceptance/cancellation and final stock are correct, including idempotent retry.
- Another tenant cannot read or mutate the order, inventory or product.
- The required product and inventory actions are discoverable from the existing store center.

## Rollback

Restore the previous backend and web images. WP 5.25 should add no destructive migration; preserve tenant orders, inventory ledger, immutable snapshots and operations.

## Evidence

See [WP 5.25 verification evidence](../evidence/WP-5.25/verification.md).
