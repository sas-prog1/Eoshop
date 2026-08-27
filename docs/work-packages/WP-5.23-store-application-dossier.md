# WP 5.23 — Store application dossier, evidence and correction

| Field | Value |
|---|---|
| Phase | Phase 5 — Launch product completion |
| Work Package | WP 5.23 |
| Status | Complete and merged |
| Started | 2026-08-27 |
| Branch | `codex/wp-5.23-store-application-dossier` |
| Base | Protected `main` at `4a40e0d` |
| Dependencies | WP 5.13–5.16, WP 5.22 |
| Decision | [ADR 0035](../decisions/ADR-0035-server-owned-store-application-dossier.md) |

## Objective

Replace the opaque final onboarding submit with a durable, server-owned application dossier that tells a merchant what evidence is required, preserves the review history and lets the platform request bounded corrections without forcing the merchant to repeat the journey.

## Scope

- Derive application requirements from the server-owned business type.
- Require owner identity evidence and either commercial-registration evidence or an allowed exemption declaration.
- Store uploads privately with MIME, size, checksum and idempotency controls.
- Expose a merchant-only dossier summary, blockers and public timeline.
- Snapshot evidence metadata into the submitted application while retaining the private authoritative record.
- Separate `changes_requested` from final `rejected` decisions.
- Let platform reviewers select the exact fields that require correction.
- Require a newer draft revision, and renewed evidence where requested, before resubmission.
- Preserve the existing lifecycle for legacy tenants that predate application dossiers.

## Exclusions

- Full platform application-detail workspace and document preview; WP 5.24.
- Antivirus/CDR service, OCR, external identity verification or government registry integration.
- Arbitrary reviewer-defined requirements.
- Production object storage, retention automation or destructive tenant deletion.
- Broad merchant/platform visual redesign.

## T0–T5

### T0 — Scope and baseline

- [x] Trace the existing three-step onboarding, submission, review and resubmission contracts.
- [x] Confirm that the central database remains authoritative for the application lifecycle.
- [x] Preserve legacy tenants without manufacturing dossier data.

### T1 — Design

- [x] Record the dossier, evidence, correction and decision boundaries in ADR 0035.
- [x] Define a bounded requirement catalog and correction-field catalog.
- [x] Define private-document and public-timeline boundaries.

### T2 — Implementation

- [x] Add dossier evidence, event and correction-request models and central migration.
- [x] Add authenticated merchant application summary, upload, exemption and download endpoints.
- [x] Require a complete dossier before first submission and snapshot evidence metadata.
- [x] Add explicit request-completion and final-rejection review paths.
- [x] Add merchant correction guidance, timeline and safe resubmission checks.
- [x] Update strict frontend adapters and preserve stale/session/error handling.

### T3 — Verification

- [x] Add PostgreSQL dossier, authorization, isolation, idempotency and transition coverage.
- [x] Update downstream lifecycle fixtures without bypassing the production contract.
- [x] Pass locked frontend and backend quality gates.
- [x] Pass the final complete isolated container integration gate.

### T4 — Pilot

- [x] Deploy the merged images to the retained local Pilot without replacing its database volume.
- [x] Verify the deployed dossier migration, authenticated routes and frontend controls; transition coverage is retained in the isolated integration gate without adding synthetic records to the retained Pilot.

### T5 — Delivery

- [x] Record final evidence, implementation commit, PR and required CI.
- [x] Merge through protected `main`.
- [x] Confirm protected-branch CI and update the retained Pilot.

## Acceptance criteria

- The final onboarding step cannot submit until every server-required item is resolved.
- Uploads are private, type/size checked, checksum recorded and idempotent.
- A merchant cannot read or mutate another merchant's draft or evidence.
- A submitted store appears in platform review with its dossier status and timeline.
- “Request completion” names one or more allowed fields and does not become a final rejection.
- Resubmission requires an actual draft change after the correction request and revalidates dossier readiness.
- Final rejection remains a distinct, explicit decision.
- Existing tenants without a dossier can still be listed and administered.

## Rollback

Restore the previous backend and web images. The additive central dossier tables and verification-state value may remain unused safely. Do not delete stored evidence during an application rollback.

## Evidence

See [WP 5.23 verification evidence](../evidence/WP-5.23/verification.md).
