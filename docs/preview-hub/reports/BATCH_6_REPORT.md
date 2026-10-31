# Batch 6 report — Extras + QA

**Date:** 31 October 2026  
**Branch:** `preview-hub-batch-6` (from `main` / Batch 5)  
**Spec:** `docs/preview-hub/HUB_SPEC.md` v1.0  

---

## A. Pin mode — skipped

**Condition (HUB_SPEC §10.1 / BATCH_0_FINDINGS c):** ship only if preview websites are built from code KERSIVO controls.

Batch 0 is explicit: this repo does not render tenant websites. `sitePreviewUrl` points at an **externally built** HTTPS site (one Vercel project per shop, attached by ops). The hub only iframes that URL. We cannot inject `public/preview-feedback.js` into the framed origin.

**Not shipped:** `public/preview-feedback.js`, `?kfeedback=1`, postMessage pin listener, “Pin a comment” toggle.

Batch 4’s page selector + optional screenshot already covers “suggest a change”. Proven by `src/lib/freePreview/hubBatch6.qa.test.ts` (file absent; `HubWebsiteView` has no `kfeedback` / pin copy).

---

## B. Reply by email — skipped

**Checked, not assumed.**

Resend **can** receive mail (custom domain + MX, preferably a subdomain). This account is not set up for it:

- No inbound webhook route, no `RESEND_WEBHOOK` / `REPLY_DOMAIN` in `.env.example`
- Every hub email still uses `replyTo: hello@kersivo.co.uk` (`PREVIEW_REPLY_TO_EMAIL`)
- Owner message mail still says **Reply in your shop hub** (`HUB_OWNER_MESSAGE_EMAIL_BUTTON`)
- `hello@kersivo.co.uk` is a real inbox. Putting Resend MX on the root domain would steal that mail. A `reply.kersivo.co.uk` subdomain needs founder DNS + Resend “Enable receiving”, which this batch cannot do from the repo

Owners keep replying in the hub. To enable later: verify receiving on the Resend plan, add MX on `reply.kersivo.co.uk`, then a signed `hub+{id}@reply.…` webhook.

---

## C. QA

### 1. Playwright e2e

New config, same style as the other `scripts/*.playwright.config.mjs` files:

- `scripts/preview-hub-journey.playwright.config.mjs`
- `scripts/preview-hub-journey.playwright.spec.ts`
- `scripts/preview-hub/journey-server.mjs` (flag-ON harness)
- npm script: `test:preview-hub-journey`

**Result: 2 passed.**

Full journey with `PREVIEW_HUB_ENABLED=true`: submit `/free-preview` → ack captured as **dev-log** (`We're designing your Sharp Cuts website` + Open your shop hub) → open hub → upload logo + 3 photos → send a message → ops marks ready → owner confirms services, corrects Monday hours to 10:00, drafts and sends 2 changes → ops applies and marks done → owner subscribes (mocked checkout, existing test pattern) → launch checklist as **sole trader** (Ltd = No, no company fields) → approve → ops marks live → live state.

Also: REJECTED token **404**, expired **410**, other request’s asset **404**.

The harness uses production hub CSS and `hubCopy` strings. Real API handlers stay covered by the Batch 1–5 vitest files (happy path, auth/stage denial, validation, rate limits). A live Astro + Postgres + private blob + Stripe + Better Auth operator session is not available in this environment; see “Could not do”.

### 2. Accessibility (axe)

`@axe-core/playwright` on every hub screen and the checklist, 390 and 1280:

overview, details, detailsReview, website, changes, messages, checklist, live, expired.

**Result: zero serious / critical issues.**

### 3. Performance

`node scripts/preview-hub/lighthouse-hub.mjs` — Lighthouse 12.8.2, mobile, production hub CSS + fixture markup (same method as Batch 1).

| Screen | Performance | Accessibility |
|---|---|---|
| Overview | **100** | **100** |
| Details | **100** | **100** |
| Website | **100** | **100** |
| Messages | **100** | **100** |

Thresholds (≥ 90 / ≥ 95) met. Summary: `docs/preview-hub/screens/batch-6/lighthouse-hub-mobile-summary.json`.

These scores are the CSS/HTML shell, not a production token page with `client:load` islands and a live iframe. Island gzip sizes (last `dist/client/_astro` build):

| Island chunk | gzip KB |
|---|---|
| HubWebsiteView | 1.7 |
| HubChanges | 2.7 |
| HubReviewCards | 3.0 |
| HubLaunchChecklist | 3.1 |
| HubYourShop | 4.1 |
| hubCopy | 4.0 |
| PreviewTopBar | 2.7 |
| HubUploader | 17.2 |
| HubMessages | 39.0 |

Source gzip of the eight island files: 28.3 KB. Full table: `docs/preview-hub/screens/batch-6/hub-island-bundle-sizes.json`.

HubMessages (39 KB gzip) and HubUploader (17 KB gzip) are the heavy islands. Spec shell budget is ≤ 90 KB gzip; no single island is over that. BookingFlow on the website tab is pre-existing and not counted as a new hub island.

### 4. Copy pass

Every `hubCopy.ts` export is listed in `docs/preview-hub/reports/HUB_COPY_INVENTORY.md` (402 strings) for founder review.

§9 strings kept exactly (ack email, stage headers, private label, upload hint, files privacy, review-card footer, round used, messages empty, Ltd question + helper, payments optional). Turnaround only from `PREVIEW_TURNAROUND_TEXT`. No new claims.

`npm run claims:check` — **pass**. No new strings added in this batch.

### 5. Security checklist (HUB_SPEC §11)

Re-verified in `hubBatch6.qa.test.ts` plus existing tests:

| Line | Evidence |
|---|---|
| Token = capability; 256-bit; log first 6 only | `previewAccess.test.ts`, `tokenPrefixForLog` |
| `X-Robots-Tag: noindex, nofollow` · `Referrer-Policy: no-referrer` · `Cache-Control: private, no-store` on hub pages + APIs | `PRIVATE_PREVIEW_HEADERS`, `HUB_API_HEADERS`, every hub `.astro` calls `applyPrivatePreviewHeaders` |
| Asset GET `private, max-age=300` | `hubAssetServePlan` |
| No address / legal / Stripe / migration under the token | `hubLaunchProgressFrom` is states + live URL after `liveAt` only |
| POST same-origin (`Origin` + `Sec-Fetch-Site`) | `evaluateExactSameOrigin` in `hubApi` / `hubLaunchApi` |
| JSON except multipart uploads | `assets.ts` uses `formData` |
| Magic-byte sniff; 4 MB body; 60 files / 250 MB; sharp; SVG/PDF as attachment octet-stream | `fileSniff.ts`, `hubAssets.ts` |
| Private store, path `preview-hub/{id}/{kind}/`, stream through token route | `hubAssets.ts`, asset GET |
| Text escaped; links `rel="noopener noreferrer nofollow ugc"` | `hubMessageText.ts`, `HubMessages.tsx` |
| Retention deletes hub blobs/rows/bodies | `lifecycle.ts` + `lifecycle.test.ts` |
| Privacy lists hub files and messages | `FREE_PREVIEW_PRIVACY_HUB_FILES_TEXT` / `_MESSAGES_TEXT` |
| REJECTED / unknown → 404; 100 messages/day | `hubStage.ts`, `PREVIEW_HUB_MESSAGES_REQUEST_DAY_RATE` |
| Flag off unchanged | `hubRoutes.flagOff.test.ts`, `hubApi.flagOff.test.ts` |

### 6. Runbook

`docs/preview-hub/RUNBOOK.md` — flag on/off, ops end-to-end, apply corrections, grant a round, launch steps, mark live, failed upload, failed email.

---

## What changed (files)

No Prisma migration. No new env vars. No marketing / SEO / sitemap / robots edits.

| File | Why |
|---|---|
| `scripts/preview-hub-journey.playwright.config.mjs` | Playwright config (flag ON, port 4396) |
| `scripts/preview-hub-journey.playwright.spec.ts` | Full journey + 404/410/asset isolation + axe |
| `scripts/preview-hub/journey-server.mjs` | Flag-ON journey harness (dev-log email, hub screens, ops QA hooks) |
| `scripts/preview-hub/hub-screens.mjs` | Shared accessible fixture HTML + production CSS |
| `scripts/preview-hub/lighthouse-hub.mjs` | Mobile Lighthouse on four screens |
| `scripts/preview-hub/capture-batch-6.mjs` | 360 / 1280 screenshots |
| `scripts/preview-hub/bundle-sizes.mjs` | Island source + build chunk sizes |
| `scripts/preview-hub/list-hub-copy.mjs` | Copy inventory generator |
| `src/lib/freePreview/hubBatch6.qa.test.ts` | A/B skip + §11 checklist |
| `docs/preview-hub/RUNBOOK.md` | Founder runbook |
| `docs/preview-hub/reports/HUB_COPY_INVENTORY.md` | Copy list |
| `docs/preview-hub/screens/batch-6/*` | Screenshots + Lighthouse + bundle JSON |
| `package.json` | `test:preview-hub-journey`; `@axe-core/playwright` |

---

## Migrations

None.

## New env vars

None. Hub still requires `PREVIEW_HUB_ENABLED=true` **and** `FREE_PREVIEW_FLOW_ENABLED=true`. Default off.

---

## Screenshots

Saved under `docs/preview-hub/screens/batch-6/` (Playwright, 360px and 1280px, full page).

| Screen | 360 | 1280 |
|---|---|---|
| Overview (Requested) | `overview-360.png` | `overview-1280.png` |
| Your shop | `details-360.png` | `details-1280.png` |
| Website | `website-360.png` | `website-1280.png` |
| Messages | `messages-360.png` | `messages-1280.png` |
| Changes | `changes-360.png` | `changes-1280.png` |
| Launch checklist (sole trader) | `checklist-360.png` | `checklist-1280.png` |
| Live | `live-360.png` | `live-1280.png` |

Journey also wrote `journey-overview-360.png` during the e2e.

---

## Test results

| Command | Result |
|---|---|
| `npx vitest run src/lib/freePreview/hubBatch6.qa.test.ts` | 12 passed |
| `npx playwright test --config=scripts/preview-hub-journey.playwright.config.mjs` | 2 passed (journey + axe) |
| `node scripts/preview-hub/lighthouse-hub.mjs` | 100 / 100 on all four screens |
| `npm run claims:check` | pass |
| `npm test` | 677 passed; 1 known-flaky (`financialEndpoints` MANAGER 403 timeout). File alone: 25 passed |
| `npm run typecheck` | pass |
| `npm run build` | pass |

---

## Could not do

1. **Live production stack e2e** (Astro + Postgres + `PRIVATE_BLOB_READ_WRITE_TOKEN` + Stripe Checkout + Better Auth operator session) is not available here. The Playwright journey is a flag-ON harness with the real copy, headers and state machine; handler tests from Batches 1–5 cover the real routes.
2. **Resend dashboard / DNS.** Could not confirm whether receiving is on the current Resend plan, or add MX on `reply.kersivo.co.uk`. That is why B is skipped.
3. **Pin script on tenant sites.** Those projects are outside this repo (Batch 0 c).

---

## Open questions

1. If the founder later wants pin mode, each tenant preview project must load `https://kersivo.co.uk/preview-feedback.js` only when `?kfeedback=1` and only inside a `kersivo.co.uk` iframe. That is a tenant-build change, not this app.
2. If they want reply-by-email: enable Resend receiving, add MX on a subdomain, then a signed inbound webhook. Until then, keep “Reply in your shop hub”.
3. HubMessages client chunk is 39 KB gzip on the last build. Worth a later split if the messages tab feels heavy on mid-range phones.

---

## Acceptance

| Item | Status |
|---|---|
| A pin mode shipped **or** skipped with reason | **Skipped** — Batch 0 c, external preview sites |
| B inbound email shipped **or** skipped with reason | **Skipped** — receiving/DNS not verified; keep hub reply |
| C1 Playwright full journey + 404/410/asset 404 | **Pass** |
| C2 axe zero serious/critical | **Pass** |
| C3 Lighthouse ≥ 90 / ≥ 95 + bundle sizes | **Pass** (100 / 100; sizes reported) |
| C4 copy inventory + claims:check | **Pass** |
| C5 §11 security re-verified | **Pass** |
| C6 RUNBOOK.md | **Pass** |
