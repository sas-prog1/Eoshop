# WP 5.26.2A — Shared platform identity contract

| Field | Value |
|---|---|
| Phase | Phase 5 — Launch product completion |
| Work Package | WP 5.26.2A |
| Status | Implementation and pilot verified; delivery pending |
| Started | 2026-08-28 |
| Branch | `codex/wp5-26-2a-platform-identity-contract` |
| Base | Protected `main` at `11ca8a6` |
| Dependencies | WP 5.12, WP 5.13 and WP 5.26.1 |
| Decision | [ADR 0038](../decisions/ADR-0038-shared-platform-visual-identity.md) |

## Objective

Make the premium public platform and all routed authentication screens consume one typed, server-owned visual identity while preserving the tenant storefront boundary and existing authentication behavior.

## Scope

- Extend the existing platform settings singleton with a bounded premium palette, curated Arabic font and safe landing/authentication image URLs.
- Extend public/admin resources, closed update validation, optimistic-concurrency service snapshots and audit values.
- Extend the typed frontend contract and platform-scoped CSS variables.
- Apply the shared identity to login, registration, forgot-password and reset-password routes.
- Preserve a bundled image fallback and every current security, loading, error and return-path behavior.

## Exclusions

- Managed platform media upload; safe external HTTPS URLs remain the current storage boundary.
- The full administration editor and dual live preview; next focused package.
- Free-form CSS, custom font uploads, arbitrary layout building or tenant storefront changes.

## T0–T5

### T0 — Scope and baseline

- [x] Trace WP 5.12 settings, provider, administration editor and authentication consumers.
- [x] Confirm current authentication consumes only part of the platform identity.

### T1 — Design

- [x] Record the additive schema, safe defaults, fallback order and tenant boundary in ADR 0038.
- [x] Preserve existing operational accent semantics and avoid overwriting operator data.

### T2 — Implementation

- [x] Add the central schema and backend contract.
- [x] Add the frontend projection and platform CSS variables.
- [x] Build one premium responsive authentication shell for all four modes.

### T3 — Verification

- [x] Pass backend contract, migration, authorization, audit and concurrency gates.
- [x] Pass frontend contract, provider, authentication and isolated regression gates; the full Docker run records resource/state-contamination diagnostics explicitly.
- [x] Pass production build and repository invariants.

### T4 — Pilot

- [x] Migrate the retained central schema without replacing PostgreSQL.
- [x] Deploy affected services and verify the four authentication routes plus central health.

### T5 — Delivery

- [ ] Record implementation commit, PR, four required CI checks and protected merge.
- [ ] Record retained Pilot image and HTTP evidence.

## Rollback

Restore the previous backend and web images. The additive migration may remove its columns only while all six values still match the deterministic defaults; otherwise it refuses destructive rollback.

## Evidence

See [WP 5.26.2A verification](../evidence/WP-5.26.2A/verification.md).
