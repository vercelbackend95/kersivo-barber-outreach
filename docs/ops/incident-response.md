# Incident response

## Severity

| Level | Example | Response |
|-------|---------|----------|
| SEV-1 | Payments down, webhook mass failure, booking create 5xx | Immediate; freeze deploys; Slack `#ops` |
| SEV-2 | Elevated email/SMS fail rate, synthetic flapping | Same day; root cause within hours |
| SEV-3 | Single orphan lifecycle event, noise alert | Next business day |

## Roles

- **Commander:** founder / on-call — decisions, external comms.
- **Operator:** investigates logs (Vercel), Sentry, Stripe Dashboard, Neon.

## Freeze deploy

1. Pause Vercel production deploys if SEV-1.
2. Do not run migrations mid-incident unless required for fix.
3. After fix: smoke checkout (test mode) + synthetic booking + one webhook replay.

## Channels

- Primary: Slack via `OPS_SLACK_WEBHOOK_URL` / Sentry Slack integration.
- Stripe: Dashboard email for webhook delivery failures (both endpoints).

## Comms template (customers)

> We’re investigating an issue affecting [bookings / payments / reminders]. No action needed from you; we’ll confirm when resolved.

Do not promise refund timelines until [refunds.md](./refunds.md) path is confirmed.

## Close-out

1. Timeline in Slack thread.
2. Link Sentry issue + Stripe `evt_` ids.
3. Follow-up ticket if process/code gap remains.
