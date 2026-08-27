# WP 5.26.1 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.26.1 — Premium platform landing |
| Status | Complete — verified, merged and deployed to retained Pilot |
| Branch | `codex/wp5-26-1a-premium-landing-hero` |
| Base | `ba511fd` |

## Implemented result

- The central landing now has a premium photographic hero, restrained platform identity and explicit registration/login actions.
- Merchant journey, capabilities, templates and server pricing are separated into focused presentation components.
- Template cards use the canonical onboarding template catalog; their final visual differentiation is deliberately deferred.
- Pricing displays the active public plan projection and never invents electronic payment or priority-review behavior.
- The closing FAQ describes the current draft, review, provisioning and publication lifecycle.
- The final CTA and footer use real routes, visible navigation and only configured support channels.
- Landing components use presentation projections and do not import service-layer contracts directly.

## Local gates

- Production frontend build passed: TypeScript `--noEmit` and Vite production compilation.
- Focused landing/platform-settings/UI-boundary gate passed: `3 files / 6 tests`.
- Complete frontend regression passed: `63 files / 330 tests`.
- `git diff --check` passed.
- The existing production bundle-size warning remains visible (`~968 kB` JavaScript before gzip) and is deferred to the performance work; it is not hidden by changing the warning threshold.

## Retained Pilot

- Web image: `eoshop/web:wp5261f-pilot`.
- Only `eoshop-pilot-web-1` was recreated.
- Backend, worker and scheduler remain on `eoshop/backend:wp525-pilot-final`; the retained PostgreSQL container and volume were preserved.
- All five retained Pilot services reported running; web, backend and database reported healthy.
- `http://127.0.0.1:8010/` returned HTTP `200`.
- Served asset `/assets/index-BuUAOo6W.js` contains `أسئلة واضحة عن إنشاء متجرك` and `حوّل نشاطك إلى متجر تستطيع إدارته ومشاركته`.

## Protected delivery

- Implementation commit: `78dab0469d1d792de58f1d51c372c5d8aea44eeb`.
- Protected pull request: [PR #76](https://github.com/sas-prog1/Eoshop/pull/76).
- Required CI: [run 33120459329](https://github.com/sas-prog1/Eoshop/actions/runs/33120459329).
- All four required checks passed: Repository safety, Frontend quality, Backend quality and Container integration.
- Squash merge to protected `main`: `0b8140106001efafe083ad3c642f49f34df2d50b` at `2026-08-27T22:04:06Z`.
