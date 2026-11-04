# Shop health ("green light")

One light per shop for KERSIVO ops, plus a checklist that says whether booking, payments, products, the
website and messages work right now.

| Light | Meaning |
| --- | --- |
| Green | Every check that applies passed. |
| Amber | Works, but something needs attention (a warning, or a critical check that could not finish on two runs in a row). |
| Red | A critical check failed: customers cannot book, pay or buy, or the website is down or broken. |
| Grey "Not live yet" | Draft (preview) shop. Shows launch readiness "x / y"; checks that only apply after launch are marked "after launch". |

This is strong evidence that the system works at the time of the check, not proof of "zero bugs". The UI
always shows: *Checks run every hour and on demand. Not covered: real card payments, SMS delivery to the
handset (only the provider's status), and how the site looks on each device.*

## Code

| Piece | Where |
| --- | --- |
| Types | `src/lib/ops/shopHealth/types.ts` |
| Context (loads the shop once per run) | `src/lib/ops/shopHealth/context.ts` |
| Config checks (DB only) | `src/lib/ops/shopHealth/checks/config.ts` |
| Availability + dry-run booking | `src/lib/ops/shopHealth/checks/bookingProbe.ts` |
| Runner (timeouts, persistence) | `src/lib/ops/shopHealth/run.ts` → `runShopHealth(shopId, { trigger, probes })` |
| Light rules | `src/lib/ops/shopHealth/overall.ts` |
| Storage | `ShopHealthRun` (latest 50 per shop), `ShopSettings.healthOverall / healthCheckedAt / healthAlertedAt` |

## Modes

- **LIVE**: the shop is on Full KERSIVO or Starter, or it was launched (`goLiveAt`) and has not left KERSIVO.
- **PRELAUNCH**: everything else (draft preview shops). The light is always grey. Readiness counts the
  checks that apply before launch (pass or warn = ready; info checks and skips are not counted).

The launch guard (H3) forces a LIVE run of a draft shop. That run is stored, but it does not change the
shop's light on `/ops/shops`.

## Rules for the light (LIVE)

- Any applicable **critical** check failed → **Red**.
- Any warn, any **warning**-level fail, or the same critical check **inconclusive on two runs in a row** →
  **Amber**.
- Otherwise **Green**. Info checks (e.g. the retail test order) are shown but never change the light.
- A check that throws or takes longer than 10 s is **inconclusive**. On its own it never turns a shop red.

## Checks

Config checks run from the database only. They are fast and also run when the page loads.

| id | severity | applies | passes when |
| --- | --- | --- | --- |
| setup.hours | critical | always | at least one open day saved |
| setup.services | critical | always | an active service with a duration and a price |
| setup.barbers | critical | always | an active barber with a linked active service and availability rules |
| setup.service_coverage | warning | always | every active service has an active barber |
| setup.business | warning | always | address or postcode, plus phone |
| booking.gate | critical | live | `loadPublicBookingIntakeStatus().accepting` (message = the reason) |
| booking.paused | critical | live | no public-activity pause covers today |
| booking.stuck_payments | warning | deposits / paid booking on | no PENDING_PAYMENT more than 30 min past its hold expiry |
| payments.connect | critical | deposits / paid booking / retail / Starter | Connect connected, charges enabled, details submitted, not disconnected |
| retail.can_sell | critical | retail on | `canSellRetail` and not paused |
| retail.products | critical | retail on | an active product with a price |
| retail.product_quality | warning | retail on | every active product has a photo and a description |
| retail.test_order | info | retail on | `retailTestOrderCompletedAt` set |
| messaging.sms | warning | SMS reminders on | last 7 days: fewer than 3 failures in a row, and under a 20% failure rate (when at least 5 sent) |
| messaging.email | warning | always | no FAILED, and no QUEUED for over 30 min, in the last 7 days |
| website.plan | critical | live, and the shop has a site or is on Full | the plan includes `BRANDED_SITE` |

Probe checks run on the cron, on "Run checks now" and in PRELAUNCH runs:

| id | severity | passes when |
| --- | --- | --- |
| booking.availability | critical | a slot in the next 14 days (warns for each active service with none) |
| booking.dry_run | critical | a dry-run booking of the first free slot goes through the whole create path |

## Dry-run booking

`createInstantBooking(input, { dryRun: true, … })` runs the real create path, including the shop lock and
capability gate, the slot guard, the client upsert and the booking insert, inside the usual Serializable
transaction. It then throws a private `DryRunRollback` right after `tx.booking.create`, so Postgres rolls back
everything the transaction wrote. It returns `{ dryRun: true, wouldCreate }`.

The customer used is "KERSIVO health check" <health-check@kersivo.co.uk>, with no phone. It is never persisted.
LIVE runs use the same gates as a public booking (`requiredCapability: PUBLIC_BOOKING`, payment readiness).
PRELAUNCH runs skip those two, because a draft shop has no plan yet.

Side-effect audit (everything reachable from `createInstantBooking`):

| Side effect | Under dryRun |
| --- | --- |
| Client upsert | inside the transaction → rolled back |
| Booking insert (slot hold) | inside the transaction → rolled back |
| Shop row lock + capability check | inside the transaction (lock released on rollback) |
| Idempotency key lookup / write | skipped (key ignored) |
| Confirmation email `enqueueEmail` | skipped (the throw comes before it; the row would also be rolled back) |
| `tryDeliverOutboxEmail` | skipped (early return, `outboxId` is null) |
| Stripe | none: `createInstantBooking` never calls Stripe (checkout is created by the route afterwards) |
| SMS / email reminder scheduling | none: picked up later by crons from persisted bookings, and nothing is persisted |
| Recommendation / insight / analytics | none in this function |
| DB triggers / Prisma middleware | none on these tables |

Tests: `src/lib/booking/createInstantBooking.dryRun.test.ts` (real commit/rollback semantics over an in-memory
store). The test checks that Booking, Client and EmailOutbound counts are unchanged, that there are no email or
Stripe calls, and that a real booking for the same slot afterwards succeeds.
