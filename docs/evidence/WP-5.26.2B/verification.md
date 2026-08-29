# WP 5.26.2B verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.26.2B — Platform identity editor and dual preview |
| Status | Complete and merged |
| Verified | 2026-08-29 |
| Branch | `codex/wp5-26-2b-platform-identity-editor` |
| Base | Protected `main` at `96de04ce54eafefbb2b9847d3a981bc7974eebc2` |

## Delivered boundary

- `/admin/settings` now exposes the existing server-owned visual identity fields without adding a second theme record or endpoint.
- An authorized platform administrator can edit three bounded brand colours, one curated Arabic font, and safe landing/authentication image URLs.
- The editor provides separate bounded previews for the platform landing page and authentication shell before one explicit save.
- The existing revisioned save, conflict recovery, authorization, audit and dirty-navigation guard remain the mutation boundary.
- Unsafe image URLs and malformed colour values are blocked before mutation and never rendered in the preview.
- Tenant storefront identity remains tenant-owned and is not read or changed by this package.

## Local verification

- Locked Linux TypeScript and Vite production build: PASS; 2,160 modules transformed.
- Production bundle: CSS 123.92 kB; JavaScript 981.22 kB (259.04 kB gzip).
- Vite emitted the existing large-chunk advisory; the package adds no new runtime dependency and code splitting remains a separate optimization package.
- Focused editor regression: PASS; 6 tests, including complete revisioned payload, dual preview switching, unsafe URL rejection, conflict handling and dirty-state behavior.
- Cross-surface identity regression: 14 of 15 tests passed in the concurrent Docker run; one pre-existing application test exceeded its 5-second timing budget by 144 ms without an assertion failure.
- Isolated rerun of that application file: PASS; 2 tests in 3.70 seconds.
- Repository safety gate and `git diff --check`: PASS.
- The first PR run correctly rejected a direct service-layer type import from the extracted preview component. The import now crosses the adapter boundary, and the focused architecture plus editor regression passes 8 tests.

## Retained Pilot

- Built `eoshop/web:wp5262b-pilot` from the verified production output.
- Recreated only `eoshop-pilot-web-1`; backend, worker, scheduler, PostgreSQL service and persistent data were preserved.
- Web health: healthy on `127.0.0.1:8010`.
- HTTP acceptance: `/up`, `/`, `/login`, `/admin/settings` and `/api/platform-settings` all returned 200.
- Rollback image remains `eoshop/web:wp5262a-pilot`; no schema or backend rollback is required.

## Delivery record

- Implementation commits: `aef2c9c4abd3a6493be98fbcd2c2bb73f86519b0` and boundary correction `4f5ea89736dbb00a79288812e96d8741abd43ed1`.
- Pull request: [#80 — WP 5.26.2B platform identity editor](https://github.com/sas-prog1/Eoshop/pull/80).
- Final required CI run: [33264898412](https://github.com/sas-prog1/Eoshop/actions/runs/33264898412).
  - Repository safety: PASS in 24 seconds.
  - Backend quality: PASS in 48 seconds.
  - Frontend quality: PASS in 1 minute 29 seconds.
  - Container integration: PASS in 4 minutes 57 seconds, including clean migrations and HTTP smoke tests.
- Protected squash merge: `52272223cc7c05c535ec39a1b0af137a18c8008d` on 2026-08-29 at 17:17:19 UTC.
- Remote protected `main` was verified at the same merge commit after delivery.
