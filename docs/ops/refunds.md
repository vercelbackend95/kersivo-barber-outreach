# Refunds (ops)

Commercial / product truth also tracked in [`docs/gtm/offer-v1-compliance.md`](../gtm/offer-v1-compliance.md).

## Booking deposits (£5 Connect)

Code: [`src/lib/booking/depositMoney.ts`](../../src/lib/booking/depositMoney.ts) → `refundPaymentIntent` / `forfeitBookingDeposit`.

| Situation | Action |
|-----------|--------|
| Client cancel inside policy window | Automatic Stripe refund via booking cancel path |
| Late cancel / no-show | Forfeit (no Stripe refund) |
| Shop-forced cancel with refund | Use admin cancel path that calls refund helper |
| Stripe refund API failed | Check `[deposit] refund` logs; refund manually in Stripe Connect dashboard; update booking notes |

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
