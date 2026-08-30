# ADR 0020 — Focused store profile and managed appearance assets

- Status: Accepted
- Date: 2026-08-20
- Work package: WP 5.8

> Quota-default note: ADR 0039 supersedes the original 20-asset/50-MiB defaults with 64 assets/75 MiB for the bounded storefront marketing-block contract. All lifecycle, tenancy, binding, serving and cleanup rules below remain in force.

## Context

WP 5.6 introduced a route-owned store operations center and WP 5.7 extracted product editing from the prototype builder. Store identity and appearance still live in the remaining `ControlPanel`, however, behind separate branding and design tabs mixed with checkout, pages, AI and export controls. This makes a simple task such as changing the store name, logo or theme feel like entering a prototype constructor instead of editing the store profile.

The existing file controls are also dishonest at the persistence boundary. They read logo, hero and about images into browser `data:` URLs, while the server workspace contract accepts HTTPS URLs only. A merchant can therefore see a local preview that the server correctly refuses to save. Product media already has secure managed upload semantics, but those records are product-owned and cannot safely be reused as store appearance assets.

## Decision

### Product boundary

- The existing-store design route becomes a focused store profile and appearance editor.
- The editor owns identity, contact/currency presentation, template, typography, colors and hero presentation. It uses small internal sections instead of exposing unrelated product, checkout, page, AI or export tabs.
- Draft onboarding remains usable, but local file upload is never simulated. Before a tenant workspace exists, the merchant can use an icon, a provided preset or an HTTPS URL and is told that managed file upload becomes available after store preparation.
- Checkout and content pages remain separate route tasks for later work packages. This WP does not redesign their server contracts.

### Persistence authority

- `StoreWorkspaceService` and its workspace/catalog revisions remain the only authority that binds appearance configuration to a store. Uploading a file creates an unbound asset; the asset becomes visible publicly only after a successful revisioned workspace save references it.
- The browser never claims that an uploaded image changed the store before the workspace save succeeds.
- A failed or conflicted workspace save retains the local reference and dirty state for explicit retry/recovery.

### Managed store assets

- A tenant migration creates `store_assets` with UUID identity, managed disk/path provenance, MIME, byte size, checksum, uploader, idempotency key, `state` (`staging`, `ready`, `cleanup`), `orphaned_at` and cleanup timestamps. Database checks bind state to the required metadata; partial unique indexes protect `(uploaded_by_user_id, upload_idempotency_key)` and `(disk, path)`.
- Upload is central-domain, authenticated, CSRF-protected, throttled, requires an active exact tenant membership and `tenant.store.manage`, and is available only for a ready tenant workspace.
- Validation is server-side: JPEG/PNG/WebP only, at most 5 MiB and 25 million decoded pixels. Each tenant may retain at most 20 managed store assets and 50 MiB across every non-deleted row, including `cleanup` tombstones; the limit is checked under tenant-schema serialization and returns `store_asset_quota_exceeded`. Exact actor/key/checksum replay is resolved before the quota check so a safe retry remains possible at the limit.
- Upload first commits a `staging` row with its deterministic platform-owned path and checksum, then writes the file, then changes the locked row to `ready`. A retry of the same actor/key/checksum completes or replays the staging row; a different checksum returns `store_asset_idempotency_conflict`. Thus a crash can leave a recoverable row, never an untracked file.
- The canonical stored value is a root-relative URL `/api/store-assets/{tenant}/{asset}`. Only `logoUrl` and `heroBannerImage` accept that exact same-tenant managed form for an existing workspace. `aboutImage` and all provisioning/draft validation remain HTTPS-only. The `/api/store-assets/` path namespace is reserved: any absolute HTTPS URL with that path prefix is rejected regardless of host, including central, same-tenant and cross-tenant hosts. Scheme-relative, cross-tenant, malformed and `data:`/`blob:` values remain rejected.
- `UpdateStoreWorkspaceRequest` performs contextual syntax/tenant validation without changing the shared provisioning contract. Syntax or cross-tenant input returns 422 with `workspace_asset_path_invalid`; an unknown, staging, cleanup or non-owned same-tenant asset returns 409 `workspace_asset_unavailable` after the service locks and resolves it.
- A managed path must resolve to a platform-owned asset row for the same tenant before a workspace write commits.
- Central preview serves an asset only to an authenticated user with active membership and `tenant.store.manage`. A tenant host serves it only when runtime/publication readiness passes and the asset path is referenced by the current public workspace configuration.
- Serving checks the configured disk, tenant path prefix and traversal invariants and returns `nosniff`; it never falls back to a public filesystem path.
- A newly ready upload starts with `orphaned_at = created_at`. A successful workspace save clears `orphaned_at` for referenced assets and sets it to the current database time for assets detached by that save, granting a fresh recovery window. Unbound assets are retained for 24 hours, then removed by an idempotent cleanup command. Cleanup is allowed for suspended but provisioned tenants and uses `cleanup` as a tombstone so file/row convergence is recoverable.

### Concurrency and isolation

- Central lock order is tenant then membership; tenant-schema operations run only after authorization and readiness under that order.
- Within a tenant-schema transaction, both workspace save and cleanup lock the singleton current `store_configs` row first and then relevant `store_assets` rows in ascending UUID order. Save rejects any referenced row not `ready` or already marked for cleanup. Cleanup re-derives references from the locked current config before marking an asset `cleanup`, deletes the file outside the transaction, then reacquires config-first/asset-second locks and rechecks non-reference before deleting the row.
- A true two-connection concurrency gate covers bind versus cleanup. Whichever locks the config first wins deterministically: a committed bind preserves the asset, while a cleanup tombstone makes the save fail closed without storing a broken reference.
- Upload results are accepted by the editor only for the same account, tenant, asset slot and operation generation. Account/store switches, slot replacement, workspace reload and unmount invalidate late results.
- Asset upload does not increment workspace revision. The subsequent workspace save is the serialization point, preserving the existing 409 recovery contract.

### Serving, readiness and deployment

- The serving route accepts only a configured central host or an exact registered domain owned by the route tenant; unknown hosts, a domain owned by another tenant and central/tenant identity mismatches return 404. Tenant delivery runs inside that exact tenant context and always restores the central connection in `finally`.
- Central preview requires an authenticated active membership plus `tenant.store.manage` and returns `Cache-Control: private, no-store`. Public delivery requires exact-host runtime/publication readiness and current-workspace reference and returns `Cache-Control: no-store` so unpublish or unreference takes effect on the next request. Both paths set `X-Content-Type-Options: nosniff`.
- `TenantWorkspaceReadiness` and provisioning verification include the `store_assets` table and required columns. Deployment order is tenant fleet migration first, readiness preflight second, then application activation; an old schema fails closed rather than serving from another context. New provisioning runs all tenant migrations before workspace initialization.
- The migration is exercised on empty and populated tenant schemas with rollback refusal and reapply. It contains no legacy asset adoption because existing persisted workspace images are HTTPS-only; legacy browser `data:`/`blob:` values are scrubbed from local drafts and never sent to the server.

### Existing store versus onboarding behavior

- Provisioning and draft validators remain HTTPS-only and cannot reference a tenant asset that does not yet exist. Managed upload controls are shown only for a ready existing tenant; onboarding explains this boundary and retains icon, preset and HTTPS choices.
- Currency remains editable during onboarding. In an existing store profile it is displayed read-only, because the authoritative catalog rejects changes once priced products exist with `catalog_currency_locked`; this WP does not misrepresent that catalog rule as a profile preference.

## Consequences

- Merchants receive a truthful store-profile task rather than a collection of unrelated builder tabs.
- Store logos and hero images can be uploaded without external hosting while remaining tenant-isolated and publication-aware.
- Uploads abandoned before save consume temporary storage only until cleanup.
- Checkout and page extraction remain visible debt; this decision intentionally avoids a second config writer or a broad builder rewrite.

## Rejected alternatives

- Reuse unattached `product_media`: rejected because its authorization, public visibility and cleanup semantics are product-specific.
- Store base64 in `store_configs`: rejected because it inflates PostgreSQL rows, bypasses media validation and makes caching/serving unsafe.
- Add a separate appearance PATCH endpoint: rejected because it would compete with the revisioned workspace aggregate and reintroduce lost updates.
- Keep the current browser-only file preview: rejected because it promises persistence the server intentionally forbids.

## Rollback

The focused editor can be reverted without changing workspace data. The tenant migration refuses to drop `store_assets` while rows exist; operational rollback must first prove no referenced or retained managed assets remain, or keep the table and disable new uploads.
