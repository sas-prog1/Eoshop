# WP 5.25 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.25 — Daily commerce cycle |
| Status | Complete — verified, merged and deployed to retained Pilot |
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

## Protected delivery

- Implementation commit: `2a9b65b02e32570c72a4c046371243d121345552`.
- Protected pull request: [PR #74](https://github.com/sas-prog1/Eoshop/pull/74).
- Required CI: [run 33083398606](https://github.com/sas-prog1/Eoshop/actions/runs/33083398606).
- All four required checks passed: Repository safety, Frontend quality, Backend quality and Container integration.
- Squash merge to protected `main`: `0ab5f25f5037199d51efdde839c84770b99376e2` at `2026-08-27T14:46:04Z`.

## Retained Pilot deployment

- Backend, worker and scheduler image: `eoshop/backend:wp525-pilot-final` (`sha256:56772ef947c847d5f1599ce6992dadf8538eef5ec91b242669d8bc65b862d623`).
- Web image: `eoshop/web:wp525-pilot-final` (`sha256:cddcb1d902478496c5049d3b2e30bdb1518548cb4fa53a1748527bc878c66b10`), built with `localhost`, `127.0.0.1` and `lvh.me` as central domains and `lvh.me` as the tenant base domain.
- Only `backend`, `worker`, `scheduler` and `web` were recreated. PostgreSQL container `c7b4b6f464a7` and the retained `eoshop-pilot_postgres_data` volume were preserved.
- Central schema reported `Nothing to migrate`; active-tenant migration completed for `3 tenant(s)`.
- Post-deployment HTTP checks returned `200` for `/up`, the central landing page and the published `noor.lvh.me` storefront.
- The served production asset `/assets/index-BPDffs2u.js` contains the new protected order-detail workspace labels, proving the merged WP 5.25 frontend is the version exposed on port `8010`.
- The destructive commerce journey was verified against the isolated PostgreSQL gate rather than modifying retained merchant orders; the retained Pilot verification confirms presentation, health, tenant host routing and deployment continuity.
