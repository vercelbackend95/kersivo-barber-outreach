# KERSIVO Shop Hub Spec v1

**Batch 0 provenance (31 October 2026):** the Batch 0 prompt required this file to be the exact contents of the attached `KERSIVO_Shop_Hub_Spec_v1.md`. That file was **not present** in:

- this git workspace
- this chat’s tool-visible attachments
- `C:\Users\Ja\Downloads`, Desktop or Documents (searched by `*Shop_Hub*`, `*HUB_SPEC*`, `*preview-hub*`)

A ChatGPT canvas titled “Kersivo shop hub cursor batches - MD” holds the batch prompts, not the product spec. A ChatGPT conversation titled “Hub i formularz preview” is the likely home of the missing document.

**Do not implement later batches against this placeholder.** Replace this file with the exact spec before Batch 1.

---

## Received from the Batch 0 prompt (GLOBAL RULES only)

The following is the only spec-adjacent text that arrived with Batch 0. Section numbers cited by later batches (§2 `liveAt`, §9 copy, Batch 6 pin mode) are **not** in this file until the source spec is supplied.

### Global rules — KERSIVO Shop Hub

1. Read `docs/preview-hub/HUB_SPEC.md` and `docs/preview-hub/BATCH_0_FINDINGS.md` before writing code. Follow them exactly.
2. Everything new is behind the server-side flag `PREVIEW_HUB_ENABLED` (env, default off; helper `isPreviewHubEnabled()` in `src/lib/freePreview/config.ts`). With the flag off, production behaviour must be byte-for-byte the same as today for owners (pages, emails, APIs). Add a test that proves the flag-off path is unchanged where practical.
3. Reuse before you build: existing token resolution (`src/lib/freePreview/previewAccess.ts`), rate limiting (`enforceIpRateLimit` + rate configs in `src/lib/freePreview/previewApi.ts`), operator auth (`resolveOperatorAccess`), private blob helpers (`src/lib/storage/privateOnboardingBlob.ts`), email outbox/Resend path, `PreviewRequestEvent` logging, `FUNNEL_EVENTS` + `sendServerAnalyticsEvent`, design tokens and components (`tokens.css`, buttons, inputs, badge, `ks-glass-card`, `admin-theme-premium-black`), `WeeklyHoursEditor`.
4. Prisma changes are additive only (new models/columns/enums, nullable or defaulted). One migration per batch, named `2026xxxx_preview_hub_<batch>`. Never drop or rename existing columns.
5. All user-facing copy is British English and comes from one copy module: `src/lib/freePreview/hubCopy.ts` (create in Batch 1). Use the exact strings in HUB_SPEC.md §9; if you need a new string, add it there and list it in your report. No new claims: no response-time promises to prospects, no guaranteed dates, turnaround only from config constants. `npm run claims:check` must pass.
6. Security defaults on every hub page and hub API: `X-Robots-Tag: noindex, nofollow`; `Referrer-Policy: no-referrer`; `Cache-Control: private, no-store` (asset GET may use `private, max-age=300`); same-origin check on non-GET; zod validation; never log full tokens (first 6 chars only); `REJECTED` and unknown tokens return 404 indistinguishably.
7. Every state-changing action writes a `PreviewRequestEvent` (action names prefixed `hub_` or `ops_hub_`).
8. Every interactive surface has designed loading (skeleton), empty, error (with retry) and success states. WCAG 2.2 AA. Test at 360, 390, 768, 1280 px. No horizontal scroll. Respect `prefers-reduced-motion`.
9. Tests: vitest unit tests for every lib function and API route (happy path, auth/stage denial, validation failure, rate limit where relevant). Component tests for key UI states. Existing tests must stay green: `npm test`, `npm run typecheck`, `npm run claims:check`, `npm run build`.
10. Don't touch marketing pages, SEO metadata, sitemap or robots unless the batch says so.
11. Finish with a report in `docs/preview-hub/reports/BATCH_<n>_REPORT.md`: what changed (files), migrations, new env vars, screenshots (360px and 1280px) of every new/changed screen saved under `docs/preview-hub/screens/batch-<n>/`, test results, anything you could not do, open questions. Do not mark the batch done if any acceptance item fails.

### Fragments implied by Batch 0 questions (not the spec)

- **§2** may add `PreviewRequest.liveAt` if no existing “public website/domain is published” field exists.
- **§9** is the copy module source (exact British English strings). The strings themselves were not supplied.
- **Batch 6 pin mode** depends on whether `sitePreviewUrl` is a site KERSIVO controls in this repo (so a preview-only feedback script could be added) or an external/manual build.
