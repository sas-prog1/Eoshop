# ADR 0036 — Platform review workspace and active-store operations

## Status

Accepted for WP 5.24 on 2026-08-27.

## Context

WP 5.23 established a server-owned application dossier, private evidence and targeted correction lifecycle. The platform interface still projected each application as a compact store card with decision buttons. That surface did not let an operator inspect the submitted snapshot, review each private document or understand provisioning and publication blockers before acting.

## Decision

1. A platform store has one permission-protected detail route at `/admin/stores/{tenant}`. The route is restorable, history-aware and reauthorized after authentication.
2. The platform detail API composes two server-owned projections: the frozen submitted application workspace and the current operational health of the tenant.
3. Reviewers see the exact submitted draft revision, business data, selected design, handle, plan, dossier checklist and public application timeline. The browser never reconstructs a submitted application from current editable merchant state.
4. Each required evidence item must receive an explicit accepted or rejected review status. A rejection requires an operator note; private evidence downloads remain authenticated, authorized and tenant-scoped.
5. A new dossier-backed application cannot be approved until every required evidence item is accepted. The server enforces this gate even if a client attempts the status transition directly.
6. Store-list cards are triage surfaces only. A pending application decision is made inside the detailed workspace after review, not through blind accept/reject shortcuts.
7. After approval, the same workspace exposes current review, tenant schema, canonical domain, subscription, provisioning and publication health, including bounded retry, activation, publish, unpublish, suspend and resume actions governed by existing permissions and transition rules.
8. Publication blockers are returned as server codes and translated to operator-readable explanations. Database state is never inferred from labels in the browser.
9. Legacy tenants without a dossier remain operable. The application projection is absent and existing server lifecycle rules continue to control them.

## Consequences

- Platform reviewers can make an evidence-backed decision without terminal or database access.
- Direct API calls cannot bypass required evidence review.
- Operations staff have one tenant-scoped health view instead of correlating compact cards and raw blocker codes.
- Private documents stay outside public storefront and tenant database payloads.
- The application detail is deliberately not a general customer-order investigation tool; exceptional order access requires a later, separately audited decision.
- Advanced document preview, OCR, malware scanning, external verification and production object storage remain later production capabilities.
