# Eoshop documentation index

## Governing documents

- [Architecture modernization plan](architecture-modernization-plan.md) — the phased delivery strategy and target architecture.
- [HTML architecture plan](architecture-modernization-plan.html) — formatted Arabic presentation of the same strategy.
- [Target architecture diagram](architecture-target.svg) — standalone architecture image used by the HTML and Markdown plans.
- [Current delivery state](current-state.md) — the authoritative delivered/active/deferred sequence.

## Work packages

- [WP 0.1 — Baseline and repository hygiene](work-packages/WP-0.1-baseline.md)
- [WP 0.2 — Single application server](work-packages/WP-0.2-single-application-server.md)
- [WP 0.3 — CI and automated quality gates](work-packages/WP-0.3-ci-quality-gates.md)
- [WP 1.1 — Central identity model](work-packages/WP-1.1-central-identity.md)
- [WP 1.2 — Real authentication and sessions](work-packages/WP-1.2-authentication-and-sessions.md)

- [WP 1.3 — Authorization, policies and protected resources](work-packages/WP-1.3-authorization-and-resource-policies.md)
- [WP 2.1 — Tenant, domain and database activation](work-packages/WP-2.1-tenant-domain-database-activation.md)
- [WP 2.2 — Recoverable tenant provisioning](work-packages/WP-2.2-recoverable-tenant-provisioning.md)
- [WP 2.3 — Domain, packages and publication](work-packages/WP-2.3-domain-packages-publication.md)
- [WP 3.1 — Unified frontend API boundary](work-packages/WP-3.1-unified-api-client.md)
- [WP 3.2 — Server-owned store workspace](work-packages/WP-3.2-server-owned-store-workspace.md)
- [WP 3.3 — Interface preservation through API adapters](work-packages/WP-3.3-interface-preservation.md)
- [WP 4.1 — Product, pricing and media authority](work-packages/WP-4.1-product-pricing-inventory-model.md)
- [WP 4.2 — Inventory ledger and reservations](work-packages/WP-4.2-inventory-ledger-reservations.md)
- [WP 4.3 — Server-authoritative orders](work-packages/WP-4.3-server-authoritative-orders.md)
- [WP 5.1 — Frontend application shell decomposition](work-packages/WP-5.1-frontend-application-shell.md)
- [WP 5.2 — Control panel workflow panels](work-packages/WP-5.2-control-panel-workflow-panels.md)
- [WP 5.3 — Pilot QA readiness](work-packages/WP-5.3-pilot-qa-readiness.md)
- [WP 5.4 — Merchant portal and store lifecycle](work-packages/WP-5.4-merchant-portal-lifecycle.md)
- [WP 5.5 — Server-owned draft, resubmission and merchant publication](work-packages/WP-5.5-store-draft-resubmission-publication.md)
- [WP 5.22 — Merchant launch console](work-packages/WP-5.22-merchant-launch-console.md)
- [WP 5.23 — Store application dossier, evidence and correction](work-packages/WP-5.23-store-application-dossier.md)
- [WP 5.27.1 — Public storefront and premium baseline](work-packages/WP-5.27.1-public-storefront.md)
- [WP 5.27.2A — Tech Bento storefront](work-packages/WP-5.27.2A-tech-bento-storefront.md)

## Architecture decisions

- [ADR 0001 — Laravel is the single application server](decisions/ADR-0001-laravel-single-application-server.md)
- [ADR 0002 — Reproducible CI gates](decisions/ADR-0002-reproducible-ci-gates.md)
- [ADR 0003 — Central identity and scoped roles](decisions/ADR-0003-central-identity-and-role-scopes.md)
- [ADR 0004 — First-party same-origin session authentication](decisions/ADR-0004-first-party-session-authentication.md)

- [ADR 0005 — Server-owned authorization boundaries](decisions/ADR-0005-server-owned-authorization-boundaries.md)
- [ADR 0006 — Schema-per-tenant runtime boundary](decisions/ADR-0006-schema-per-tenant-runtime-boundary.md)
- [ADR 0007 — Recoverable tenant provisioning](decisions/ADR-0007-recoverable-tenant-provisioning.md)
- [ADR 0008 — Domain, subscription and publication boundaries](decisions/ADR-0008-domain-subscription-publication-boundaries.md)
- [ADR 0009 — Unified frontend API boundary](decisions/ADR-0009-unified-frontend-api-boundary.md)
- [ADR 0010 — Server-owned store workspace](decisions/ADR-0010-server-owned-store-workspace.md)
- [ADR 0011 — Interface API adapters](decisions/ADR-0011-interface-api-adapters.md)
- [ADR 0012 — Server-owned catalog, pricing and media](decisions/ADR-0012-server-owned-catalog-pricing-media.md)
- [ADR 0013 — Append-only inventory ledger](decisions/ADR-0013-append-only-inventory-ledger.md)
- [ADR 0014 — Server-authoritative orders](decisions/ADR-0014-server-authoritative-orders.md)
- [ADR 0015 — Incremental frontend feature boundaries](decisions/ADR-0015-incremental-frontend-feature-boundaries.md)
- [ADR 0016 — Merchant and platform product shells](decisions/ADR-0016-merchant-and-platform-product-shells.md)
- [ADR 0017 — Server-owned draft, resubmission and merchant publication](decisions/ADR-0017-server-owned-draft-resubmission-merchant-publication.md)
- [ADR 0034 — Canonical merchant launch console](decisions/ADR-0034-canonical-merchant-launch-console.md)
- [ADR 0035 — Server-owned store application dossier](decisions/ADR-0035-server-owned-store-application-dossier.md)
- [ADR 0039 — Server-owned storefront marketing blocks](decisions/ADR-0039-server-owned-storefront-marketing-blocks.md)

## Evidence

- [WP 0.1 verification — 2026-08-12](evidence/WP-0.1/verification-2026-08-12.md)
- [WP 0.2 verification — 2026-08-12](evidence/WP-0.2/verification.md)
- [WP 0.3 verification — 2026-08-12](evidence/WP-0.3/verification.md)
- [WP 0.3 branch-protection activation — 2026-08-12](evidence/WP-0.3/branch-protection.md)
- [WP 1.1 verification — 2026-08-12](evidence/WP-1.1/verification.md)
- [WP 1.2 verification — 2026-08-12](evidence/WP-1.2/verification.md)
- [WP 1.3 verification — 2026-08-13](evidence/WP-1.3/verification.md)
- [WP 2.1 verification — 2026-08-14](evidence/WP-2.1/verification.md)
- [WP 2.2 verification — 2026-08-15](evidence/WP-2.2/verification.md)
- [WP 2.3 verification — 2026-08-15](evidence/WP-2.3/verification.md)
- [WP 3.1 verification — 2026-08-15](evidence/WP-3.1/verification.md)
- [WP 3.2 verification — 2026-08-16](evidence/WP-3.2/verification.md)
- [WP 3.3 verification — 2026-08-16](evidence/WP-3.3/verification.md)
- [WP 4.1 verification — 2026-08-16](evidence/WP-4.1/verification.md)
- [WP 4.2 verification — 2026-08-16](evidence/WP-4.2/verification.md)
- [WP 4.3 verification — 2026-08-18](evidence/WP-4.3/verification.md)
- [WP 5.1 verification — 2026-08-18](evidence/WP-5.1/verification.md)
- [WP 5.2 verification — 2026-08-18](evidence/WP-5.2/verification.md)
- [WP 5.3 verification — 2026-08-19](evidence/WP-5.3/verification.md)
- [WP 5.22 verification — 2026-08-27](evidence/WP-5.22/verification.md)
- [WP 5.23 verification — 2026-08-27](evidence/WP-5.23/verification.md)

## QA handoff

- [Pilot QA runbook](qa/pilot-test-runbook.md)
- [Pilot defect issue form](../.github/ISSUE_TEMPLATE/pilot-bug.yml)

## Documentation rules

- A Work Package record is created before implementation begins.
- Each record contains scope, exclusions, acceptance criteria, risks, gates and evidence.
- Evidence records facts and command results; it does not claim checks that were not run.
- Architecture decisions that affect more than one Work Package are recorded as ADRs.
- Documentation is updated in the same Pull Request as the behavior it describes.
- Sensitive values must never appear in evidence or examples.
