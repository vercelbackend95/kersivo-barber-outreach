# Batch 0 findings — KERSIVO Shop Hub

Discovery only. No product code was changed. Citations are `path:start-end` against `origin/main` as of 31 October 2026 (`88f600e3`).

The source spec `KERSIVO_Shop_Hub_Spec_v1.md` was **not attached** to this chat and was not found on disk. Conflicts in §14 are therefore GLOBAL RULES + Batch 0 questions versus the code. Re-run the conflict list after the exact spec is supplied.

---

## a. Preview lifecycle

### Enum

`PreviewRequestStatus` (`prisma/schema.prisma:1530-1541`):

| Value | Schema note |
|---|---|
| `REQUESTED` | default (`status @default(REQUESTED)` at `prisma/schema.prisma:1550`) |
| `IN_PROGRESS` | |
| `READY` | |
| `CHANGES_REQUESTED` | comment: returns to `READY` when ops sends the updated preview (`prisma/schema.prisma:1528-1529`) |
| `CONVERTED` | |
| `DECLINED` | “Owner said no thanks” (`prisma/schema.prisma:1536-1537`) |
| `EXPIRED` | |
| `REJECTED` | “Not eligible (set by ops; no email is sent)” (`prisma/schema.prisma:1539-1540`) |

There is no `NO_THANKS` status. “No thanks” writes `DECLINED`.

### Actual state machine

```
                    createPreviewRequest
                         │
                         ▼
                    REQUESTED ◄──────────────► IN_PROGRESS
                         │                         │         ops set_status
                         │                         │
                         └──────────┬──────────────┘
                                    │ ops mark_ready_and_send (E3)
                                    ▼
                    ┌──────────── READY ◄──────────────────────────┐
                    │              │                               │
                    │              │ owner requestPreviewChanges    │ ops mark_ready_and_send (E4)
                    │              ▼                               │
                    │     CHANGES_REQUESTED ───────────────────────┘
                    │              │
                    │ expireDuePreviews (READY | CHANGES_REQUESTED, expiresAt ≤ now)
                    ▼
                 EXPIRED ──ops mark_ready_and_send──► READY   (server allows; ops UI does not)
                    │
                    │ owner declinePreviewByToken
                    │ (READY | CHANGES_REQUESTED | EXPIRED)
                    ▼
                 DECLINED

Any non-final ──ops reject──► REJECTED     (final = CONVERTED | REJECTED)
Any except CONVERTED ──webhook markPreviewRequestConverted──► CONVERTED
```

### Every `status` write

| From | To | Function | File:line | Guard |
|---|---|---|---|---|
| *(none)* | `REQUESTED` | `createPreviewRequest` | `src/lib/freePreview/createPreviewRequest.ts:72-100` | Prisma default. Event `CREATED` with `toStatus: 'REQUESTED'` at line 96. Duplicate retry at `62-64` does **not** change status. |
| `REQUESTED` ↔ `IN_PROGRESS` | same pair | `executePreviewRequestOpsAction` (`set_status`) | `src/lib/freePreview/opsActions.ts:122-140` | `allowedFrom` is only `REQUESTED` \| `IN_PROGRESS` (123). `OPS_SETTABLE_STATUSES` (12). Same-status is a no-op (125). |
| `REQUESTED` \| `IN_PROGRESS` \| `CHANGES_REQUESTED` \| `EXPIRED` | `READY` | `executePreviewRequestOpsAction` (`mark_ready_and_send`) | `src/lib/freePreview/opsActions.ts:202-241` (write 221-223) | Needs draft shop + `sitePreviewUrl` (205-206). Flow flag on (203). `CHANGES_REQUESTED` sends E4, others E3 (208). Sets `previewReadyAt` + new `expiresAt`. |
| `READY` \| `CHANGES_REQUESTED` | `CHANGES_REQUESTED` | `requestPreviewChanges` | `src/lib/freePreview/requestChanges.ts:33-53` (write 51-53) | `ownerCanActOnPreview` = status in `READY` \| `CHANGES_REQUESTED`, has `draftShopId`, not expired (`src/lib/freePreview/previewAccess.ts:5-6, 56-64`). Second message is a self-loop that replaces the text. |
| `READY` \| `CHANGES_REQUESTED` \| `EXPIRED` | `DECLINED` | `declinePreviewByToken` | `src/lib/freePreview/noThanks.ts:29-56` (write 39-42) | `DECLINABLE_STATUSES` at line 8. Idempotent. Also sets `emailOptOut`. |
| `READY` \| `CHANGES_REQUESTED` | `EXPIRED` | `expireDuePreviews` | `src/lib/freePreview/lifecycle.ts:75-102` (write 84-86) | `EXPIRABLE_STATUSES` at line 35. Cron: `src/pages/api/cron/free-preview-lifecycle.ts:11` → `runFreePreviewLifecycle` at `lifecycle.ts:365-366`. |
| *any except `CONVERTED`/`REJECTED`* | `REJECTED` | `executePreviewRequestOpsAction` (`reject`) | `src/lib/freePreview/opsActions.ts:143-160` (write 145-148) | `FINAL_PREVIEW_STATUSES = ['CONVERTED','REJECTED']` (15). Anonymised rows blocked (101). No email. |
| *any except `CONVERTED`* | `CONVERTED` | `markPreviewRequestConverted` | `src/lib/freePreview/conversion.ts:15-48` (write 26-33) | Where: matching `id` + `draftShopId`, `status ≠ CONVERTED`. **No from-status filter.** Caller: Stripe webhook `src/pages/api/shop/webhook.ts:695-704`. |

Ops entry: `POST /api/ops/preview-requests/[id]` → `executePreviewRequestOpsAction`. Owner changes entry: `src/pages/api/free-preview/[token]/changes.ts`. Create entry: `src/pages/api/free-preview.ts:79`.

### Places the prompt named — status or not

| Named place | Changes `status`? | Evidence |
|---|---|---|
| `createPreviewRequest` | yes → `REQUESTED` | `createPreviewRequest.ts:72-96` |
| `opsActions` | yes: `set_status`, `reject`, `mark_ready_and_send` | `opsActions.ts:122-140, 143-160, 202-223` |
| `requestChanges` | yes → `CHANGES_REQUESTED` | `requestChanges.ts:51-53` |
| `noThanks` | yes → `DECLINED` | `noThanks.ts:39-42` |
| `lifecycle` | yes, only `expireDuePreviews` | `lifecycle.ts:84-86`. Follow-up claim (`118-126`) writes timestamps with `status: 'READY'` as a **where** clause. `anonymisePreviewRequest` (`264-289`) wipes PII; **status is kept**. |
| `conversion` | yes → `CONVERTED` | `conversion.ts:26-33`. `adoptPreviewDraftShop` (`106-197`) writes event `DRAFT_SHOP_ADOPTED` (`188-194`) and does **not** change status. |
| webhook (`shop/webhook`) | yes, only by calling `markPreviewRequestConverted` | `webhook.ts:695-704` |
| `claim-paid-subscription` | **no** | Looks up by `draftShopId` and calls `adoptPreviewDraftShop` (`src/pages/api/setup/claim-paid-subscription.ts:224-247, 269-270`). Status is expected to already be `CONVERTED` from the webhook. |

Ops actions that do **not** change status: `update_notes` (`opsActions.ts:111-119`), `create_draft_shop` (`163-176`), `link_draft_shop` (`179-199`), `set_site_preview` (`250-283`).

### UI vs server mismatch

Server `MARK_READY_FROM_STATUSES` includes `EXPIRED` (`opsActions.ts:32-37`). Ops UI `MARK_READY_FROM` is only `REQUESTED | IN_PROGRESS | CHANGES_REQUESTED` (`src/components/ops/previewRequests/PreviewRequestActions.tsx:39, 53`) — no Expired button, even though the API would accept it.

`DECLINED` is not ops-final (`FINAL_PREVIEW_STATUSES` is only `CONVERTED`/`REJECTED`, `opsActions.ts:15`), so Reject / create-draft still apply after decline. Convert from the webhook can also fire from `DECLINED`/`EXPIRED`/`REJECTED` because conversion only excludes `CONVERTED`.

---

## b. How `draftShop` is created and filled

### Model link

```1580:1581:prisma/schema.prisma
  draftShopId String?       @unique
  draftShop   ShopSettings? @relation(fields: [draftShopId], references: [id], onDelete: SetNull)
```

`ShopSettings.sitePreviewUrl` (and version / ready-at) at `prisma/schema.prisma:287-291`. Reverse relation `previewRequest` at `:329`.

### Create (ops)

`executePreviewRequestOpsAction` `create_draft_shop` (`opsActions.ts:163-176`) calls `createDraftShop` (`src/lib/preview/shopPreviewSession.ts:87-105`):

- name / town from the request
- `ownerUserId: null`
- `publicActivityPaused: true` with `GUEST_PREVIEW_PAUSE_REASON` (“Shop under construction — goes live after subscription.”)
- **Empty at birth:** no services, barbers, hours, logo, or `sitePreviewUrl`

`link_draft_shop` (`opsActions.ts:179-199`) attaches an existing **ownerless** shop that is not already linked.

Guest onboarding uses the same `createDraftShop()` via `createPreviewShopSession` (`shopPreviewSession.ts:107-125`) — a **different** shop, cookie-bound, not auto-linked to a `PreviewRequest`.

Ops UI has create/link + site URL only (`PreviewRequestActions.tsx:217-264`). There is **no ops API that writes services, barbers, hours, or logo** onto the draft.

### Fill: `sitePreviewUrl`

One writer: `applySitePreview` (`src/lib/setup/sitePreview.ts:26-65`). Callers:

1. Ops action `set_site_preview` → `setSitePreview` (`opsActions.ts:250-273`)
2. Machine `POST /api/ops/site-preview` (`src/pages/api/ops/site-preview.ts:24-57`) — Bearer `CRON_SECRET`

`mark_ready_and_send` **reads** `draftShop.sitePreviewUrl` (`opsActions.ts:206`) and refuses if missing. It does not set the URL.

### Fill: logo

No ops action. Logo is `ShopSettings.logoUrl`, written after `storeShopLogo` (`src/lib/storage/storeShopLogo.ts:11`).

| Path | File:line |
|---|---|
| Dashboard identity | `src/pages/api/admin/barbershop-settings/identity.ts` |
| Signed-in onboarding shop step | `src/pages/api/admin/onboarding/shop.ts` |
| Guest preview shop step | `src/pages/api/preview/onboarding/shop.ts` |

Reusable: **`storeShopLogo(file, shopId)`**, then `shopSettings.update({ logoUrl })`.

### Reusable service-layer writers (dashboard / onboarding)

There is **no** extracted `saveOnboardingServices` / `saveOnboardingBarbers`. List sync is inlined Prisma in the API routes. Named functions the hub can reuse to “apply” owner corrections:

#### Opening hours (shop)

| Function | File:line | Used by |
|---|---|---|
| **`replaceShopOpeningHours(shopId, rules)`** | `src/lib/admin/shopOpeningHours.ts:77-93` | Dashboard `src/pages/api/admin/barbershop-settings/hours.ts`. Onboarding `src/pages/api/admin/onboarding/shop-hours.ts`. Guest preview `src/pages/api/preview/onboarding/shop-hours.ts`. |
| `serializeShopOpeningHours` | `shopOpeningHours.ts:29` | reads |

#### Barber working hours

| Function | File:line | Used by |
|---|---|---|
| **`replaceBarberAvailabilityRules(barberId, rules)`** | `src/lib/admin/onboarding.ts:165-186` | Onboarding hours `src/pages/api/admin/onboarding/hours.ts`. Guest preview hours `src/pages/api/preview/onboarding/hours.ts`. |
| `ensureBarberHasAvailabilityRules(barberId)` | `src/lib/admin/defaultAvailability.ts:10-54` | Dashboard barber create `src/pages/api/admin/barbers.ts`. |

Per-barber dashboard editor inlines the same delete+create at `src/pages/api/admin/barbers/[id]/rules.ts`. Prefer the named helper.

#### Services

No shared save helper. Best bulk apply is the onboarding list sync:

- `PUT /api/admin/onboarding/services` — update-or-create selected, `updateMany isActive: false` for the rest (`src/pages/api/admin/onboarding/services.ts:66-109`), then **`linkAllServicesToAllBarbers(shopId)`** (`src/lib/admin/onboarding.ts:188-205`, called at `services.ts:111`)
- Dashboard one-at-a-time: `POST /api/admin/services`, `PATCH /api/admin/services/[id]`
- Guest clone: `src/pages/api/preview/onboarding/services.ts`

Also reusable: `ensureBarberHasAllServices`, `ensureCustomServiceCategory`, `unfeatureOtherServicesInCategory`.

#### Barbers

Onboarding list sync (inline): `src/pages/api/admin/onboarding/barbers.ts`. Dashboard Team (named):

| Function | File:line |
|---|---|
| **`createStandaloneBookingProfile`** | `src/lib/admin/teamCreation.ts:295-312` |
| **`createBookingProfileForMember`** | `teamCreation.ts:318` |
| **`createTeamInviteWithOptionalProfile`** | `teamCreation.ts:591` |
| `linkMemberToBarber` | `src/lib/admin/onboardingOwnerSeat.ts:10` |

### Auth constraint if dashboard routes are reused as-is

`resolveAdminAccess` prefers a Better Auth session over the preview cookie (`src/lib/admin/auth.ts`). An operator logged into `/ops` cannot drive `/preview/onboarding` in the same browser. Onboarding APIs require `via === 'session'` + `userId`, so they will not run against an **ownerless** draft until claim. Guest preview APIs would work if a `ShopPreviewSession` existed for that shop — which ops never mints.

Conversion comments that KERSIVO already built the workspace and sets `onboardingCompleted: true` (`src/lib/freePreview/conversion.ts:162-164`). `adoptPreviewDraftShop` then prefills `ClientOnboarding` from the request (`174-186`), not from catalogue rows.

**Practical fill path today:** ops creates/links an ownerless shop, sets `sitePreviewUrl` in ops, and must fill catalogue through dashboard/onboarding/guest-preview APIs (or by linking a shop already filled that way). There is no “apply corrections” ops action.

---

## c. How `sitePreviewUrl` is built and hosted

**External / manual build. This repo does not render tenant websites.**

`applySitePreview` is explicit: it **points a shop at an externally built website** (`src/lib/setup/sitePreview.ts:21-25, 41-54`). URL must be `https://` (`5-16`).

How the URL is set: see §b. How it is shown: this repo **iframes** the external URL.

- Owner review: `/admin/site-preview` → `SitePreviewShell` (`src/pages/admin/site-preview.astro`). Approve calls `POST /api/admin/site-launch/approve`.
- Public free-preview token page: iframe + “open in new tab” fallback (`src/pages/preview/[token].astro`).

Config: previews are built by hand (`src/lib/freePreview/config.ts:25-30`). Discovery doc: one Vercel project per shop, attached via `sitePreviewUrl` (`docs/free-preview-discovery.md:30-37`). Tenant projects are **not** created with the `vercel` CLI from this folder (`CLAUDE.md`).

**Implication for Batch 6 pin mode:** this repo can add UI on the wrapper (`SitePreviewShell`, `preview/[token].astro`). It cannot inject JS into the iframed origin unless ops add that script when they build each tenant project.

---

## d. “Live” marker

**There is no `sitePublished`, `liveAt`, or `domainPublished` field.** Closest existing fields mean different things.

| Field | Meaning | Not |
|---|---|---|
| `launchApprovedAt` + `launchApprovedVersion` | Owner approved the current `sitePreviewVersion` (`prisma/schema.prisma:292-296`) | DNS / public domain live |
| `goLiveAt` | Timestamp recorded **at that same approve click** (`prisma/schema.prisma:297-298`: “physical DNS switch = OPS”) | Physical DNS switch |
| `publicActivityPaused` | Public booking/retail pause; draft shops start paused | Website published |
| `FullBookingDestination.status = VERIFIED_LIVE` | OPS attested the **own-domain booking URL** is live (`prisma/schema.prisma:332-347`) | Generic “site published” |

`approveSiteLaunch` sets approval + `goLiveAt` together (`src/lib/setup/siteLaunch.ts`). The launch status API is explicit: preview approval / `goLiveAt` never imply a live domain (`src/pages/api/admin/site-launch/index.ts:41-63`). `resolvePublicBookingDestination` uses own-domain only when `FullBookingDestination.status === 'VERIFIED_LIVE'` (`src/lib/shop/publicBookingDestination.ts`).

`publishedCatalogueVersion` / `publishedSetId` are Smart Retail catalogues, not the shop website.

**If spec §2 then adds `PreviewRequest.liveAt`:** that field does not exist today. The recommended existing stand-in for “own-domain booking is live” is `FullBookingDestination.status === VERIFIED_LIVE`. Owner-approved preview is `getSiteLaunchStatus(...) === 'approved'`.

---

## e. Direct subscription flow

**A direct subscriber gets `ClientOnboardingWizard` at `/admin/client-onboarding`. They do not get `/admin/preview-launch`. No `PreviewRequest` is created.**

### Path

1. `/admin/launch` (`src/pages/admin/launch.astro`) renders `LaunchWizard`.
2. Pay: guest → `POST /api/setup/subscription-checkout`; signed-in → `POST /api/setup/launch-subscription-checkout`. Guest checkout may attach a **guest-cookie** draft shop (`ShopPreviewSession`), **not** a `PreviewRequest`.
3. Stripe Checkout → `/setup/success?session_id=…`.
4. Webhook marks the SaaS row ACTIVE. Accounts are not created here.
5. `/setup/success` → `SetupSuccessSaasContinue` → `POST /api/setup/claim-paid-subscription`.
6. Claim (`src/pages/api/setup/claim-paid-subscription.ts:216-274`): **only if** `record.shopId` is a draft linked to a `PreviewRequest`, `adoptPreviewDraftShop` and `redirectTo: '/admin/preview-launch'`. Otherwise **no `redirectTo`**.
7. Client default (`src/components/setup/SetupSuccessSaasContinue.tsx:27-31`): `/admin/client-onboarding`.
8. `/admin/client-onboarding` mounts `ClientOnboardingWizard` — full delivery form. Submit → `POST /api/admin/client-onboarding/submit`.

The only creator of a `PreviewRequest` is `createPreviewRequest` from `POST /api/free-preview` (`src/pages/api/free-preview.ts:79`). Launch/checkout/claim never call it. `/admin/preview-launch` **refuses** shops without a `PreviewRequest` (`src/pages/admin/preview-launch.astro:26-30`; `src/lib/freePreview/previewOnboarding.ts:37-59`).

---

## f. `/admin/preview-launch` today

Shortened post-purchase form for **adopted free-preview shops only**. Website/workspace already exist; this collects contact, domain, optional Stripe Connect, and declarations.

### Gate

`src/pages/admin/preview-launch.astro:21-30`: session + `billing.manage`; `loadPreviewOnboarding(shopId)` must return a row. Else → `/admin/client-onboarding`.

### Fields (`src/components/freePreview/PreviewLaunchOnboarding.tsx:13-28, 127-206`)

| Area | Fields |
|---|---|
| Contact | `primaryContactName`, `primaryContactEmail` |
| Address | `addressLine1`, `townCity`, `postcode` |
| Public | `publicEmail`, `publicPhone` (phone optional) |
| Domain | `DomainSearcher`: `EXISTING` / `KERSIVO_REGISTER`, `existingDomain` / `preferredDomain1`, registration authorised |
| Migration | checkbox if preview request had a booking system |
| Stripe | optional “Connect Stripe” (not required to submit) |
| Confirm | content rights, information accuracy |

No retail, deposits, brand, team, or services steps.

### Validation

- Client HTML `required` on name, email, address, town, postcode (`132-148`).
- Server: `PATCH /api/admin/client-onboarding` then `POST /api/admin/client-onboarding/submit` (`65-80`).
- Submit uses `validateClientOnboardingSubmit` (`src/lib/admin/clientOnboarding/schema.ts:222-312`): contact + address; public email **or** phone; ≥1 barber, service, shop-open day, barber-availability day (already on the draft shop); domain not `UNDECIDED`; content rights + accuracy; migration if requested. `launchRetail` is not sent, so the retail product rule does not apply.

### What “submitted” does

Same as the full wizard (`src/lib/admin/clientOnboarding/service.ts`):

- `ClientOnboarding.status` → `SUBMITTED`, `submittedAt` set
- `SaasSubscription.onboardingSubmittedAt` set if still null
- Internal ops email + customer confirmation

Does **not** set `retailEnabled`, `bookingPaymentMode`, `goLiveAt`, `sitePreviewUrl`, or `FullBookingDestination`. Success copy: “Nothing goes live until you approve it” (`PreviewLaunchOnboarding.tsx:105-111`).

### Stripe Connect

Optional `POST /api/admin/barbershop-settings/deposits` (`PreviewLaunchOnboarding.tsx:36-47`). That handler creates a Standard Connect account if needed and returns an Account Link. Refresh/return URLs: `/admin?section=barbershop_settings&connect=refresh|return`. **ClientOnboardingWizard has no Connect step.**

---

## g. Retail activation

**Confirmed: `retailEnabled` is only written by `PATCH /api/admin/barbershop-settings/retail.ts` (settings checkbox). Onboarding paths do not set it. “At least one product” is not required to flip `retailEnabled=true`.**

The only writer (`src/pages/api/admin/barbershop-settings/retail.ts:56-91`):

- Gates: paid shop + Connect charges enabled (`82-86`)
- **No product-count check**
- Schema default is `false` (`prisma/schema.prisma:276`)

`ClientOnboarding.launchRetail` is a **preference** only. Submit copies it onto the onboarding row (`src/lib/admin/clientOnboarding/service.ts:399`). `validateClientOnboardingSubmit` if `launchRetail === true` requires a product **or** `retailProductsDeferred` (`schema.ts:304-309`) — still does not set `ShopSettings.retailEnabled`.

`PreviewLaunchOnboarding` never sends `launchRetail`. Retail onboarding (`RetailOnboardingWizard`, first-product create) sets `retailOnboardingCompleted`. **No `retailEnabled` writes** in that folder.

Repo-wide, the only `data: { retailEnabled: ... }` write on a live shop is `retail.ts:91`. Demo/bootstrap code sets `false` for the demo shop.

---

## h. Booking payment default

**Yes: `bookingPaymentMode` defaults to `NONE` (pay at shop). Nothing in provision, draft-shop, preview→launch, claim, or client-onboarding submit changes it.** The only writer is the settings PATCH.

- Enum + default: `prisma/schema.prisma:39-41, 273-274`
- `provisionShopForUser` creates name, timezone, owner, onboarding flags only (`src/lib/auth/provisionShop.ts:43-57`)
- `createDraftShop` sets pause/construction reason only (`shopPreviewSession.ts:87-104`)
- `adoptPreviewDraftShop` sets `ownerUserId` + `onboardingCompleted` only (`conversion.ts:158-166`)
- `applySitePreview` / `approveSiteLaunch` do not mention it
- Claim is tested **not** to match `bookingPaymentMode` (`src/lib/setup/fullKersivoUpgrade.test.ts:215-227`)
- `ClientOnboarding.launchDeposits` is a preference field only (`service.ts:400`)
- Only writer: `PATCH /api/admin/barbershop-settings/deposits` (`src/pages/api/admin/barbershop-settings/deposits.ts:256-338`)

---

## i. Private blob helpers

**File:** `src/lib/storage/privateOnboardingBlob.ts`

There is no generic `put`/`get`/`delete`/`stream` export. The private-store wrappers are:

| Role | Function | Lines |
|---|---|---|
| Put | `uploadPrivateOnboardingFile` | 225-248 — `@vercel/blob` `put(..., { access: 'private' })` |
| Delete | `deletePrivateOnboardingFile` | 250-255 |
| Get + stream | `retrievePrivateOnboardingFile` | 261-286 — returns `{ stream, contentType, statusCode }` |

Related: `makePrivateOnboardingPath` (68-83); validators; `looksLikePublicBlobUrl` (289-296). Token is `PRIVATE_BLOB_READ_WRITE_TOKEN` only (fail-closed, 57-65). Size caps: CSV/guidelines **10 MiB**; image/other **5 MiB** (5-9).

**Streaming read for ops downloads: the helper exists; a dedicated ops onboarding-download route does not.** The only production caller found is the authenticated client-note-image GET (`src/pages/api/admin/clients/[clientId]/notes/images/[imageId].ts`). `/api/admin/client-onboarding/assets` is POST + DELETE only.

**Max request body on the deployment: not configured in-repo.** `vercel.json` has redirects, headers, and crons only. `astro.config.mjs` uses `adapter: vercel()` with no function/body options. The **Vercel serverless default applies: 4.5 MB request body**. App-level file caps (5–10 MiB) can exceed that if a file is uploaded through a function.

---

## j. Email

### Queue / send (outbox)

`src/lib/email/outbox.ts`:

1. `enqueueEmail` (116-131) — inside a transaction; upsert on `dedupeKey`
2. `enqueueEmailOnce` (141-159) — after commit
3. `tryDeliverOutboxEmail` (292-302) — immediate best-effort
4. `deliverOutboxEmail` (170-287) → `sendRenderedEmail`
5. Cron drain: `processDueEmailOutbox` via `/api/cron/email-outbox` every 5 minutes (`vercel.json:80-82`)

Transport: `src/lib/email/sender.ts` — Resend, or `console.log` in non-prod. There is **no separate template engine / MJML layer**. Free-preview builders live in `src/lib/freePreview/emails.ts` (plain HTML, `escapeHtml`, sign-off “The KERSIVO team”).

| Code | Builder | File:line |
|---|---|---|
| E1 | `buildPreviewRequestAcknowledgementEmail` | `emails.ts` |
| E2 | `buildPreviewRequestInternalEmail` | `emails.ts` |
| Step-2 follow-up | `buildPreviewRequestDetailsInternalEmail` | `emails.ts` |
| E3 | `buildPreviewReadyEmail` | `emails.ts` |
| E4 | `buildPreviewUpdatedEmail` | `emails.ts` |
| Changes (internal) | `buildPreviewChangesRequestedInternalEmail` | `emails.ts` |
| E5 | `buildPreviewFollowupEmail` | `emails.ts` |
| E6 | `buildPreviewExpiryReminderEmail` | `emails.ts` |

Enqueue sites: create E1+E2 (`createPreviewRequest.ts:103-126`); details internal (`savePreviewRequestDetails.ts`); ops mark-ready E3/E4 (`opsActions.ts:226-246`); owner changes internal (`requestChanges.ts:55-66`); lifecycle E5/E6 (`lifecycle.ts`).

### Opt-out

`PreviewRequest.emailOptOut` / `emailOptOutAt` (`prisma/schema.prisma:1598-1599`). Set by “no thanks”: `declinePreviewByToken` (`noThanks.ts:25-57`) — status `DECLINED`, `emailOptOut: true`, then `suppressPendingPreviewFollowups`. Follow-ups only if `status === 'READY' && !emailOptOut` (`lifecycle.ts:53-54`). Also suppressed on expire and convert.

Marketing opt-in is a separate checkbox (`intake.ts`); it is not the transactional opt-out.

### How free-preview emails are tested

| File | What |
|---|---|
| `src/lib/freePreview/emails.test.ts` | E1 subject/turnaround/cap/sign-off; E2 fields, HTML escape, work links |
| `src/lib/freePreview/followupEmails.test.ts` | E5/E6 copy + no-thanks URL |
| `src/lib/freePreview/createPreviewRequest.test.ts` | enqueue E1/E2 + daily cap |
| `src/lib/freePreview/opsActions.ready.test.ts` | E3 vs E4 on mark-ready |
| `src/lib/freePreview/lifecycle.test.ts` | follow-up/opt-out/anonymise |
| `src/lib/freePreview/noThanks.test.ts` | opt-out + suppress |
| `src/lib/email/outbox.test.ts` | queue/CAS/suppress/drain (generic) |

No dedicated isolated-builder tests for E3/E4/changes-internal (covered via ops/request-changes tests).

---

## k. `purgeExpiredPreviewData` / anonymisation

**Entry:** `purgeExpiredPreviewData` — `lifecycle.ts:331-351`  
**Worker:** `anonymisePreviewRequest` — `lifecycle.ts:217-325`  
**Hourly driver:** `runFreePreviewLifecycle` — `lifecycle.ts:365-372` (expiry → follow-ups if flag on → retention always)

**Eligibility:** status in `EXPIRED | DECLINED | REJECTED` (38), `anonymisedAt: null`, and `expiresAt <= now-90d` **or** (`expiresAt` null and `rejectedAt <= now-90d`) (332-338). Batch 50. **Never CONVERTED.**

**Skipped (shop not disposable):** `ownerUserId` or `shopPaidAt` or any `saasSubscription` with `status !== 'PENDING'` (229-233).

### What is deleted / wiped

Inside the transaction (`lifecycle.ts:246-290`):

| Table | Action |
|---|---|
| `SaasSubscription` | `deleteMany({ shopId, status: 'PENDING' })` (258) |
| Shop graph | `purgeShopData(tx, shopId)` — `EmailOutbound`/`SmsOutbound`/`Booking`/`Order` for the shop, then `ShopSettings.delete` (cascades catalogue, hours, members, clients, onboarding, preview sessions, QR, recommendations, …) |
| `EmailOutbound` | also `deleteMany({ dedupeKey: { startsWith: 'free-preview:', contains: id } })` (261) |
| `PreviewRequestEvent` | `deleteMany` then one `ANONYMISED` event (262, 288) |
| `PreviewRequest` | field wipe (264-289) |

`purgeShopData` does **not** delete `LegalAcceptance`, non-PENDING `SaasSubscription`, `SetupDeposit`, `AccountLifecycleEvent`.

`PreviewRequest` fields written to anonymise (`264-289`): `anonymisedAt`; new `publicToken`/`publicTokenHash`; null details token; `firstName` null; `email` → `deleted-${id}@anonymised.invalid`; `shopName`/`townCity` → `'Deleted'`; URL/work-link/notes/Stripe/draftShopId cleared.

**Intentionally kept:** `status`, dates, `viewCount`, `barberCount`, `currentBookingSystem`, `hasOwnDomain`, consent timestamps, `entryPoint`, `emailOptOut`.

**After commit:** warn if `sitePreviewUrl` is set — **external host is not deleted** (305-311); private + public blob cleanup.

---

## l. Cron jobs

**Free-preview cron (only one):**

| Path | Schedule | Meaning |
|---|---|---|
| `/api/cron/free-preview-lifecycle` | `20 * * * *` | Minute 20 of every hour (`vercel.json:88-90`) |

Handler: `src/pages/api/cron/free-preview-lifecycle.ts:7-26` → `runFreePreviewLifecycle`. Follow-ups skipped if `FREE_PREVIEW_FLOW_ENABLED` is off; expiry + retention always run (`lifecycle.ts:360-371`).

**All crons in `vercel.json:63-104`:**

| Path | Schedule |
|---|---|
| `/api/cron/sms-reminders` | `*/15 * * * *` |
| `/api/cron/email-reminders` | `*/15 * * * *` |
| `/api/cron/expire-deposit-holds` | `*/10 * * * *` |
| `/api/cron/retry-deposit-refunds` | `*/10 * * * *` |
| `/api/cron/email-outbox` | `*/5 * * * *` (delivers queued FP emails too) |
| `/api/cron/recommendation-rebuild` | `*/2 * * * *` |
| `/api/cron/free-preview-lifecycle` | `20 * * * *` |
| `/api/cron/saas-lifecycle` | `0 6 * * *` (06:00 UTC daily) |
| `/api/cron/ops-health` | `*/15 * * * *` |
| `/api/ops/synthetic-booking` | `*/15 * * * *` |

---

## m. Design system

**Theme hook:** body class `admin-theme-premium-black` on `/admin` (`src/pages/admin.astro:32`) and most admin/ops/preview/booking pages.

**Token overrides** — `src/styles/components/booking.css:3610-3624`:

```3610:3624:src/styles/components/booking.css
body.admin-theme-premium-black {
  --bg: #030303;
  --fg: #fff8ee;
  --surface-1: #030303;
  --surface-2: #0d0d0d;
  --surface-3: #141414;
  ...
}
```

**Foundation tokens:** `src/styles/tokens.css` — `--bg: #0b0d10`, `--color-brand: #d72638`, Inter body / Bebas Neue headings.

**Dashboard page imports** (`admin.astro:5-24`): `tokens.css`, `fonts-admin.css`, `global.css`, `booking.css`, `admin-mobile-sticky-overrides.css`, `inputs.css`, `buttons.css`, `badge.css`, plus admin-login/section-header/empty-state/skeleton/services/wizards/shop-products-polish/retail-onboarding/table/admin-ai.

**Marketing glass card:** `ks-glass-card.css` — used on `/starter`, `/free-preview`, `/pricing`. Not the live dashboard chrome.

**Buttons / inputs / badge:** `src/styles/components/buttons.css`, `inputs.css`, `badge.css`. Also `src/components/ui/button.tsx` (Radix/cva) and `src/components/admin/StatusBadge.tsx`.

**`WeeklyHoursEditor`:** `src/components/admin/clientOnboarding/WeeklyHoursEditor.tsx:4-14` — day switches + time inputs.

**Icons:** dashboard uses a **local Lucide subset** (`src/components/lucide-react.tsx`), not Heroicons or Phosphor. Some marketing/shop files import the `lucide-react` package.

**Toast: no shared Toast component.** Zero `*Toast*` component files. Ad-hoc: `.shop-toast` in `shop.css`; `.sf-cart-toast` in `StorefrontCartDrawer.tsx`; inline save timer in `BarberWorkingHoursEditor.tsx`. Admin uses `role="status"` banners, not a toast primitive.

---

## Reuse inventory (GLOBAL RULE 3)

| Piece | Exists? | Where |
|---|---|---|
| Token resolution | yes | `src/lib/freePreview/previewAccess.ts:42-48` (hash lookup + constant-time compare). Uniform 404. `REJECTED` and unsent tokens already look like unknown (`previewAccess.ts:73-94`). |
| Rate limits | yes | `enforceIpRateLimit` + `PREVIEW_*_RATE` in `src/lib/freePreview/previewApi.ts:27-34` |
| Operator auth | yes | `resolveOperatorAccess` in `src/lib/ops/operatorAuth.ts:55-95` |
| Private blobs | yes | `uploadPrivateOnboardingFile` / `deletePrivateOnboardingFile` / `retrievePrivateOnboardingFile` |
| Email outbox | yes | `enqueueEmail` + Resend via `sender.ts` |
| `PreviewRequestEvent` | yes | `PREVIEW_REQUEST_ACTIONS` in `createPreviewRequest.ts:10-30` |
| `FUNNEL_EVENTS` + `sendServerAnalyticsEvent` | yes | `src/lib/analytics/funnelEvents.ts`, `src/lib/analytics/serverEvents.ts` |
| Design tokens / components | yes | see §m |
| `WeeklyHoursEditor` | yes | see §m |
| `PREVIEW_HUB_ENABLED` / `isPreviewHubEnabled()` | **no** | Closest: `isFreePreviewFlowEnabled()` (`config.ts:16-18`) — `FREE_PREVIEW_FLOW_ENABLED === 'true'` |
| `src/lib/freePreview/hubCopy.ts` | **no** | not found |
| Preview security headers | yes, on token APIs | `PREVIEW_API_HEADERS` in `previewApi.ts:3-8` (`X-Robots-Tag`, `Referrer-Policy`, `Cache-Control: private, no-store`) |

---

## 14. Conflicts — HUB_SPEC / GLOBAL RULES vs code

Do not resolve these here. Recommended resolution is a suggestion only.

| # | Spec / prompt assumption | Code today | Recommended resolution |
|---|---|---|---|
| 1 | `PREVIEW_HUB_ENABLED` + `isPreviewHubEnabled()` in `config.ts`, default off | Does not exist. Only `FREE_PREVIEW_FLOW_ENABLED` / `isFreePreviewFlowEnabled()` (`config.ts:16-18`) | Add the new flag beside the existing one. Decide whether hub pages 404 when the **hub** flag is off even if the **flow** flag is on. Two flags can disagree. |
| 2 | `src/lib/freePreview/hubCopy.ts` with exact §9 strings | File does not exist. Preview copy is inline in components / `emails.ts` / `config.ts` constants | Create in Batch 1 **after** the exact §9 strings are supplied. Do not invent copy. |
| 3 | Spec §9 copy strings | Not in the workspace; HUB_SPEC.md is a placeholder | Founder attaches `KERSIVO_Shop_Hub_Spec_v1.md`. Replace `docs/preview-hub/HUB_SPEC.md` before Batch 1. |
| 4 | Spec §2 may add `PreviewRequest.liveAt` if no published-website field exists | No `liveAt` / `sitePublished`. Closest: `goLiveAt` (approve-time, not DNS) and `FullBookingDestination.status = VERIFIED_LIVE` (booking URL only) | Confirm whether hub “live” means owner-approved preview, OPS-verified domain, or a new `PreviewRequest.liveAt`. If the last, add the column as the spec says. |
| 5 | Batch 6 pin mode: a preview-only feedback script on the shop site | Tenant site is an external `https://` URL, not rendered in this repo (`sitePreview.ts:21-25`) | Pin mode must live on the **wrapper** (`/preview/{token}`, `/admin/site-preview`) unless ops add a script to each tenant Vercel project. Do not assume this repo can inject into the iframe origin. |
| 6 | Ops fills draft shop (services, barbers, hours, logo) then owner corrects | Ops can only `create_draft_shop` / `link_draft_shop` / `set_site_preview`. Catalogue writes are dashboard/onboarding APIs that need a session or a `ShopPreviewSession` ops never mints | Either mint a `ShopPreviewSession` for ops (“open draft workspace”), or add hub/ops apply-correction APIs that call `replaceShopOpeningHours`, `replaceBarberAvailabilityRules`, `linkAllServicesToAllBarbers`, `createStandaloneBookingProfile`, `storeShopLogo`. |
| 7 | Conversion assumes “KERSIVO built the workspace (services, barbers, hours)” (`conversion.ts:162-164`) | Draft is empty at birth. Submit validation then requires ≥1 barber, service, shop-open day, barber-availability day (`schema.ts:249-260`) | If hub lets the owner correct an empty draft, preview-launch submit will 400 until catalogue exists. Decide who fills it (ops before READY, or owner in the hub) and when `onboardingCompleted` is set. |
| 8 | Hub may need to cover direct subscribers | Direct `/admin/launch` creates **no** `PreviewRequest` and lands on `ClientOnboardingWizard` | If the hub is preview-only, leave this path. If every Full shop should get a hub, create a `PreviewRequest` (or a different record) on direct subscribe. |
| 9 | Hub asset uploads via private blobs; app caps 5–10 MiB | Vercel function body default is **4.5 MB**; no in-repo override | Cap hub uploads at ≤4.5 MB, or add a Vercel `functions` body-size / use client-direct blob upload. |
| 10 | Every interactive surface has a designed success/error toast-like state | No shared Toast component. Admin uses `role="status"` banners | Reuse banners + skeleton CSS, or add a small hub toast. Do not import the storefront cart toast. |
| 11 | Security defaults on every hub page/API (headers, same-origin, 404 for REJECTED) | Token **APIs** already set `PREVIEW_API_HEADERS` (`previewApi.ts:3-8`) and uniform 404 (`previewAccess.ts:73-94`). Hub **pages** do not exist yet. Preview-launch uses `Cache-Control: private, no-store` but not `X-Robots-Tag` / `Referrer-Policy` on the page response (`preview-launch.astro:19`) | Copy `PREVIEW_API_HEADERS` onto every new hub page/API. Add the missing page headers on preview-launch only if the batch says so (GLOBAL RULE 10). |
| 12 | Event names prefixed `hub_` / `ops_hub_` | Existing actions are `CREATED`, `MARKED_READY`, `CHANGES_REQUESTED`, … (`createPreviewRequest.ts:10-30`) | Keep existing names for today’s actions. Prefix only **new** hub/ops-hub events. |
| 13 | Flag-off path must be byte-for-byte unchanged for owners | Hub flag does not exist, so today’s owner path **is** the flag-off path | Batch 1 test should snapshot today’s owner pages/APIs as the flag-off baseline. |
| 14 | Webhook conversion from any non-`CONVERTED` status | `markPreviewRequestConverted` has no from-status filter (`conversion.ts:26-27`). Can convert `REJECTED`/`DECLINED`/`EXPIRED` | If the spec forbids converting a rejected/declined request, add a from-status guard. If payment always wins, document it. |
| 15 | Ops can re-open an expired preview (“Want another look?”) | API allows `EXPIRED` → `READY`; ops UI does not show the button | If the hub needs this, expose it in ops UI or keep it API-only. |
| 16 | Retention deletes the preview | External `sitePreviewUrl` host is **not** deleted (`lifecycle.ts:305-311`). Row is anonymised; status kept | Hub “deleted” must not promise the tenant Vercel project is gone. Ops still take the site down by hand. |
| 17 | Token logging: first 6 chars only | Existing preview code hashes tokens for lookup and stores plaintext `publicToken` so ops can copy the link (`schema.prisma:1546-1549`) | Keep the plaintext column (ops copy-link). New hub logs must truncate. Do not log `publicToken` in events/meta. |
| 18 | Same-origin check on non-GET | `previewApiGuard` checks `Origin` when present (`previewApi.ts:18-23`). Missing `Origin` is allowed (server-to-server / no-CORS) | Match this pattern on hub APIs unless the spec requires a stricter deny-if-absent rule. |
| 19 | Turnaround only from config constants | Already true for free-preview copy (`config.ts:20-23`: “usually within a few working days”). Over-cap message still says “up to 3 working days” (`config.ts:29-30`) | Hub copy must use the config constants. The over-cap “3 working days” is an existing claim-adjacent string — do not copy it into hub prospect-facing UI without checking `claims:check`. |
| 20 | `claim-paid-subscription` as a status writer | It does not change `PreviewRequest.status` | If the spec diagram shows claim → `CONVERTED`, the actual writer is the webhook. Leave claim as adopt-only. |

---

## Open questions (do not resolve)

1. Please attach `KERSIVO_Shop_Hub_Spec_v1.md` so `HUB_SPEC.md` can be replaced with the exact text before Batch 1.
2. Is the hub for free-preview owners only, or also for direct subscribers (who have no `PreviewRequest`)?
3. Who fills services/barbers/hours/logo on the draft before READY — ops in a workspace, or the owner in the hub?
4. What should “live” mean in the hub: owner approval, OPS-verified domain, or a new `liveAt`?
5. Should pin-mode feedback sit on the KERSIVO wrapper, or will ops add a script to each tenant site?
