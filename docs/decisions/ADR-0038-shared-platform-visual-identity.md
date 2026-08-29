# ADR 0038 — Shared platform visual identity contract

## Status

Accepted for WP 5.26.2A on 2026-08-28.

## Context

WP 5.12 established one revisioned, audited and permission-owned platform settings singleton. It applies the platform name, logo and one operational accent colour across central surfaces. WP 5.26.1 introduced an approved premium landing direction, while the routed authentication page still uses a compiled gradient, icon and focus palette. Styling those surfaces independently would make later operator changes inconsistent and would create repeated implementation work.

This is a platform identity boundary. Tenant storefront appearance remains tenant-owned and must never inherit platform marketing colours, images or fonts.

## Decision

1. The existing central `platform_settings` singleton remains the only identity authority. No browser storage, second settings record or free-form theme JSON is introduced.
2. The singleton is extended with six bounded presentation fields: `brandPrimaryColor`, `brandAccentColor`, `brandSurfaceColor`, `brandFontFamily`, optional `landingHeroImageUrl` and optional `authImageUrl`.
3. All colours are uppercase `#RRGGBB`. The allowed fonts are exactly `Cairo`, `Tajawal` and `IBM Plex Sans Arabic`, which are already shipped by the application stylesheet. No arbitrary font URL, CSS value, class name, HTML or script is accepted.
4. Image fields use the same canonical external-HTTPS safety policy as the existing platform logo. They reject credentials, fragments, controls, backslashes and current or reserved managed-asset API paths. Managed platform upload remains a later additive capability.
5. The authentication image resolves in this order: safe `authImageUrl`, safe `landingHeroImageUrl`, then the bundled approved landing image. This gives a coherent default while allowing a later dedicated authentication composition.
6. `PlatformSettingsProvider` projects the palette and font through platform-scoped CSS variables and readable foreground variables. Landing and authentication consume the same projection. Tenant storefronts continue to consume only their tenant workspace appearance.
7. Existing `primaryColor` remains the bounded operational accent used by current compact platform shells during migration. The new brand palette owns the premium public and authentication composition; it does not silently reinterpret or overwrite an operator's existing value.
8. The update contract remains closed and complete. A real change uses the existing revision lock, actor recheck and audit transaction. Stale writes, unsafe images, unsupported fonts/fields and malformed colours fail without mutation.
9. This package establishes the server/frontend contract and shared authentication consumption. The expanded `/admin/settings` editing and dual landing/auth preview are delivered in the next focused package on top of these fields.

## Defaults

- Brand primary: `#081725`
- Brand accent: `#B18A46`
- Brand surface: `#F8F6F1`
- Brand font: `Tajawal`
- Landing hero image URL: `null` (bundled approved image fallback)
- Authentication image URL: `null` (landing image fallback)

## Consequences

- The public platform and authentication journey share one server-owned identity without coupling to tenant themes.
- Operator-controlled values remain typed, revisioned, authorized and audited.
- The approved visual composition survives the migration because the new fields default to its current palette and bundled image.
- A future managed platform-asset endpoint can replace external image URLs without changing component ownership or the public DTO shape.

## Rejected alternatives

- Re-style authentication with new hardcoded colours: rejected because it would require another rewrite when administration controls are added.
- Reuse tenant store appearance: rejected because it crosses the multi-tenant ownership boundary.
- Accept arbitrary CSS or font URLs: rejected because it weakens validation, CSP planning and accessibility guarantees.
- Overwrite the existing operational `primaryColor`: rejected because an operator may already have intentionally changed it.

## Verification

- Prove migration defaults, constraints, public/admin projection, closed validation, audit and optimistic concurrency.
- Prove unsafe image URLs and unsupported fonts/colours fail closed.
- Prove provider CSS variables update from the public projection and revert to safe defaults after a failed load.
- Prove login, registration, forgot-password and reset routes use the shared identity while preserving their current security and navigation behavior.
- Prove tenant storefront appearance remains independent.
