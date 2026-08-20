# WP 5.8 — Store profile, appearance and managed assets

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.8 |
| Status | Implemented; awaiting delivery |
| Started | 2026-08-20 |
| Branch | `codex/wp-5.8-store-profile` |
| Base | Protected `main` at `2c769fc` |
| Dependencies | WP 3.2; WP 4.1; WP 5.4–5.7 |
| Decision | [ADR 0020](../decisions/ADR-0020-store-profile-and-managed-assets.md) |

## Objective

Turn store identity and appearance into a focused, truthful merchant task and provide tenant-isolated managed uploads for store logos and hero images without creating a second workspace writer.

## Baseline

- Existing-store design opens the remaining prototype builder with branding, design, products, checkout, pages, AI and export navigation.
- Branding and design occupy roughly 760 lines inside `ControlPanel.tsx`.
- Logo, hero and about file controls create `data:` URLs that the server workspace validator rejects.
- Product media upload is secure but intentionally cannot authorize or publish store-level appearance assets.
- Workspace revision conflict, dirty navigation and public publication readiness are already server-authoritative and must be preserved.

## Scope

- Extract a typed store-profile/appearance editor for identity, contact/currency presentation, logo, theme, typography, colors and hero presentation.
- Present focused internal sections and suppress unrelated builder navigation for an existing store design route.
- Add tenant `store_assets`, managed upload/serve/cleanup services and exact API contracts.
- Accept root-relative same-tenant managed asset paths for `logoUrl` and `heroBannerImage` only in an existing workspace, while keeping draft/provisioning and `aboutImage` HTTPS-only.
- Verify asset provenance during workspace save and reference visibility during public serving.
- Preserve App-owned workspace save, dirty state, 409 recovery, preview and return-to-operations behavior.
- Remove browser `data:` persistence claims and add truthful pre-provisioning behavior.
- Add backend, frontend, route-boundary, migration and cleanup verification.

## Out of scope

- Checkout/payment settings redesign or a new checkout policy writer.
- Content page extraction, rich text, custom page types or SEO management.
- Custom-domain/DNS/TLS changes.
- Image transformations, CDN delivery, antivirus scanning or a general-purpose media library.
- Platform administration, team/profile management or customer-facing storefront redesign.

## Safety and product invariants

- Workspace and catalog revisions remain mandatory; asset upload alone never changes the public store.
- Managed assets are same-tenant, platform-owned, bounded and fail closed on unknown path/disk/row/reference.
- Public asset bytes require current-workspace reference plus runtime/publication readiness; central preview requires exact permission.
- A merchant cannot bind another tenant's asset or an arbitrary relative URL.
- A late upload cannot overwrite a newer slot choice or cross account/store context.
- Failed save, 409 conflict and navigation retain the same explicit recovery behavior as WP 5.7.
- Draft onboarding never shows a file upload as saved when no ready tenant workspace exists.
- Cleanup is recoverable and never deletes referenced assets.
- Workspace save and cleanup use current-config-first then ascending-asset-UUID lock order; bind/cleanup races fail closed.
- Upload uses recoverable staging rows and tenant limits of 20 rows/50 MiB across all non-deleted states, including cleanup tombstones; exact replay remains available at the limit and no crash path intentionally leaves an untracked file.
- Existing-store currency is read-only in this profile; onboarding currency remains editable under the existing catalog contract.

## T0–T5

### T0 — Contract and baseline

- [x] Record current builder ownership and the `data:`/HTTPS contract mismatch.
- [x] Accept ADR 0020 product, persistence, authorization and asset lifecycle decisions.
- [x] Complete independent design review.

### T1 — Managed asset authority

- [x] Add tenant migration, model/service boundary and safe rollback refusal.
- [x] Add authenticated upload and known-domain serving routes with exact policy/readiness checks.
- [x] Validate same-tenant managed paths during workspace save and add recoverable orphan cleanup with config-first lock order.

### T2 — Focused profile experience

- [x] Extract identity, appearance and hero editing from `ControlPanel`.
- [x] Add managed logo/hero upload with account/tenant/slot/generation guards.
- [x] Focus existing-store design navigation and keep onboarding limitations truthful.

### T3 — Verification

- [x] Cover identity/theme/color/hero edits and successful revisioned save/reload/public composition.
- [x] Cover upload validation, idempotency, membership/permission, tenant ownership and exact public/preview visibility.
- [x] Cover cross-tenant path rejection, unsafe URL forms, exact 422/409 codes, stale upload results, failed save and 409 recovery.
- [x] Cover reserved managed-path rejection for absolute central, same-tenant and cross-tenant HTTPS URLs.
- [x] Cover staging recovery, quotas, orphan retention/detach window, suspended maintenance, tombstone retry and rollback refusal.
- [x] Cover quota accounting for cleanup tombstones and exact replay while at the limit.
- [x] Cover real two-connection bind/cleanup serialization and immediate unpublish/unreference serving denial.
- [x] Cover fleet readiness before/after migration and unchanged HTTPS-only draft/provisioning validation.
- [x] Preserve storefront, product, inventory, order, lifecycle and onboarding characterization.

### T4 — Gates

- [x] Pass frontend tests, production build and dependency audit.
- [x] Pass backend quality, repository safety and isolated container integration.

### T5 — Evidence and delivery

- [ ] Record exact evidence and retained checkout/page/platform debt.
- [x] Obtain final independent read-only approval.
- [ ] Commit implementation and evidence separately, push, open PR, pass required CI and merge.

## Acceptance criteria

- An authorized merchant opens one focused “profile and appearance” task from the store operations center.
- The merchant can upload a valid logo/hero image for a ready store, preview it, save the workspace and see it on the exact public host after publication.
- File selection for a pre-provisioning draft is not represented as a durable server upload.
- Other accounts, tenants, unready stores and unauthorized roles cannot upload, preview or bind managed assets.
- A workspace conflict cannot silently publish or discard appearance edits.
- The existing-store design task no longer exposes product, checkout, pages, AI or export as sibling builder tabs.

## Rollback

Revert the focused frontend boundary and upload routes. Do not drop `store_assets` while any row exists; retain the tenant table until referenced and recoverable orphan assets have been migrated or safely removed.
