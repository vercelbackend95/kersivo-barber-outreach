# Batch 1 report — Shop Hub foundations

**Date:** 31 October 2026  
**Branch:** `preview-hub-batch-1` (from `preview-hub-batch-0`; Batch 0 is not on `main` yet)  
**Spec:** `docs/preview-hub/HUB_SPEC.md` v1.0  

---

## What changed (files)

### Flag and config
| File | Why |
|---|---|
| `src/lib/freePreview/config.ts` | `isPreviewHubEnabled()` — env `PREVIEW_HUB_ENABLED`, exact `'true'`, default off. |
| `.env.example` | Documents the new flag. Hub pages require **both** this and `FREE_PREVIEW_FLOW_ENABLED`. |
| `src/lib/freePreview/config.test.ts` | Source assertion that the helper is exact-`'true'` only. |

### Data
| File | Why |
|---|---|
| `prisma/schema.prisma` | Additive `PreviewHubActor` enum; `PreviewRequest` hub columns from HUB_SPEC §7, including `liveAt` (Batch 0 finding d: no existing live marker). |
| `prisma/migrations/20261031210000_preview_hub_1/migration.sql` | One migration, named `preview_hub_1`. |
| `src/lib/freePreview/lifecycle.ts` | Anonymise also clears `styleNotes`, `aboutText`, brand colours. |

### Stage, copy, headers
| File | Why |
|---|---|
| `src/lib/freePreview/hubCopy.ts` | All owner-facing hub strings (HUB_SPEC §9 + Batch 1 extras listed below). |
| `src/lib/freePreview/hubStage.ts` | `resolveHubState` + capabilities + owner-facing stage label. |
| `src/lib/freePreview/hubPage.ts` | Hub route gate, overview extras, `hub_viewed` recording, relative time. |
| `src/lib/freePreview/previewHeaders.ts` | Shared `PRIVATE_PREVIEW_HEADERS` (same values as today’s token page). |
| `src/lib/freePreview/hubStage.test.ts` | Every status × operator; flag-off `resolvePreviewPageState` still 404s REQUESTED. |
| `src/lib/freePreview/hubPage.test.ts` | View tracking, stepper, activity filter, token log prefix. |
| `src/lib/freePreview/hubCopy.test.ts` | Exact §9 strings. |
| `src/lib/freePreview/hubRoutes.flagOff.test.ts` | Nested hub pages 404 unless both flags are on; root still uses `resolvePreviewPageState`. |

### Routes and UI
| File | Why |
|---|---|
| `src/pages/preview/[token].astro` | Flag off: unchanged `resolvePreviewPageState` path. Flag on: 404 / `?view=booking` → `/website?view=booking` / rewrite to Overview. |
| `src/pages/preview/[token]/overview.astro` | Hub Overview. |
| `src/pages/preview/[token]/website.astro` | Existing iframe + booking + `PreviewTopBar` (checkout kept). Locked before Review. |
| `src/pages/preview/[token]/details.astro` | Coming-soon placeholder. |
| `src/pages/preview/[token]/changes.astro` | Locked before Review; coming soon at Review. |
| `src/pages/preview/[token]/messages.astro` | Coming-soon placeholder. |
| `src/layouts/HubDocument.astro` | Private hub document chrome (admin dark theme, no analytics). |
| `src/components/previewHub/HubShell.astro` | Desktop sidebar, mobile top bar + bottom tabs, locked tabs, private label, stage pill. |
| `src/components/previewHub/HubOverview.astro` | Header, stepper, Now, preview card, activity, help. |
| `src/components/previewHub/HubComingSoon.astro` | Designed coming-soon state. |
| `src/components/previewHub/PreviewWebsitePane.astro` | Moved iframe/booking rendering (behaviour unchanged). |
| `src/components/previewHub/HubOverview.test.ts` | Source tests for Overview/expired CTA/subscribe and HubShell skip/lock. |
| `src/styles/components/preview-hub.css` | Hub layout, namespaced so flag-off pages are unaffected. |
| `src/components/freePreview/PreviewTopBar.tsx` | Optional `chrome="checkout"` for Overview subscribe during Review. |
| `scripts/preview-hub/capture-batch-1.mjs` | Playwright fixture screenshots (360 viewport, 1280 full page). |
| `scripts/preview-hub/lighthouse-overview.mjs` | Mobile Lighthouse against the Overview fixture. |

### Emails and `/free-preview`
| File | Why |
|---|---|
| `src/lib/freePreview/emails.ts` | Flag on: §9.1 acknowledgement with hub button; E2 adds “Open hub as KERSIVO”. Flag off: previous HTML. |
| `src/lib/freePreview/emails.test.ts` | Both flags; hub E1 snapshot. |
| `src/lib/freePreview/createPreviewRequest.ts` | Passes `publicToken` into E1; `hub_viewed` action name. |
| `src/lib/seo/freePreviewPage.ts` | Flag-on FAQ + photos line via getters. Flag-off constants unchanged. |
| `src/pages/free-preview/index.astro` | Renders hub FAQ variant when the hub flag is on. |
| `src/components/freePreview/FreePreviewForm.astro` | Photos line swap. |
| `src/lib/freePreview/publicCopy.test.ts` | Proves flag-off copy is identical; hub-on variants match JSON-LD. |

### Analytics and ops
| File | Why |
|---|---|
| `src/lib/analytics/funnelEvents.ts` | `hub_viewed` (server-side only). |
| `src/pages/ops/preview-requests/[id].astro` | Owner-facing stage + “Open hub as KERSIVO” when the hub flag is on. |
| `src/components/ops/previewRequests/PreviewRequestActions.tsx` | Hub link and stage hint (flag-gated). |

---

## Migrations

`prisma/migrations/20261031210000_preview_hub_1/migration.sql`

- `CREATE TYPE "PreviewHubActor" AS ENUM ('OWNER', 'KERSIVO');`
- Additive nullable/defaulted columns on `"PreviewRequest"`: `brandPrimaryColour`, `brandSecondaryColour`, `styleNotes`, `aboutText`, `includedChangeRounds` (default 1), `changeRoundsUsed` (default 0), `ownerLastSeenAt`, `opsLastSeenAt`, `opsFilesNotifiedAt`, `opsMessagesNotifiedAt`, `launchApprovedAt`, `liveAt`, `ourStepDomainAt`, `ourStepSslAt`.

No drops, no renames. No other models.

---

## New env vars

| Name | Default | Meaning |
|---|---|---|
| `PREVIEW_HUB_ENABLED` | off (anything other than `true`) | Shop Hub. Nested hub routes also require `FREE_PREVIEW_FLOW_ENABLED`. |

**Flag composition (locked for Batch 1):** hub pages 404 unless **both** flags are on. Public `/free-preview` CTAs stay on the flow flag alone. This lets ops trial the hub only when the public flow is already on, and keeps production byte-identical when the hub flag is off.

---

## New copy (beyond HUB_SPEC §9, listed as required)

§9 strings live in `hubCopy.ts` and are tested. Extra Batch 1 strings:

- Overview “Now” body (`HUB_NOW`) and primary button labels (`HUB_PRIMARY`)
- `HUB_NOW_NOTHING`, `HUB_COMING_SOON`, `HUB_AVAILABLE_SOON`, `HUB_QUESTIONS_FOOTER`
- `HUB_TAB_COMING_SOON_TITLE` / `HUB_TAB_COMING_SOON_BODY`
- `HUB_WEBSITE_LOCKED_BODY` (“We'll email you when it's ready.”)
- `HUB_HELP_*`, activity labels, stepper labels, nav labels
- `/free-preview` hub-on replacements specified in the batch (photos line + FAQ answer)

No response-time promises, no guaranteed dates. Turnaround only from `PREVIEW_TURNAROUND_TEXT` / `PREVIEW_OVER_CAP_MESSAGE`.

---

## Decisions taken in this batch

1. **Both flags required** for hub routes (see above).
2. **`liveAt` added** — Batch 0 found no published-website marker.
3. **Operators** can open the website iframe before Review if a draft shop exists (`showPreview` for operators only). Owners still see the locked placeholder. Ops can QA a draft before “Mark ready”.
4. **Your shop checklist omitted** on Overview. Every item would have been “Coming soon” until Batch 2/4; that looked unfinished. Wiring it when uploads and review cards exist.
5. **“Ask us to reopen it”** is rendered **disabled** with “Available soon” (Batch 3 messages). Not omitted, so the expired CTA is visible.
6. **No-thanks** keeps `Referrer-Policy: same-origin` (Batch 0 conflict 25). Not changed.
7. **`/preview/{token}/overview`** exists as the rewrite target of the canonical token URL. Direct visits work when the hub is on; the shell’s Overview tab still points at `/preview/{token}`.

---

## Screenshots

Saved under `docs/preview-hub/screens/batch-1/` (Playwright, 360px and 1280px). Fixture markup + real hub CSS (no database). Capture script: `scripts/preview-hub/capture-batch-1.mjs`.

| Screen | 360 | 1280 |
|---|---|---|
| Overview Requested | `overview-requested-360.png` | `overview-requested-1280.png` |
| Overview Designing | `overview-designing-360.png` | `overview-designing-1280.png` |
| Overview Review | `overview-review-360.png` | `overview-review-1280.png` |
| Overview Review (changes sent) | `overview-review-changes-sent-360.png` | `overview-review-changes-sent-1280.png` |
| Overview Launch | `overview-launch-360.png` | `overview-launch-1280.png` |
| Overview Live | `overview-live-360.png` | `overview-live-1280.png` |
| Overview Declined | `overview-declined-360.png` | `overview-declined-1280.png` |
| Overview Expired | `overview-expired-360.png` | `overview-expired-1280.png` |
| Website locked (pre-Review) | `website-locked-360.png` | `website-locked-1280.png` |
| Your shop coming soon | `details-coming-soon-360.png` | `details-coming-soon-1280.png` |
| Changes coming soon | `changes-coming-soon-360.png` | `changes-coming-soon-1280.png` |
| Messages coming soon | `messages-coming-soon-360.png` | `messages-coming-soon-1280.png` |

The Review **website/booking iframe** is the existing preview pane moved to `/website` (same `PreviewWebsitePane` + `PreviewTopBar`). Not re-shot as a live iframe (needs a draft shop `sitePreviewUrl`).

---

## Test results

| Command | Result |
|---|---|
| `npm run claims:check` | Pass |
| `npm run typecheck` (`astro check --tsconfig tsconfig.app.json`) | Pass |
| Hub + free-preview vitest files | Pass (stage, copy, emails, routes, indexing, public copy, Overview shell) |
| Full `npm test` | First run: 3 failed / 5530 passed. Then: brand-token hex fallbacks removed from `preview-hub.css`; `previewIndexing.test.ts` now asserts shared `PRIVATE_PREVIEW_HEADERS`; known-flaky `financialEndpoints` MANAGER 403 timed out once and passed on rerun (25 tests). |
| `npm run build` | Pass |

E1 hub snapshot: `src/lib/freePreview/__snapshots__/emails.test.ts.snap` — subject/body/button/URL from §9.1.

---

## Lighthouse

Mobile Lighthouse **12.8.2** on the Overview Requested fixture (same CSS and structure as HubShell + HubOverview; skip link, unique landmarks, 44px targets). Script: `scripts/preview-hub/lighthouse-overview.mjs`. Summary: `docs/preview-hub/screens/batch-1/lighthouse-overview-mobile-summary.json`.

| Category | Score |
|---|---|
| Performance | **100** |
| Accessibility | **100** |
| Failed a11y audits | none |

Not scored on a live `/preview/{token}` row (no seeded request in this environment). Re-score on a REQUESTED token after migrate + both flags on if you want the live document, including the Review `PreviewTopBar` island.

---

## Anything I could not do

- Live Playwright pass against `/preview/{token}` with real Prisma rows (no seeded hub request in this run). Screenshots are CSS-accurate fixtures; 360px is the phone viewport (fixed tab bar at the bottom), 1280px is full page.
- Lighthouse on a live Overview with a real token (fixture scored instead).
- Horizontal-scroll check at 390 / 768 on a running server. CSS is mobile-first with `minmax(0, 1fr)` and no fixed widths above the viewport; 360/1280 fixture shots show no horizontal scroll.
- Apply the migration to a hosted database (local `prisma migrate deploy` is for the operator).

---

## Open questions

Carried from Batch 0, still for later batches:

1. Approve-for-launch: `approveSiteLaunch` vs `PreviewRequest.launchApprovedAt`?
2. D1 dashboard retail product+live gate — out of hub batches unless asked.
3. Converting REJECTED/DECLINED if they pay — current webhook allows it.
4. Direct-subscribe hub (`entryPoint = 'direct_subscribe'`) — Batch 5.

New:

5. Should `/preview/{token}/overview` redirect to `/preview/{token}` so only one URL exists, or is the rewrite target fine to leave public while the hub flag is on?

---

## Acceptance

| Item | Status |
|---|---|
| Flag OFF: existing free-preview tests; `/preview/{token}` REQUESTED still 404s | Pass (`resolvePreviewPageState` still 404s REQUESTED; nested hub pages 404 unless both flags are on). |
| Flag ON: REQUESTED → Overview “We've got your request”; IN_PROGRESS → “We're designing…”; READY → Review with website/booking + checkout; CONVERTED → Launch; DECLINED/EXPIRED/REJECTED per spec | Pass in `resolveHubState` + Overview copy. HTTP 410 on expired hub pages. REJECTED → 404. |
| Acknowledgement email (flag ON) contains hub link; snapshot | Pass |
| Lighthouse mobile Overview ≥ 90 / 95 | Pass on the Overview fixture (100 / 100). Not re-scored on a live token. |
| Screenshots 360/1280 each stage | Pass (fixtures) |

**Batch 1 product code is in place** behind `PREVIEW_HUB_ENABLED`. Remaining caveats: screenshots and Lighthouse used CSS fixtures rather than a seeded live token; confirm the Vercel preview after migrate.
