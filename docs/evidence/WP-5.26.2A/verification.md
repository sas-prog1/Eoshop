# WP 5.26.2A — Verification evidence

## Result

The shared platform identity contract, premium authentication shell and retained Pilot rollout are verified. Delivery remains intentionally open until the protected pull request passes all four required CI checks and is merged.

## Backend and database

- `composer check` passed in the backend quality image:
  - Laravel Pint: 295 files.
  - PHPStan: no errors.
  - Non-database PHPUnit: 3 tests and 6 assertions.
- The isolated PostgreSQL integration gate passed with 170 tests and 1,910 assertions.
- The integration gate covered the new visual-identity defaults, canonical update projection, closed validation, audit transaction, optimistic concurrency, authorization, database constraints and guarded rollback.
- The retained central PostgreSQL volume was migrated in place. Migration `2026_08_28_000015_add_platform_visual_identity` completed successfully; no database or tenant volume was replaced.
- Local `composer audit` could not reach Packagist because of a network timeout (`curl error 28`). Dependency audit therefore remains a mandatory CI result before merge; it is not waived.

## Frontend

- The identity-focused isolated run passed 5 of 5 tests:
  - `PlatformSettingsApplication.test.tsx`
  - `AuthRoutePage.test.tsx`
- The previously timing-sensitive files passed in isolated Docker processes:
  - Platform users: 9 of 9.
  - Public storefront accessibility: 10 of 10.
  - Checkout flows: 6 of 6.
- A complete single-worker Docker run passed 326 of 332 tests. The six incomplete cases were four timeouts under sustained container load and two cross-file browser-global-state contaminations. Every affected case passed in the isolated runs above, including the new server-owned identity assertion.
- TypeScript and the Vite production build passed: 2,159 modules transformed.
- The production build still reports the existing large-chunk warning at approximately 972.68 kB before gzip. Code splitting remains a separate performance package and is not disguised as an identity defect.

## Repository invariants

- `scripts/ci/repository-gate.ps1`: passed.
- `git diff --check`: passed.
- The public settings DTO remains closed and typed; no arbitrary CSS, font URL, HTML or tenant theme value is accepted.

## Retained Pilot

- Backend image: `eoshop/backend:wp5262a-pilot`.
- Web image: `eoshop/web:wp5262a-pilot`.
- Only backend, worker, scheduler and web services were recreated; the database service and retained volumes were preserved.
- Central HTTP verification on port 8010:

| Route | Result |
|---|---|
| `/up` | 200 |
| `/` | 200 |
| `/login` | 200 |
| `/register` | 200 |
| `/forgot-password` | 200 |
| `/api/platform-settings` | 200 |

- The public projection returned the deterministic identity defaults: primary `#081725`, accent `#B18A46`, surface `#F8F6F1`, font `Tajawal`, and null optional image URLs with bundled-image fallback.

## Rollback evidence

The previous backend and web image tags remain the runtime rollback boundary. The migration rollback refuses to drop the six columns after any operator-owned identity value differs from its deterministic default.

## Delivery record

Implementation commit, pull request, four CI results and protected merge SHA will be added only after those events exist.
