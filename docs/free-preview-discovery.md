# Free preview — discovery audit and implementation plan

Discovery for `docs/free-preview-spec.md` (29 Oct 2026). No application code was changed.

---

## 1. Stack, hosting, data, email, analytics, forms

| Area | Finding | Files |
|---|---|---|
| Framework | Astro (`output: 'server'`, Vercel adapter) + React islands. Pages are SSR by default, so a runtime env flag works per request. `sitemap.xml` is the exception (`prerender = true`, build-time). | `astro.config.mjs`, `src/pages/sitemap.xml.ts` |
| Hosting | Vercel project `kersivo-barber-outreach`; redirects, headers and **crons** live in `vercel.json`. | `vercel.json` |
| DB / ORM | Postgres (Neon) via Prisma. | `prisma/schema.prisma`, `src/lib/db/client` |
| Auth | Better Auth (email/password + OAuth). New user → `provisionShopForUser` auto-creates an **empty owned shop**. | `src/lib/auth.ts`, `src/lib/auth/userCreatedHook.ts`, `src/lib/auth/provisionShop.ts` |
| Email | Resend through `sender.ts` (supports `replyTo`). Durable retries through the `EmailOutbound` outbox + `/api/cron/email-outbox` (every 5 min); purposes are a Prisma enum. | `src/lib/email/sender.ts`, `src/lib/email/outbox.ts`, `EmailOutboundPurpose` |
| Analytics | GA4 / Google Ads via gtag behind Consent Mode v2. Events: `data-track="…"` attributes (auto-sent by `initDataTrack`) or `trackConsentedEvent()`. Canonical names in `FUNNEL_EVENTS`. **No server-side (Measurement Protocol) sending exists.** | `src/lib/analytics/funnelEvents.ts`, `src/lib/analytics/initDataTrack.ts`, `src/lib/consent/events` |
| Forms | JSON POST to an API route. Homepage contact (`contact16.astro` → `/api/contact`): **honeypot** (`companyWebsite`, silent 200), **durable IP rate limit** (`enforceIpRateLimit`, `RateLimitEvent` table), server validation, Resend send. **No captcha anywhere** (no Turnstile/reCAPTCHA/hCaptcha). | `src/pages/api/contact.ts`, `src/lib/rate-limit/*` |
| Copy guard | `npm run claims:check` scans `src/pages`, `src/components`, `src/lib/seo|pricing|compare|landing|nav` for banned phrases; approved wording in `claimsPolicy.ts`. | `scripts/claims-guard.mjs`, `src/lib/pricing/claimsPolicy.ts` |

## 2. Current Full KERSIVO purchase flow (end to end)

1. **CTA** → `/admin/launch` (`src/pages/admin/launch.astro` → `LaunchWizard.tsx`).
2. `LaunchWizard` calls `/api/setup/launch-context`:
   - **401 (guest)** → guest mode; prefills from a guest preview cookie shop if one exists (`/api/preview/onboarding`). Guest fills name/email/shop/size/stack ("Tell us about your shop", `LaunchWizard.tsx:641`) + Terms checkbox → `POST /api/setup/subscription-checkout` (unauthenticated, IP-limited, `checkoutAttemptId` idempotency, `LegalAcceptance` via `requireTermsAcceptance`). It creates a `SaasSubscription` PENDING row and a Stripe Checkout session (`createSubscriptionCheckoutSession`, `customer_email` prefilled, metadata `type=saas_subscription`, `checkoutAttemptId`, optional `shopId` = guest preview shop).
   - **Signed in** → requires `onboardingCompleted`, else → `/admin/onboarding`; then `POST /api/setup/launch-subscription-checkout` (`runAuthenticatedSaasCheckout`, metadata includes own `shopId`).
3. **Stripe Checkout** → success `/setup/success?session_id=…`, cancel `/setup/cancel`.
4. **Webhook** `src/pages/api/shop/webhook.ts` → `handleSaasSubscriptionCheckout` (ledgered in `StripeWebhookEvent`, idempotent): marks the row ACTIVE, then, if `shopId` is known, `setShopAnalyticsLive`, `markShopPaid` (`shopPaidAt`), `enableShopSmsReminders`; otherwise it falls back to "by owner email"; sends the confirmation email + internal email.
5. **`/setup/success`** → `SetupSuccessSaasContinue.tsx`: guest signs up / signs in; then `POST /api/setup/claim-paid-subscription` (requires signed-in email == checkout email; links `SaasSubscription.shopId` to **the user's own shop**; refuses `ALREADY_OWNED` if the row already points at another shop) → redirect to `/admin/client-onboarding`.
6. **Delivery onboarding** `/admin/client-onboarding` (`ClientOnboardingWizard`, `ClientOnboarding` model: business, brand, domain, migration, launch prefs, declarations) → status SUBMITTED.
7. **KERSIVO builds the website outside this repo**, then calls `POST /api/ops/site-preview` (Bearer `CRON_SECRET`, body `{shopId, previewUrl, siteVersion}`) → sets `ShopSettings.sitePreviewUrl/Version/ReadyAt`, clears approval, logs `SiteLaunchEvent`.
8. **Owner review** `/admin/site-preview` (`SitePreviewShell.tsx`: iframes the external `sitePreviewUrl`, falls back to "open in new tab" if framing is blocked) → **Approve & launch** (`/api/admin/site-launch/approve` → `approveSiteLaunch`, records `launchApprovedAt/Version`, `goLiveAt`).
9. DNS switched manually by ops; `FullBookingDestination` set via `/api/ops/full-booking-destination` after manual attestations.

## 3. The existing "private preview" — there are two mechanisms

**A. Site preview (the branded website)**: `ShopSettings.sitePreviewUrl` etc.
- The website itself is **not rendered by this repo**. It is an external `https://` URL that ops sets after building the site elsewhere. KERSIVO only stores the URL and iframes it inside an authenticated admin page.
- URL formation: whatever ops posts. Protection: **only the wrapper page is protected** (Better Auth session + `billing.manage` + `BRANDED_SITE` capability). The external URL itself has no token or auth that this repo knows of.
- Noindex: the wrapper is `noindex` (`MinimalLayout noindex`). Whether the external site is noindexed is outside this repo.
- Before payment: **no**. `/admin/site-preview` requires a signed-in owner with Full capability, so the review step only exists after payment.

**B. Guest workspace preview (the booking workspace)**: `ShopPreviewSession` + `src/lib/preview/shopPreviewSession.ts`.
- **Draft state:** `createPreviewShopSession()` creates a `ShopSettings` with `ownerUserId: null`, `publicActivityPaused: true`, reason `GUEST_PREVIEW_PAUSE_REASON` ("Shop under construction — goes live after subscription."). Product state is `SETUP`, so public booking is blocked.
- **Token:** 32 random bytes base64url (256-bit), stored as a SHA-256 hash; the plaintext lives only in an httpOnly cookie `kersivo_shop_preview`, 7-day TTL. It is a **cookie, not a URL**.
- **Surfaces:** `/preview/onboarding`, `/preview/dashboard`, `/api/preview/onboarding/*` (IP rate-limited). Pages are `noindex`, analytics off.
- Before payment / account: **yes**. This is exactly an ownerless draft shop with services, barbers and hours. Guest checkout already passes this shop's id into Stripe metadata, and the webhook marks that shop paid.
- **Gap:** after payment, nothing transfers ownership. Sign-up auto-provisions a *new* empty shop, and the claim then fails with `ALREADY_OWNED` because the subscription points at the preview shop. So this path is effectively half-built (`PreviewAdminShell.tsx` still links "Get started — £39/month").

## 4. Transferring a KERSIVO-built draft shop to a customer account

**Not supported today.** `ShopSettings.ownerUserId` is `@unique` and only set by `provisionShopForUser`. `claim-paid-subscription` links the subscription to the user's *own* shop and refuses to re-point it. No code adopts an ownerless shop. This must be built in Batch 2 (see 7.2).

## 5. /ops

- Pages: `/ops/recommendations`, `/ops/recommendations/[shopId]` (Smart Retail control room), `/ops/reset-password`.
- APIs: `/api/ops/qr-kits/*`, `/api/ops/recommendations/*`, `/api/ops/full-booking-destination`, `/api/ops/payment-analytics`, `/api/ops/outbound-failures`, plus the machine endpoints `/api/ops/site-preview` and `/api/ops/synthetic-booking` (Bearer `CRON_SECRET`).
- Human auth: `resolveOperatorAccess` = Better Auth session + verified email + `KERSIVO_OPS_EMAILS` allowlist (fails closed). Mutations: `requireOperatorMutation` (operator + exact same-origin `Origin`). Page modes come from `resolveOpsPageView`; `Cache-Control: private, no-store`. `/ops` is disallowed in `robots.txt` and pages are `noindex, nofollow`.
- Template to copy: `src/pages/ops/recommendations/*` + `src/components/ops/recommendations/*` + `src/lib/ops/*`.

## 6. Paid CTA rendering: there is **no single shared component**

Label constants: `NAVBAR_SUBSCRIBE_CTA_LABEL` ("Get started — £39/month", `src/lib/nav/navbar17Items.ts:8`) and "Start Full KERSIVO — £39/month" repeated inline.

| Surface | File |
|---|---|
| Navbar (session-aware, via middleware) | `src/lib/nav/navbarPreviewCta.server.ts` (`GET_STARTED`), fallback `MARKETING_NAV_PRIMARY_ACTION` in `src/lib/nav/marketingNavigation.ts:353`, `navbar17Items.ts` (shop variants) |
| Footer | `src/lib/nav/footerNavigation.ts:15`, `src/components/footer50.astro:41` |
| Homepage hero | `src/components/homepage/HomepageHero.astro:28` |
| Homepage switching section | `src/components/landingSwitcherReassurance.astro:93` |
| Homepage "getting started" | `src/components/landingPostPurchaseSteps.astro:109` |
| Final CTA (home, alternatives) | `src/components/landingFinalCta.astro:35` |
| Comparison final CTA | `src/components/comparison/ComparisonFinalCta.astro:42` |
| Pricing card(s) | `src/components/rateCard1.tsx:110,241` + `src/lib/pricing/rateCard1Copy.ts:84,110`; `src/components/pricing36.tsx:22`; `src/pages/pricing.astro:66,228` |
| /barbershop-websites | `BarbershopWebsitesHero.astro:56`, `FullOffer.astro:15`, `FaqAndClose.astro:12` |
| /barbershop-online-booking | `src/lib/barbershopOnlineBooking/planChoiceContent.ts:47` |
| Pages consuming the above | `index`, `pricing`, `about`, `compare`, `barber-software-cost-calculator`, all 10 `*-alternative` pages |
| App-only | `src/components/preview/PreviewAdminShell.tsx:59`; `src/components/facebookCoverHero.astro` (social asset, leave) |

The no-show and chair-rent calculators and the cancellation template have **no** Full CTA today (spec 10.4 says "the calculators"; only `barber-software-cost-calculator` has one).

## 7. FAQ and JSON-LD

- Visible FAQ: `faq4.astro` fed by per-page data modules in `src/lib/seo/*Faq.ts` / `*Page.ts`.
- Homepage: `HOMEPAGE_FAQ_ITEMS` (`src/lib/seo/barbershopBookingFaq.ts:92`) drives **both** the visible FAQ and `FAQPage` JSON-LD (`buildBarbershopBookingFaqJsonLd`, merged in `buildHomepageJsonLd`, `src/lib/seo/barberDemoJsonLd.ts`). Same pattern for alternatives, calculators, pricing and starter: **single source, already in sync.**
- `SoftwareApplication` + `Offer` nodes: `src/lib/seo/barberDemoJsonLd.ts:86–119`.
- Many `src/lib/seo/*.test.ts` assert exact copy and section order, and will need updating with the copy.

## 8. Sitemap, robots, X-Robots-Tag

- Sitemap: hand-listed `MARKETING_SITEMAP_ENTRIES` with content-based `lastmod` (`src/lib/seo/marketingSitemap.ts`), prerendered at build time.
- `robots.txt`: `src/pages/robots.txt.ts`, private-path disallows (`/ops`, `/api/`, `/setup/`, `/q/`…). `/preview/` and `/book/` are deliberately **not** disallowed (so noindex is seen). Good for the spec.
- X-Robots-Tag: a route sets it on its own `Response` (example `src/pages/q/[code].ts:13`); an `.astro` page can call `Astro.response.headers.set('X-Robots-Tag', 'noindex, nofollow')` (ops pages already set headers this way). Meta robots come from `MinimalLayout`'s `noindex` / `robotsFollow` props.

## 9. Flags, cron, tests

- **Feature flags:** no flag framework. The pattern is constants (`src/lib/pricing/offerMode.ts` `ENABLE_SETUP_FEES`, `BARBERSHOP_WEBSITES_PAGE_INDEXABLE`) or env reads (`EMAIL_REMINDERS_ENABLED` in `src/lib/email/reminders.ts`).
- **Cron:** Vercel crons in `vercel.json` → `/api/cron/*`, authorised by `src/lib/ops/cronAuth.ts` (`CRON_SECRET`). There is already a daily `saas-lifecycle` job at 06:00.
- **Tests:** Vitest (`npm test`, `vitest.config.ts`, colocated `*.test.ts`), Playwright for a few scripted checks (`scripts/*.playwright.config.mjs`), plus `typecheck`, `claims:check` and `build`.

---

## 10. Conflicts and false assumptions in the spec

1. **"The preview is the shop's draft site."** The branded website is built and hosted **outside this repo**. This repo only stores `sitePreviewUrl`, so:
   - X-Robots-Tag / meta robots on our token page protect only **our wrapper**. The external preview host must send its own `noindex` and must not be linked publicly. **Needs an answer: where are tenant sites hosted, and can they send `X-Robots-Tag` and allow framing from kersivo.co.uk?**
   - "Sticky top bar on every preview page" is only achievable as a wrapper around an iframe (the existing `SitePreviewShell` pattern). If the host blocks framing, the fallback is "open in new tab", which loses the bar.
   - "Test-mode booking" applies to the booking page we host (`/book/{slug}`), not to the website.
2. **"Attach the draft shop to the account without rebuilding it" does not exist** (§4). Sign-up always creates a new empty shop; the claim refuses to re-point.
3. **"Webhook: create or link the customer account."** Accounts are never created in the webhook; the customer creates one at `/setup/success`. The webhook can mark the request `converted` and mark the draft shop paid (it already does this via `metadata.shopId`). **Ownership transfer must happen at claim time**, where the signed-in email has been matched to the paid checkout.
4. **Checkout needs more than email.** Guest checkout requires name (≥ 2 chars; the spec makes first name optional), shop size, current stack and **an explicit Terms acceptance** (`LegalAcceptance`, H05). The spec's confirmation panel has no Terms checkbox, so one must be added.
5. **Preview booking "test mode" does not exist.** Owner test bookings (`/admin/test-book`) write **real `Booking` rows** tagged `[TEST]`. The draft shop is in `SETUP` state, so `/book/{slug}` refuses bookings anyway. A new non-writing mode is needed.
6. **Operator vs. guest cookie.** Ops is Better Auth-only, and `resolveAdminAccess` prefers the session over the preview cookie, so an operator cannot use the existing `/preview/onboarding` wizard on a draft shop in the same browser.
7. **"One-click" no-thanks GET link.** Mail security scanners (Outlook Safe Links, Gmail) prefetch links and would silently mark people declined. Recommend GET → confirmation page → one-button POST (still effectively one click for a human).
8. **Fixed turnaround.** CLAUDE.md forbids fixed day counts for *setup* time. "Usually within 3 working days" is a *preview* turnaround and is a new commitment. It is config-driven, but the founder must confirm the wording. (`PREVIEW_TURNAROUND_TEXT_CAPITALISED` / `_SHORT` are referenced in the spec but not defined in §3, so they need adding to config.)
9. **"Is my website a template? — No."** `claimsPolicy.ts` describes a "standard KERSIVO website" tailored to the shop and bans "fully bespoke / custom-built". The spec's answer qualifies itself, so it is acceptable, but it should be added as an approved claim in `claimsPolicy.ts`, and the homepage FAQ "Is the website custom-designed?" must not drift from `STANDARD_SITE_NOT_BESPOKE_CLAIM`.
10. **Legal.** Adding a Terms section requires a `CURRENT_TERMS_VERSION` bump with the prior version kept in `ACCEPTED_PRIOR_TERMS_VERSIONS`. Privacy changes should also update `docs/compliance/ropa.md` and `retention-schedule.md` (and its test `retentionSchedule.test.ts`). Marketing opt-in is a new processing purpose; current outreach runs under `lia-b2b-outreach.md`.
11. **`preview_converted` "from webhook".** There is no server-side GA4. Options: fire it client-side on `/setup/success` when the session's metadata has `previewRequestId` (consistent with the existing `saasPurchaseTrackingClient`), or add Measurement Protocol, which is a new integration and needs approval.
12. **Captcha.** None exists, so this is honeypot + rate limit only, per the spec's "if the site already uses one".
13. **"The calculators"** (10.4): two of three calculators have no Full CTA today. Recommend adding the pattern only where a Full CTA already exists, unless the founder wants new CTAs.
14. **Sitemap is build-time.** `/free-preview` in the sitemap must follow the flag at build time. Flipping the flag needs a redeploy for the sitemap (pages follow at runtime).
15. **Status naming.** "Back to ready when updated": `changes_requested` → `ready` via "Mark ready and send" (E4). This also needs the existing `sitePreviewVersion` bumped, otherwise the iframe shows a stale site.

## 11. Recommendations for "decide during discovery"

| Decision | Recommendation |
|---|---|
| Preview URL | `/preview/{token}` (`src/pages/preview/[token].astro`). Astro static routes `onboarding` / `dashboard` win over the dynamic one; `/preview` is already in the marketing-nav private regex, crawlable-but-noindex, and absent from the sitemap. Expired page, request-changes and launch-confirm are sub-states of the same route, plus `/preview/{token}/no-thanks`. |
| Token | Reuse `mintPreviewToken()` (256-bit base64url). Store it **plaintext with a unique index** on `PreviewRequest` (ops needs "Copy preview link", and E3–E6 resend it). Do not use the cookie mechanism, because the spec wants a shareable link. |
| Draft shop | Reuse the guest-preview draft-shop shape: an ownerless `ShopSettings` with `publicActivityPaused` + `GUEST_PREVIEW_PAUSE_REASON`, name/town prefilled. Extract a `createDraftShop({name, townCity})` from `createPreviewShopSession()` so both use it. |
| Website on preview | Ops builds externally as today and sets the URL through the existing `sitePreviewUrl/Version` fields. Add an operator-session ops action that calls the same logic as `/api/ops/site-preview` (refactor its body into `src/lib/setup/sitePreview.ts`), so no `curl` with `CRON_SECRET` is needed. The preview page reuses `SitePreviewShell`'s iframe + blocked-frame fallback inside the new top bar. |
| Booking test mode | A `previewToken` mode on the public booking UI: real availability reads (`/api/availability` already has a preview test), and **create is replaced by a client-side confirmation screen** (no POST, so no rows, payments or emails). This is the safest; there is no write path to get wrong. |
| Operator editing of draft data | Ops "Open draft workspace" mints a `ShopPreviewSession` for the draft shop and shows a link to open it in a private window. This reuses `/preview/onboarding` unchanged and avoids the session-precedence clash (§10.6). |
| Ownership transfer | New `adoptPreviewDraftShop()` called from `claim-paid-subscription` when `record.shopId` is an **ownerless** shop linked to a `PreviewRequest` whose email equals the verified checkout email. In one transaction: lock both shops; require the user's auto-provisioned shop to be empty (onboarding not completed, no bookings/clients/subscriptions); delete it; set `ownerUserId` on the draft shop; create an OWNER `ShopMember`. Idempotent on retry. This also fixes the dormant guest-cookie path (§3B). |
| Checkout | New `POST /api/free-preview/{token}/checkout`, reusing `createSubscriptionCheckoutSession`, `buildSaasSubscriptionStripeMetadata({shopId: draftShopId})` + `previewRequestId`, the `checkoutAttemptId` idempotency and Terms acceptance from `subscription-checkout.ts`. Prefill name/size/stack from the request; ask for name in the confirm panel if missing. |
| Shortened onboarding | After adoption, redirect to `/admin/client-onboarding` with business/brand/links prefilled from the request, then Stripe Connect and domain. Workspace onboarding is already completed on the draft shop, so the Launch Wizard is skipped. |
| Flag | `src/lib/freePreview/config.ts`: `FREE_PREVIEW_FLOW_ENABLED = env('FREE_PREVIEW_FLOW_ENABLED') === 'true'` (runtime on SSR pages, build-time in the sitemap) + all §3 values + derived `_CAPITALISED` / `_SHORT` strings. |
| Emails | Add `EmailOutboundPurpose` values for E1–E6 and send through the outbox (retries come free). `replyTo: hello@kersivo.co.uk`. |
| Follow-ups and retention | A new daily cron `/api/cron/free-preview` (E5, E6, mark `expired`, purge after `expires_at + 90d`: delete the draft shop through `purgeShopData` when it is ownerless/unpaid, and null the request's PII). |
| Shared CTA | New `src/components/cta/FullPlanCta.astro` (+ a `fullPlanCta.ts` label/href resolver used by `.tsx` and nav modules) that returns the current CTA when the flag is off and the new pattern when it is on. |

## 12. Plan mapped to the batches

### Batch 1: data, config, intake, ops (not linked publicly)
- Prisma: `PreviewRequest` model + `PreviewRequestStatus` enum; `PreviewFollowup` log (or JSON) and `EmailOutboundPurpose` additions. One migration.
- `src/lib/freePreview/config.ts`, `validation.ts` (zod; URL list ≥ 1; enums), `emails.ts` (E1/E2 templates).
- `/free-preview` page (SSR) returns **404 when the flag is off**. Per the spec it is "built but not linked", but a reachable unlinked page would still be indexable; a 404 is the safest "exactly as today" behaviour. The form posts to `POST /api/free-preview` (honeypot, `enforceIpRateLimit`, zod, captures UTM/referrer/landing page, consent timestamps) → E1 + E2 through the outbox.
- `/ops/preview-requests` (list with filter/sort) and `/ops/preview-requests/[id]` (detail, notes, status, create/link draft shop, set site preview URL, "Copy preview link", "Mark ready and send", "Reject"), `/api/ops/preview-requests/*` with `requireOperatorMutation`.
- Tests: validation, honeypot/rate-limit, status transitions, ops auth.

### Batch 2: preview, conversion, adoption
- `/preview/[token].astro`: X-Robots-Tag + meta noindex, `Cache-Control: private, no-store`, expired state, top bar, request-changes form (`POST /api/free-preview/{token}/changes`), view tracking (skip if `resolveOperatorAccess` ok), iframe of `sitePreviewUrl`, link to test booking.
- Test-mode booking (no writes).
- E3/E4 through "Mark ready and send"; extract the site-preview logic for reuse.
- Launch confirm panel → checkout endpoint → webhook marks the request `converted` (idempotent, keyed by `previewRequestId` in metadata) → `/setup/success` → claim → `adoptPreviewDraftShop` → `/admin/client-onboarding` prefilled.
- Tests: adoption transaction (empty-shop guard, email mismatch, retry), webhook idempotency, expired token, operator view exclusion.

### Batch 3: public copy behind the flag
- Shared `FullPlanCta` + label resolver; swap every surface in §6. Navbar `GET_STARTED` → "Free preview".
- Homepage, pricing, websites, alternatives, compare and the cost calculator copy per §10.3/10.4; `/free-preview` full copy, WebPage + BreadcrumbList + FAQPage from one data module; sitemap entry conditional on the flag.
- New approved wording in `claimsPolicy.ts`; update the `src/lib/seo/*.test.ts` copy assertions **for both flag states**.

### Batch 4: lifecycle, analytics, legal, QA
- Cron: E5/E6 (once each, all exclusion rules), expiry, retention purge; no-thanks confirm page + POST.
- Analytics events (client-side; `preview_converted` on `/setup/success`, unless Measurement Protocol is approved).
- Terms section + version bump, Privacy paragraph, compliance docs.
- End-to-end QA on a Vercel preview with Stripe test mode, then a flag-on recommendation.

## 13. Decisions (founder, 29 Oct 2026)

| # | Question | Decision |
|---|---|---|
| 2 | Preview turnaround copy | **"usually within a few working days"**. This overrides spec §3: `PREVIEW_TURNAROUND_TEXT = "usually within a few working days"`. The derived `_CAPITALISED` ("Usually within a few working days") and `_SHORT` ("within a few working days") follow from it. No fixed number anywhere. |
| 3 | `/free-preview` with the flag off | **404.** Test on a Vercel preview deployment with `FREE_PREVIEW_FLOW_ENABLED=true` set for the Preview environment only. |
| 4 | `preview_converted` | **Client-side** on `/setup/success` when the checkout metadata carries `previewRequestId`. No Measurement Protocol. |
| 5 | Calculators without a Full CTA (no-show, chair-rent) | Default: leave them unchanged; apply the pattern only where a Full CTA already exists. |
| 6 | Marketing opt-in destination | Default: store the flag + timestamp only; no list sync. |

## 14. Where tenant websites are hosted — **decided: option B** (founder, 29 Oct 2026)

**Decision: one Vercel project per shop**, attached via `sitePreviewUrl`; each sends `X-Robots-Tag: noindex, nofollow` while in preview and `Content-Security-Policy: frame-ancestors https://kersivo.co.uk`. Batch 2 proceeds as planned (iframe + top bar). Background below.

Founder had no preference. Checked the Vercel team `vercelbackend95s-projects`: it contains **only** `kersivo-barber-outreach`. So no tenant site is deployed on Vercel under this account, and `/api/ops/site-preview` has no live hosting behind it in this account.

Options, decided before Batch 2:
- **A. Render the website inside this repo** at `/preview/{token}` (and later on the shop's domain), from the draft shop's data plus per-shop design settings/sections. "Preview becomes the live site with no rebuild" holds literally, noindex/top bar/test booking are fully under our control, and there are no extra Vercel projects. Cost: a tenant-site renderer must be built, and per-shop design is limited to what that renderer supports (which fits "designed individually, not unlimited bespoke").
- **B. One Vercel project per shop** (or one multi-tenant `kersivo-sites` project) in this team, built externally and attached via `sitePreviewUrl`. We set `X-Robots-Tag` and `frame-ancestors https://kersivo.co.uk` in each project. Batch 2 stays as planned (iframe + top bar). Per CLAUDE.md, never create these with `vercel` CLI from this repo's folder.
- **C. A website builder** (Framer/Webflow). Weakest fit: limited header control, and the top bar is lost when framing is blocked.

Recommendation: **B for the first previews**, because it keeps today's `sitePreviewUrl` flow and Batch 2 as planned. Revisit A once a few sites show which parts repeat. Batch 1 is unaffected by this choice and can start now.
