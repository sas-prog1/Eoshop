# ADR 0040 — Elegant editorial stories and discovery images

## Status

Accepted for WP 5.27.2B on 2026-08-31. The shared WP 5.27.2A/T1 contract is merged at `b7ed06b4a5f67871216696ae1d1342192dd11370`, and the Elegant implementation extends that contract without a parallel writer or API.

## Context

WP 5.27.1 delivered one server-authoritative public storefront and the complete published-product-to-order journey. The approved second visual direction is not a recolored product grid: it is an editorial storefront led by a season title, five independently managed portrait stories and a compact rail of image-led editorial discoveries.

WP 5.27.2A is expected to establish the shared `marketingBlocks` contract, managed desktop/mobile campaign assets, typed targets, disclosure, scheduling, preview parity and mixed-version protection. Recreating those capabilities for Elegant would produce a second CMS and competing save authority. Conversely, flattening the approved composition into one Hero image would make the five stories inaccessible, uneditable and unusable on mobile.

The decision is therefore limited to how `themeStyle=elegant` composes the shared campaign contract. The image squares below the stories are editorial discovery links, not product cards: they never show price, stock or add-to-cart actions.

## Decision

1. The approved design replaces the visual composition of the existing `elegant` theme. It does not add a third theme value and does not change `tech`.
2. Elegant reuses the approved WP 5.27.2A `StorefrontMarketingBlock` contract and editor. It adds exactly one reviewed placement, `editorial_story`, with at most five blocks. No stories table, editor endpoint or browser-owned state is introduced.
3. Every story is an independent block with managed desktop/mobile image, alt text, bounded text, CTA, typed target, colors/crop/overlay, disclosure and optional schedule. The design reference is never shipped as a flattened page image.
4. Visual prominence is derived from count and order. CSS may emphasize the logical center story on wide screens, but no merchant-supplied coordinates, widths, transforms, class names or free layout JSON are stored.
5. Elegant reuses the existing `discovery` placement for the square image rail below the story stage. Every square is an independently managed marketing block and opens its typed target.
6. Discovery squares never render price, stock, discount, rating or add-to-cart controls. A `contentType=product` block may navigate to a real product, but it remains an editorial creative rather than a product snapshot.
7. Public projection, schedule, target validity, disclosure and asset ownership come unchanged from the shared T1 contract. No Elegant-specific product-selection field is introduced.
8. Hero badge/title/subtitle and optional button remain the source of the editorial introduction. `heroBannerImage` is retained across theme switching and acts only as a legacy/fallback Hero when there are no active editorial stories; it is not silently copied into a story.
9. `homeSections` remains the semantic section authority. `hero` owns the editorial introduction and story stage; `categories` owns the editorial discovery rail; `featured_products`, `trust` and `about` keep their existing meanings lower in the page. Hidden sections cannot leak their content elsewhere.
10. Header navigation is capability-driven. Search, catalog/category navigation, About and cart use existing routes. Customer account, favorites, blog or badges are not rendered until their actual features and data exist.
11. Public and authenticated preview use the same config, filters and renderer. Theme-specific components remain presentational below shared route, catalog, pricing, inventory, cart, checkout and order state.
12. All public routes receive a coherent Elegant presentation, but no route is forked: home, products, product detail, cart, checkout, receipt, About/contact and footer continue to use the shared commerce handlers and APIs.
13. Theme switching preserves both Tech placements and Elegant stories without deleting hidden-theme content. The customization UI shows only placements relevant to the selected theme and clearly states that other-theme content is retained.
14. The Elegant branch rebased on the approved WP 5.27.2A/T1 contract before modifying shared product files. Contract differences are resolved in this ADR and the work package, not through a competing implementation.

## Contract delta

Relative to the approved shared WP 5.27.2A contract, WP 5.27.2B requests only:

- `placement += editorial_story`, maximum five.
- aggregate maximum `17 -> 22`.

All campaign fields, targets, scheduling, disclosure, asset ownership, revision behavior and error semantics come from the shared contract unchanged.

## Consequences

- Elegant and Tech are materially different experiences while sharing one commerce and campaign foundation.
- Merchants can replace and schedule each portrait story and discovery image independently without a deployment.
- Fixed template composition protects responsive behavior, accessibility and visual quality; merchants control content, not arbitrary layout.
- Reusing `discovery` avoids a second image contract and avoids misrepresenting editorial tiles as product cards.
- The renderer and merchant editor can evolve independently by theme while saving through one revisioned aggregate.

## Rejected alternatives

- **One wide Hero image containing all five cards:** rejected because text, CTA, mobile crop, scheduling and accessibility would be inseparable.
- **A second `stories` API/table:** rejected because the content is bounded storefront presentation and must save atomically with the workspace revision.
- **Rendering discovery blocks as product cards:** rejected because it falsely adds price/cart semantics to editorial campaign imagery.
- **A free masonry/page builder:** rejected because it weakens validation, responsive guarantees, CSP and preview parity.
- **Rendering every icon and route from the visual reference:** rejected because favorites, customer accounts and a blog are not present capabilities.
- **Implementing against an assumed WP 5.27.2A schema:** rejected because it creates contract drift and a high-conflict merge.

## Required verification

- Shared contract conformance after rebase and no duplicate campaign writer/editor.
- Closed validation and mixed-version protection for `editorial_story`; `discovery` conformance remains covered by T1.
- Tenant isolation for every story image and public filtering for schedule/target state.
- Discovery order, empty state, schedule and unpublished target filtering.
- Exact preview/public parity and preservation across `elegant`/`tech` switching.
- All storefront routes retain the same server-authoritative price, stock, cart, checkout and order paths.
- Desktop, tablet, mobile, keyboard, reduced-motion, contrast and image-transfer acceptance.
- Elegant and Tech regression on one final immutable SHA.
