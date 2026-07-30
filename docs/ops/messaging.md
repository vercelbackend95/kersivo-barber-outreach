# Messaging (email / SMS)

## Providers

| Channel | Provider | Env |
|---------|----------|-----|
| Email | Resend | `RESEND_API_KEY`, `FROM_EMAIL` |
| SMS | Twilio | `TWILIO_*`, kill switch `SMS_REMINDERS_ENABLED` |

Email reminders kill switch: `EMAIL_REMINDERS_ENABLED=false`.

## Persistence

Appointment **SMS** reminders write `SmsOutbound` (`QUEUED` → `SENT` / `FAILED`).

**EmailOutbound** (appointment email reminders) is not on `main` yet — `ops-health` reports email fail-rate as 0 until that ships. Confirmation / contact emails remain log-only.

## Ops queries

```http
GET /api/ops/outbound-failures?since=2026-07-30T00:00:00.000Z
Authorization: Bearer $CRON_SECRET
```

Returns recent FAILED email, SMS, and Stripe webhook rows.

## Alerts

`ops-health` (every 15 min) alerts when last-60m fail rate ≥ 20% (n≥5) or ≥3 consecutive FAILED.

## Triage

1. Check provider status pages + API keys on Vercel Production.
2. Confirm cron auth (`CRON_SECRET`) and cron invocations in Vercel.
3. For SMS: shop must have `smsRemindersEnabled` and global `SMS_REMINDERS_ENABLED`.
4. For email: paid shop (`shopPaidAt`) gate for appointment reminders.
