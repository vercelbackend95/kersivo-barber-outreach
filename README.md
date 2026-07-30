# Kersivo Booking Lite v1
Astro + React (TypeScript) booking + shop system for barbershops.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Neon Postgres database and set `DATABASE_URL` in `.env` (use the dashboard connection string; add `?sslmode=require` if needed; on serverless hosting use Neon’s **pooled** URL so the hostname includes `-pooler`).
   - If Prisma throws `P1001: Can't reach database server` on Windows/dev while `Test-NetConnection ... -Port 5432` succeeds, regenerate the Neon string and use the endpoint routing option in the query string:
     - `...&options=endpoint%3D<your_neon_endpoint_id>`
   - If needed as a local workaround, temporarily pin an IPv4 host in `DATABASE_URL` and keep the `options=endpoint%3D...` parameter so Neon can route the connection correctly.
   - P1001 quick fix checklist:
     1. Make sure `DATABASE_URL` uses Neon pooled host (`-pooler`) and includes `sslmode=require`.
     2. Keep/add endpoint routing: `options=endpoint%3D<your_neon_endpoint_id>`.
     3. Validate Prisma can connect: `npx prisma migrate status` (or `npx prisma db pull`).
3. Reset database and apply migrations (this command **wipes all data** and then runs seed):
   ```bash
   npx prisma migrate reset
   ```
4. Regenerate Prisma client after schema changes/migrations:
   ```bash
   npx prisma generate
   ```
5. Configure environment:
   - `RESEND_API_KEY`: **required in production** for real email delivery via Resend. Without it, production APIs refuse to report form/mail success (so Ads/lead conversions cannot fire on a fake send). In local development only, missing key falls back to `[DEV EMAIL]` console logs.
   - `FROM_EMAIL`: sender identity used by Resend (must be verified in your Resend account).
   - `CONTACT_INBOX_EMAIL`: inbox that receives landing page contact/setup inquiries (defaults to `FROM_EMAIL` if unset).
   - `SETUP_ONBOARDING_FORM_URL`: Tally (or other) onboarding form URL linked from setup deposit confirmation emails.
   - `PUBLIC_CALENDLY_URL`: optional Calendly link shown under pricing (e.g. scorecard call).
   - `PUBLIC_SITE_URL`: public base URL used by booking + shop links and Stripe success/cancel links (for local dev: `http://localhost:4321`). For production, set to `https://kersivo.co.uk`.
   - `STRIPE_SECRET_KEY`: Stripe test secret key used for checkout session creation.
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret used to verify `/api/shop/webhook` (platform events: SaaS, retail, setup).
   - `STRIPE_CONNECT_WEBHOOK_SECRET`: signing secret for a **second** Stripe webhook endpoint on the same URL that listens to **events on Connected accounts** (required for booking deposit direct charges).
   - `ADMIN_SECRET`: admin panel login secret.
   - `BLOB_READ_WRITE_TOKEN` (preferred) or `VERCEL_BLOB_READ_WRITE_TOKEN`: Vercel Blob token used for barber avatar + product image uploads.
            - If Blob storage is not configured, barber avatars still save as inline `data:` URLs, but product uploads still require Blob.
   - `BETTER_AUTH_SECRET`: secret for Better Auth sessions (use a long random string in production).
   - `BETTER_AUTH_URL` / `PUBLIC_SITE_URL`: auth base URL (local: `http://localhost:4321`, production: `https://kersivo.co.uk`).
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth for `/admin` sign-in.
     - These must come from a **Kersivo** Google Cloud project (or a consent screen whose **App name** is Kersivo).
     - If Google says another app name (e.g. an old project), you are using the wrong Client ID — create a new OAuth client under the Kersivo project and replace both env vars locally and on the host.
     - OAuth consent screen → App name: **Kersivo**.
     - Authorized redirect URIs:
       - `http://localhost:4321/api/auth/callback/google`
       - `https://kersivo.co.uk/api/auth/callback/google`
       - `https://www.kersivo.co.uk/api/auth/callback/google` (if www is used)
       - For phone-on-LAN testing (e.g. `http://192.168.1.113:4321`), also add:
         `http://<your-lan-ip>:4321/api/auth/callback/google`
         (update when your LAN IP changes; otherwise Google returns `redirect_uri_mismatch`).
     - Optional: `BETTER_AUTH_TRUSTED_ORIGINS` — comma-separated extra origins for auth CSRF checks.
     - `SMS_REMINDERS_ENABLED`: set `true` to enable the appointment SMS reminder cron (default off). Per-shop gate also required: `ShopSettings.smsRemindersEnabled` (flipped on by paid SaaS subscription webhook).
     - `EMAIL_REMINDERS_ENABLED`: appointment email reminder cron is **on by default**. Set `false` for emergency off. Requires `RESEND_API_KEY` in production; per-shop gate is `ShopSettings.shopPaidAt` (paid SaaS).
     - `CRON_SECRET`: shared secret for `/api/cron/*` and `/api/ops/*` (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`).
     - Ops monitoring (M02): `OPS_SLACK_WEBHOOK_URL` (AlertSink), `SENTRY_DSN` / optional `SENTRY_ENVIRONMENT`, `OPS_CANARY_SHOP_ID` (paid canary shop for synthetic booking). See [`docs/ops/README.md`](docs/ops/README.md).
     - `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`: Twilio credentials for SMS (required in production when reminders are enabled). Locally, missing Twilio logs `[DEV SMS]` instead.
     - Optional `TWILIO_TRIAL_TEMPLATE`: e.g. `sms_appointment_reminders` — trial accounts only allow Twilio template keys as `Body` (remove after upgrading to Pay as you go).
   - `PUBLIC_GA4_MEASUREMENT_ID`: GA4 measurement id (`G-…`) for analytics (Consent Mode; loads after analytics consent).
   - `PUBLIC_GOOGLE_ADS_ID`: Google Ads account id (`AW-…`). Loads Ads config only when the visitor enables **Advertising measurement**.
   - `PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL`: conversion **label** for the £39 SaaS purchase (from Google Ads → Goals → Conversions). Used on `/setup/success` as `send_to: AW-…/label`. Without this label, GA4 `saas_subscription_paid` still fires; Ads `conversion` does not.

### Pre-Ads email checklist (production)
Before running Google Ads against the live site, confirm:
1. `RESEND_API_KEY` is set in the **Production** environment (Vercel).
2. `FROM_EMAIL` is a Resend-verified sender (not only `onboarding@resend.dev` for real customers).
3. `CONTACT_INBOX_EMAIL` receives mail (test with your own address).
4. Submit the homepage **contact** form → expect `200` + inbox message; GA event `setup_enquiry_submit` only after success.
5. Submit **Send yourself the demo & pricing** → expect inbox lead + visitor email; GA event `demo_pricing_capture_submit` only after both succeed.
6. With `RESEND_API_KEY` temporarily unset in a production-like deploy, both forms must show an error and must **not** fire lead events.

### Pre-Ads purchase conversion checklist (F01)
1. In Google Ads create a **Purchase** website conversion (Primary, Count = One, value from tag) for the `send_to` tag path.
2. Copy `AW-…` → `PUBLIC_GOOGLE_ADS_ID` and the label → `PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL` on Vercel Production; redeploy.
3. Mark `saas_subscription_paid` as a **key event** in GA4; link GA4 ↔ Ads.
4. **Required (covers analytics-only consent):** In Google Ads, **import** the GA4 key event `saas_subscription_paid` as a Purchase conversion. Many UK visitors enable Analytics but not Advertising measurement — without this import those £39 purchases never reach Ads via `send_to`. Use one Primary purchase action (or the same action); both paths send the same `transaction_id` so Google can dedupe.
5. Soft-launch bidding: **Manual CPC** (or Maximize clicks with cap) — do **not** use Maximize conversions until you have stable purchase volume.
6. Contact/demo form events stay **Secondary / observe only** in Ads — never Primary (protects a small budget from optimizing for free form fills).
7. Verify with Tag Assistant + [`docs/consent-tag-assistant-checklist.md`](docs/consent-tag-assistant-checklist.md) (Conversions section).

6. Run app:
   ```bash
   npm run dev
   ```

## Production domain (kersivo.co.uk)

1. Set `PUBLIC_SITE_URL=https://kersivo.co.uk` in Vercel (Production environment) and in local `.env` when testing production-like URLs.
2. Add `kersivo.co.uk` as the production domain in the Vercel project (Settings → Domains).
3. Legacy redirect: `barberdemo.kersivo.co.uk` → `https://kersivo.co.uk` is configured in [`vercel.json`](vercel.json) (permanent redirect, all paths).
4. Stripe webhook endpoints (production), both pointing at `https://kersivo.co.uk/api/shop/webhook`:
   - **Platform** endpoint → set `STRIPE_WEBHOOK_SECRET` in Vercel (SaaS subscription, retail shop, setup).
   - **Connect** endpoint with “Listen to events on Connected accounts” → set `STRIPE_CONNECT_WEBHOOK_SECRET` (booking deposits + `account.updated`).
   Events to include on Connect: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `account.updated`.

   - **Test mode:** add the same endpoint under Stripe **Test** webhooks (or use `stripe listen`) and use the **test** signing secret with `sk_test_…` keys. Sandbox `cs_test_…` checkouts will not fulfil if only a Live webhook is configured.
   - **Live mode:** separate Live webhook + `whsec_…` + `sk_live_…`. Never mix test events with the live signing secret.
5. `SETUP_ONBOARDING_FORM_URL`: your Tally onboarding form link (e.g. `https://tally.so/r/XXXXX`). Sent to clients in the subscription confirmation email and shown on `/setup/success` after verified payment.

## Subscription checkout flow test (default offer)

Public pricing is pure SaaS (£39/month) when `SHOW_SETUP_PLAN_CARDS` is `false` in [`src/lib/pricing/offerMode.ts`](src/lib/pricing/offerMode.ts). Setup packages remain in code for a later return.

1. Run the dev server:
   ```bash
   npm run dev
   ```
2. In another terminal, forward Stripe webhooks locally:
   ```bash
   stripe listen --forward-to localhost:4321/api/shop/webhook
   ```
   Copy the signing secret into `.env` as `STRIPE_WEBHOOK_SECRET`.
3. Open the homepage, click **Get started — £39/mo** under Pricing, complete Launch Wizard details, and pay with Stripe test card `4242 4242 4242 4242`.
4. Confirm:
   - A `SaasSubscription` row exists in the database (`ACTIVE`, `monthlyPence`, `stripeSessionId`).
   - Customer confirmation + internal notification emails (via Resend in production; `[DEV EMAIL]` console logs only in local development when `RESEND_API_KEY` is unset).
   - Replaying the same webhook returns `{ ok: true, duplicate: true }` without a second DB row.

## Setup deposit flow test (when setup fees re-enabled)

Set `SHOW_SETUP_PLAN_CARDS = true` in `offerMode.ts`, then:

1. Open the homepage, click **Launch** (or Priority) under Pricing, complete the wizard, and pay with Stripe test card `4242 4242 4242 4242`.
2. Confirm a `SetupDeposit` row exists (correct plan, `depositPence`, `stripeSessionId`).

## Stripe local webhook testing (end-to-end)
1. Set `STRIPE_SECRET_KEY` in `.env`.
2. Run the dev server:

   ```bash
   npm run dev
   ```
3. In another terminal, run Stripe CLI webhook forwarding:
   ```bash
   stripe listen --forward-to http://localhost:4321/api/shop/webhook
   ```
4. Copy the webhook signing secret from Stripe CLI into `.env` as `STRIPE_WEBHOOK_SECRET`.
5. Open `/shop`, add products to cart, enter `Email for receipt`, then click **BUY (PICKUP)**.
6. Pay with Stripe test card `4242 4242 4242 4242` (any valid future date/CVC/ZIP in test mode).
7. Confirm order appears in Admin → Shop → Orders after payment webhook is received.

## Demo flow
- Public booking: `/book`
- Public shop: `/shop`
- Shop success: `/shop/success?session_id=...`
- Shop cancelled: `/shop/cancelled`
- Admin panel: `/admin`
## Booking flow (instant confirmation)
- New booking is created immediately as `BOOKED` (active booking).
- Slot is occupied immediately after form submission.
- Customer does **not** need to confirm via email.
- Customer receives one confirmation email with full booking details.
- Confirmation email includes secure token links to:
  - `Reschedule booking`
  - `Cancel booking`
- `EXPIRED` and `PENDING_CONFIRMATION` are no longer used in the customer booking confirmation flow (`BOOKED` is used instead).
- If customer uses the cancel link and confirms cancellation, booking changes to `CANCELLED_BY_CLIENT`.
- If customer uses reschedule link, booking is updated in place, old slot is released, new slot is reserved, and a reschedule confirmation email is sent.

## SMS appointment reminders (backend)
- Cron: `GET/POST /api/cron/sms-reminders` every 15 minutes (`vercel.json`), auth via `CRON_SECRET`.
- Ops health: `GET/POST /api/cron/ops-health` every 15 minutes — Stripe webhook FAILED ledger + SMS fail-rate alerts ([`docs/ops/README.md`](docs/ops/README.md)).
- Synthetic booking: `GET/POST /api/ops/synthetic-booking` every 15 minutes — homepage + canary availability (`OPS_CANARY_SHOP_ID`).
- Sends one SMS ~24h before `BOOKED` appointments (23–25h window) when `SMS_REMINDERS_ENABLED=true` **and** the shop has `smsRemindersEnabled=true` (set on paid SaaS subscription webhook).
- Skips: unpaid/demo shops, demo shop id, `[TEST]` bookings, missing/invalid phone, already-sent, bookings created too late for a day-before reminder.
- Optional trial override: `TWILIO_TRIAL_TEMPLATE=sms_appointment_reminders` (Twilio trial cannot send custom Body text).
- Reschedule clears `smsReminderSentAt` so a new reminder can fire for the new time.
- No admin UI in v1; outbound rows land in `SmsOutbound` for ops/debug.

## Email appointment reminders (WP-D)
- Cron: `GET/POST /api/cron/email-reminders` every 15 minutes (`vercel.json`), auth via `CRON_SECRET`.
- Sends one email ~24h before `BOOKED` appointments (23–25h window) when `EMAIL_REMINDERS_ENABLED` is not `false` **and** the shop has `shopPaidAt` set (paid SaaS).
- Skips: unpaid/demo shops, demo shop id, `[TEST]` bookings, missing/invalid email, already-sent, bookings created too late for a day-before reminder.
- Reminder body points clients to manage links in their confirmation email (manage token is hash-only in DB).
- Reschedule (client or shop-forced) clears `emailReminderSentAt` so a new reminder can fire for the new time.
- No admin UI in v1; outbound rows land in `EmailOutbound` for ops/debug.
- Distinct from instant booking confirmation / reschedule / cancel emails in `src/lib/email/sender.ts`.

## Online booking deposits (WP-A/B/C + B05 direct charges)
- Paid shops only (`shopPaidAt` / SaaS webhook). Demo shop and marketing `/book` sandbox never collect.
- Owner toggle + Stripe Connect in **Barbershop settings** (`/api/admin/barbershop-settings/deposits`).
- **Charge model:** Checkout is a **direct charge** on the shop’s connected account (`Stripe-Account`). KERSIVO `application_fee_amount` is `0` today.
- Live book: `/book/[shopId]` → deposit Checkout on Connect → webhook `booking_deposit` (Connect endpoint) → `BOOKED`.
- Success / calendar.ics retrieve the Checkout Session with the shop’s Connect account id.
- Refunds: connected account first; legacy destination charges fall back to platform refund with `reverse_transfer=true`.
- Policy defaults: 24h cancel/reschedule windows, max 2 client reschedules; refund in-window / shop cancel; forfeit late cancel + no-show.
- Cron: `GET/POST /api/cron/expire-deposit-holds` every 10 minutes expires unpaid `PENDING_PAYMENT` holds.
- `account.updated` (Connect webhook) syncs `stripeConnectChargesEnabled` / `detailsSubmitted`.



## Shop flow (GBP, pickup only)
- Cart is client-side (`localStorage`) and supports quantity +/- and remove.
- Checkout endpoint: `POST /api/shop/checkout` with payload:
  - `{ email, items: [{ productId, quantity }] }`
- Stripe webhook endpoint: `POST /api/shop/webhook`.
- Order lookup endpoint (public): `GET /api/shop/order-by-session?session_id=...`.
- Admin orders:
  - `GET /api/admin/shop/orders`
  - `GET /api/admin/shop/orders/:id`
  - `POST /api/admin/shop/orders/:id/collect`

## Manual test checklist
1. Add products in Admin → Shop → Products.
2. Open `/shop`, add multiple products to cart, adjust quantity, provide customer email.
3. Click **BUY (PICKUP)** and complete Stripe test payment.
4. Verify `/shop/success` and cart clear on refresh.
5. Verify order appears in Admin → Shop → Orders as `PAID`.
6. Open order details and click **Mark as collected**.
7. Verify status updates to `COLLECTED`.
8. Verify customer receives email subject: `Order confirmed — pick up in store` (via Resend in production; console `[DEV EMAIL]` log only in local development when `RESEND_API_KEY` is unset).

## SSR build on Vercel
SSR build requires adapter; use Vercel adapter + output: server.

## Vercel Blob setup
1. In Vercel Dashboard, open your project.
2. Go to **Storage** → **Blob** and create/link a Blob store.
3. Go to **Settings** → **Environment Variables**.
4. Add `BLOB_READ_WRITE_TOKEN` (recommended name) with the read-write token value from Blob.
   - The app also accepts `VERCEL_BLOB_READ_WRITE_TOKEN` for compatibility.
5. Redeploy the project so serverless functions can read the token.

## GTM strategy docs
- `docs/gtm/icp-segment-uk-barbers.md` - single-segment ICP definition and qualification rules.
- `docs/gtm/proof-stack-case-studies.md` - three case-study frameworks with strict evidence requirements.
- `docs/gtm/offer-migration-sprint.md` - risk-reversal migration sprint offer model.
- `docs/gtm/channel-playbook-uk.md` - account-based outbound + partnerships + proof-led inbound playbook.
