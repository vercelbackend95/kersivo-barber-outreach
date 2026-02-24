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
   - `PUBLIC_SITE_URL`: public base URL used by booking + shop links (for local dev: `http://localhost:4321`).
   - `STRIPE_SECRET_KEY`: Stripe API secret key used for checkout session creation.
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret used to verify `/api/shop/webhook`.
   - If `RESEND_API_KEY` is missing, the app falls back to console logs for outgoing email contents.


6. Set `ADMIN_SECRET` for admin panel login.
7. Run app:
   ```bash
   npm run dev
   ```

## Neon recovery for failed shop migration (P3009)
If Neon shows a failed migration for `20260224153000_add_shop_orders`, recover with:

```bash
# Option A (most common): migration partially ran on Neon, so mark it as applied
npx prisma migrate resolve --applied 20260224153000_add_shop_orders

# Option B: if Neon has none of the objects from that migration, mark it rolled back instead
npx prisma migrate resolve --rolled-back 20260224153000_add_shop_orders

# Then apply remaining migrations
npx prisma migrate deploy
```

For demo/local reset (fresh DB + seed):

```bash
npx prisma migrate reset --force
```

Or seed only:

```bash
npx prisma db seed
```


## Stripe local webhook testing
1. Start app locally (`npm run dev`).
2. Start Stripe CLI forwarding to local webhook:
   ```bash
   stripe listen --forward-to localhost:4321/api/shop/webhook
   ```
3. Copy webhook signing secret shown by Stripe CLI into `.env` as `STRIPE_WEBHOOK_SECRET`.
4. Complete a test checkout from `/shop`.



## Demo flow
- Public booking: `/book`
- Public shop: `/shop`
- Shop success: `/shop/success?session_id=...`
- Shop cancelled: `/shop/cancelled`
- Admin panel: `/admin`

## Shop Lite v1.5 (GBP, pickup only)
- Cart is client-side (`localStorage`) and supports quantity +/- and remove.
- Checkout endpoint: `POST /api/shop/checkout`.
- Stripe webhook endpoint: `POST /api/shop/webhook`.
- Order lookup endpoint (public): `GET /api/shop/order-by-session?session_id=...`.
- Admin orders:
  - `GET /api/admin/shop/orders`
  - `GET /api/admin/shop/orders/:id`
  - `POST /api/admin/shop/orders/:id/collect`

## Manual test checklist
1. Add products in Admin → Shop → Products.
2. Open `/shop`, add multiple products to cart, adjust quantity, provide customer email.
3. Click **Checkout (Pickup)** and complete Stripe test payment.
4. Verify `/shop/success` and cart clear on refresh.
5. Verify order appears in Admin → Shop → Orders as `PAID`.
6. Open order details and click **Mark as collected**.
7. Verify status updates to `COLLECTED`.
8. Verify customer receives email subject: `Order confirmed — pick up in store` (via Resend, or console log fallback).

