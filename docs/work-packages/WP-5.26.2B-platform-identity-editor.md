# WP 5.26.2B — Platform identity editor and dual preview

| Field | Value |
|---|---|
| Phase | Phase 5 — Launch product completion |
| Work Package | WP 5.26.2B |
| Status | Complete and merged |
| Started | 2026-08-29 |
| Branch | `codex/wp5-26-2b-platform-identity-editor` |
| Base | Protected `main` at `96de04c` |
| Dependencies | WP 5.12, WP 5.26.1 and WP 5.26.2A |
| Decision | [ADR 0038](../decisions/ADR-0038-shared-platform-visual-identity.md) |

## Objective

Let an authorized platform administrator edit the already server-owned premium identity from `/admin/settings` and inspect truthful landing/authentication previews before one explicit revisioned save.

## Scope

- Add controls for the three bounded brand colours, curated Arabic font and safe landing/authentication image URLs.
- Add immediate client validation without weakening the closed backend contract.
- Replace the old approximate identity card with focused landing and authentication previews.
- Preserve existing authorization, optimistic concurrency, dirty-state guard, audit and public-provider replacement behavior.

## Exclusions

- Platform media upload or an asset library.
- Arbitrary CSS, uploaded fonts, free-form layout building or animation controls.
- Tenant storefront identity; it remains tenant-owned and isolated.
- Rebuilding the landing or authentication components.

## T0–T5

### T0 — Scope and baseline

- [x] Trace the current `/admin/settings` editor, save adapter, dirty guard and public-settings replacement.
- [x] Confirm all six fields already persist through the WP 5.26.2A contract.

### T1 — Design

- [x] Keep one editor and one server save; do not create a second theme record or endpoint.
- [x] Select two bounded previews rather than embedding a fully interactive application inside administration.

### T2 — Implementation

- [x] Add visual identity controls and local safety feedback.
- [x] Add landing/authentication preview switching.
- [x] Preserve the existing save, conflict and permission boundaries.

### T3 — Verification

- [x] Prove the complete identity payload uses the current server revision.
- [x] Prove unsafe images and malformed colours cannot be saved or rendered.
- [x] Pass focused frontend regression and the locked production build.
- [x] Pass the local repository gate on the final implementation tree.
- [x] Pass the four GitHub required checks on the final tree.

### T4 — Pilot

- [x] Deploy only the retained web service and verify `/admin/settings` against the retained backend/database.

### T5 — Delivery

- [x] Record implementation commit, PR, four required CI checks and protected merge.
- [x] Record Pilot and rollback evidence.

## Rollback

Restore the previous web image. No schema or backend rollback is required because this package only exposes the already delivered server contract.

## Evidence

See [WP 5.26.2B verification evidence](../evidence/WP-5.26.2B/verification.md).
