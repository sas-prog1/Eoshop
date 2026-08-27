# WP 5.24 — Platform application review and active-store operations

| Field | Value |
|---|---|
| Phase | Phase 5 — Launch product completion |
| Work Package | WP 5.24 |
| Status | Implemented; protected delivery pending |
| Started | 2026-08-27 |
| Branch | `codex/wp-5.24-platform-review-operations` |
| Base | Protected `main` at `34195f1` |
| Dependencies | WP 5.10–5.12, WP 5.22–5.23 |
| Decision | [ADR 0036](../decisions/ADR-0036-platform-review-workspace-and-store-operations.md) |

## Objective

Turn platform store review from a compact accept/reject card into an evidence-backed application workspace, then reuse the same tenant-scoped route as the operational health view for an approved or published store.

## Scope

- Add a protected platform store-detail API and route.
- Project the frozen submitted draft, dossier checklist, private evidence metadata and application timeline.
- Let authorized reviewers accept or reject each evidence item with an auditable note boundary.
- Prevent approval until dossier-backed required evidence is accepted.
- Remove blind pending-review decisions from store-list cards.
- Show tenant, domain, subscription, provisioning and publication health with understandable blockers.
- Reuse existing bounded lifecycle actions and permissions from one operational workspace.
- Preserve legacy tenants that predate the dossier.

## Exclusions

- General platform access to customer order contents.
- OCR, antivirus/CDR, external identity verification or government registry integration.
- Arbitrary reviewer requirements or unbounded free-form workflows.
- Product/order/inventory feature expansion; WP 5.25.
- Final cross-system visual refinement; WP 5.26.
- Production object storage, retention automation or destructive tenant deletion.

## T0–T5

### T0 — Scope and baseline

- [x] Trace the store-list review actions, dossier contract and lifecycle permissions.
- [x] Confirm that the central database remains authoritative for review and operations.
- [x] Preserve existing protected admin routes and legacy-tenant behavior.

### T1 — Design

- [x] Record the detailed-review and active-store operations boundary in ADR 0036.
- [x] Separate triage cards from evidence-backed decisions.
- [x] Define one strict frontend detail contract for application and operations projections.

### T2 — Implementation

- [x] Add platform store detail, evidence-review and private-download endpoints.
- [x] Enforce accepted required evidence before application approval.
- [x] Add tenant-scoped audit and application events for evidence decisions.
- [x] Add a restorable `/admin/stores/{tenant}` route.
- [x] Build the frozen-application, checklist, evidence and timeline workspace.
- [x] Build the current tenant/domain/subscription/provisioning/publication health view.
- [x] Keep pending decisions inside the detailed workspace.

### T3 — Verification

- [x] Add platform authorization, cross-tenant isolation, evidence and approval-gate coverage.
- [x] Add frontend contract, route and review-workspace coverage.
- [x] Pass locked backend quality and full isolated container integration locally.
- [x] Pass the final locked frontend quality gate after the last route-ownership assertion.

### T4 — Pilot

- [ ] Deploy merged backend and web images without replacing the retained Pilot database.
- [ ] Verify the detail route, dossier controls, operations health and existing Pilot journey.

### T5 — Delivery

- [ ] Record implementation commit, PR and required CI.
- [ ] Merge through protected `main` only after all four required checks pass.
- [ ] Record merged Pilot evidence in a closeout PR.

## Acceptance criteria

- A reviewer can inspect the submitted snapshot and every required evidence item before deciding.
- A dossier-backed application cannot be approved while evidence is pending or rejected.
- Evidence review and download are permission-protected and fail closed across tenants.
- A pending store card opens the detailed application; it does not expose blind accept/reject actions.
- An active store view explains review, provisioning, domain, subscription and publication health without database access.
- Existing bounded operations remain protected by their original server transitions and permissions.
- Direct detail URLs survive authentication return and reject malformed or unauthorized targets.

## Rollback

Restore the previous backend and web images. No migration is introduced by WP 5.24; existing dossier review columns and events remain valid. Preserve private evidence and all central audit records.

## Evidence

See [WP 5.24 verification evidence](../evidence/WP-5.24/verification.md).
