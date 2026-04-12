# Kersivo Booking Lite v1
Astro + React (TypeScript) booking + shop system for barbershops.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Neon Postgres database and set `DATABASE_URL` in `.env` (use the dashboard connection string; add `?sslmode=require` if needed; on serverless hosting use Neon’s **pooled** URL so the hostname includes `-pooler`).
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
   - `CONTACT_INBOX_EMAIL`: inbox that receives landing page contact/demo inquiries (defaults to `FROM_EMAIL` if unset).
   - `PUBLIC_SITE_URL`: public base URL used by booking + shop links and Stripe success/cancel links (for local dev: `http://localhost:4321`). For the public BarberDemo deployment, set this to the demo origin (e.g. `https://barberdemo.kersivo.co.uk`) so JSON-LD structured data and canonical asset URLs resolve correctly.
   - `STRIPE_SECRET_KEY`: Stripe test secret key used for checkout session creation.
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret used to verify `/api/shop/webhook`.
   - `ADMIN_SECRET`: admin panel login secret.
      - `BLOB_READ_WRITE_TOKEN` (preferred) or `VERCEL_BLOB_READ_WRITE_TOKEN`: Vercel Blob token used for barber avatar + product image uploads.
            - If Blob storage is not configured, barber avatars still save as inline `data:` URLs, but product uploads still require Blob.
   - If `RESEND_API_KEY` is missing, the app falls back to console logs for outgoing email contents.


6. Run app:
   ```bash
   npm run dev
   ```

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
- New booking is created immediately as `CONFIRMED` (active booking).
- Slot is occupied immediately after form submission.
- Customer does **not** need to confirm via email.
- Customer receives one confirmation email with full booking details.
- Confirmation email includes secure token links to:
  - `Reschedule booking`
  - `Cancel booking`
- `EXPIRED` and `PENDING_CONFIRMATION` are no longer used in the customer booking confirmation flow.
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
