# Refunds (ops)

Commercial / product truth also tracked in [`docs/gtm/offer-v1-compliance.md`](../gtm/offer-v1-compliance.md).

## Booking deposits (£5 Connect)

Code: [`src/lib/booking/depositMoney.ts`](../../src/lib/booking/depositMoney.ts) → durable `BookingDepositRefund` ledger + `refundPaymentIntent`.

### State machine

| Status | Meaning |
|--------|---------|
| `REFUND_PENDING` | Ledger row created; Stripe call in flight, retrying, or waiting on webhook |
| `REFUNDED` | Stripe confirmed (`succeeded` API status or `charge.refunded` / `refund.updated`) — only then is `Booking.paymentStatus=REFUNDED` / `depositRefundedAt` set |
| `REFUND_FAILED` | Attempts exhausted or Stripe/webhook reported failure |

Flow:

1. Cancel (client manage-token or shop) **write-ahead** creates `BookingDepositRefund` with a stable `idempotencyKey` (`deposit_refund_{bookingId}`).
2. Immediate `attemptDepositRefund` calls Stripe with `Idempotency-Key` (`…:direct` / `…:legacy`).
3. Cron `/api/cron/retry-deposit-refunds` (every 10 min) retries due `REFUND_PENDING` rows.
4. Connect webhook events `charge.refunded`, `refund.updated`, `refund.failed` confirm or fail the ledger (never demote `REFUNDED`).
5. `ops-health` alerts on stuck / failed refunds (`dedupeKey: refund:stuck:{bookingId}`).

| Situation | Action |
|-----------|--------|
| Client cancel inside policy window | Automatic refund (ledger + Stripe) |
| Late cancel / no-show | Forfeit (no Stripe refund) |
| Shop-forced cancel | Automatic refund (ledger + Stripe); email mentions refund only when confirmed/pending/failed honestly |
| Stripe API / network failure | Auto-retry with backoff; critical Slack alert when exhausted |
| Operator repair | Admin History / day list → **Retry refund** (requires `bookings.manage`) → `POST /api/admin/bookings/:id/refund-retry` |

UI never claims “refunded” until ledger status is `REFUNDED`.

### Manual Stripe fallback (rare)

If Stripe Dashboard shows a successful refund but the app ledger is stuck:

1. Confirm `re_…` / `pi_…` on the connected account.
2. Prefer **Retry refund** in admin (idempotent).
3. Or replay the Connect webhook event from Stripe Dashboard.
4. Last resort: update ledger / booking notes after verifying funds returned.

## SaaS £39 / setup goodwill

- No automated “refund subscription” button in admin for arbitrary goodwill.
- Stripe Dashboard → Customers → refund charge / credit note as appropriate.
- Document reason in ops notes; if shop should lose access, use billing cancel / lifecycle (grace) rather than only refunding.

## Retail shop orders

- **Product refund API: MISSING** (compliance tracker). Do not claim automated retail refunds.
- Manual: Stripe Dashboard refund + mark order status carefully in admin if needed.

## Rules

1. Never refund from a laptop Stripe key without logging `charge` / `pi_` id and shop id.
2. Prefer Connect dashboard for connected-account deposit charges.
3. After manual refund, verify customer email/SMS expectations (no duplicate “paid” confirmations).
4. Do not set `Booking.paymentStatus=REFUNDED` unless Stripe (API or webhook) confirmed success.
