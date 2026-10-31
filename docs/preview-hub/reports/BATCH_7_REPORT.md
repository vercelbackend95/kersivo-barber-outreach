# Batch 7 report — Real-stack QA, polish, hardening

**Date:** 31 October 2026  
**Branch:** `preview-hub-batch-7` (from `main` @ `572690d8` / Batch 6)  
**Spec:** `docs/preview-hub/HUB_SPEC.md` v1.0  

The Batch 6 “e2e” was a mock HTTP server with fixture markup. This batch runs the **real** Astro pages and React islands against a **local** Postgres. The production Neon `DATABASE_URL` is never used.

---

## A. Real-app end-to-end

### How to run

```
npm run test:preview-hub-real
```

Documented in `docs/preview-hub/RUNBOOK.md`. The script:

1. Aborts if `DATABASE_URL` is not localhost / 127.0.0.1 / `::1`.
2. Starts `docker-compose.preview-hub.yml` (port 55432) or embedded Postgres 18.6 when Docker is missing.
3. Applies the current schema with `prisma db push` (historical `migrate deploy` is not replayable on an empty cluster — `SaasSubscriptionStatus` is ALTERed before it is created). Production still uses `prisma migrate deploy`.
4. Seeds `scripts/preview-hub/seed-real.ts` (REQUESTED, READY + draft shop, CONVERTED + claimable shop, REJECTED, EXPIRED-after-ready).
5. Starts `astro dev` with `PREVIEW_HUB_ENABLED=true`, `FREE_PREVIEW_FLOW_ENABLED=true`, `PRIVATE_BLOB_DRIVER=memory`, `PREVIEW_HUB_STRIPE_STUB=true`, `PREVIEW_HUB_REAL_QA=true`.
6. Runs Playwright (`scripts/preview-hub-real.spec.ts`).
7. Restarts the same port with the hub flag **off** and asserts REQUESTED 404 + the previous acknowledgement email.

QA routes under `/preview-hub-qa` and `/api/preview-hub-qa` 404 unless the real-QA gate is on. That gate is **false** on Vercel Production, Vercel Preview, Vitest, and any remote `DATABASE_URL`. Memory blob is refused when `VERCEL_ENV=production`. Stripe stubs are refused in Vercel production.

The Batch 6 fixture harness (`journey-server.mjs`, `hub-screens.mjs`, `preview-hub-journey.playwright.*`, `lighthouse-hub.mjs`, `capture-batch-6.mjs`) is deleted.

### Acceptance A

`npm run test:preview-hub-real` passed **twice in a row** on this machine (3 Playwright tests + flag-off check each time, ~40s Playwright + ~107s wall including seed and the flag-off restart).

Real screenshots (not fixtures) are in `docs/preview-hub/screens/batch-7/` at 360 and 1280.

Axe (WCAG 2.2 AA) on Overview, Details, Website, Changes, Messages, Checklist at 390 and 1280: **zero serious / critical**.

### Bugs found in A (fixed + regression tests)

| Bug | Fix | Regression |
|---|---|---|
| Hub islands imported server modules (`process is not defined` / Prisma in the client graph) | Split `hubReviews.shared.ts`, `hubChanges.shared.ts`, `hubMessages.shared.ts` | `hubIslands.clientSafe.test.ts` |
| Ops Content tab crashed: `formatGbpPence is not defined` | Local import in `hubReviews.ts` | `hubReviews.test.ts` |
| Preview booking still offered Sunday 09:00 after hours were closed | `previewSlotsForDate` honours shop hours (`previewBookingSlots.ts`) | `previewBookingSlots.test.ts`, `previewBooking.test.tsx` |
| Stripe stub reused one session id; retrieve hit live Stripe | Unique stub ids + retrieve stub for `cs_stub_preview_hub*` | covered by the real journey |
| Page-view rate limit (120/h) blocked repeated local QA | Skip IP limits only when the real-QA gate is on; gate is off inside Vitest | `realQa.test.ts`, `free-preview.test.ts` |
| Axe: active tab label contrast 4.02:1 | Tab labels `#f4f4f5`; icon stays brand red | `HubYourShop.test.ts` |
| Axe: Changes tab name flattened to “Changes3” | `aria-label` “Changes N open”; count outside `aria-hidden` | `HubOverview.test.ts` |
| Axe: `role="row"` with inputs/buttons (aria-required-children) | Review services are a form grid, not a table | `HubReviewCards.test.tsx` |
| Axe: “No logo yet” on cream swatch contrast 1.02 | Light-swatch text `#1a1a1a` | `HubYourShop.test.ts` |
| Axe: `#hub-about` unlabeled | `aria-labelledby="hub-about-title"` | `HubYourShop.test.ts` |
| Production NFT walked `scripts/preview-hub` (dynamic `import('lighthouse')`) via the QA email-log path | Log + seed files live at repo root (`.preview-hub-qa-emails.json`, `.preview-hub-seed.json`) | `realQa.test.ts` |
| Flag-off check tried a second `astro dev` (Astro allows one per project) | Stop, then restart the same port with the flag off | `start-real-qa.mjs` |

---

## B. UX polish

1. **One primary action.** Review Overview: “Open your preview” is primary; “Launch this website” is secondary/outline with £39/month as supporting text (`PreviewTopBar`, `HUB_PRIMARY.subscribe`).
2. **Mobile tab bar.** Inline dashboard-style SVGs, 12px+ labels, accent + indicator, unread dot, open-count badge, lock icon on locked tabs (still focusable, reason announced), safe-area padding, 44px+ targets.
3. **Mobile top bar.** Small KERSIVO wordmark left of the shop name; stage pill right; private label kept.
4. **“Your preview” card.** Logo or initials on the brand colour inside a phone-frame placeholder. “Open website” / “Try booking”. No iframe in the card.
5. **Review cards.** “Send corrections” disabled until a value differs; “Unsaved changes” hint; “Looks right ✓” disabled while dirty. Copy unchanged.
6. **Team bio.** Owner helper: “We'll add this to your website.” Ops Content tab lists bio and show-on-website under “Update on the website build manually”. No new Barber columns.
7. **Empty / loading / error.** Checklist has skeletons + retry. Messages, Details, Changes and uploads have empty, error and Try again. Remaining layout shift is reported under Lighthouse.
8. **Lighthouse (mobile, real routes, seeded data).** See numbers below. Measured on `astro dev` (unminified). Accessibility met ≥ 95 and CLS &lt; 0.05 on the hub screens in the last real run; Performance on the unminified dev server did **not** meet ≥ 90 (expected — Batch 6’s 100s were fixture HTML). Re-run after production deploy if a production-like local preview is needed.

Last captured real-dev numbers (`docs/preview-hub/screens/batch-7/lighthouse-real-mobile-summary.json`):

| Screen | Performance | Accessibility | CLS |
|---|---|---|---|
| Overview | 55 | 100 | 0.0002 |
| Details | 58 | 99 | 0.0014 |
| Website | 38 | 100 | 0.0008 |
| Messages | 64 | 100 | 0.0019 |
| Checklist | 54 | 100 | 0.0523 |

Checklist CLS was just over 0.05 on that run (font / island hydrate). Accessibility passed.

---

## C. Hardening

1. **Retention gap.** REQUESTED / IN_PROGRESS with `convertedAt` null, not `direct_subscribe`, and no owner or ops `PreviewRequestEvent` for 180 days → `EXPIRED` (no email). Existing purge then applies. Tests in `lifecycle.test.ts`.
2. **Orphan attachments.** `MESSAGE_ATTACHMENT` / `CHANGE_ATTACHMENT` not referenced after 24 hours → delete blob + row. Tests in `lifecycle.test.ts`.
3. **Review Apply.** Each section’s writes + `APPLIED` + event run in one Prisma `$transaction`. Idempotent; fingerprint still `INCOMPATIBLE`. Mid-apply throw persists nothing (`hubReviews.apply.test.ts`).
4. **Upload body cap.** `readLimitedHubBody` rejects when the bytes actually read exceed `HUB_MAX_BODY_BYTES`, even without `Content-Length`. `hubApi.body.test.ts`.
5. **SVG logos.** Before rasterising, reject `<script`, `on*` handlers, `<foreignObject`, and external `href` / `xlink:href` (only `#` and `data:image/` allowed). `hubAssets.test.ts`.
6. **REJECTED webhook.** Payment on a rejected request’s draft shop still records the subscription; warning + internal email “Payment received for a rejected preview request: {shop}”. No owner-facing change. `conversion.test.ts`.

No Prisma migration in this batch.

---

## D. Verification

| Command | Result |
|---|---|
| `npm run test:preview-hub-real` | Pass × 2 |
| `npm run claims:check` | pass |
| `npm run typecheck` | 0 errors |
| `npm test` | 5771 passed; 1 known-flaky (`financialEndpoints` MANAGER 403 timeout). File alone: 25 passed |
| `npm run build` | pass |

---

## Screenshots

`docs/preview-hub/screens/batch-7/`

| Screen | 360 | 1280 |
|---|---|---|
| Overview — Requested | `overview-requested-360.png` | `overview-requested-1280.png` |
| Overview — Review | `overview-review-360.png` | `overview-review-1280.png` |
| Overview — Launch | `overview-launch-360.png` | `overview-launch-1280.png` |
| Overview — Live | `overview-live-360.png` | `overview-live-1280.png` |
| Details empty | `details-empty-360.png` | `details-empty-1280.png` |
| Details filled | `details-filled-360.png` | `details-filled-1280.png` |
| Website phone | `website-phone-360.png` | `website-phone-1280.png` |
| Website desktop | `website-desktop-360.png` | `website-desktop-1280.png` |
| Changes | `changes-360.png` | `changes-1280.png` |
| Messages | `messages-360.png` | `messages-1280.png` |
| Checklist sole trader | `checklist-sole-360.png` | `checklist-sole-1280.png` |
| Checklist Ltd | `checklist-ltd-360.png` | `checklist-ltd-1280.png` |
| Ops overview / files / content / changes / messages | `ops-*-360.png` | `ops-*-1280.png` |

---

## New env vars (local QA only)

Never set these on Vercel Production or Preview:

- `PREVIEW_HUB_REAL_QA=true`
- `PRIVATE_BLOB_DRIVER=memory`
- `PREVIEW_HUB_STRIPE_STUB=true`
- `PREVIEW_HUB_DATABASE_URL` (localhost Postgres)

`PREVIEW_HUB_ENABLED` stays **unset** on Preview. Production flip is a separate step after this PR is on `main` and the production deployment is READY.

---

## Production status

**Not enabled yet.** This report is written before the PR merge. After merge:

1. Wait for the Vercel **production** deployment of that commit to be READY. Build log should show `prisma migrate deploy` / “No pending migrations”.
2. Set `PREVIEW_HUB_ENABLED=true` on **Production only** (never Preview, never Development).
3. Redeploy production so the variable is picked up.
4. Smoke-test https://kersivo.co.uk/free-preview as “KERSIVO Test Shop”, town Bournemouth, founder email. Then REJECT the request in ops.
5. Rollback: clear `PREVIEW_HUB_ENABLED` on Production and redeploy.

---

## Open questions

1. Real-route Lighthouse Performance on `astro dev` is 38–64. Need a production-deployment run to see whether Overview / Details / Messages / Checklist meet ≥ 90 once minified. Website includes BookingFlow and will stay heavier.
2. Checklist CLS was 0.052 on the last real-dev run. Recheck on production.
3. Founder must set `PREVIEW_HUB_ENABLED` on Production if this environment cannot run `vercel env add` from the linked `kersivo-barber-outreach` folder.
