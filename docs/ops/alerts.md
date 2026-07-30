# Ops alerts — first triage

## `webhook:failed:{evt_id}` / ops-health stuck FAILED

**Meaning:** Stripe event was received but processing marked `FAILED`, or still `FAILED` after 10+ minutes.

**First steps:**
1. Open Stripe Dashboard → Developers → Webhooks → event `evt_…` → resend if needed.
2. Check Vercel logs for `Stripe webhook failed` / `[webhook]`.
3. See [stripe-webhooks.md](./stripe-webhooks.md).

## `messaging:email-fail-rate` / `messaging:sms-fail-rate`

**Meaning:** ≥20% FAILED among SENT+FAILED in the last 60 minutes (min 5 attempts), or ≥3 consecutive FAILED.

**First steps:**
1. `GET /api/ops/outbound-failures` (Bearer `CRON_SECRET`).
2. Check Resend / Twilio dashboards and kill switches (`EMAIL_REMINDERS_ENABLED`, `SMS_REMINDERS_ENABLED`).
3. See [messaging.md](./messaging.md).

## `synthetic:booking`

**Meaning:** Homepage or canary public availability probe failed.

**First steps:**
1. Hit `https://kersivo.co.uk/` and `/book/{OPS_CANARY_SHOP_ID}` manually.
2. Check Neon connectivity and Vercel deployment health.
3. Confirm `OPS_CANARY_SHOP_ID` is a paid shop that accepts public bookings.

## Sentry 5xx / new issue on payment routes

**Meaning:** Unhandled exception or 5xx on `/api/shop/webhook`, `/api/public/bookings/**`, `/api/setup/**`, etc.

**First steps:**
1. Open Sentry issue → stack + breadcrumbs (PII scrubbed).
2. If webhook-related, correlate with `StripeWebhookEvent` row.
3. Freeze risky deploys per [incident-response.md](./incident-response.md).

## Stripe Dashboard “delivery failed”

**Meaning:** Stripe could not deliver to our endpoint (timeout, 4xx/5xx exhaustion).

**First steps:** Enable + monitor both **platform** and **Connect** webhook endpoints. Replay after fix.
