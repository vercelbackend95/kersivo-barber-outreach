# Stripe webhooks

## Endpoints

Two Stripe Dashboard endpoints hit the same app URL `POST /api/shop/webhook`:

| Endpoint | Secret env | Typical events |
|----------|------------|----------------|
| Platform | `STRIPE_WEBHOOK_SECRET` | SaaS checkout, retail, setup deposit, subscription lifecycle |
| Connect | `STRIPE_CONNECT_WEBHOOK_SECRET` | Booking deposits, `account.updated` |

**OPS checklist (do once per environment):**
1. Both endpoints point at production URL.
2. Enable **failed delivery** notifications (email / Slack) in Stripe Dashboard.
3. Confirm events include: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `account.updated`.

## App ledger

Table `StripeWebhookEvent` (`evt_…` PK):
- `RECEIVED` → after signature verify
- `PROCESSED` → HTTP 2xx fulfilment
- `IGNORED` → unhandled type (still 200)
- `FAILED` → 4xx/5xx or thrown error

`ops-health` alerts on `FAILED` older than 10 minutes.

## Status codes (why Stripe retries)

| App status | Stripe behaviour | When we use it |
|------------|------------------|----------------|
| 500 | Retries | Uncaught errors; incomplete email fulfilment (setup/SaaS) |
| 400 | Usually no useful retry | Bad signature, missing metadata, missing Connect account |
| 200 | Success | Including `duplicate`, `unhandled`, lifecycle `found: false` |

Lifecycle `found: false` now also fires an ops **warning** (possible race).

## Manual replay

1. Stripe Dashboard → event → **Resend**.
2. Or Stripe CLI: `stripe events resend evt_…`.
3. Confirm row moves to `PROCESSED` and domain row (booking / SaaS / order / deposit) is correct.

## Dual-secret misconfig

If Connect secret is missing, booking deposit webhooks may verify with the platform secret then fail session retrieve / account resolution → 400. Fix secrets, then replay.
