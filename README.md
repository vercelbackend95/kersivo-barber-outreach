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
   - `RESEND_API_KEY`: required for real email delivery via Resend.
   - `FROM_EMAIL`: sender identity used by Resend (must be verified in your Resend account).
   - `CONTACT_INBOX_EMAIL`: inbox that receives landing page contact/setup inquiries (defaults to `FROM_EMAIL` if unset).
   - `SETUP_ONBOARDING_FORM_URL`: Tally (or other) onboarding form URL linked from setup deposit confirmation emails.
   - `PUBLIC_CALENDLY_URL`: optional Calendly link shown under pricing (e.g. scorecard call).
   - `PUBLIC_SITE_URL`: public base URL used by booking + shop links and Stripe success/cancel links (for local dev: `http://localhost:4321`). For production, set to `https://kersivo.co.uk`.
   - `STRIPE_SECRET_KEY`: Stripe test secret key used for checkout session creation.
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret used to verify `/api/shop/webhook`.
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
   - If `RESEND_API_KEY` is missing, the app falls back to console logs for outgoing email contents.


6. Run app:
   ```bash
   npm run dev
   ```

## Production domain (kersivo.co.uk)

1. Set `PUBLIC_SITE_URL=https://kersivo.co.uk` in Vercel (Production environment) and in local `.env` when testing production-like URLs.
2. Add `kersivo.co.uk` as the production domain in the Vercel project (Settings → Domains).
3. Legacy redirect: `barberdemo.kersivo.co.uk` → `https://kersivo.co.uk` is configured in [`vercel.json`](vercel.json) (permanent redirect, all paths).
4. Stripe webhook endpoint (production): `https://kersivo.co.uk/api/shop/webhook` — register this URL in the Stripe Dashboard and set `STRIPE_WEBHOOK_SECRET` in Vercel.
   - **Test mode:** add the same endpoint under Stripe **Test** webhooks (or use `stripe listen`) and use the **test** signing secret with `sk_test_…` keys. Sandbox `cs_test_…` checkouts will not fulfil if only a Live webhook is configured.
   - **Live mode:** separate Live webhook + `whsec_…` + `sk_live_…`. Never mix test events with the live signing secret.
5. `SETUP_ONBOARDING_FORM_URL`: your Tally onboarding form link (e.g. `https://tally.so/r/XXXXX`). Sent to clients in the setup deposit confirmation email and shown on `/setup/success` after verified payment.

## Setup deposit flow test

1. Run the dev server:
   ```bash
   npm run dev
   ```
2. In another terminal, forward Stripe webhooks locally:
   ```bash
   stripe listen --forward-to localhost:4321/api/shop/webhook
   ```
   Copy the signing secret into `.env` as `STRIPE_WEBHOOK_SECRET`.
3. Open the homepage, click **Launch** (or Priority) under Pricing, fill in the setup deposit modal, and pay with Stripe test card `4242 4242 4242 4242`.
4. Confirm:
   - A `SetupDeposit` row exists in the database (correct plan, `depositPence`, `stripeSessionId`).
   - Customer confirmation + internal notification emails (via Resend, or `[DEV EMAIL]` logs if `RESEND_API_KEY` is unset).
   - Replaying the same webhook returns `{ ok: true, duplicate: true }` without a second DB row.

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
8. Verify customer receives email subject: `Order confirmed — pick up in store` (via Resend, or console log fallback).

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
