# Kersivo Booking Lite v1
Astro + React (TypeScript) booking system for barbershops.
## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create Neon Postgres database and set `DATABASE_URL` in `.env`.
3. Run Prisma migrations:
   ```bash
   npx prisma migrate dev
   ```
4. Seed demo data:
   ```bash
   npx prisma db seed
   ```
5. Configure email:
   - Production: set `RESEND_API_KEY` and `FROM_EMAIL`
   - Dev fallback: leave `RESEND_API_KEY` empty to log magic links in console.
6. Set `ADMIN_SECRET` for admin panel login.
7. Run app:
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
- Shop: Demo Barbershop
- Barbers: Jay, Mason, Luca
- Services:
  - Haircut (30)
  - Skin Fade (45)
  - Beard Trim (20)
  - Haircut + Beard (50)
- Availability: Mon-Sat 10:00-18:00, break 13:00-13:30, Sunday closed
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