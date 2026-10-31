# Batch 4 report — Review

**Date:** 31 October 2026  
**Branch:** `preview-hub-batch-4` (from `preview-hub-batch-3`)  
**Spec:** `docs/preview-hub/HUB_SPEC.md` v1.0  

---

## What changed (files)

### Data
| File | Why |
|---|---|
| `prisma/schema.prisma` | Additive `PreviewChangeStatus`, `PreviewChangeRequest`, `PreviewContentSection`, `PreviewContentReviewState`, `PreviewContentReview` + `PreviewRequest` relations. Existing `changesRequestedText` / `changeRoundsUsed` / `includedChangeRounds` unchanged. |
| `prisma/migrations/20261031240000_preview_hub_4/migration.sql` | One migration, named `preview_hub_4`. No backfill. |

### Review + changes libs
| File | Why |
|---|---|
| `src/lib/freePreview/hubReviews.ts` | Zod proposals, fingerprints, load draft-shop data, create / apply / dismiss, card states, Now copy, purge helpers. |
| `src/lib/freePreview/hubChanges.ts` | Draft CRUD, send (round++, `CHANGES_REQUESTED`, `changesRequestedText`), grant extra round, resolved-since-last-send, purge helpers. |
| `src/lib/freePreview/hubCopy.ts` | Batch 4 owner / ops / email strings (listed below). |
| `src/lib/freePreview/emails.ts` | E4 lists Done / Not possible items when the hub flag is on; internal changes email lists items when on. Flag off keeps the old HTML. |
| `src/lib/freePreview/opsActions.ts` | `mark_ready_and_send` loads DONE / NOT_POSSIBLE items since the last `MARKED_READY` when the hub is on. |
| `src/lib/freePreview/lifecycle.ts` | Clear then delete change bodies / review proposals on purge. |
| `src/lib/freePreview/hubApi.ts` | Review + change IP rates (40 / 15 min); `requireReviewCapability` / `requireDraftChangesCapability` / `requireSendChangesCapability`; `CHANGE_ATTACHMENT` upload when `canDraftChanges`. |
| `src/lib/freePreview/hubAssets.ts` | Owner upload kinds include `CHANGE_ATTACHMENT`. |
| `src/pages/api/preview-hub/[token]/assets.ts` | Kind parsed before capability; `CHANGE_ATTACHMENT` skipped from the files digest. |

### Owner APIs
| File | Why |
|---|---|
| `src/pages/api/preview-hub/[token]/reviews.ts` | GET / POST. Confirmed + corrections. Asserts `changeRoundsUsed` is unchanged. Events `hub_review_confirmed` / `hub_review_corrections_sent`. |
| `src/pages/api/preview-hub/[token]/changes.ts` | GET / POST draft. Event `hub_change_drafted`; analytics `hub_change_drafted`. |
| `src/pages/api/preview-hub/[token]/changes/[id].ts` | PATCH / DELETE drafts. Events `hub_change_updated` / `hub_change_deleted`. |
| `src/pages/api/preview-hub/[token]/changes/send.ts` | POST send. Increments `changeRoundsUsed`. Analytics `hub_changes_sent`. |

`/api/free-preview/[token]/changes` is untouched and still used when the flag is off.

### Owner UI
| File | Why |
|---|---|
| `src/components/previewHub/HubWebsiteView.tsx` | Website / Booking segmented control; Phone (390×844 scaled) / Desktop; suggest-change sheet; existing iframe CSP + BookingFlow test-mode notice. |
| `src/components/previewHub/HubReviewCards.tsx` | Overview strip + full `/details` cards. Services / Team / Hours (`WeeklyHoursEditor`). Looks right ✓ / send corrections. |
| `src/components/previewHub/HubChanges.tsx` | List with status chips, add/edit/delete drafts, send, round-used copy. |
| `src/components/previewHub/HubYourShop.tsx` | Review cards when `canReview`; placeholders before Review. |
| `src/components/previewHub/HubOverview.astro` | "Check your details" strip; Now card uses `reviewNowNeed`. |
| `src/components/previewHub/HubShell.astro` | Open-changes badge. |
| `src/components/previewHub/HubUploader.tsx` | `CHANGE_ATTACHMENT` + team photo `barberId`. |
| `src/components/freePreview/PreviewTopBar.tsx` | Optional `changesHref`: flag on → link to Changes tab; flag off → existing free-text dialog. |
| `src/pages/preview/[token]/website.astro` | Wires `HubWebsiteView`. Existing `EXTRA_FRAME_SRC_HEADER`. |
| `src/pages/preview/[token]/details.astro` | Full review cards. |
| `src/pages/preview/[token]/changes.astro` | Changes tab. |
| `src/pages/preview/[token]/overview.astro` | Strip + Now copy. |
| `src/styles/components/preview-hub.css` | Website frame, review cards, changes list, sheet. Brand red via `--color-brand` only. |

### Ops
| File | Why |
|---|---|
| `src/components/ops/previewRequests/OpsHubContent.tsx` | Latest proposal + diff; Apply / Dismiss; website-vs-booking reminder (Batch 0 c). |
| `src/components/ops/previewRequests/OpsHubChanges.tsx` | IN_PROGRESS / DONE / NOT_POSSIBLE (+ note); grant extra round. |
| `src/pages/api/ops/preview-requests/[id]/reviews.ts` | Apply (idempotent; 409 if shop fingerprint changed) / dismiss. Event `ops_hub_review_applied` / `ops_hub_review_dismissed`. |
| `src/pages/api/ops/preview-requests/[id]/changes.ts` | Set change status. Event `ops_hub_change_status`. |
| `src/pages/api/ops/preview-requests/[id]/grant-round.ts` | `includedChangeRounds++`. Event `ops_hub_round_granted`. |
| `src/pages/ops/preview-requests/[id].astro` | Content + Changes tabs. |
| `src/pages/ops/preview-requests/index.astro` | Open-changes badge. |
| `src/lib/freePreview/opsQueries.ts` | Open-change counts. |
| `src/styles/components/ops-preview-requests.css` | Content / changes tabs. |
| `scripts/preview-hub/capture-batch-4.mjs` | Playwright fixtures at 360 and 1280. |

### Copy, events, analytics
| File | Why |
|---|---|
| `src/lib/analytics/funnelEvents.ts` | `hub_review_confirmed`, `hub_review_corrections_sent`, `hub_change_drafted`, `hub_changes_sent`. |
| `src/lib/freePreview/createPreviewRequest.ts` | `hub_review_*`, `hub_change_*`, `hub_changes_sent`, `ops_hub_review_*`, `ops_hub_change_status`, `ops_hub_round_granted`. |

---

## Migrations

`prisma/migrations/20261031240000_preview_hub_4/migration.sql`

- `CREATE TYPE "PreviewChangeStatus"` (`DRAFT`, `SENT`, `IN_PROGRESS`, `DONE`, `NOT_POSSIBLE`)
- `CREATE TYPE "PreviewContentSection"` (`SERVICES`, `TEAM`, `HOURS`)
- `CREATE TYPE "PreviewContentReviewState"` (`CONFIRMED`, `CORRECTIONS_SENT`, `APPLIED`, `DISMISSED`)
- `CREATE TABLE "PreviewChangeRequest"` (round, page, body, attachment, anchor, status, opsNote, sent/resolved timestamps)
- `CREATE TABLE "PreviewContentReview"` (section, state, proposal JSON, opsNote, appliedAt / appliedBy)
- Indexes + `ON DELETE CASCADE` to `PreviewRequest`

No drops, no renames. `changesRequestedText` stays for back-compat. No backfill.

---

## New env vars

None. Hub still requires `PREVIEW_HUB_ENABLED=true` **and** `FREE_PREVIEW_FLOW_ENABLED=true`. Default off.

---

## New copy (beyond HUB_SPEC §9)

All in `hubCopy.ts`. §9.3 strings kept exactly (`HUB_REVIEW_CARD_FOOTER`, `HUB_ROUND_USED`). Extra Batch 4 strings:

- Review cards: `HUB_CHECK_DETAILS_TITLE` (`Check your details`), `HUB_REVIEW_LOOKS_RIGHT` (button renders `Looks right ✓`), `HUB_REVIEW_SEND_CORRECTIONS`, add/remove row, states (`Not checked` / `Confirmed` / `Corrections sent` / `Updated on your preview` / `KERSIVO left a note`), empty/error/loading, field labels, validation messages
- Now card: `HUB_NOW_REVIEW_NEED_ALL` (`Check your services, team and hours, then subscribe when you're happy.`), `HUB_NOW_REVIEW_NEED_SOME`, `HUB_NOW_REVIEW_NEED_DONE`
- Changes: title, empty, add/send/sending/sent/failed, chips, page labels, body field, round counters, attachment, denied / no-drafts
- Website: Website / Booking / Phone / Desktop / Open in new tab / Suggest a change / `Test bookings only — no payments are taken.` / Request changes
- Ops: Content / Changes tabs, Apply / Dismiss, grant extra round, required note, `HUB_OPS_WEBSITE_REMINDER` (separate site-preview build)
- Activity: confirmed / corrections / updated section / change done / changes sent

No response-time promises, no guaranteed dates.

---

## Decisions taken in this batch

1. **Pin mode skipped.** Batch 0 c: `sitePreviewUrl` is a separate Vercel project, not a KERSIVO-controlled frame. Page selector + optional screenshot covers §4.3. Batch 6 pin mode stays conditional.
2. **Apply writers.** Hours go through existing `replaceShopOpeningHours`. Services and team have no session-free upsert helper (Batch 0 b); apply writes them in a Prisma transaction and relinks `barberService` (same idea as `linkAllServicesToAllBarbers`). Already-`APPLIED` is idempotent. Fingerprint mismatch → 409 `INCOMPATIBLE`.
3. **Team bio / showOnWebsite stay in the proposal only.** `Barber` has no those columns; apply updates name / active and sets `barberId` on `TEAM_PHOTO`.
4. **Closed day = no slots.** Hours apply writes `shopOpeningHours`; booking already intersects shop hours, so a closed day has no bookable slots.
5. **Data corrections never touch `changeRoundsUsed`.** `hubReviews.ts` does not mention the column. Owner POST re-reads it and 500s if it moved.
6. **Flag-off PreviewTopBar stays the free-text dialog** and `/api/free-preview/[token]/changes` is unchanged. Flag on replaces the dialog with a link to `/changes`.
7. **E4 and the internal changes email** list structured items only when `isPreviewHubEnabled()`. Flag-off HTML is the previous body even if items are passed.
8. **CHANGE_ATTACHMENT** is allowed when `canDraftChanges` (Review+). Skipped from the files digest, same as `MESSAGE_ATTACHMENT`.

---

## Screenshots

Saved under `docs/preview-hub/screens/batch-4/` (Playwright, 360px and 1280px, full page). Fixture markup + real hub / ops CSS. Capture script: `scripts/preview-hub/capture-batch-4.mjs`.

| Screen | 360 | 1280 |
|---|---|---|
| Website — phone frame | `website-phone-360.png` | `website-phone-1280.png` |
| Website — desktop | `website-desktop-360.png` | `website-desktop-1280.png` |
| Overview review strip | `overview-review-strip-360.png` | `overview-review-strip-1280.png` |
| Details review cards | `details-review-360.png` | `details-review-1280.png` |
| Changes empty | `changes-empty-360.png` | `changes-empty-1280.png` |
| Changes drafts | `changes-drafts-360.png` | `changes-drafts-1280.png` |
| Changes round used | `changes-blocked-360.png` | `changes-blocked-1280.png` |
| Ops Content | `ops-content-360.png` | `ops-content-1280.png` |
| Ops Changes | `ops-changes-360.png` | `ops-changes-1280.png` |

390 / 768 were not separately shot; 360 covers the phone column and 1280 the desktop shell.

---

## Test results

| Command | Result |
|---|---|
| `npm run claims:check` | Pass |
| `npm run typecheck` | Pass (0 errors) |
| Hub + ops vitest (Batch 4 files) | Pass — zod proposals, fingerprints, card states / Now copy, send increments `changeRoundsUsed` and reviews never mention it, owner/ops APIs (happy / 404 flag-off / stage deny / validation / 429), corrections `changeRoundsUsed` stays 0, second send returns `HUB_ROUND_USED`, grant increments `includedChangeRounds`, apply idempotent + 409 incompatible, dismiss note, E4 / internal email flag-off unchanged, PreviewTopBar dialog vs Changes link, HubReviewCards / HubChanges UI states |
| Full `npm test` | First run: 2 failed / 5671 passed — `brandTokens` (`var(--color-brand, #d72638)` fallback in `preview-hub.css`; fixed to `var(--color-brand)`) and known-flaky `financialEndpoints` MANAGER 403 timeout. Rerun of both files: 27/27 pass. |
| `npm run build` | Pass |

---

## Anything I could not do

- **Live owner → ops apply → booking preview** on a real `/preview/{token}` row (price + closed day). No seeded hub request with a draft shop in this environment. Covered by: proposal validation, apply writers + fingerprint, card state `APPLIED` → "Updated on your preview", hours via `replaceShopOpeningHours`. Confirm on a READY token after migrate + both flags on.
- **Live three-draft send → blocked → grant → send again** against a real token. Covered by unit/API tests. Confirm on a READY token.
- Live Playwright against hub routes (same reason). Screenshots are CSS-accurate fixtures.
- Apply the migration to a hosted database (`prisma migrate deploy` is for the operator).
- Horizontal-scroll check at 390 / 768 on a running server.

---

## Open questions

Carried from Batch 1–3:

1. Approve-for-launch: `approveSiteLaunch` vs `PreviewRequest.launchApprovedAt`?
2. D1 dashboard retail product+live gate — out of hub batches unless asked.
3. Converting REJECTED/DECLINED if they pay — current webhook allows it.
4. Direct-subscribe hub (`entryPoint = 'direct_subscribe'`) — Batch 5.
5. Should `/preview/{token}/overview` redirect to `/preview/{token}`?
6. Should unused `MESSAGE_ATTACHMENT` files (uploaded but never sent) stay until purge, or be swept after a timeout?

New:

7. Team bio / show-on-website have nowhere to persist on `Barber`. Apply name + photo only; should Batch 5 add columns, or do we keep them as ops notes?
8. Apply marks the review `APPLIED` after the shop write, not in one wrapping transaction. A retry is safe (idempotent). Worth tightening?

---

## Acceptance

| Item | Status |
|---|---|
| Owner corrects a price and closes a day; ops applies; the booking preview shows the new price and hours; owner card shows "Updated on your preview" | **Not proven live.** Unit/UI/apply path in place. Do not treat as done until a real-token pass. |
| Owner drafts 3 changes, sends them; second send is blocked with the round-used copy; ops grants a round; sending works again | **Not proven live.** API/UI tests cover send, `HUB_ROUND_USED`, and grant. Confirm on a READY token. |
| Data corrections never change `changeRoundsUsed` (test) | Pass (`hubChanges.test.ts` source proof; owner reviews POST re-reads the column and returns 0 after confirmed and corrections) |
| Flag off: owner behaviour unchanged | Pass (new APIs go through `resolveHubApiContext` / `isHubRouteEnabled`; `/api/free-preview/[token]/changes` and PreviewTopBar dialog untouched) |
| Pin mode | Skipped (Batch 0 c: external `sitePreviewUrl`) |

**Batch 4 product code is in place** behind `PREVIEW_HUB_ENABLED`. The live apply-to-booking and send/grant passes are the remaining acceptance gaps — do not mark the batch done until those are confirmed on a seeded token.
