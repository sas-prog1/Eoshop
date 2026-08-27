# WP 5.24 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.24 — Platform application review and active-store operations |
| Status | Complete; verified, merged and deployed to the retained Pilot |
| Verified | 2026-08-27 |
| Branch | `codex/wp-5.24-platform-review-operations` |
| Base | `34195f1` |
| Decision | [ADR 0036](../../decisions/ADR-0036-platform-review-workspace-and-store-operations.md) |

## Delivered boundary

- One permission-protected platform store detail route.
- Frozen submitted-application snapshot, dossier checklist, private evidence and application timeline.
- Explicit evidence acceptance/rejection before application approval.
- Tenant-isolated evidence review and download.
- Store-list triage that routes pending decisions into the detailed dossier.
- Current tenant, schema, domain, subscription, provisioning and publication health.
- Operator-readable publication blockers and existing bounded lifecycle actions.
- Legacy-tenant compatibility without synthetic dossier data.

## Local gates

- Backend quality: PASS; Pint on 294 files, Larastan on 254 files with zero errors and PHPUnit 3 tests / 6 assertions.
- Complete isolated container integration: PASS; 167 tests / 1,855 assertions, migration rollback/reapply, cached routes, HTTP boundaries, worker and scheduler checks.
- Frontend production build: PASS; TypeScript validation and Vite production bundle.
- Frontend Vitest: PASS; 58 files / 317 tests, including the detailed-workspace route, strict API contract mapping, and frozen-dossier review behavior.

## Security and lifecycle assertions

- Platform detail and document routes require platform store-view permission.
- Evidence decisions require store-review permission and accept only the bounded status contract.
- Rejected evidence requires a note; pending evidence cannot be approved as an application.
- Evidence from one tenant cannot be reviewed or downloaded through another tenant route.
- Private document responses retain authenticated, non-public delivery.
- Application approval rechecks dossier readiness on the server inside the transition path.
- Legacy tenants without a dossier retain their prior administration behavior.
- Operational actions retain existing manager permission, audit and state-transition enforcement.

## Delivery evidence

- Implementation commits: `0b2b5cb83efac18a82daec1f3986c81e9f6d3959` and the CI-isolation correction `6e35f702df14f665a6914ee33cc54e25a28e8888`.
- Protected delivery: [PR #72](https://github.com/sas-prog1/Eoshop/pull/72), squash-merged on 2026-08-27 as `08313c0cf421f3d3c253d0c53d146c4bca241b26`.
- Required CI: [run 33075482312](https://github.com/sas-prog1/Eoshop/actions/runs/33075482312), with Repository safety, Backend quality, Frontend quality and Container integration all passing.
- Retained Pilot backend: `eoshop/backend:wp524-pilot-final`, image `sha256:3d14f718f6f7715caf1d365775df1ffb99d6dda01fc358142cd2d16504f44f30`.
- Retained Pilot web: `eoshop/web:wp524-pilot-final`, image `sha256:039a657d2332345df9005636d8fa5cf95435c4322b7c5c2e497d0b99172a47e4`.
- The PostgreSQL container remained `c7b4b6f464a7c436c804167af01c733eb0acc4bbe1f6ea1c852afe8e8dde507f`; volumes `eoshop-pilot_postgres_data` and `eoshop-pilot_app_storage` were preserved.
- Central migration reported nothing pending; active-tenant migration completed for three tenants.
- Pilot HTTP checks passed: `/up` and `/` returned 200, the deployed bundle exposed the new review/operations labels, an anonymous store-detail request returned 401 and an unknown tenant host returned 404.
- The deployed backend exposes ten protected platform-store routes covering list/detail, evidence download and decisions, subscription activation, provisioning retry, publication controls and lifecycle status.

## Rollback

Restore the previous backend and web images. WP 5.24 adds no database migration; preserve all dossier evidence, events and central audit records.
