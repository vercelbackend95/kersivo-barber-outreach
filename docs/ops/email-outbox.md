# Email outbox (ops)

Transactional emails that must not fail a business commit (booking confirmation, reschedule, shop order confirmation) go through a durable `EmailOutbound` outbox.

Code: [`src/lib/email/outbox.ts`](../../src/lib/email/outbox.ts).

## State machine

| Status | Meaning |
|--------|---------|
| `QUEUED` | Row written in the same DB transaction as the booking/order; waiting for send or retry |
| `SENT` | Resend accepted; `providerMessageId` set; **`payload` cleared** (manage-token links must not linger) |
| `FAILED` | `attempts >= maxAttempts` (default 6); ops alert fired |

Flow:

1. Business write (`booking.create` / `booking.update` / `order.create`) and `emailOutbound.create` happen in **one** Prisma transaction.
2. After commit, best-effort `deliverOutboxEmail` runs (never fails the API / webhook).
3. Cron `/api/cron/email-outbox` (every 5 min) drains due rows (`status IN (QUEUED, FAILED)` and `nextAttemptAt <= now` and payload present).
4. `ops-health` alerts on stuck `FAILED` or old `QUEUED` rows (`dedupeKey: email:stuck:{id}`).

Backoff: `60s * 2^(attempts-1)`, capped at 1 hour.

## Purposes using the durable outbox

| Purpose | Trigger |
|---------|---------|
| `BOOKING_CONFIRMATION` | Instant booking (no deposit) |
| `BOOKING_RESCHEDULED` | Client reschedule by manage token |
| `SHOP_ORDER_CONFIRMATION` | Retail order after Stripe payment |

`APPOINTMENT_REMINDER` still uses the reminder claim path in [`src/lib/email/reminders.ts`](../../src/lib/email/reminders.ts) (log-only `EmailOutbound` rows without `nextAttemptAt` / payload are ignored by the outbox cron).

## Booking create idempotency

`Booking.idempotencyKey` stores `${shopId}:{clientKey}`. The public/admin booking create APIs accept `idempotencyKey` in the JSON body or the `Idempotency-Key` header. `BookingFlow` generates a key once per submit attempt and reuses it on retry — so a Resend blip (or any post-commit client retry) cannot create a second booking, including for “any barber”.

## Manual repair

1. Find the row: `EmailOutbound` where `status = FAILED` (or stuck `QUEUED`) for the booking/order shop.
2. Confirm `payload` is still present (required for replay). On `SENT` it is intentionally null.
3. Reset and retry (SQL or a one-off script):

```sql
UPDATE "EmailOutbound"
SET status = 'QUEUED',
    attempts = 0,
    "nextAttemptAt" = NOW(),
    error = NULL
WHERE id = '<emailOutboundId>';
```

4. Hit cron (with `CRON_SECRET`) or wait for the next 5-minute tick:  
   `GET /api/cron/email-outbox`

`retryOutboxEmailForOperator` in `outbox.ts` performs the same reset + immediate attempt for internal tooling.

## Payload retention

- While `QUEUED` / `FAILED`: payload keeps `{ to, subject, html, replyTo? }` so the manage-token cancel/reschedule links can still be delivered.
- On `SENT`: payload is set to SQL `NULL`.
- Do not log full HTML in Slack/Sentry — alerts carry ids and purpose only.
