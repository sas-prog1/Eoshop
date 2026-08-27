# WP 5.26.1 — Premium platform landing

| Field | Value |
|---|---|
| Phase | Phase 5 — Launch product completion |
| Work Package | WP 5.26.1 |
| Status | Implemented, locally verified and deployed to retained Pilot; protected delivery pending |
| Started | 2026-08-27 |
| Branch | `codex/wp5-26-1a-premium-landing-hero` |
| Base | Protected `main` at `ba511fd` |
| Dependencies | WP 5.12, WP 5.13, WP 5.14 and WP 5.25 |

## Objective

Replace the experimental central landing presentation with a premium, truthful and coherent Arabic platform journey that explains the service, exposes the real onboarding entry and uses server-owned platform settings and plans.

## Scope

- Premium platform header and hero using real platform copy and one approved photographic asset.
- Trust strip and a concise merchant journey from account creation through publication.
- Platform capabilities constrained to currently implemented product behavior.
- Template discovery backed by the onboarding template catalog.
- Pricing backed by the public server plan projection, including loading, error and empty states.
- Operational FAQ, final onboarding call to action and footer backed by visible navigation and configured support channels.
- Responsive behavior and regression coverage for landing, settings and storefront accessibility boundaries.

## Exclusions

- Final differentiation of the two merchant storefront templates.
- Free-form page building, arbitrary CSS or unsupported marketing claims.
- New plans, payment capture, priority-review behavior or fabricated customer statistics.
- Platform branding editor extensions and the shared authentication visual shell; WP 5.26.2.

## T0–T5

### T0 — Scope and baseline

- [x] Preserve the existing onboarding, authentication and public settings routes.
- [x] Identify the compiled experimental landing blocks and real server-owned projections.

### T1 — Design

- [x] Agree a restrained ivory, navy and gold visual direction without emoji decoration.
- [x] Keep the landing narrative truthful to the current review, provisioning and publication lifecycle.

### T2 — Implementation

- [x] Split hero, journey, capabilities, templates and closure into focused landing components.
- [x] Redesign server pricing without duplicating or mutating server plan data.
- [x] Connect navigation, onboarding, login and support actions to their existing routes/settings.
- [x] Keep presentation components independent from service-layer imports.

### T3 — Verification

- [x] Pass production TypeScript and Vite compilation.
- [x] Pass the complete frontend regression suite and UI-boundary gate.
- [x] Pass whitespace/error-marker validation.

### T4 — Pilot

- [x] Deploy the web image only and preserve backend, workers, scheduler and PostgreSQL.
- [x] Verify the central page returns HTTP 200 and serves the new FAQ/final CTA bundle.

### T5 — Delivery

- [ ] Create implementation commit and protected pull request.
- [ ] Pass the four required CI checks and merge through protected `main`.
- [ ] Record the merged commit and retained Pilot evidence.

## Acceptance criteria

- A visitor understands the platform value and the steps required to create and publish a store.
- Registration, login, section navigation and onboarding calls to action lead to real application routes.
- Templates and plans come from their canonical application/server sources.
- The page makes no unsupported payment, priority, scale, testimonial or feature promise.
- Configured platform identity, navigation and support data remain server-owned.
- The page remains compatible with authenticated and anonymous visitors.

## Rollback

Restore the previous web image. This work package changes no database schema or backend runtime and does not require tenant data rollback.

## Evidence

See [WP 5.26.1 verification evidence](../evidence/WP-5.26.1/verification.md).
