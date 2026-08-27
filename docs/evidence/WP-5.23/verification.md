# WP 5.23 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.23 — Store application dossier, evidence and correction |
| Status | Local gates complete; protected delivery in progress |
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

Implementation commit, pull request, required CI, merge and retained-Pilot facts will be appended during T5 closeout.

## Rollback

Restore the previous application images. Preserve the additive dossier tables and private evidence objects for audit and recovery; do not destructively remove application material as part of a code rollback.
