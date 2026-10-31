# Batch 0 findings — KERSIVO Shop Hub

Discovery only. No product code was changed. Citations are `path:start-end` against this branch’s tree (docs on `preview-hub-batch-0`; product code matches `origin/main` `88f600e3`). Spec: `docs/preview-hub/HUB_SPEC.md` v1.0 (founder-placed; not edited in this batch).

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

Owner page visibility today (`resolvePreviewPageState`, `previewAccess.ts:72-94`): owners see a page only for `READY` / `CHANGES_REQUESTED` (unexpired) or `CONVERTED`. `REQUESTED` / `IN_PROGRESS` / `REJECTED` / unsent-expired look like unknown (404). `EXPIRED` after a send is HTTP 410 (`src/pages/preview/[token].astro:97`). Operators can open any linked draft (`previewAccess.ts:83`); their views are not counted (`previewAccess.ts:97-99`, `[token].astro:83-84`).

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

Ops UI has create/link + site URL only (`src/components/ops/previewRequests/PreviewRequestActions.tsx`). There is **no ops API that writes services, barbers, hours, or logo** onto the draft.

### Fill: `sitePreviewUrl`

One writer: `applySitePreview` (`src/lib/setup/sitePreview.ts:26-65`). Callers:

1. Ops action `set_site_preview` → `setSitePreview` (`opsActions.ts:250-273`)
2. Machine `POST /api/ops/site-preview` (`src/pages/api/ops/site-preview.ts:24-57`) — Bearer `CRON_SECRET`

`mark_ready_and_send` **reads** `draftShop.sitePreviewUrl` (`opsActions.ts:206`) and refuses if missing. It does not set the URL.

### Fill: logo

No ops action. Logo is `ShopSettings.logoUrl`, written after `storeShopLogo` (`src/lib/storage/storeShopLogo.ts:11`). Accepts JPG/PNG/WEBP only (`ALLOWED_SHOP_LOGO_TYPES`, lines 4-5), max 2 MB. Used by dashboard identity, signed-in onboarding shop step, and guest preview shop step.

Reusable: **`storeShopLogo(file, shopId)`**, then `shopSettings.update({ logoUrl })`.

### Reusable service-layer writers (dashboard / onboarding)

There is **no** extracted `saveOnboardingServices` / `saveOnboardingBarbers`. List sync is inlined Prisma in the API routes. Named functions the hub can reuse to “apply” owner corrections (spec §6 Content → Apply):

#### Opening hours (shop)

| Function | File:line | Used by |
|---|---|---|
| **`replaceShopOpeningHours(shopId, rules)`** | `src/lib/admin/shopOpeningHours.ts:77-93` | Dashboard hours, onboarding shop-hours, guest preview shop-hours |
| `serializeShopOpeningHours` | `shopOpeningHours.ts:29` | reads |

#### Barber working hours

| Function | File:line | Used by |
|---|---|---|
| **`replaceBarberAvailabilityRules(barberId, rules)`** | `src/lib/admin/onboarding.ts:165-186` | Onboarding hours, guest preview hours |
| `ensureBarberHasAvailabilityRules(barberId)` | `src/lib/admin/defaultAvailability.ts:10-54` | Dashboard barber create |

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

`resolveAdminAccess` prefers a Better Auth session over the preview cookie. An operator logged into `/ops` cannot drive `/preview/onboarding` in the same browser. Onboarding APIs require `via === 'session'` + `userId`, so they will not run against an **ownerless** draft until claim. Guest preview APIs would work if a `ShopPreviewSession` existed for that shop — which ops never mints.

Conversion comments that KERSIVO already built the workspace and sets `onboardingCompleted: true` (`src/lib/freePreview/conversion.ts:162-164`). `adoptPreviewDraftShop` then prefills `ClientOnboarding` from the request (`174-186`), not from catalogue rows.

**Practical fill path today:** ops creates/links an ownerless shop, sets `sitePreviewUrl` in ops, and must fill catalogue through dashboard/onboarding/guest-preview APIs (or by linking a shop already filled that way). There is no “apply corrections” ops action. Spec §6 Apply should call the named helpers above, not the session-gated API routes.

---

## c. How `sitePreviewUrl` is built and hosted

**External / manual build. This repo does not render tenant websites.**

`applySitePreview` is explicit: it **points a shop at an externally built website** (`src/lib/setup/sitePreview.ts:21-25, 41-54`). URL must be `https://` (`5-16`).

How the URL is set: see §b. How it is shown: this repo **iframes** the external URL.

- Owner review (paid): `/admin/site-preview` → `SitePreviewShell`, including “Open in new tab” (`src/components/admin/SitePreviewShell.tsx:84`).
- Token preview: iframe + “Open it in a new tab” fallback (`src/pages/preview/[token].astro:162-176`). `?view=booking` already works (`[token].astro:99-100, 159`).

Config: previews are built by hand (`src/lib/freePreview/config.ts:25-30`). Discovery doc: one Vercel project per shop, attached via `sitePreviewUrl`. Tenant projects are **not** created with the `vercel` CLI from this folder (`CLAUDE.md`).

**Batch 6 pin mode (spec §10.1):** the condition fails. Skip pin mode. Batch 4 page selector + screenshot covers the need. This repo can add UI on the wrapper; it cannot inject JS into the iframed origin unless ops add a script when they build each tenant project.

---

## d. “Live” marker

**There is no `sitePublished`, `liveAt`, or `domainPublished` field.** Closest existing fields mean different things.

| Field | Meaning | Not |
|---|---|---|
| `launchApprovedAt` + `launchApprovedVersion` | Owner approved the current `sitePreviewVersion` (`prisma/schema.prisma:292-296`) | DNS / public domain live |
| `goLiveAt` | Timestamp recorded **at that same approve click** (`prisma/schema.prisma:297-298`: “physical DNS switch = OPS”) | Physical DNS switch |
| `publicActivityPaused` | Public booking/retail pause; draft shops start paused | Website published |
| `FullBookingDestination.status = VERIFIED_LIVE` | OPS attested the **own-domain booking URL** is live (`prisma/schema.prisma:332-347`) | Generic “site published” |

`approveSiteLaunch` sets approval + `goLiveAt` together (`src/lib/setup/siteLaunch.ts`). The launch status API is explicit: preview approval / `goLiveAt` never imply a live domain (`src/pages/api/admin/site-launch/index.ts`). `resolvePublicBookingDestination` uses own-domain only when `FullBookingDestination.status === 'VERIFIED_LIVE'`.

`publishedCatalogueVersion` / `publishedSetId` are Smart Retail catalogues, not the shop website.

**Spec §2 / §7:** “use an existing shop field if one exists; otherwise add `PreviewRequest.liveAt` set by an ops action Mark live.” **Add `PreviewRequest.liveAt`.** Do not reuse `goLiveAt` or `FullBookingDestination` for the hub Live stage.

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

Spec §2 target (Batch 5, not this batch): create a `PreviewRequest` at checkout with `entryPoint = 'direct_subscribe'`, status `IN_PROGRESS`, `convertedAt` set. Legacy wizard stays for existing shops only.

---

## f. `/admin/preview-launch` today

Shortened post-purchase form for **adopted free-preview shops only**. Website/workspace already exist; this collects contact, domain, optional Stripe Connect, and declarations. It is **not** the spec §4.6 five-item checklist.

### Gate

`src/pages/admin/preview-launch.astro:21-30`: session + `billing.manage`; `loadPreviewOnboarding(shopId)` must return a row. Else → `/admin/client-onboarding`.

### Fields (`src/components/freePreview/PreviewLaunchOnboarding.tsx:13-28, 127-206`)

| Area | Fields |
|---|---|
| Contact | `primaryContactName`, `primaryContactEmail` |
| Address | `addressLine1`, `townCity`, `postcode` |
| Public | `publicEmail`, `publicPhone` (phone optional) |
| Domain | `DomainSearcher`: `EXISTING` / `KERSIVO_REGISTER`, `existingDomain` / `preferredDomain1`, registration authorised |
| Migration | checkbox if preview request had a booking system (not skippable “Not now”; it is an optional checkbox) |
| Stripe | optional “Connect Stripe” (not required to submit) |
| Confirm | content rights, information accuracy |

No Ltd question, no registered office, no retail, no deposits, no “Approve for launch” (approval lives on `/admin/site-preview`). Submit button: “Send my details”.

### Validation

- Client HTML `required` on name, email, address, town, postcode (`132-148`).
- Server: `PATCH /api/admin/client-onboarding` then `POST /api/admin/client-onboarding/submit` (`65-80`).
- Submit uses `validateClientOnboardingSubmit` (`src/lib/admin/clientOnboarding/schema.ts:222-312`): contact + address; public email **or** phone; ≥1 barber, service, shop-open day, barber-availability day (already on the draft shop); domain not `UNDECIDED`; content rights + accuracy; migration if requested. `launchRetail` is not sent, so the retail product rule does not apply.

### What “submitted” does

Same as the full wizard (`src/lib/admin/clientOnboarding/service.ts`):

- `ClientOnboarding.status` → `SUBMITTED`, `submittedAt` set
- `SaasSubscription.onboardingSubmittedAt` set if still null
- Internal ops email + customer confirmation

Does **not** set `retailEnabled`, `bookingPaymentMode`, `goLiveAt`, `sitePreviewUrl`, `FullBookingDestination`, or `PreviewRequest.launchApprovedAt` (column does not exist). Success copy: “Nothing goes live until you approve it” (`PreviewLaunchOnboarding.tsx:105-111`).

### Stripe Connect

Optional `POST /api/admin/barbershop-settings/deposits` (`PreviewLaunchOnboarding.tsx:36-47`). That handler creates a Standard Connect account if needed and returns an Account Link. Refresh/return URLs: `/admin?section=barbershop_settings&connect=refresh|return`. **ClientOnboardingWizard has no Connect step.**

`ClientOnboarding` already has `legalBusinessName` and `companyNumber` (`prisma/schema.prisma:1242-1244`) and a free-text `businessType` (`1243`). There is **no** `isLimitedCompany` or `registeredOfficeAddress`. The full wizard always shows legal name / company number (`BusinessBrandDomain.tsx:81-103`), not gated on “Is your shop a limited company?”.

---

## g. Retail activation

**Confirmed: `retailEnabled` is only written by `PATCH /api/admin/barbershop-settings/retail.ts` (settings checkbox). Onboarding paths do not set it. “At least one product” is not required to flip `retailEnabled=true`. “Site is live” is not required either.**

The only writer (`src/pages/api/admin/barbershop-settings/retail.ts:56-91`):

- Gates: paid shop + Connect charges enabled (`82-86`)
- **No product-count check**
- **No live-site check**
- Schema default is `false` (`prisma/schema.prisma:276`)

`ClientOnboarding.launchRetail` is a **preference** only. Submit copies it onto the onboarding row (`src/lib/admin/clientOnboarding/service.ts:399`). `validateClientOnboardingSubmit` if `launchRetail === true` requires a product **or** `retailProductsDeferred` (`schema.ts:304-309`) — still does not set `ShopSettings.retailEnabled`.

`PreviewLaunchOnboarding` never sends `launchRetail`. Retail onboarding (`RetailOnboardingWizard`, first-product create) sets `retailOnboardingCompleted`. **No `retailEnabled` writes** in that folder.

Spec D1: hub and launch checklist never ask about retail — **matches preview-launch today**. D1 also says retail turns on only after the site is live **and** at least one product exists — **does not match** the dashboard toggle.

---

## h. Booking payment default

**Yes: `bookingPaymentMode` defaults to `NONE` (pay at shop). Nothing in provision, draft-shop, preview→launch, claim, or client-onboarding submit changes it.** Matches spec D2.

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

Related: `makePrivateOnboardingPath` (68-83); validators; `looksLikePublicBlobUrl` (289-296). Token is `PRIVATE_BLOB_READ_WRITE_TOKEN` only (fail-closed, 57-65). Size caps: CSV/guidelines **10 MiB**; image/other **5 MiB** (5-9). `validateMigrationCsvFile` (87-103) exists for the launch-checklist CSV (spec §4.6 item 4).

**Streaming read for ops downloads: the helper exists; a dedicated ops onboarding-download route does not.** The only production caller found is the authenticated client-note-image GET (`src/pages/api/admin/clients/[clientId]/notes/images/[imageId].ts`). `/api/admin/client-onboarding/assets` is POST + DELETE only.

**Max request body on the deployment: not configured in-repo.** `vercel.json` has redirects, headers, and crons only. `astro.config.mjs` uses `adapter: vercel()` with no function/body options. The **Vercel serverless default applies: 4.5 MB request body**. Spec §8 hub POST `/assets` is `≤ 4 MB body` — that fits. App-level onboarding caps (5–10 MiB) can exceed the platform limit if used as-is.

No magic-byte sniffing in this helper (MIME + extension only). `sharp` is used for public shop logos (`storeShopLogo.ts`), not for private onboarding blobs.

---

## j. Email

### Queue / send (outbox)

`src/lib/email/outbox.ts`:

1. `enqueueEmail` (116-131) — inside a transaction; upsert on `dedupeKey`
2. `enqueueEmailOnce` (141-159) — after commit
3. `tryDeliverOutboxEmail` (292-302) — immediate best-effort
4. `deliverOutboxEmail` (170-287) → `sendRenderedEmail`
5. Cron drain: `processDueEmailOutbox` via `/api/cron/email-outbox` every 5 minutes (`vercel.json:80-82`)

Transport: `src/lib/email/sender.ts` — Resend, or `console.log` in non-prod. There is **no separate template engine / MJML layer**. Free-preview builders live in `src/lib/freePreview/emails.ts` (plain HTML, `escapeHtml`, sign-off “The KERSIVO team”, reply-to `hello@kersivo.co.uk`).

| Code | Builder | Today vs spec §5 |
|---|---|---|
| E1 | `buildPreviewRequestAcknowledgementEmail` (`emails.ts:43-64`) | **Rewrite required.** Subject is “We've received your preview request — {shop}”. Body has **no hub link**; tells the owner we will “email you a private link”. Spec §9.1: subject “We're designing your {shopName} website”, hub button now. |
| E2 | `buildPreviewRequestInternalEmail` | Exists; add hub + ops links |
| Step-2 follow-up | `buildPreviewRequestDetailsInternalEmail` | Exists (intake step 2) |
| E3 | `buildPreviewReadyEmail` (`emails.ts:205-221`) | Keep; button/copy adjustments (review cards, “Open your preview”) |
| E4 | `buildPreviewUpdatedEmail` (`emails.ts:224-236`) | Exists; spec wants Done / Not possible item list |
| Changes (internal) | `buildPreviewChangesRequestedInternalEmail` | Exists; spec wants item list |
| E5 / E6 | follow-up / expiry | Keep (`lifecycle.ts`) |
| File digest / message emails / subscribed hub / owner-approved / site live | — | **Do not exist** |

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

Resend inbound / reply-by-email: **not found** in this repo (spec §10.2 skip unless verified later).

---

## k. `purgeExpiredPreviewData` / anonymisation

**Entry:** `purgeExpiredPreviewData` — `lifecycle.ts:331-351`  
**Worker:** `anonymisePreviewRequest` — `lifecycle.ts:217-325`  
**Hourly driver:** `runFreePreviewLifecycle` — `lifecycle.ts:365-372` (expiry → follow-ups if flag on → retention always)

**Eligibility:** status in `EXPIRED | DECLINED | REJECTED` (38), `anonymisedAt: null`, and `expiresAt <= now-90d` **or** (`expiresAt` null and `rejectedAt <= now-90d`) (332-338). Batch 50. **Never CONVERTED.** Matches spec D6 retention window (`PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY = 90`, `config.ts:44`).

**Skipped (shop not disposable):** `ownerUserId` or `shopPaidAt` or any `saasSubscription` with `status !== 'PENDING'` (229-233).

### What is deleted / wiped today

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

Hub models (`PreviewHubAsset`, `PreviewHubMessage`, `PreviewChangeRequest`, `PreviewContentReview`) **do not exist**. Spec §7: when they do, purge must delete rows + blobs and must not leave file names or message bodies.

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

No existing 15-minute digest job for hub file/message emails (spec §5). Implement with outbox `dedupeKey` + `opsFilesNotifiedAt` / `opsMessagesNotifiedAt`, not a new cron, unless Batch 1 decides otherwise.

---

## m. Design system

**Theme hook:** body class `admin-theme-premium-black` on `/admin` (`src/pages/admin.astro:32`) and most admin/ops/preview/booking pages. Token preview already uses it (`[token].astro:124`).

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

**Marketing glass card:** `ks-glass-card.css` — used on `/starter`, `/free-preview`, `/pricing`, and the current preview page.

**Buttons / inputs / badge:** `src/styles/components/buttons.css`, `inputs.css`, `badge.css`. Also `src/components/ui/button.tsx` (Radix/cva) and `src/components/admin/StatusBadge.tsx`.

**`WeeklyHoursEditor`:** `src/components/admin/clientOnboarding/WeeklyHoursEditor.tsx:4-14` — reuse on `/details` hours card (spec §4.2).

**Icons:** dashboard uses a **local Lucide subset** (`src/components/lucide-react.tsx`), not Heroicons or Phosphor. Spec §3.3: one consistent outline set already used in the dashboard → this file.

**Toast: no shared Toast component.** Zero `*Toast*` component files. Ad-hoc: `.shop-toast` in `shop.css`; `.sf-cart-toast` in `StorefrontCartDrawer.tsx`; inline save timer in `BarberWorkingHoursEditor.tsx`. Admin uses `role="status"` banners. Spec §3.3 requires toasts (4s, live region). **Build a small hub toast; do not import the storefront cart toast.**

**Skeleton:** `src/styles/components/skeleton.css` is already imported on `/admin`.

---

## Reuse inventory (spec + GLOBAL RULE 3)

| Piece | Exists? | Where |
|---|---|---|
| Token resolution | yes | `src/lib/freePreview/previewAccess.ts:42-48`. Uniform 404. `REJECTED` and unsent tokens already look like unknown (`previewAccess.ts:73-94`). |
| Rate limits | yes | `enforceIpRateLimit` + `PREVIEW_*_RATE` in `src/lib/freePreview/previewApi.ts:27-34` |
| Operator auth | yes | `resolveOperatorAccess` in `src/lib/ops/operatorAuth.ts:55-95` |
| Strict same-origin (ops) | yes | `evaluateExactSameOrigin` + `Sec-Fetch-Site` in `src/lib/ops/requireOperatorMutation.ts:23-64` |
| Token API Origin check | weaker | `previewApiGuard` (`previewApi.ts:18-23`): 404 if flow off; 403 if `Origin` present and mismatches; **missing Origin allowed** |
| Private blobs | yes | `uploadPrivateOnboardingFile` / `deletePrivateOnboardingFile` / `retrievePrivateOnboardingFile` |
| Email outbox | yes | `enqueueEmail` + Resend via `sender.ts` |
| `PreviewRequestEvent` | yes | `PREVIEW_REQUEST_ACTIONS` in `createPreviewRequest.ts:10-30` |
| `FUNNEL_EVENTS` + `sendServerAnalyticsEvent` | yes | `src/lib/analytics/funnelEvents.ts`, `src/lib/analytics/serverEvents.ts` |
| Preview security headers | yes, on token page + APIs | `PRIVATE_HEADERS` in `[token].astro:46-52`; `PREVIEW_API_HEADERS` in `previewApi.ts:3-8` |
| `?view=booking` | yes | `[token].astro:99-100, 159` |
| HTTP 410 expired | yes | `[token].astro:97` |
| `WeeklyHoursEditor` | yes | see §m |
| `PREVIEW_HUB_ENABLED` / `isPreviewHubEnabled()` | **no** | Closest: `isFreePreviewFlowEnabled()` (`config.ts:16-18`) |
| `src/lib/freePreview/hubCopy.ts` | **no** | not found |
| Hub models / APIs / routes | **no** | only `/preview/{token}` and `/preview/{token}/no-thanks` |

---

## 14. Conflicts — `HUB_SPEC.md` vs code

Do not resolve these here. Recommended resolution is a suggestion only.

| # | Spec | Code today | Recommended resolution |
|---|---|---|---|
| 1 | Flag `PREVIEW_HUB_ENABLED` / `isPreviewHubEnabled()`, default off | Does not exist. Only `FREE_PREVIEW_FLOW_ENABLED` / `isFreePreviewFlowEnabled()` (`config.ts:16-18`) | Add the hub flag beside the flow flag. Hub pages/APIs 404 unless **both** are on, unless Batch 1 decides hub can run while public CTAs stay off. Two flags can disagree — lock that in Batch 1. |
| 2 | `hubCopy.ts` with exact §9 strings | File does not exist. Preview copy is inline in components / `emails.ts` | Create in Batch 1 from spec §9. Do not invent extra prospect-facing claims. |
| 3 | `/preview/{token}` is the hub from **Requested** onward; owner can upload/message before the preview is ready (§2, §3.1, §8) | `resolvePreviewPageState` 404s owners unless `READY`/`CHANGES_REQUESTED`/`CONVERTED` **and** `draftShopId` is set (`previewAccess.ts:72-94`). `createPreviewRequest` does not create a draft shop. | Hub Overview at Requested/Designing must not require `draftShopId`. Keep 404 for `REJECTED`/unknown. Operators still open any linked draft. |
| 4 | Expired: HTTP 410 kept + “Ask us to reopen it” (creates a message) (§2, §9.2) | 410 yes (`[token].astro:97`). Copy is “Want another look? Email hello@…” + link to `/free-preview` (`[token].astro:131-140`). No message composer. | Keep 410. Replace copy/CTA with spec §9.2 when hub messages exist. |
| 5 | Declined: hub closed state; messages stay until purge (§2) | `/preview/{token}` 404s declined (`isPreviewExpired` treats `DECLINED` as expired without `previewReadyAt` path → `not_found` if somehow no ready-at; with ready-at would 410). No-thanks page is a separate route (`no-thanks.astro`). | Show spec declined hub on the token route; keep no-thanks as the one-click opt-out. |
| 6 | `REJECTED` and unknown → 404 indistinguishable (§2, §11) | Matches (`previewAccess.ts:73-94`; no-thanks `not_found` for rejected, `noThanks.ts:12-17`) | Keep. |
| 7 | Operator views never counted (§2) | Matches (`shouldRecordOwnerView`, `previewAccess.ts:97-99`) | Keep. |
| 8 | No existing live-site field → add `PreviewRequest.liveAt` + ops “Mark live” (§2, §7) | No such field or action. `goLiveAt` is approve-time, not DNS. `FullBookingDestination.VERIFIED_LIVE` is booking URL only. | Add `liveAt` as the spec says. Do not overload `goLiveAt`. |
| 9 | Direct subscribers get a hub in Batch 5 (`entryPoint = 'direct_subscribe'`) (§2) | No `PreviewRequest`; `ClientOnboardingWizard`. Documented in §e. | Leave until Batch 5. Do not change `/admin/launch` in earlier batches. |
| 10 | Routes `/preview/{token}/website|details|changes|messages` (§3.1) | Only `/preview/{token}` and `/preview/{token}/no-thanks`. `?view=booking` already works. | Add routes. Back-compat: redirect `?view=booking` → `/website?view=booking` as spec says. |
| 11 | Launch checklist rebuilt at `/admin/preview-launch`: 5 items including Ltd question, DNS instructions, skippable migration, **Approve for launch** (§4.6) | One form: contact/address/domain/optional Connect/declarations. Submit emails ops. Approval is `/admin/site-preview` → `approveSiteLaunch` (sets shop `launchApprovedAt`/`goLiveAt`). No Ltd gate. | Rebuild behind the hub flag. Reuse `legalBusinessName` + `companyNumber`; **add** `isLimitedCompany` and `registeredOfficeAddress`. Do not reuse free-text `businessType` as the Ltd question. Decide whether “Approve for launch” stays `approveSiteLaunch` or writes spec `PreviewRequest.launchApprovedAt`. |
| 12 | D1: retail off at launch; hub never asks; dashboard only after live **and** ≥1 product | Hub/preview-launch never asks (match). Dashboard `PATCH …/retail.ts` needs paid + Connect only — **no live check, no product count**. | Hub: do not add retail. Dashboard product/live gate is **out of hub batches** unless the founder wants it in a later dashboard batch; flag it, do not silently change the settings PATCH in hub work. |
| 13 | D2: pay at shop; Connect optional | Matches. | Keep. Stripe copy on checklist = spec §9.3 payments line. |
| 14 | D5: one **design** change round; data corrections unlimited; ops can grant a round | `requestPreviewChanges` is unlimited self-loops; no `includedChangeRounds` / `changeRoundsUsed`; single `changesRequestedText` blob. E3 already promises “One round of changes is included”. | New `PreviewChangeRequest` model + counters. Keep writing `changesRequestedText` as the plain-text rendering (spec §4.5). Existing `POST …/changes.ts` becomes a thin wrapper or stays until the flag ships. |
| 15 | Review cards: proposal JSON, ops Apply via service-layer functions (§4.4, §6) | No `PreviewContentReview`. Catalogue writes are session-gated API routes. Named helpers listed in §b. | Hub apply must call `replaceShopOpeningHours`, `replaceBarberAvailabilityRules`, onboarding-style service sync + `linkAllServicesToAllBarbers`, barber create/update helpers, `storeShopLogo` — **not** `/api/admin/onboarding/*` (those need an owned session). |
| 16 | Logo uploader: PNG/JPG/WEBP/**SVG/PDF**; colours from logo; style notes; about text (§4.2, §7) | `storeShopLogo` is JPG/PNG/WEBP only, 2 MB, public blob. No brand colour columns on `PreviewRequest`. `ClientOnboarding` already has `preferredPrimaryColour` / `preferredSecondaryColour` / `shopDescription`. | Hub assets go to **private** store (`PreviewHubAsset`). “Use as logo” shortcut: if applying to draft shop, rasterise SVG/PDF first or keep SVG as attachment-only (spec §11: SVG rasterised for display, original as attachment). Do not put SVG on `logoUrl` via `storeShopLogo` as-is. |
| 17 | Uploads: client compress ≤2560px, body ≤4 MB, magic-byte sniff, sharp strip metadata, thumbs, per-request 60 files / 250 MB (§11) | Private helper: MIME/extension, 5–10 MiB caps, no magic-byte, no thumb, no hub prefix `preview-hub/{id}/…`. Vercel body default 4.5 MB. | New hub upload pipeline on top of `uploadPrivateOnboardingFile` / `retrievePrivateOnboardingFile`. Cap body at 4 MB as spec. Do not reuse 10 MiB CSV cap for hub photos. |
| 18 | Stream assets through token/ops routes; never expose blob URLs (§8, §11) | Pattern exists for client-note images. No hub route. | Copy that streaming GET. `Cache-Control: private, max-age=300` on asset GET only. |
| 19 | E1 rewrite with hub link now (§5, §9.1) | E1 has no link (`emails.ts:43-64`). Tests assert current subject/body. | Change only behind the hub flag. Keep old E1 when hub flag is off (GLOBAL RULE 2). Over-cap variant: keep `PREVIEW_OVER_CAP_MESSAGE` in the second paragraph as spec. |
| 20 | New emails: file digest (15 min), message-to-ops (15 min), KERSIVO-to-owner immediate, subscribed hub, owner-approved, site live (§5) | Not found. Outbox + `dedupeKey` can implement the 15 min digests (`opsFilesNotifiedAt`, `opsMessagesNotifiedAt` in spec §7). | Add purposes to `EmailOutboundPurpose` (additive enum). Do not send file/message ops mail without the digest cap. |
| 21 | Site-live email to owner (§5) | No live marker, no email. | Depends on conflict 8 (`liveAt`). |
| 22 | Pin mode (§10.1) only if KERSIVO controls preview site code | External/manual Vercel project (§c) | **Skip Batch 6 pin mode.** |
| 23 | Reply-by-email inbound (§10.2) | Resend inbound / signed reply address: **not found** | Skip unless later verified. Owners reply in the hub. |
| 24 | POST: `Origin` / `Sec-Fetch-Site` = same-origin (§11) | Token APIs: Origin checked only if present (`previewApi.ts:18-23`). Ops mutations: require Origin + optional Sec-Fetch-Site (`requireOperatorMutation.ts:23-64`). | Hub APIs should follow the **ops** exact-origin helper (or a JSON+multipart variant). Multipart uploads cannot use `requireOperatorMutation` as-is (it demands `application/json`). |
| 25 | No-thanks is a hub page; all hub pages `Referrer-Policy: no-referrer` (§11) | `no-thanks.astro:21-25` uses `Referrer-Policy: same-origin` **on purpose** so the form POST is not `Origin: null`. | Keep same-origin on no-thanks POST, or send Origin another way. Do not blindly set no-referrer or the opt-out POST breaks. Flag in Batch 1. |
| 26 | Event names `hub_*` / `ops_hub_*`; analytics list in §12 | Existing `PREVIEW_REQUEST_ACTIONS` and `FUNNEL_EVENTS.preview_*`. No hub events. | Keep today’s action names for today’s writers. Prefix **new** hub events. Add §12 names to `FUNNEL_EVENTS`. |
| 27 | Conversion/webhook can mark `CONVERTED` from any non-converted status | `conversion.ts:26-27` has no from-status filter | If a declined/rejected owner pays, they become CONVERTED. Spec Launch stage is `CONVERTED` and not live — that is probably intended. Document; add a guard only if founder forbids converting `REJECTED`. |
| 28 | Ops UI cannot mark EXPIRED ready; API can (`opsActions.ts:32-37` vs `PreviewRequestActions.tsx`) | Spec expired CTA is “Ask us to reopen” (owner message), plus existing mark-ready-from-EXPIRED | Keep API. Hub reopen is a message, not an automatic READY. Ops still mark ready after they rebuild. |
| 29 | Retention must delete hub files/messages/changes/reviews and not leave names/bodies (§7, D6) | Job does not know those tables (they do not exist). External `sitePreviewUrl` is not deleted (`lifecycle.ts:305-311`) | Extend `anonymisePreviewRequest` in the batch that adds the models. Do not promise the tenant Vercel project is taken down. |
| 30 | Sensitive data never under the token (§11) | Token preview already has no address/Stripe. Domain choice is collected **before** checkout on the current preview (`launchCheckout` / `persistPreviewDomainChoice`) — that is hostname, not legal address. | Launch checklist (logged in) holds address/Ltd/migration/CSV. Do not add those fields to token APIs. |
| 31 | `adoptPreviewDraftShop` assumes workspace already built (`conversion.ts:162-164`) | Draft is empty at birth. Preview-launch submit then requires ≥1 barber/service/hours (`schema.ts:249-260`) | Owner corrections in Review (proposals) + ops Apply must happen **before** Launch submit, or launch validation will 400 on empty drafts. |
| 32 | Toasts required (§3.3) | No shared toast | New hub toast component using tokens; 4s; `aria-live`. |
| 33 | Shell: sidebar / bottom tabs / locked tabs (§3.2) | `PreviewTopBar` is a sticky bar with Request changes + Launch. No sidebar, no messages badge | Replace behind the flag. Keep checkout on Review until Launch stage. |
| 34 | “Open in new tab” only if the current page already exposes it (§4.3) | Token page fallback + `SitePreviewShell` both expose it | Keep on `/website`. |
| 35 | `claim-paid-subscription` as a status writer | It does not change status | Spec Launch backing state is `CONVERTED` from the webhook. Claim only adopts the shop. Leave it. |

---

## Open questions

1. Hub flag vs flow flag: may the hub be on while public `/free-preview` CTAs stay off (ops-only trial)?
2. “Approve for launch” on the checklist: reuse `approveSiteLaunch` (shop `launchApprovedAt`/`goLiveAt`) or only `PreviewRequest.launchApprovedAt`?
3. D1 product+live gate on the **dashboard** retail toggle: in-scope later, or leave until a dashboard batch?
4. Converting a `REJECTED`/`DECLINED` request if they pay — allow (current webhook) or block?
5. No-thanks `Referrer-Policy` exception (conflict 25) — confirm keeping `same-origin` on that one page.
