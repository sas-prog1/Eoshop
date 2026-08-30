# ADR 0039 — Server-owned storefront marketing blocks

## Status

Accepted for WP 5.27.2A on 2026-08-31.

## Context

WP 5.27.1 established one public storefront renderer and a server-authoritative purchase journey. The approved Tech Bento direction adds five hero tiles, two side advertisements and up to ten discovery items, with independent desktop/mobile media, links, advertising disclosure and optional schedules. Keeping these values in browser-only state would allow stale or cross-tenant assets, unpublished catalog targets and hidden advertising metadata to reach the public storefront.

The existing revisioned `StoreConfig` aggregate and managed store-asset lifecycle already provide the correct ownership and concurrency boundary. The new presentation must extend that boundary rather than create a second content store, endpoint or database table.

## Decision

1. `StoreConfig` is extended with a closed, optional `marketingBlocks` list and typed hero mobile/target/focal-point fields. No new endpoint, table, migration or client-side authority is introduced.
2. Each marketing block has a UUID identity, one of three placements (`hero_bento`, `side_ad`, `discovery`), a contiguous one-based position, enabled state, bounded copy, managed desktop/mobile image paths, optional palette/overlay/focal-point values, typed destination, disclosure and optional UTC schedule.
3. Placement limits are five hero tiles, two side advertisements and ten discovery items; the aggregate maximum is seventeen. Positions are unique and contiguous inside each placement.
4. Marketing images must be exact same-tenant managed-asset paths. Product/category targets are validated against the submitted non-archived catalog. External HTTPS destinations are allowed only for campaigns and require an advertising disclosure plus sponsor name.
5. The server remains the public projection authority. It removes disabled, not-yet-started, expired and unpublished catalog-target blocks. An invalid stored contract fails closed. A legacy workspace without this contract projects an empty list.
6. Once a workspace stores the contract, an older client may not silently omit or erase it. Missing `marketingBlocks` then returns `workspace_marketing_blocks_required`; malformed stored or submitted contracts return the corresponding typed conflict/validation code.
7. Provisioning ignores any centrally supplied marketing-block draft and starts the tenant workspace with an empty list. This prevents a central draft from becoming tenant content without an explicit tenant save.
8. The existing revision lock remains the serialization point. A semantic no-op does not increment the workspace revision.
9. Managed assets remain capped at 5 MiB per upload, while the default tenant allowance becomes 64 retained assets and 75 MiB. Placement budgets are enforced when the workspace binds an asset: hero 2 MiB/1 MiB mobile, hero tile 750/500 KiB, side advertisement 1024/600 KiB and discovery 350/350 KiB. Reusing an asset is allowed, but it must satisfy the strictest placement that references it.
10. Frontend parsing is strict and defensive, but Laravel is the final authority for tenancy, catalog targets, schedules, asset ownership, quotas and public projection.

## Consequences

- Tech Bento and the later merchant editor can share one typed contract without duplicating the storefront renderer or purchase logic.
- Marketing surfaces can be scheduled and sponsored without publishing misleading or undisclosed destinations.
- The higher asset-count default supports the bounded seventeen-block composition; byte and placement budgets keep the total media cost controlled.
- Existing stores remain compatible because absence means an empty list until the first explicit save.
- ADR 0020 remains authoritative for the managed-asset lifecycle. Its original 20-asset/50-MiB defaults are superseded only by the 64-asset/75-MiB defaults in this decision; upload, isolation, binding, serving and cleanup semantics are unchanged.

## Rejected alternatives

- Store the tiles in React/local storage: rejected because it bypasses revisions, tenancy and public projection.
- Create separate campaign tables and endpoints for the first release: rejected because the bounded blocks are configuration, not an analytics or bidding system.
- Accept arbitrary image URLs: rejected because they cannot be ownership-checked or protected by the asset lifecycle.
- Let the frontend hide expired or unpublished blocks: rejected because public truth must not depend on a particular client version.
- Add `editorial_story` or `featuredProductIds` now: rejected until a concrete second-template contract proves they are needed.

## Verification

- Prove closed validation, placement limits, contiguous positions, safe targets, UTC scheduling and same-tenant managed paths.
- Prove write round-trip, semantic no-op, old-client deletion protection and legacy empty projection.
- Prove public projection removes disabled, scheduled-out and unpublished-target blocks.
- Prove per-placement byte budgets and strictest-budget reuse.
- Re-run frontend, backend, repository and PostgreSQL integration gates without migration or API regressions.

## Rollback

The code can be reverted without a database rollback because the contract lives in the existing JSON workspace aggregate. A rollback client must preserve unknown `marketingBlocks` to avoid intentional old-client deletion protection; otherwise rollback should first clear the blocks through the current revisioned writer.
