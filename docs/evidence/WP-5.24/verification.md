# WP 5.24 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.24 — Platform application review and active-store operations |
| Status | Local implementation verified; protected delivery pending |
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

Implementation commit, protected PR, required CI, merge commit and retained Pilot image/runtime facts will be recorded after protected delivery.

## Rollback

Restore the previous backend and web images. WP 5.24 adds no database migration; preserve all dossier evidence, events and central audit records.
