# WP 5.8 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.8 — Store profile, appearance and managed assets |
| Status | Complete and merged |
| Verified | 2026-08-20 |
| Branch | `codex/wp-5.8-store-profile` |
| Base | `2c769fca8c59246eb64e15b179484c40da29f752` |
| Implementation commit | `701e31c1f8ff936a160cd851959b11512c24102f` |

## Delivered product boundary

- Replaced the existing-store branding/design portion of the prototype builder with one focused, typed store-profile and appearance editor.
- Preserved `App` as the owner of workspace revision, dirty state, save, reload and conflict recovery; the extracted editor is not a second writer.
- Added tenant-isolated managed logo and hero uploads with bounded image validation, idempotency, explicit staging/ready/cleanup states and recoverable cleanup.
- Added exact same-tenant asset provenance checks when binding an asset to the workspace and fail-closed public/preview serving boundaries.
- Kept draft and provisioning configuration HTTPS-only and removed browser `data:` persistence claims; managed root-relative paths become valid only for a ready existing tenant.
- Kept currency read-only for an existing store profile while preserving the existing onboarding/catalog contract.

## Independent review

- The independent review challenged path canonicalization, partial-schema readiness and staging-row recovery.
- Reserved asset paths now reject repeated percent encoding, duplicate slashes and dot-segment traversal after canonicalization.
- Runtime/provisioning readiness now requires the full `store_assets` column contract, and staging rows must carry an orphan timestamp while cleanup tombstones retain both cleanup timestamps.
- The review also verified tenant isolation, exact idempotent replay, quotas, config-first locking, serving boundaries, rollback refusal, stale-upload guards and the focused design experience.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Frontend quality gate

Environment: exact WP 5.8 frontend quality/build image.

- TypeScript check: PASS.
- Vitest: **31 files / 176 tests passed**.
- Vite production build: PASS; **2,125 modules transformed**.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- Covered identity, theme, typography, colors and hero editing; managed logo/hero upload; account/tenant/slot/generation stale-result guards; failed save and 409 recovery; and preservation of storefront, product, inventory, order and onboarding journeys.

## Backend quality gate

Environment: exact WP 5.8 PHP 8.4 backend quality image.

- Composer validation and locked dependency audit: PASS; no vulnerability advisories.
- Laravel Pint: **214 files passed**.
- Larastan: **183 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- GitHub Actions workflow lint: PASS.
- `git diff --check`: PASS.
- PostgreSQL/container integration: **112 tests / 1,145 assertions passed**.
- Covered clean central/tenant migrations, legacy tenant adoption, populated rollback refusal/reapply, full-schema readiness, route cache, exact Host boundaries, asset upload/replay/quota/ownership, binding and cleanup concurrency, public/preview visibility, worker and scheduler.
- Final integration project `eoshop-wp58-final2`, its containers, network and volumes were removed after the successful run; the local Pilot stack on port 8010 was not touched.

## Product handoff and retained debt

- Merchants now have a coherent existing-store profile and appearance task with real managed logo/hero persistence.
- Checkout/payment settings and content pages remain in the retained builder and require later focused extraction; WP 5.8 deliberately created no competing writer for them.
- Platform administration, team/profile management and customer-facing storefront redesign remain separate product work.
- Image transformations, antivirus scanning, object storage/CDN and external custom-domain automation remain production/infrastructure debt.
- The frontend production bundle still requires route-level code splitting during performance hardening.

## Delivery status

- Implementation is recorded separately in `701e31c1f8ff936a160cd851959b11512c24102f`.
- Evidence is recorded separately in `e5ebaac4f23c37e69eda754682620af1d323e3ee`.
- Pull request [#40](https://github.com/sas-prog1/Eoshop/pull/40) was merged from final head `e5ebaac4f23c37e69eda754682620af1d323e3ee`.
- Pull-request CI run [32404863504](https://github.com/sas-prog1/Eoshop/actions/runs/32404863504) passed all four required jobs: Repository safety, Backend quality, Frontend quality and Container integration.
- Merge commit: `4e004b31ddc178d6f835914f1a57f4a91f738bd3`.
- Protected-main CI run [32405399804](https://github.com/sas-prog1/Eoshop/actions/runs/32405399804) passed the same four required jobs after merge.
