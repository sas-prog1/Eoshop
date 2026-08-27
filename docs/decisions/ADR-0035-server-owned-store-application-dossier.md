# ADR 0035 — Server-owned store application dossier

## Status

Accepted for WP 5.23 on 2026-08-27.

## Context

The guided onboarding flow already persisted a server draft, but its last step moved directly from handle and plan selection to submission. The platform could only accept or reject a store, evidence was absent and a merchant had no durable list of review events or targeted corrections. Treating final rejection as the correction path also made the lifecycle ambiguous.

## Decision

1. Every new store submission is backed by its existing central `store_draft`; direct payload-only submission is no longer an accepted production path.
2. The server derives a bounded evidence requirement catalog from the draft business type. The browser cannot declare which requirements exist.
3. Evidence files are stored on a private disk. The central database records ownership, requirement, resolution, MIME type, byte size, checksum and upload idempotency key.
4. Evidence access always reauthorizes the current actor against the owning draft or tenant. A download is never exposed by a public storage URL.
5. Submission is permitted only when the locked draft is at the review stage, the submitted payload matches it and every current requirement is resolved.
6. The submission snapshot contains evidence metadata and checksums, not file contents or public links.
7. `changes_requested` is a first-class verification state distinct from final `rejected`. A correction request contains an allow-listed set of fields, a reason and the draft revision at which it was requested.
8. Resubmission requires a later draft revision, current requirement readiness and renewed document evidence when a requested document was rejected.
9. A public-safe application timeline is append-only. Detailed audit records remain a separate privileged platform record.
10. Legacy tenants without a store draft remain administrable; the dossier projection is `null` and decision-event recording is skipped for those records.

## Consequences

- Merchants see a concrete checklist before submission and can resume incomplete evidence work.
- Platform decisions no longer collapse correction and terminal rejection into one state.
- Correction is bounded, explainable and auditable without restarting onboarding.
- Private documents remain central-platform records and do not enter tenant schemas or storefront payloads.
- WP 5.24 can build a professional platform review workspace on a stable dossier contract instead of another browser-owned form.
- External verification, malware scanning, production object storage and retention policy remain required production follow-ups.
