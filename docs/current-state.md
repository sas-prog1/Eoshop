# Eoshop current delivery state

Updated: 2026-08-27

## Product position

Eoshop has a server-authoritative commerce core, a repeatable local Pilot and a verified minimum journey from merchant customization through provisioning to a server-confirmed public storefront. Human Pilot acceptance can resume while Phase 5 hardens the public storefront and then expands management capabilities and visual polish. Automated verification and protected-branch CI remain mandatory.

## Delivered

- Phase 0: repository baseline, single Laravel application server, CI and protected `main`.
- Phase 1: central identity, database sessions, authentication, scoped roles, policies and audit.
- Phase 2: tenant isolation, domains, recoverable provisioning, plans, subscriptions and publication.
- Phase 3: unified frontend transport, server-owned workspaces and UI adapter boundary.
- Phase 4.1–4.3: catalog/pricing/media, inventory ledger/reservations and server-authoritative orders.
- Phase 5.1–5.3: initial frontend boundaries and repeatable local QA Pilot.
- WP 5.4–5.5: merchant portal, server-owned drafts, rejected-store correction/resubmission and merchant publication controls.
- WP 5.6: route-owned merchant store operations for catalog, orders, inventory and store modules.
- WP 5.7: focused product editor with ID-keyed changes, truthful archive/media behavior and removal of duplicate order/inventory builder modules.
- WP 5.8: focused store profile and appearance editor with tenant-isolated managed logo/hero assets and no second workspace writer.
- WP 5.9: focused checkout policy and About/contact content tasks with truthful payment/contact behavior, immutable receipt presentation and managed About media.
- WP 5.10–5.12: permission-driven platform administration, operator lifecycle and server-owned platform branding/navigation/settings.
- WP 5.13: guided authentication, merchant account and durable three-step onboarding routes with recoverable submission handoff.
- WP 5.14: bounded visual template selection, real preview and appearance-only onboarding persistence.
- WP 5.15: server-owned storefront section ordering/visibility, truthful first-party theme composition and focused renderer decomposition.
- WP 5.16: durable onboarding draft continuity, explicit submission requirements and truthful resume behavior.
- WP 5.17: nullable-contact workspace boundary hotfix for newly provisioned stores.
- WP 5.18: authenticated-shell narrow-screen, keyboard and structural accessibility acceptance hardening.
- WP 5.19: end-to-end existing-store customization completion, bounded provisioning refresh and server-confirmed publication continuity.
- WP 5.20: discoverable merchant store management, capability-aware shortcuts and recoverable public-storefront loading.
- WP 5.21: public-storefront loading/error semantics, keyboard and cart/checkout focus behavior, reduced motion, readable merchant colors, secure local-HTTP request identity and verified 320–1440 px reflow.
- WP 5.22: one canonical, permission-aware merchant launch console backed by tenant database aggregates and existing operational modules, verified and merged.
- WP 5.23: server-owned store application requirements, private evidence, a durable review timeline and targeted correction/resubmission, verified, merged and deployed to the retained Pilot.
- WP 5.24: detailed platform application review, required-evidence decisions and tenant/domain/subscription/provisioning/publication operations are verified, merged and deployed to the retained Pilot.

## Active

- WP 5.25 is active: complete the tenant-isolated customer-checkout to merchant-processing cycle, beginning with the missing professional order queue and protected detail experience.

## Approved next sequence

1. Implement WP 5.25 launch-required commerce-management gaps without widening the release boundary.
2. Restore richer appearance options through bounded server-owned contracts before broader visual refinement.
3. Complete local-market payment verification/notifications, then continue to Phase 6 staging, observability, backup and scale work.

## Deliberately deferred

- Real payment gateway capture, webhooks, refunds and chargebacks.
- Transfer-proof verification, returns, fulfillment and shipping integrations.
- External custom-domain DNS/TLS automation.
- Production mail/WhatsApp/social publishing.
- Product variants, multi-warehouse inventory and advanced analytics.
- Destructive tenant/schema deletion and retention automation.
- Redis, object storage/CDN, production monitoring, backup drills and load targets.

## Control rule

No work package is considered complete from code alone. Its Work Package status, T0–T5 gates, evidence, commit/PR/CI/merge facts and this current-state sequence must agree.
