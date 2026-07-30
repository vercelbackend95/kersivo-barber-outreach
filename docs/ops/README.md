# Ops — monitoring & operations

Payment-critical observability for Kersivo (Stripe, public booking, email/SMS).

## Signal map

| Signal | Source | Alert channel |
|--------|--------|---------------|
| Unhandled 5xx / exceptions | Sentry (`SENTRY_DSN`) | Sentry → Slack (configure in Sentry UI) |
| Stripe webhook `FAILED` ledger | App + `ops-health` cron | `OPS_SLACK_WEBHOOK_URL` via AlertSink |
| Stripe Dashboard delivery failures | Stripe Dashboard (both endpoints) | Stripe email / Slack (Dashboard) |
| Email/SMS fail rate | `ops-health` cron over `EmailOutbound` / `SmsOutbound` | AlertSink |
| Synthetic public booking | `/api/ops/synthetic-booking` cron | AlertSink |

## Environment

| Var | Required | Purpose |
|-----|----------|---------|
| `OPS_SLACK_WEBHOOK_URL` | Prod recommended | Incoming Slack webhook for AlertSink |
| `SENTRY_DSN` | Prod recommended | Error tracking |
| `SENTRY_ENVIRONMENT` | Optional | e.g. `production` / `preview` |
| `CRON_SECRET` | Prod | Auth for `/api/cron/*` and `/api/ops/*` |
| `OPS_CANARY_SHOP_ID` | Prod synthetic | Paid canary shop for availability probe (not a real client) |
| `OPS_SYNTHETIC_BOOKING_CREATE` | Optional | `true` to attempt `[TEST]` create (default off) |
| `PUBLIC_SITE_URL` | Synthetic | Base URL for homepage check |

## Owner

Founder / on-call: triage via Slack `#ops` (or configured channel), then runbooks under this folder.

## Docs in this folder

- [alerts.md](./alerts.md) — what each alert means
- [incident-response.md](./incident-response.md)
- [stripe-webhooks.md](./stripe-webhooks.md)
- [refunds.md](./refunds.md)
- [messaging.md](./messaging.md)
- [backup-restore-neon.md](./backup-restore-neon.md)
- [uptime.md](./uptime.md)
