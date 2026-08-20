# Eoshop current delivery state

Updated: 2026-08-20

## Product position

Eoshop has a server-authoritative commerce core and a repeatable local Pilot. Human Pilot acceptance is paused while Phase 5 turns the prototype-style navigation into coherent merchant and platform product shells. Automated verification and protected-branch CI remain mandatory.

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

## Active

- No implementation WP is active while the next focused merchant boundary is defined from retained checkout/page and platform-console debt.

## Approved next sequence

1. Focused checkout/settings and content-page merchant tasks, continuing removal of the retained prototype builder.
2. Platform administration console with users, audit, platform settings and operational queues.
3. UX/browser acceptance, accessibility and responsive hardening.
4. Local-market payment verification/notifications, then Phase 6 staging, observability, backup and scale work.

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
