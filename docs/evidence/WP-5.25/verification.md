# WP 5.25 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.25 — Daily commerce cycle |
| Status | Implementation verified locally; protected delivery pending |
| Started | 2026-08-27 |
| Branch | `codex/wp-5.25-daily-commerce-cycle` |
| Base | `b015ec1` |
| Decision | [ADR 0037](../../decisions/ADR-0037-daily-commerce-operations.md) |

## Baseline finding

- The backend already owns product prices, inventory revisions and reservations, immutable order snapshots, idempotent checkout and bounded status transitions.
- Public checkout and compact merchant order cards already use the server.
- The frontend does not call the existing protected order-detail endpoint, so the merchant cannot inspect customer, delivery, items, payment or history before processing.
- The existing inventory ledger and product editor will be changed only where the launch journey proves a user-facing blocker.

## Verification record

### Implemented contract

- Merchant order list: bounded server status/order-number filters, page facts and customer display name only.
- Protected detail: customer, delivery, immutable items/totals, payment facts and ordered status history.
- Authorization: list rows never expose transition actions; detail actions are returned only to members with `tenant.orders.manage`.
- Merchant workspace: searchable queue, protected detail sheet, Arabic status/history labels, server-authorized actions and explicit cancellation confirmation.
- Transition retry: the same idempotency key is retained after an ambiguous response and authoritative detail/list state is reloaded.

### Local verification

- Production frontend compilation passed. The existing bundle-size warning remains deferred to the performance phase.
- Clean full frontend gate: `58 files / 320 tests` passed.
- Final focused order/API/control-panel gate after the visible transition-error fix: `3 files / 18 tests` passed.
- Frontend dependency audit: `0 vulnerabilities`.
- Final locked backend gate: Composer validation and audit passed; Pint passed `294 files`; Larastan passed `254 files`; non-database PHPUnit passed `3 tests / 6 assertions`.
- PostgreSQL journey regression: `1 test / 94 assertions` passed for checkout, list privacy, protected detail, role permission, cross-tenant owner denial, prefix filtering, idempotent acceptance, processing, completion, immutable history and final stock.
- Repository invariant gate and `git diff --check` passed.
- The isolated `eoshop-wp525-target` PostgreSQL container, network and volume were removed after verification; the retained Pilot database was not used or replaced.
- Diagnostic note: an earlier all-frontend run passed `318 / 319` while one unrelated forgot-password test exceeded its five-second timeout under concurrent Docker builds. Its isolated rerun passed `2 / 2` in `1.36s`, and the subsequent clean acceptance run passed all `320 / 320` tests.

### Product and inventory launch-gap review

- Product create/edit/pricing/publish/archive continues through the canonical workspace writer and is reachable from the store operations center.
- Inventory balances, revisioned adjustments, policy updates and low-stock facts continue through the canonical inventory API and ledger.
- Existing frontend coverage passed for the product editor (`6 tests`) and inventory panel (`3 tests`). No missing action blocks the customer-to-completion journey, so WP 5.25 adds no parallel product or inventory writer.

Protected delivery, CI and retained Pilot evidence will be appended after the local gates pass.
