# KERSIVO Shop Hub — Product & Technical Spec v1.0

Status: APPROVED FOR BUILD (founder decisions locked 31 Oct 2026)
Owner: KERSIVO founder · Implementation: Cursor, in batches (see `KERSIVO_Shop_Hub_Cursor_Batches.md`)
Copy language for everything users see: **British English**.

---

## 0. What we are building and why

Today a barbershop requests a free preview at `/free-preview` (4 required fields), gets an acknowledgement email **with no link**, waits, then gets a link to `/preview/{token}` showing the draft website + booking page, with a single free-text "request changes" box and checkout. After paying they fill a short "Confirm your details" form at `/admin/preview-launch`. Logos, photos and corrections arrive as email attachments that nobody tracks.

The old post-payment `ClientOnboardingWizard` (`/admin/client-onboarding`, 11 steps) collected everything at once. It was thorough but heavy, and it came *before* the owner had seen any value.

**The Shop Hub** replaces that gap with **one private link that lives for the whole journey** — from the moment the owner requests a preview until the site is live. It is a real client portal, not a form:

- the owner always knows **where things are** (stage, what we're doing, what we need from them);
- they can **send material** (logo, photos, price list, team photos) from their phone in seconds;
- they **confirm** their services, team and hours instead of typing them;
- they **request design changes** as a tracked list, and see each one move to "Done";
- they **message KERSIVO** in one thread, with attachments;
- after subscribing, a **launch checklist** takes them to go-live with only the missing details.

### Design principles
1. **One link, one place.** `/preview/{token}` is the hub for every stage. Emails always link back to it.
2. **Confirm, don't collect.** We build from their links; the owner corrects. Every field we ask is a field they could skip.
3. **Ask at the moment of motivation.** Nothing sensitive before payment. Legal/contact/address/migration only after subscribing, behind login.
4. **Always show the next step.** Every screen has exactly one primary action.
5. **Nothing silent.** Every upload, change, message and status change is visible to both sides (activity feed + ops console).
6. **Product continuity.** The hub uses the same premium dark visual language as the KERSIVO dashboard, so the owner's first contact with KERSIVO already feels like the product.

---

## 1. Founder decisions (locked)

| # | Decision |
|---|---|
| D1 | **Retail is off at launch.** Retail turns on only from the dashboard via Retail onboarding, after the site is live and at least one product exists. The hub and launch checklist never ask about retail. |
| D2 | **Booking payment default = Pay at shop** (`BookingPaymentMode.NONE`). Deposits / full payment are set later in dashboard settings. Stripe Connect is therefore **optional** for launch ("Recommended if you want deposits"). |
| D3 | **No legal business name / company number for sole traders.** We ask "Is your shop a limited company?" Only if **Yes** do we ask registered company name, company number and registered office address — because a limited company's website must show them (Companies Act 2006 / trading disclosures), and we build that website. |
| D4 | Everything else (team availability, deposits, retail, SMS, opening-hours exceptions) is configured by the owner in the dashboard after launch. The hub does not duplicate dashboard settings. |
| D5 | **One round of design changes** is included before subscribing (existing public promise). **Data corrections** (services, prices, durations, team, hours, contact details) are unlimited and do not use the round. Ops can grant an extra round. |
| D6 | Preview expiry stays 30 days after ready (`PREVIEW_EXPIRY_DAYS`); data retention follows the existing purge job. Hub files and messages are purged with the request. |

---

## 2. Journey and stages

Owner-facing stages (shown as a 5-step stepper):

| # | Stage label | Backing state | Owner sees | Owner can do |
|---|---|---|---|---|
| 1 | **Requested** | `REQUESTED` | "We've got your request" + what happens next | Upload material, add shop details, message |
| 2 | **Designing** | `IN_PROGRESS` | "We're designing your website" | Same as 1 |
| 3 | **Review** | `READY`, `CHANGES_REQUESTED` | Website + booking preview, review cards, changes list | Confirm/correct content, draft & send changes, subscribe, message |
| 4 | **Launch** | `CONVERTED` and not live | Launch progress (what's done, what's left, what KERSIVO is doing) | Open launch checklist (login), message |
| 5 | **Live** | `CONVERTED` and live | "You're live" + next steps in dashboard | Go to dashboard, message |

Terminal/other states:
- `DECLINED` → calm closed state ("You've closed this preview") + "Changed your mind? Message us" (messages stay available until purge).
- `EXPIRED` → expired state (HTTP 410 kept) + "Ask us to reopen it" button (creates a message, rate-limited).
- `REJECTED` and unknown tokens → **404, indistinguishable** (unchanged).
- Operators (`resolveOperatorAccess`) can open any hub; their views are never counted as owner views (unchanged rule).

"Live" detection: use an existing shop field that marks the public site as published if one exists (Batch 0 verifies); otherwise add `PreviewRequest.liveAt` set by an ops action "Mark live".

Direct subscribers (who skip the preview via `/admin/launch`): Batch 0 documents the current flow. Target state (Batch 5): they also get a hub — a `PreviewRequest` is created at checkout with `entryPoint = 'direct_subscribe'`, status `IN_PROGRESS`, `convertedAt` set, so they use the same hub and launch checklist instead of the legacy 11-step wizard. The legacy wizard stays reachable for existing shops only.

---

## 3. Information architecture & layout

### 3.1 Routes
| Route | Purpose | Auth |
|---|---|---|
| `/preview/{token}` | Hub → Overview | token |
| `/preview/{token}/website` | Website + booking preview (stage ≥ Review; locked state before) | token |
| `/preview/{token}/details` | Your shop: Brand, Photos, Price list, Services, Team, Hours, About | token |
| `/preview/{token}/changes` | Design change requests (stage ≥ Review) | token |
| `/preview/{token}/messages` | Thread with KERSIVO | token |
| `/preview/{token}/no-thanks` | existing | token |
| `/admin/preview-launch` | **Launch checklist** (rebuilt, same visual language as hub) | logged-in owner |
| `/ops/preview-requests` and `/ops/preview-requests/{id}` | Ops console (list + workspace) | operator |

Back-compat: `?view=booking` on `/preview/{token}` keeps working (redirect to `/website?view=booking`). All emails already sent must keep working.

### 3.2 Shell
- **Desktop (≥1024px):** left sidebar 248px — KERSIVO wordmark, shop name, stage pill, nav (Overview · Website · Your shop · Changes · Messages), footer card "Questions? Message us". Main column max 1080px.
- **Tablet/mobile:** top bar (shop name + stage pill + messages icon with unread dot) and a **fixed bottom tab bar** with 4–5 icons + labels (Overview, Website, Your shop, Changes, Messages). Safe-area insets respected. Tap targets ≥ 44px.
- Tabs that are not available yet are shown **locked** with a one-line reason ("Available when your preview is ready"), never hidden — the owner sees the whole journey.
- A persistent but quiet "Private · hidden from search engines" label in the header.
- Unread badge on Messages; count badge on Changes (open items).

### 3.3 Visual language
- Reuse the dashboard's premium dark theme (`admin-theme-premium-black`), tokens from `src/styles/tokens.css`, existing button/input/badge/`ks-glass-card` components. No new font families.
- Cards with 1px hairline borders, 12–16px radius, generous spacing (8px grid), muted secondary text, one accent colour for primary actions and progress.
- Status colours: neutral (pending), accent (in progress), green (done), amber (needs you). Never colour alone — always icon + text.
- Icons: one consistent outline icon set already used in the dashboard.
- Motion: 150–200ms ease-out for state changes; respects `prefers-reduced-motion`.
- Every async surface has four designed states: **loading (skeleton)**, **empty**, **error (with retry)**, **success**. Autosave fields show "Saving…" → "Saved".
- Toasts for confirmations (bottom on mobile, bottom-right on desktop), auto-dismiss 4s, accessible live region.

### 3.4 Quality bar
- WCAG 2.2 AA (contrast ≥ 4.5:1 text, focus visible, full keyboard support, labelled inputs, `aria-live` for upload progress and toasts).
- Mobile-first; tested at 360, 390, 768, 1280, 1440px. No horizontal scroll.
- Performance: hub Overview LCP < 2.0s on 4G mid-range phone; JS for the shell ≤ 90 KB gzip (islands only where interactive); images via thumbnails.
- No layout shift on load (CLS ≈ 0).

---

## 4. Screens

### 4.1 Overview (every stage)
Top to bottom:
1. **Header block**: H1 per stage (copy §9), one-line subtext, primary action button.
2. **Stepper**: Requested → Designing → Review → Launch → Live, with dates for completed steps (from `createdAt`, `PreviewRequestEvent`s, `previewReadyAt`, `convertedAt`, live date).
3. **"Now" card** — two columns: *What we're doing* / *What we need from you* (or "Nothing — we'll email you").
4. **Preview card**:
   - before Review: tasteful locked placeholder with shop name and "Your preview will appear here";
   - Review+: thumbnail (phone frame) + buttons "Open website" / "Try booking".
5. **Your shop checklist** (progress ring "4 of 7"): Logo · Shop photos · Services & prices · Team · Opening hours · About your shop · Price list photo (optional items labelled "Optional"). Before Review, Services/Team/Hours items say "We'll fill these from your links — you'll confirm them on your preview".
6. **Activity feed** (latest 10, "Show all"): request received, files added, preview ready, changes sent, change done, message received/sent, subscribed, live. Each with relative time ("2 hours ago") and absolute time on hover/long-press.
7. **Help card**: "Message KERSIVO" + email `hello@kersivo.co.uk`. No response-time promise for prospects.

Stage Launch/Live: section 4 becomes **Launch progress** (see 4.6) and section 5 is replaced with "Next in your dashboard" (Live).

### 4.2 Your shop (`/details`)
Sections as cards, each independently saved:

**Brand**
- Logo uploader (drag & drop, tap to choose, camera on mobile). Shows logo on dark and light swatches side by side. Accepts PNG/JPG/WEBP/SVG/PDF.
- **Colour picker with "Pick from my logo"**: after a logo upload, extract up to 5 dominant colours client-side (canvas sampling, ignore near-white/near-black/transparent) and offer them as chips; owner taps primary (and optional secondary). Hex input also available. Optional.
- "Anything about your style?" short text (≤ 500 chars). Optional.

**Photos**
- Shop photos (interior, chairs, cuts) — multi-select upload, grid of thumbnails, drag to reorder, caption optional, delete with undo (5s). Up to 40.
- Team photos — upload per barber when the team is known (after Review), otherwise a general "Team photos" set.
- Hint: "Phone photos are perfect. Landscape works best for the top of your website."

**Price list**
- "Snap your price list" — photo or PDF of the price board/menu. Up to 5 files. Explains: "We'll copy your services and prices from it."

**Services & prices** (review card — see 4.4 when stage ≥ Review; before Review: optional free-text "Anything missing from your links?")

**Team** (review card, ≥ Review)

**Opening hours** (review card, ≥ Review; reuse `WeeklyHoursEditor`)

**About your shop** — 2–3 sentences (≤ 600 chars), optional, prefilled if ops wrote one.

Uploads UX (all uploaders):
- Client-side: images downscaled to max 2560px long edge and re-encoded (JPEG q≈0.85 or WEBP) before upload — strips EXIF/GPS and keeps uploads fast on mobile data. Per-file progress bars, parallel uploads (max 3), retry on failure, clear error per file ("This file is over 15 MB", "Only JPG, PNG, WEBP or PDF").
- On iOS, `accept="image/jpeg,image/png,image/webp"` makes Safari convert HEIC to JPEG automatically — do not list HEIC.

### 4.3 Website (`/website`, stage ≥ Review)
- Toolbar: **Website / Booking** segmented control; **Phone / Desktop** device switch (desktop default ≥1024px, phone default on mobile); "Open in new tab" (only if the current page already exposes it — keep existing behaviour); "Suggest a change" button.
- Website view: framed `sitePreviewUrl` (existing CSP frame allowance kept). Booking view: existing `BookingFlow` in test mode with the existing "Test bookings only — no payments are taken." notice.
- "Suggest a change" opens a side sheet (bottom sheet on mobile) prefilled with the current page/section selector (Home · Services · Barbers · Gallery · Contact · Booking · Other), text, optional screenshot/image attachment → saved as a **draft** change (see 4.5).
- Batch 6 (conditional): **pin mode** — owner clicks an element on the framed site; see §10.

Before Review: locked state with stepper excerpt and "We'll email you when it's ready".

### 4.4 Review cards ("Is this right?") — stage ≥ Review
Shown on Overview (as a "Check your details" strip with three cards) and in `/details`.
- **Services & prices**: table of the draft shop's active services (name, duration, price). Actions: "Looks right ✓" (whole card) or per-row edit (inline), add row, remove row (soft). Saving creates a **content proposal** — the preview does not change until ops applies it. Card state: *Not checked* → *Confirmed* or *Corrections sent* → *Updated* (after ops applies).
- **Team**: barber cards (name, photo, short bio ≤ 280 chars, "Show on website" toggle). Same states.
- **Opening hours**: weekly grid. Same states.
- Copy under each card: "Corrections to your details don't use your round of design changes."
- Ops applies proposals in one click (§6); the owner sees "Updated on your preview" and gets it in the activity feed.

### 4.5 Changes (`/changes`, stage ≥ Review)
A tracked list, like a lightweight ticket board:
- Each change: page/section, description, optional attachment, status chip **Draft · Sent · In progress · Done · Not possible** (+ ops note when Not possible).
- Owner adds drafts any time (from here or from Website "Suggest a change"), edits/deletes drafts, then **"Send changes to KERSIVO"** submits all drafts as one round (round number shown: "Round 1 of 1 included").
- After the included round is used: drafting still possible, sending disabled with "You've used your included round of changes. Message us if something isn't right." Ops can grant another round.
- Submission sets status `CHANGES_REQUESTED` (existing semantics), notifies ops (existing internal email, now listing items), and writes `changesRequestedText` as a plain-text rendering for back-compat.
- When ops marks changes done and re-sends the preview, the existing "We've updated your preview" email lists the completed items.

### 4.6 Launch (stage Launch/Live)
**In the hub (token, no sensitive data):** Launch progress card with two lists:
- *Your steps*: Business details · Domain · Payments (optional) · Moving your clients (optional) · Approve your website — each Done / To do, with "Finish in your dashboard" button → `/admin/preview-launch` (login).
- *Our steps*: Connect your domain · Secure it (SSL) · Publish your website — Pending / In progress / Done (set by ops actions).

**`/admin/preview-launch` — Launch checklist (rebuilt, logged in):** a vertical checklist with progress bar ("3 of 5 done"), each item expands inline, prefilled, autosaved:
1. **Business details** — name shown on your website (prefill shop name), public phone, public email, shop address + postcode + town (shown on website and Google), contact name + contact email (private, for KERSIVO). "Is your shop a limited company?" Yes → registered company name, company number, registered office address (shown in website footer). No → nothing more.
2. **Domain** — shows the choice made at checkout (`domainMode`, `existingDomain` / chosen domain). Existing domain: step-by-step DNS instructions for the owner's registrar + "I've done this" + live check status. KERSIVO registers: status only ("We're registering yourshop.co.uk").
3. **Payments (optional)** — "Clients pay at the shop by default. Connect Stripe if you'd like deposits or online payment." Existing Stripe Connect button/state. Skippable.
4. **Moving your clients (optional)** — current system (prefilled from request), CSV upload (existing `MIGRATION_CSV` validation) + lawful-data confirmation. Skippable ("Not now").
5. **Approve your website** — final review links (website + booking), two confirmations (existing: rights to photos/logo/text; details correct), button **"Approve for launch"**. Enabled only when item 1 is complete. Approval timestamps are stored and shown in the hub and ops.

After approval: "Thanks — we'll put {shop} live and email you" + Our steps progress.

**Live:** hub Overview shows "{shop} is live" (no emoji anywhere in the hub UI) with a link to the live site, then **Next in your dashboard** cards: Add your booking link to Google · Order your QR Kit · Set deposits (optional) · Start selling products (Retail onboarding) · Add your team's working hours. Each links to the existing dashboard page.

### 4.7 Messages (`/messages`)
- Chat-style thread, newest at bottom, day separators, author labels ("You" / "KERSIVO"), timestamps, read state for owner messages ("Seen" when ops opened).
- Composer: multiline (≤ 2000 chars), attach up to 5 files (images/PDF, same pipeline), send with button (Enter = newline on mobile; Ctrl/Cmd+Enter sends on desktop).
- Empty state: "Got a question or something we should know? Send us a message — we reply by email and here."
- System events are NOT mixed into the thread (they live in the activity feed).

---

## 5. Emails

All emails: plain, short, one button, reply-to `hello@kersivo.co.uk`, sent through the existing outbox/Resend path, respecting `emailOptOut` for non-transactional ones.

| Trigger | To | Change vs today |
|---|---|---|
| Request created | Owner | **Rewrite** — adds the hub link (copy §9.1) |
| Request created | Ops | Add hub link + ops link (exists) |
| Owner uploads files | Ops | **New** — digest: at most one email per request per 15 min, listing files |
| Owner sends message | Ops | **New** — at most one per request per 15 min ("3 new messages") |
| KERSIVO sends message | Owner | **New** — immediate, includes message text (first 500 chars) + button "Reply in your shop hub" |
| Preview ready | Owner | Keep; button text "Open your preview"; mention review cards |
| Changes sent | Ops | Exists — now lists items |
| Preview updated | Owner | Exists — now lists Done / Not possible items |
| Ops applied content corrections | Owner | No email (activity feed only) unless sent with a preview update |
| Subscribed (converted) | Owner | **New/adjust** — "Let's put {shop} live" → launch checklist |
| Owner approved for launch | Ops | **New** |
| Site live | Owner | **New** — "{shop} is live" + next steps |
| Follow-up / expiry reminder | Owner | Keep (existing lifecycle) |

Batch 6 optional: reply-by-email into the thread (inbound parsing) — only if Resend inbound (or equivalent) is available and verified; otherwise owners keep replying in the hub.

---

## 6. Ops console

`/ops/preview-requests` list: add columns/badges — unread messages, new files since last ops view, open changes, review-card states, stage. Sort by "needs attention" (unread messages, sent changes, owner-approved launches first).

`/ops/preview-requests/{id}` becomes a workspace with tabs:
- **Overview** — request details (existing), links, stage, key dates, actions (existing status actions + new: Mark live, Grant extra change round, Set our launch steps).
- **Files** — grid by kind, download original, copy-to-clipboard of file name, "Use as logo" shortcut that sets the draft shop logo (only if a helper for that exists; otherwise download only).
- **Content** — proposals per section with a diff view (current draft shop vs proposed), **Apply** (writes to the draft shop through existing service-layer functions) / **Dismiss with note**.
- **Changes** — list with status controls (In progress / Done / Not possible + note).
- **Messages** — same thread, ops composer, attachments.
- **Activity** — full event log (`PreviewRequestEvent`).
- **Internal notes** — existing.

Opening the Messages tab marks owner messages as read by ops.

---

## 7. Data model (Prisma, additive only)

New enums/models (names may be adjusted to match repo conventions; keep semantics):

```prisma
enum PreviewHubAssetKind { LOGO SHOP_PHOTO TEAM_PHOTO PRICE_LIST MESSAGE_ATTACHMENT CHANGE_ATTACHMENT OTHER }
enum PreviewHubActor { OWNER KERSIVO }

model PreviewHubAsset {
  id               String              @id @default(cuid())
  previewRequestId String
  kind             PreviewHubAssetKind
  storagePath      String              // private blob path (original, re-encoded)
  thumbPath        String?             // private blob path, 480px webp
  originalFileName String
  contentType      String
  sizeBytes        Int
  width            Int?
  height           Int?
  caption          String?
  sortOrder        Int                 @default(0)
  barberId         String?             // TEAM_PHOTO linked to a draft-shop barber
  uploadedBy       PreviewHubActor
  createdAt        DateTime            @default(now())
  deletedAt        DateTime?
  previewRequest   PreviewRequest      @relation(fields: [previewRequestId], references: [id], onDelete: Cascade)
  @@index([previewRequestId, kind])
}

model PreviewHubMessage {
  id               String          @id @default(cuid())
  previewRequestId String
  author           PreviewHubActor
  authorEmail      String?         // ops actor email; null for owner
  body             String          @db.Text
  attachmentIds    String[]        // PreviewHubAsset ids
  createdAt        DateTime        @default(now())
  readByOwnerAt    DateTime?
  readByOpsAt      DateTime?
  previewRequest   PreviewRequest  @relation(fields: [previewRequestId], references: [id], onDelete: Cascade)
  @@index([previewRequestId, createdAt])
}

enum PreviewChangeStatus { DRAFT SENT IN_PROGRESS DONE NOT_POSSIBLE }

model PreviewChangeRequest {
  id               String              @id @default(cuid())
  previewRequestId String
  round            Int?                // set on send
  page             String              // HOME | SERVICES | BARBERS | GALLERY | CONTACT | BOOKING | OTHER
  body             String              @db.Text
  attachmentId     String?
  anchor           Json?               // Batch 6 pin data
  status           PreviewChangeStatus @default(DRAFT)
  opsNote          String?
  createdAt        DateTime            @default(now())
  sentAt           DateTime?
  resolvedAt       DateTime?
  previewRequest   PreviewRequest      @relation(fields: [previewRequestId], references: [id], onDelete: Cascade)
  @@index([previewRequestId, status])
}

enum PreviewContentSection { SERVICES TEAM HOURS }
enum PreviewContentReviewState { CONFIRMED CORRECTIONS_SENT APPLIED DISMISSED }

model PreviewContentReview {
  id               String                    @id @default(cuid())
  previewRequestId String
  section          PreviewContentSection
  state            PreviewContentReviewState
  proposal         Json?                     // validated with zod per section
  opsNote          String?
  createdAt        DateTime                  @default(now())
  appliedAt        DateTime?
  appliedBy        String?
  previewRequest   PreviewRequest            @relation(fields: [previewRequestId], references: [id], onDelete: Cascade)
  @@index([previewRequestId, section, createdAt])
}
```

`PreviewRequest` additions: `brandPrimaryColour String?`, `brandSecondaryColour String?`, `styleNotes String?`, `aboutText String?`, `includedChangeRounds Int @default(1)`, `changeRoundsUsed Int @default(0)`, `ownerLastSeenAt DateTime?`, `opsLastSeenAt DateTime?`, `opsFilesNotifiedAt DateTime?`, `opsMessagesNotifiedAt DateTime?`, `launchApprovedAt DateTime?`, `liveAt DateTime?` (only if no existing live marker), `ourStepDomainAt DateTime?`, `ourStepSslAt DateTime?`.

`ClientOnboarding` additions (launch checklist): `isLimitedCompany Boolean?`, `registeredOfficeAddress String?` (reuse existing `legalBusinessName` for registered company name and `companyNumber`). Existing `launchRetail` / `launchDeposits` are no longer asked (D1, D2); leave columns, stop writing them from new UI.

Retention: `purgeExpiredPreviewData` must delete hub assets (blobs + rows), messages, change requests and reviews for purged requests. Anonymisation must not leave file names or message bodies.

On conversion (`adoptPreviewDraftShop`), hub assets stay linked to the request; the launch checklist reads them; no copying into `ClientOnboardingAsset` is required except the migration CSV, which is uploaded in the checklist (logged in) using the existing `ClientOnboardingAsset` path.

---

## 8. API surface

All hub endpoints: `src/pages/api/preview-hub/[token]/…`. Each: feature flag check → IP rate limit → token resolution (`resolvePreviewRequestByToken`) → **capability check by stage** (table below) → zod validation → action → `PreviewRequestEvent` row → JSON.

| Endpoint | Method | Allowed stages |
|---|---|---|
| `/state` | GET | all visible |
| `/assets` | POST (multipart, ≤ 4 MB body) | Requested, Designing, Review, Launch (not Live for owner uploads except messages) |
| `/assets/{id}` | GET (`?size=thumb|full`) — streams private blob, `Cache-Control: private, max-age=300` | all visible |
| `/assets/{id}` | PATCH (caption, sortOrder, barberId) / DELETE (soft) | owner's own uploads, until Launch |
| `/details` | PATCH (brand colours, styleNotes, aboutText) | until Launch |
| `/reviews` | POST (section, CONFIRMED or proposal) | Review |
| `/changes` | POST/PATCH/DELETE drafts | Review |
| `/changes/send` | POST | Review, rounds left |
| `/messages` | GET/POST; `/messages/read` POST | all visible incl. EXPIRED/DECLINED (POST rate-limited) |
| `/event` | existing | — |

Ops endpoints under `src/pages/api/ops/preview-requests/[id]/…` (operator auth): messages, reviews apply/dismiss, changes status, grant round, mark live, our-steps, assets download.

Existing endpoints `changes.ts`, `checkout.ts`, `domain-search.ts`, `event.ts`, `details.ts` keep working; `changes.ts` becomes a thin wrapper or is retired only after the new flow ships behind the flag and tests pass.

---

## 9. Copy (British English, final unless marked)

### 9.1 Acknowledgement email (replaces current)
```
Subject: We're designing your {shopName} website

Hi {firstName|there},

Thanks for requesting a free website preview for {shopName}. We design every preview individually, {PREVIEW_TURNAROUND_TEXT}.

Your private shop hub is ready now:
[Open your shop hub]

Use it to see where your preview is up to, add your logo, photos or a photo of your price list, and message us. Everything is optional — we can work from your links.

When your preview is ready, it appears in the same place and we'll email you.

There's nothing to pay and no card needed. You only pay if you decide to launch.

The KERSIVO team
```
(Over-daily-cap variant keeps `PREVIEW_OVER_CAP_MESSAGE` in the second paragraph.)

### 9.2 Hub headers by stage
| Stage | H1 | Sub |
|---|---|---|
| Requested | We've got your request | We'll start designing {shopName}'s website soon. Add anything that helps — it's all optional. |
| Designing | We're designing your website | Your preview is being built individually for {shopName}. We'll email you when it's ready. |
| Review | Your preview is ready | Have a look, check your details and tell us what to change. |
| Review (changes sent) | We're updating your preview | We've got your changes and we'll email you when they're done. |
| Launch | Let's put {shopName} live | A few details from you, then we connect your domain and publish. |
| Live | {shopName} is live | Your website and booking page are open to clients. |
| Declined | You've closed this preview | Changed your mind? Send us a message. |
| Expired | This preview has expired | Ask us to reopen it and we'll get back to you. |

### 9.3 Microcopy (selection)
- Private label: "Private · hidden from search engines"
- Upload hint: "Phone photos are perfect. JPG, PNG, WEBP or PDF."
- Files privacy: "Your files are private. If you don't launch, we delete them with your preview."
- Review card footer: "Corrections to your details don't use your round of design changes."
- Round used: "You've used your included round of changes. Message us if something isn't right."
- Messages empty: "Got a question or something we should know? Send us a message — we reply by email and here."
- Launch Ltd question: "Is your shop a limited company?" Helper: "Limited companies must show their registered name, number and office address on their website. We'll add them to your footer."
- Payments optional: "Clients pay at the shop by default. Connect Stripe if you'd like deposits or online payment — you can also do this later in your dashboard."

Claims guard: no response-time promises to prospects; "first-response target of one business day" only where it already appears for Full subscribers; no "guaranteed" launch dates; turnaround text only from `config.ts` constants. `npm run claims:check` must pass.

---

## 10. Batch 6 extras (conditional)

1. **Pin mode on the website preview** — only if preview websites are built from code KERSIVO controls (Batch 0 answers). A tiny script served from kersivo.co.uk is loaded by the preview site only when framed with `?kfeedback=1`; on click it posts `{path, cssPath, textSnippet, scrollY, viewport}` to the parent via `postMessage` (strict origin checks both ways). The parent creates a draft change with `anchor`. Ops sees "Home › 'Book an appointment' button". If the condition fails, skip — Batch 4's page selector + screenshot already covers the need.
2. **Reply by email** into the thread via inbound email, only if the provider supports it and DNS can be set on a subdomain; signed per-request reply address; strip quoted text; attachments go through the same validation.

---

## 11. Security & privacy

- Token = capability. 256-bit token already. Never log full tokens (log first 6 chars). `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store` on all hub pages **and** hub APIs (asset GET may use `private, max-age=300`).
- No sensitive data under the token: no address, legal details, Stripe, migration data. Those live in `/admin/*` behind login.
- POST endpoints check `Origin`/`Sec-Fetch-Site` = same-origin; JSON only (except multipart uploads).
- Uploads: server-side magic-byte sniffing (JPEG/PNG/WEBP/PDF/SVG) — never trust extension or client MIME; size caps (body ≤ 4 MB after client compression; images re-encoded server-side with `sharp`: auto-rotate, strip all metadata, max 2560px, plus 480px WEBP thumbnail); SVG rasterised to PNG for display, original stored and only ever served as attachment with `Content-Disposition: attachment` and `Content-Type: application/octet-stream`; PDFs served as attachment. Per-request caps: 60 active files, 250 MB total. Per-token and per-IP rate limits.
- Storage: existing private store helper (`privateOnboardingBlob`, `PRIVATE_BLOB_READ_WRITE_TOKEN`), path prefix `preview-hub/{previewRequestId}/{kind}/…`. Never expose blob URLs; always stream through the token/operator-checked route.
- Text inputs: length-limited, rendered as text (no HTML), links auto-linked safely in messages (rel="noopener noreferrer nofollow ugc").
- Retention per D6; privacy policy updated to list hub files and messages (Batch 2/3).
- Abuse: one request per email/shop already deduped; hub POSTs rejected for `REJECTED`; per-request message cap (e.g. 100/day).

---

## 12. Analytics

Server-side events via existing `sendServerAnalyticsEvent` / `FUNNEL_EVENTS` (add names):
`hub_viewed` (first view per stage), `hub_asset_uploaded` (kind), `hub_details_saved`, `hub_review_confirmed` (section), `hub_review_corrections_sent` (section), `hub_change_drafted`, `hub_changes_sent`, `hub_message_sent` (actor), `launch_checklist_item_completed` (item), `launch_approved`, `site_live`.
No personal data in event params. Owner views only (never operators).

---

## 13. Out of scope
Live chat/websockets; push notifications; owner editing the website directly; payments inside the hub other than the existing checkout; multi-location; Welsh translation.
