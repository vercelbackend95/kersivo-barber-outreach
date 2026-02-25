# Kersivo Booking Lite v1
Astro + React (TypeScript) booking + shop system for barbershops.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create Neon Postgres database and set `DATABASE_URL` in `.env`.
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
   - `PUBLIC_SITE_URL`: public base URL used by booking + shop links and Stripe success/cancel links (for local dev: `http://localhost:4321`).
   - `STRIPE_SECRET_KEY`: Stripe test secret key used for checkout session creation.
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret used to verify `/api/shop/webhook`.
   - `ADMIN_SECRET`: admin panel login secret.
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

