# Batch 0 report — Shop Hub discovery

**Date:** 31 October 2026  
**Branch:** `preview-hub-batch-0`  
**Product code changed:** none (docs only)

---

## What changed (files)

| File | Why |
|---|---|
| `docs/preview-hub/HUB_SPEC.md` | Required destination for the attached spec. The source file was not in the workspace or on disk, so this is a provenance placeholder plus the GLOBAL RULES that arrived with the prompt. **Not the product spec.** |
| `docs/preview-hub/BATCH_0_FINDINGS.md` | Answers a–m with `file:line` evidence, the actual state machine, reuse inventory, and conflicts. |
| `docs/preview-hub/reports/BATCH_0_REPORT.md` | This report. |

No migrations. No new env vars. No screens (discovery; no UI).

---

## Acceptance

| Item | Status |
|---|---|
| `docs/preview-hub/HUB_SPEC.md` exists | **Partial.** File exists. It is **not** the exact contents of `KERSIVO_Shop_Hub_Spec_v1.md` because that attachment was not found. |
| `docs/preview-hub/BATCH_0_FINDINGS.md` exists | Pass. |
| Every question a–m has an answer with evidence or an explicit “not found” | Pass. |
| No product code changed | Pass. |

**Batch 0 is not marked done** (GLOBAL RULE 11 / Batch 0 acceptance): item 1 failed. Replace `HUB_SPEC.md` with the exact spec before Batch 1.

---

## Screenshots

None. Batch 0 added no screens. Directory `docs/preview-hub/screens/batch-0/` was not created.

---

## Test results

Not run. No product code, no tests added. Existing suite was not required for a docs-only discovery batch.

---

## What I could not do

1. **Copy the attached spec.** Searched the workspace, this chat’s tool-visible attachments, Downloads, Desktop, Documents, and filename patterns `*Shop_Hub*`, `*HUB_SPEC*`, `*preview-hub*`. Not found. A ChatGPT canvas “Kersivo shop hub cursor batches - MD” holds the batch prompts; conversation “Hub i formularz preview” is the likely home of the spec. Computer-use clicks into that ChatGPT window were blocked.
2. **Fully enumerate spec-vs-code conflicts.** §14 of the findings compares GLOBAL RULES + Batch 0 questions to the code. Re-run after the exact spec is supplied (especially §2 `liveAt` and §9 copy).
3. **Screenshots at 360/1280.** No new or changed screens.

---

## Open questions

See `docs/preview-hub/BATCH_0_FINDINGS.md` “Open questions”. The blocker is the missing spec file.

---

## Headline findings (for Batch 1)

- Eight `PreviewRequest` statuses. Status actually changes in six writers: create, ops (`set_status` / `reject` / `mark_ready_and_send`), request-changes, no-thanks, expiry cron, Stripe webhook. Claim/adoption does **not** change status.
- Ops can create/link an ownerless draft and set `sitePreviewUrl`. There is no ops API for services, barbers, hours or logo. Reuse `replaceShopOpeningHours`, `replaceBarberAvailabilityRules`, `linkAllServicesToAllBarbers`, `createStandaloneBookingProfile`, `storeShopLogo`.
- The website at `sitePreviewUrl` is an **external/manual** Vercel project. This repo only stores the URL and iframes it. Batch 6 pin mode cannot inject a script from this codebase.
- No single “site published” field. Closest: `FullBookingDestination.status = VERIFIED_LIVE` (booking URL) and `goLiveAt` (approve click, not DNS). Spec §2 would add `PreviewRequest.liveAt`.
- Direct subscribers get `ClientOnboardingWizard`. No `PreviewRequest`. Preview buyers get `/admin/preview-launch`.
- `retailEnabled` only via settings PATCH; no product-count gate. `bookingPaymentMode` stays `NONE` through preview → launch.
- Private blobs: `uploadPrivateOnboardingFile` / `deletePrivateOnboardingFile` / `retrievePrivateOnboardingFile`. Vercel body default 4.5 MB. Streaming helper exists; no ops download route.
- Emails: `EmailOutbound` outbox + Resend. Free-preview builders and opt-out already exist.
- Retention anonymises `EXPIRED`/`DECLINED`/`REJECTED` after 90 days and deletes the draft shop graph. External site is **not** deleted.
- Only free-preview cron: `/api/cron/free-preview-lifecycle` at `20 * * * *`.
- Dashboard look: `admin-theme-premium-black` + `booking.css` + `tokens.css`. Icons: local Lucide subset. No shared toast.
- `PREVIEW_HUB_ENABLED` / `isPreviewHubEnabled()` / `hubCopy.ts` do not exist.
