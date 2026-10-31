# Batch 0 report — Shop Hub discovery

**Date:** 31 October 2026  
**Branch:** `preview-hub-batch-0`  
**Product code changed:** none (docs only)  
**Spec:** `docs/preview-hub/HUB_SPEC.md` v1.0 (founder-placed; not edited)

---

## What changed (files)

| File | Why |
|---|---|
| `docs/preview-hub/HUB_SPEC.md` | Founder placed the full spec. This batch did not modify it. |
| `docs/preview-hub/BATCH_0_FINDINGS.md` | Answers a–m with `file:line` evidence, reuse inventory, and spec-vs-code conflicts. |
| `docs/preview-hub/reports/BATCH_0_REPORT.md` | This report. |

No migrations. No new env vars. No screens (discovery; no UI).

---

## Acceptance

| Item | Status |
|---|---|
| `docs/preview-hub/HUB_SPEC.md` exists with the spec | Pass (founder-placed). |
| `docs/preview-hub/BATCH_0_FINDINGS.md` exists | Pass. |
| Every question a–m has an answer with evidence or an explicit “not found” | Pass. |
| Conflicts between HUB_SPEC and the code listed, not resolved | Pass (findings §14, 35 items). |
| No product code changed | Pass. |

---

## Screenshots

None. Batch 0 added no screens.

---

## Test results

Not run. No product code.

---

## Headline answers (a–m)

- **a.** Eight statuses. Writers: create, ops (`set_status` / `reject` / `mark_ready_and_send`), request-changes, no-thanks, expiry cron, Stripe webhook. Claim does not change status. Owners currently 404 before READY.
- **b.** Ops create/link ownerless draft + set `sitePreviewUrl` only. Apply-correction helpers: `replaceShopOpeningHours`, `replaceBarberAvailabilityRules`, `linkAllServicesToAllBarbers`, `createStandaloneBookingProfile`, `storeShopLogo`.
- **c.** External/manual Vercel project. This repo iframes the URL. **Skip Batch 6 pin mode.**
- **d.** No published-website field. **Add `PreviewRequest.liveAt`** (spec §2 / §7).
- **e.** Direct subscribe → `ClientOnboardingWizard`. No `PreviewRequest`. Batch 5 target documented.
- **f.** `/admin/preview-launch` is a short confirm-details form, not the five-item checklist. Approval lives on `/admin/site-preview`.
- **g.** `retailEnabled` only via settings PATCH; no product or live gate. Hub/preview-launch never ask (matches D1 for the hub).
- **h.** `bookingPaymentMode` stays `NONE` (matches D2).
- **i.** `uploadPrivateOnboardingFile` / `deletePrivateOnboardingFile` / `retrievePrivateOnboardingFile`. Stream helper exists. Vercel body default 4.5 MB (spec hub cap 4 MB fits). No magic-byte sniff.
- **j.** Outbox + Resend. E1 has **no hub link**. File/message/live emails do not exist. Opt-out via no-thanks.
- **k.** Anonymise `EXPIRED`/`DECLINED`/`REJECTED` after 90 days; draft shop graph deleted; external site not deleted. Hub tables do not exist yet.
- **l.** `/api/cron/free-preview-lifecycle` at `20 * * * *`. Email outbox every 5 min.
- **m.** `admin-theme-premium-black` + `tokens.css` + Lucide subset (`lucide-react.tsx`). `WeeklyHoursEditor` exists. **No shared toast.**

---

## Conflicts to carry into Batch 1

Highest impact:

1. Token page 404s before READY and without `draftShopId` — hub must open at Requested.
2. Add `PREVIEW_HUB_ENABLED` beside `FREE_PREVIEW_FLOW_ENABLED`; decide composition.
3. E1 rewrite behind the hub flag only (flag-off byte-identical).
4. Add `PreviewRequest.liveAt`; skip pin mode.
5. Apply content via named service helpers, not `/api/admin/onboarding/*`.
6. No-thanks `Referrer-Policy: same-origin` vs spec `no-referrer`.
7. D1 dashboard retail product+live gate is **not** true today — do not change that PATCH in hub batches unless asked.

Full table: `docs/preview-hub/BATCH_0_FINDINGS.md` §14.

---

## What I could not do

Nothing remaining for Batch 0 investigation. Product implementation starts at Batch 1.

---

## Open questions

See findings “Open questions” (flag composition, approve-for-launch writer, D1 dashboard gate, converting REJECTED, no-thanks referrer).
