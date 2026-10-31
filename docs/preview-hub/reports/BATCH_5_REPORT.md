# Batch 5 report — Launch

**Date:** 31 October 2026  
**Branch:** `preview-hub-batch-5` (from `main` / Batch 4)  
**Spec:** `docs/preview-hub/HUB_SPEC.md` v1.0  

---

## What changed (files)

### Data
| File | Why |
|---|---|
| `prisma/schema.prisma` | Additive `EmailOutboundPurpose` values + `ClientOnboarding.isLimitedCompany` / `registeredOfficeAddress`. Reuses `legalBusinessName` and `companyNumber`. `PreviewRequest.launchApprovedAt` / `ourStepDomainAt` / `ourStepSslAt` / `liveAt` already exist from Batch 1. |
| `prisma/migrations/20261031250000_preview_hub_5/migration.sql` | One migration, named `preview_hub_5`. No backfill. |

### Launch libs
| File | Why |
|---|---|
| `src/lib/freePreview/ukCompanyNumber.ts` | UK company number: 8 digits or `SC`/`NI`/`OC` + 6 digits. |
| `src/lib/freePreview/hubLaunch.ts` | Completeness, checklist load/save/skip/approve, token-safe progress, ops steps, subscribed / launch-approved / site-live emails. |
| `src/lib/freePreview/hubLaunchApi.ts` | Logged-in owner gate, hub-flag 404, exact same-origin on mutations, private headers. |
| `src/lib/freePreview/directSubscribe.ts` | Create `PreviewRequest` (`entryPoint = 'direct_subscribe'`, `IN_PROGRESS`, `convertedAt` set) for new Full shops only. |
| `src/lib/freePreview/hubCopy.ts` | Batch 5 owner / ops / email strings (listed below). |
| `src/lib/freePreview/hubStage.ts` | `convertedAt` + `previewReadyAt` → Launch (direct subscribers stay Designing until ops marks ready). |
| `src/lib/freePreview/opsActions.ts` | `mark_ready_and_send` writes `CONVERTED` when `convertedAt` is already set. |
| `src/lib/freePreview/conversion.ts` | After convert, send owner subscribed email when the hub flag is on. |
| `src/lib/freePreview/emails.ts` | Subscribed, launch-approved (ops), site-live builders. |
| `src/lib/freePreview/opsQueries.ts` | “Approved — ready to launch” sort (approved + not live first). |
| `src/lib/freePreview/createPreviewRequest.ts` | New `hub_*` / `ops_hub_*` action names. |
| `src/lib/analytics/funnelEvents.ts` | `launch_checklist_item_completed`, `launch_approved`, `site_live`. |
| `src/lib/email/sender.ts` | SaaS confirmation: flag on → “Let’s put {shop} live” + “Open your launch checklist”. Flag off unchanged. Button still goes to `/setup/success` (claim required). |
| `src/lib/admin/clientOnboarding/schema.ts` | Additive optional Ltd fields on the draft schema (legacy wizard still does not ask). |
| `src/lib/admin/clientOnboarding/service.ts` | Read/write the two new columns. |
| `src/components/admin/clientOnboarding/types.ts` | Draft type includes the two columns so GET/save stay typed. |

### Owner APIs + page
| File | Why |
|---|---|
| `src/pages/admin/preview-launch.astro` | Flag off: existing `PreviewLaunchOnboarding` + prefill. Flag on: login gate + `HubLaunchChecklist`. |
| `src/pages/api/admin/preview-launch/index.ts` | GET / PATCH autosave (business / payments skip / migration skip + CSV). |
| `src/pages/api/admin/preview-launch/approve.ts` | Approve for launch. |
| `src/pages/api/admin/preview-launch/domain-confirm.ts` | “I’ve done this” DNS confirmation. |
| `src/pages/api/setup/claim-paid-subscription.ts` | After claim: preview shops → checklist; new direct Full shops get a hub then the checklist. Legacy wizard shops unchanged. |
| `src/pages/api/admin/barbershop-settings/retail.ts` | **D1:** refuse `retailEnabled=true` unless the shop has ≥1 active product. Unconditional (see Decisions). |

### Owner UI
| File | Why |
|---|---|
| `src/components/previewHub/HubLaunchChecklist.tsx` | Five-item checklist: Ltd gate, DNS / Stripe / CSV, approve. Autosave, progress bar, collapsible Done states. Does not write `launchRetail` / `launchDeposits`. |
| `src/components/previewHub/HubOverview.astro` | Launch progress (states only) + Live next-step cards. |
| `src/pages/preview/[token]/overview.astro` | Wires Launch / Live blocks. |
| `src/styles/components/preview-hub.css` | Checklist, progress, live cards. |

### Ops
| File | Why |
|---|---|
| `src/pages/api/ops/preview-requests/[id]/launch-steps.ts` | Domain connected / SSL active / Mark live (confirmations + events + live email + `site_live`). |
| `src/components/ops/previewRequests/PreviewRequestActions.tsx` | The three launch actions. |
| `src/pages/ops/preview-requests/index.astro` | “Approved — ready to launch” badge. |
| `src/pages/ops/preview-requests/[id].astro` | Launch-steps block. |
| `src/styles/components/ops-preview-requests.css` | Approved badge + launch-steps row. |

### Tests + capture
| File | Why |
|---|---|
| `src/lib/freePreview/ukCompanyNumber.test.ts` | Valid / invalid UK numbers. |
| `src/lib/freePreview/hubLaunch.test.ts` | Sole vs Ltd completeness; skip payments/migration; states-only progress. |
| `src/lib/freePreview/directSubscribe.test.ts` | New shops yes; existing preview / wizard-in-progress no. |
| `src/lib/freePreview/hubDefaults.test.ts` | Conversion / claim / checklist never set `retailEnabled` or `bookingPaymentMode`; retail API has the product gate. |
| `src/lib/freePreview/hubRoutes.flagOff.test.ts` | Flag-off preview-launch still mounts `PreviewLaunchOnboarding`. |
| `src/lib/freePreview/hubStage.test.ts` | Direct-subscribe Designing until ready; then Launch / Live. |
| `src/lib/freePreview/emails.test.ts` | New email builders + flag-off HTML unchanged. |
| `src/lib/freePreview/conversion.test.ts` | Convert does not write retail / payment mode; subscribed notify when hub on. |
| `src/lib/email/saasSubscriptionConfirmationEmail.test.ts` | Flag-off SaaS email unchanged; flag-on subject/button. |
| `src/components/previewHub/HubLaunchChecklist.test.ts` | Sole trader never sees company fields; no retail/deposits writes. |
| `src/components/previewHub/HubOverview.test.ts` | Launch / Live copy; no sensitive values. |
| `src/pages/api/admin/preview-launch/*.test.ts` | Happy path, auth, validation. |
| `src/pages/api/ops/preview-requests/[id]/launch-steps.test.ts` | Ops steps, confirmations, flag-off. |
| `src/pages/api/admin/barbershop-settings/retail.test.ts` | Product gate. |
| `src/pages/api/admin/client-onboarding/index.test.ts` | Fixture includes the new columns. |
| `src/components/admin/clientOnboarding/ClientOnboardingWizard.test.tsx` | Same. |
| `src/lib/freePreview/opsQueries.hubFiles.test.ts` | Approved rows sort first. |
| `scripts/preview-hub/capture-batch-5.mjs` | Playwright fixtures at 360 and 1280. |

---

## Migrations

`prisma/migrations/20261031250000_preview_hub_5/migration.sql`

- `ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_HUB_SUBSCRIBED'`
- `ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_HUB_LAUNCH_APPROVED_INTERNAL'`
- `ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_HUB_SITE_LIVE'`
- `ALTER TABLE "ClientOnboarding" ADD COLUMN "isLimitedCompany" BOOLEAN`
- `ALTER TABLE "ClientOnboarding" ADD COLUMN "registeredOfficeAddress" TEXT`

No drops, no renames. No backfill. Existing `launchRetail` / `launchDeposits` columns left in place and are no longer written from the new UI.

---

## New env vars

None. Hub still requires `PREVIEW_HUB_ENABLED=true` **and** `FREE_PREVIEW_FLOW_ENABLED=true`. Default off.

---

## New copy (beyond HUB_SPEC §9)

All in `hubCopy.ts`. §9.2 Launch / Live headers and §9.3 Ltd + payments strings kept exactly (`HUB_LAUNCH_LTD_QUESTION`, `HUB_LAUNCH_LTD_HELPER`, `HUB_PAYMENTS_OPTIONAL`). Extra Batch 5 strings:

- Checklist chrome: `Launch checklist`, `{n} of {n} done`, Your steps / Our steps, Done / To do / Pending / In progress, item titles
- Business fields: name shown on website, public phone/email, address, town, postcode, private contact, Ltd Yes/No, registered company name / number / office, validation (`Limited companies need a registered name, number and office address.`)
- Domain: registrar-agnostic DNS steps, “I’ve done this”, “We’re registering {domain}.”
- Payments / migration skip labels
- Approve: intro, preview links, existing rights + accuracy confirmations, “Approve for launch”, blocked copy, thanks copy
- Live next cards: Google booking link, QR Kit, deposits, retail, team hours
- Ops: Domain connected / SSL active / Mark live + confirmations, “Approved — ready to launch”
- Emails: `Let's put {shop} live`, `Ready to launch: {shop}`, `{shop} is live`
- Retail API: `Add at least one active product before enabling retail checkout.`

No response-time promises, no guaranteed dates.

---

## Decisions taken in this batch

1. **Live marker is `PreviewRequest.liveAt`.** Batch 0 found no existing shop live field that means “public site published”. Ops “Mark live” sets `liveAt`. Does not write `goLiveAt`.
2. **Approve writes `launchApprovedAt` only.** Does not call the old `approveSiteLaunch` helper or set `goLiveAt`.
3. **D1 product gate is unconditional.** Batch 0 (g) said the dashboard `PATCH …/retail` had no product count. This batch’s acceptance requires the gate, so it is enforced for every shop, flag on or off. This is the **one** flag-off production behaviour change. Error copy is British English from `HUB_RETAIL_NEEDS_PRODUCT`. The “site is live” extra gate from D1 is still not on the settings PATCH (retail onboarding stays the path after launch).
4. **D2 stays NONE.** Conversion, draft-shop create, claim, direct-subscribe and the checklist never write `bookingPaymentMode`. Source-level test in `hubDefaults.test.ts`.
5. **Direct subscribe is not risky if gated.** Batch 0 (e): a direct Full subscriber today gets `ClientOnboardingWizard` and no `PreviewRequest`. We create a hub only when there is no existing `PreviewRequest` **and** onboarding is missing or `DRAFT` at step 0 with no `submittedAt`. Shops already on the 11-step wizard are left on it. `/admin/client-onboarding` stays reachable for them.
6. **Direct-subscribe hub stage:** status `IN_PROGRESS` + `convertedAt` → Designing until ops `mark_ready_and_send` (which now writes `CONVERTED` when `convertedAt` is set) → Launch.
7. **Two subscribed emails when the hub is on.** (a) Stripe SaaS confirmation: subject/button adapted, URL still `/setup/success` so guests can claim. (b) Hub outbox `FREE_PREVIEW_HUB_SUBSCRIBED` after convert / direct-subscribe, button to `/admin/preview-launch`. Flag-off SaaS HTML is the previous body.
8. **DNS copy is registrar-agnostic.** No invented IPs or hostnames. “I’ve done this” records owner confirmation (`hub_domain_confirmed`); `ourStepDomainAt` is ops-only.
9. **Token hub shows states only.** `loadHubLaunchProgress` / `hubLaunchProgressFrom` omit address, company number, emails, Stripe and CSV contents. Live URL is returned only after `liveAt`.
10. **Ltd fields on the legacy draft schema** are additive so GET/save stay typed. The 11-step wizard still does not ask the Ltd question (sole traders on that path are unchanged).
11. **Live next-step links** (existing pages):  
    `/insights/google-business-profile-booking-link-barbershop` · `/admin?section=barbershop_settings#qr-kit` · deposits settings · `/admin/retail-onboarding` · `/admin?section=team`.

---

## Screenshots

Saved under `docs/preview-hub/screens/batch-5/` (Playwright, 360px and 1280px, full page). Fixture markup + real hub / ops CSS. Capture script: `scripts/preview-hub/capture-batch-5.mjs`.

| Screen | 360 | 1280 |
|---|---|---|
| Checklist — sole trader (Ltd = No, no company fields) | `checklist-sole-360.png` | `checklist-sole-1280.png` |
| Checklist — Ltd (name, number, office) | `checklist-ltd-360.png` | `checklist-ltd-1280.png` |
| Hub Overview — Launch progress | `overview-launch-360.png` | `overview-launch-1280.png` |
| Hub Overview — Live + next cards | `overview-live-360.png` | `overview-live-1280.png` |
| Ops list — Approved badge | `ops-approved-360.png` | `ops-approved-1280.png` |
| Ops — Domain / SSL / Mark live | `ops-launch-steps-360.png` | `ops-launch-steps-1280.png` |

390 / 768 were not separately shot; 360 covers the phone column and 1280 the desktop shell. Word-spacing in fixture captures matches Batch 4 (webfonts not loaded in the file:// page).

---

## Test results

| Command | Result |
|---|---|
| `npm run claims:check` | Pass |
| `npm run typecheck` | Pass (0 errors) after adding Ltd fields to `DraftFields` and fixing a `never` on the direct-subscribe lookup |
| Batch 5 vitest (20 files, 134 tests in the two targeted runs) | Pass — sole vs Ltd, skip payments/migration, states-only progress, UK company numbers, retail product gate, D1/D2 source proof, flag-off preview-launch + SaaS email, direct-subscribe gating, Launch/Live stage, approve/domain/ops APIs, emails |
| Full `npm test` | First run: 2 failed / 5714 passed — `brandTokens` (`var(--color-brand, #d72638)` fallback in `preview-hub.css`; fixed to `var(--color-brand)`) and known-flaky `financialEndpoints` MANAGER 403 timeout. Rerun of both files: 27/27 pass. |
| `npm run build` | Pass |

---

## Anything I could not do

- **Live sole-trader / Ltd pass on a real claimed shop** (fill checklist → skip Stripe/CSV → approve → ops Mark live → hub Live + owner email). No seeded converted hub row in this environment. Covered by unit/API/UI tests. Confirm after migrate + both flags on.
- **Live direct-subscribe** (new Full shop, empty onboarding → hub Designing → ops mark ready → Launch). Covered by `shouldCreateDirectSubscribeHub` + `hubStage` tests.
- Live Playwright against `/admin/preview-launch` and hub routes. Screenshots are CSS-accurate fixtures.
- Apply the migration to a hosted database (`prisma migrate deploy` is for the operator).
- Horizontal-scroll check at 390 / 768 on a running server.

---

## Open questions

Carried from Batch 1–4:

1. Converting REJECTED/DECLINED if they pay — current webhook still allows it.
2. Should `/preview/{token}/overview` redirect to `/preview/{token}`?
3. Should unused `MESSAGE_ATTACHMENT` files stay until purge?
4. Team bio / show-on-website still have nowhere to persist on `Barber`.
5. Review apply is not one wrapping transaction (idempotent retry).

Resolved this batch:

- Approve-for-launch uses `PreviewRequest.launchApprovedAt` (not `approveSiteLaunch` / `goLiveAt`).
- Direct-subscribe hub: implemented, gated to new empty onboardings.
- D1 dashboard product gate: implemented on `PATCH …/retail` (live-site extra gate still not added).

New:

6. Guests still claim via `/setup/success` before the checklist. The SaaS email button cannot go straight to `/admin/preview-launch` without that claim. Is the extra hub subscribed email (after convert) enough, or should claim redirect always win?
7. Direct-subscribe shops sit in Designing with an empty draft shop until ops creates/fills one and marks ready. Should ops get a distinct “Direct subscribe — needs preview” badge?
8. Retail “site is live” extra gate from D1 is still open if the founder wants it later.

---

## Acceptance

| Item | Status |
|---|---|
| Sole trader completes the checklist without ever seeing legal name / company number | **Pass in tests + fixtures.** `businessDetailsComplete` with `isLimitedCompany: false` does not require those fields. `HubLaunchChecklist` renders company name/number/office only when Yes. Confirm on a claimed shop. |
| Ltd owner must fill the three fields before approval | **Pass in tests.** Incomplete Ltd (missing name / number / office / invalid number) cannot complete; approve returns `BUSINESS_INCOMPLETE`. |
| Skipping Stripe and migration still allows approval | **Pass in tests.** Schema accepts `skip: true` for both; approve only requires business complete + the two confirmations. |
| After “Mark live”, hub shows the live state and the owner gets the live email | **Pass in unit/API tests.** `ops_hub_mark_live` sets `liveAt`, sends `FREE_PREVIEW_HUB_SITE_LIVE`, analytics `site_live`; `resolveHubState` → Live. **Not proven on a real token.** |
| Tests prove `retailEnabled` cannot be set true without ≥1 active product | **Pass** (`retail.test.ts` + `hubDefaults.test.ts`) |
| `bookingPaymentMode` remains `NONE` through conversion | **Pass** (`hubDefaults.test.ts` + conversion shop-update keys) |
| Flag off: owner behaviour unchanged | **Pass except D1.** Preview-launch still mounts the old form; SaaS email HTML unchanged; new launch APIs 404 via `isHubRouteEnabled`. Retail product gate is on regardless of the flag (acceptance + Batch 0 gap). |
| Existing shops on the legacy wizard untouched | **Pass in tests.** `shouldCreateDirectSubscribeHub` is false once `currentStep > 0` or submitted. |

**Batch 5 product code is in place** behind `PREVIEW_HUB_ENABLED` (except the D1 retail product gate). The live sole/Ltd checklist and Mark-live email passes are the remaining acceptance gaps — do not treat those two as done until confirmed on a seeded converted shop.
