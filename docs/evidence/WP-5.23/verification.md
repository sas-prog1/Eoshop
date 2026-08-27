# WP 5.23 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.23 — Store application dossier, evidence and correction |
| Status | Complete, merged and deployed to the retained Pilot |
| Verified | 2026-08-27 |
| Branch | `codex/wp-5.23-store-application-dossier` |
| Base | `4a40e0d` |
| Decision | [ADR 0035](../../decisions/ADR-0035-server-owned-store-application-dossier.md) |

## Delivered boundary

- Server-derived identity and commercial-registration requirements.
- Private, tenant-aware document storage with MIME, size, checksum and idempotency controls.
- Durable evidence, public application events and targeted correction requests.
- Locked-draft readiness validation before submission and resubmission.
- Evidence metadata snapshot in the store submission.
- Distinct request-completion and final-rejection platform actions.
- Merchant checklist, evidence controls, correction labels and application timeline.
- Legacy-tenant compatibility without synthetic dossier records.

## Local gates

- Frontend Vitest: PASS; 57 files / 315 tests.
- Frontend production build: PASS; TypeScript validation and Vite production bundle.
- Backend quality: PASS; Pint on 291 files, Larastan on 252 files with zero errors and PHPUnit 3 tests / 6 assertions.
- Focused PostgreSQL dossier integration: PASS; 2 tests / 44 assertions.
- Complete isolated container integration: PASS; 165 tests / 1,827 assertions, central and tenant migration rollback/reapply, cached routes, HTTP boundaries, worker and scheduler checks.
- Migration-chain regression found by the gate: FIXED; the dossier migration is now explicitly rolled back before its dependencies and reapplied after the protected WP 5.13 rollback assertion.

## Security and lifecycle assertions

- A user cannot inspect, upload, exempt or download evidence for another user's draft.
- Upload content is inspected by the server; the client filename does not select the stored extension.
- Stored objects use generated identifiers and private response headers.
- Reusing an idempotency key for different evidence fails closed.
- Submission snapshots contain checksums and metadata, not public document links.
- Review corrections accept only allow-listed field keys and require a human-readable reason.
- Resubmission cannot occur until a newer draft revision exists and dossier requirements are ready.
- Final rejection is separate from a correctable completion request.
- Dossier events and administrative audit events are both retained for their separate audiences.

## Delivery evidence

- Implementation commit: `7345a53b2294a5d63e142dedb985e8842b34c0cf`.
- Protected pull request: [#70](https://github.com/sas-prog1/Eoshop/pull/70).
- Required CI run: [33064450924](https://github.com/sas-prog1/Eoshop/actions/runs/33064450924).
- Required checks: Repository safety PASS (24s), Frontend quality PASS (57s), Backend quality PASS (1m02s), Container integration PASS (5m26s).
- Squash merge commit on protected `main`: `5b8d86fb93a361f221fae4add3cce703c7c8be66`.
- Retained Pilot deployment: backend/worker/scheduler `eoshop/backend:wp523-pilot-final` (`sha256:91c75297d2bcd1b9e45d3e7467e97e9c99851bbf97e3576409e14cef5eae7701`); web `eoshop/web:wp523-pilot-final` (`sha256:2422a9de786ba6b0303c2aa03132e16f2ff363f069efacd470269cbceef0aaac`).
- Pilot database container `c7b4b6f464a7` and both persistent volumes were retained. The dossier migration is recorded as batch 4 and all five services are running; backend and web are healthy.
- Pilot HTTP verification: `/up` and `/` returned 200; served assets are `index-Dyx31a39.js` and `index-CZjnDAZG.css`.
- Deployed-bundle verification: the served JavaScript contains the dossier-ready and targeted-correction controls. Authenticated dossier read/upload/exemption/download routes are present in the deployed backend.

## Rollback

Restore the previous application images. Preserve the additive dossier tables and private evidence objects for audit and recovery; do not destructively remove application material as part of a code rollback.
