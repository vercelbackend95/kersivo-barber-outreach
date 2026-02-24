# Kersivo Booking Lite v1
Astro + React (TypeScript) booking system for barbershops.

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
5. Configure email + URLs:
   - `RESEND_API_KEY`: required for real email delivery via Resend.
   - `FROM_EMAIL`: sender identity used by Resend (must be verified in your Resend account).
   - `PUBLIC_SITE_URL`: public base URL used to generate confirm/cancel/reschedule links in emails (for local dev use `http://localhost:4321`).
   - If `RESEND_API_KEY` is missing, the app falls back to console logs for booking links.

6. Set `ADMIN_SECRET` for admin panel login.
7. Run app:
   ```bash
   npm run dev
   ```
## Booking email flow (Plan A)
- `POST /api/bookings/create`
  - Creates booking as `PENDING_CONFIRMATION`
  - Generates and emails only the confirmation link (`Confirm your booking`)
- `POST /api/bookings/confirm`
  - Confirms booking
  - Generates manage token
  - Sends second email (`Manage your booking`) with cancel + reschedule links
- Cancel/reschedule links are valid only for `CONFIRMED` bookings.


## Demo flow
- Public booking: `/book`
- Confirm booking magic link: `/book/confirm?token=...`
- Cancel: `/book/cancel?token=...`
- Reschedule: `/book/reschedule?token=...`
- Admin panel: `/admin`

## Included seed
- Shop: Demo Barbershop (`demo-shop`)
- Barbers:
  - Jay (`seed-jay`)
  - Mason (`seed-mason`)
  - Luca (`seed-luca`)
- Services:
  - Haircut (30) — `svc-haircut`
  - Skin Fade (45) — `svc-skin-fade`
  - Beard Trim (20) — `svc-beard-trim`
  - Haircut + Beard (50) — `svc-haircut-beard`
- Availability: Mon-Sat 10:00-18:00, break 13:00-13:30, Sunday closed

## Availability check (serviceId mismatch fix)
After reset + seed, this request should return `200` with slots on a weekday:

```bash
curl "http://localhost:4321/api/availability?serviceId=svc-haircut&barberId=seed-luca&date=2026-02-24"
```

## API routes
- `POST /api/bookings/create`
- `POST /api/bookings/confirm`
- `POST /api/bookings/cancel`
- `POST /api/bookings/reschedule`
- `GET /api/availability?barberId=...&serviceId=...&date=YYYY-MM-DD`
- Admin:
  - `GET/POST /api/admin/services`
  - `GET/POST /api/admin/barbers`
  - `GET/POST /api/admin/availability`
  - `GET/POST /api/admin/timeoff`
  - `GET /api/admin/bookings`
  - `POST /api/admin/bookings/manual`

## Deposits-ready schema (v2 prep)
Bookings already include:
- `paymentRequired`
- `depositAmountPence`
- `paymentStatus` (`UNPAID` / `PAID`)
- `stripeCheckoutSessionId`
- `paidAt`

No Stripe integration in v1.
