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
4. Configure email:
   - Production: set `RESEND_API_KEY` and `FROM_EMAIL`
   - Dev fallback: leave `RESEND_API_KEY` empty to log magic links in console.
5. Set `ADMIN_SECRET` for admin panel login.
6. Run app:
   ```bash
   npm run dev
   ```

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
