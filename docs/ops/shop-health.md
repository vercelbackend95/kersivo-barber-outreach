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
| HTTP / Stripe probe checks | `src/lib/ops/shopHealth/checks/probes.ts` |
| SSRF-guarded fetch | `src/lib/ops/shopHealth/probe.ts` |
| Probe identity (header + secret) | `src/lib/ops/healthProbeAuth.ts` |
| Hourly cron | `src/lib/ops/shopHealth/cron.ts`, `GET /api/cron/shop-health` (`vercel.json`, minute 7) |
| Ops alerts | `src/lib/ops/shopHealth/alerts.ts` |
| Storage | `ShopHealthRun` (latest 50 per shop), `ShopSettings.healthOverall / healthCheckedAt / healthAlertedAt` |
| Read side for the UI | `src/lib/ops/shopHealth/report.ts` (list rows, report, history), `display.ts` (labels, icons) |
| Ops UI | `/ops/shops`, `/ops/shops/[shopId]`, "System health" card on `/ops/preview-requests/[id]` |
| API | `POST /api/ops/shops/[shopId]/health/run`, `GET /api/ops/shops/[shopId]/health` |
| Launch guard | `src/lib/ops/shopHealth/launchGuard.ts`, used by `PreviewRequestActions` ("Mark live") |

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

HTTP and Stripe probe checks (cron, "Run checks now", launch guard):

| id | severity | applies | passes when |
| --- | --- | --- | --- |
| booking.page | critical | live | `https://kersivo.co.uk/book/<slug>` returns 200 and the HTML contains the shop name |
| website.site_data | critical | live + `BRANDED_SITE` | `/api/public/site/<slug>` returns 200, `contractVersion === 1`, `planFeatures.onlineBooking === true` |
| website.up | critical | live + site URL | 200 over HTTPS within 10 s (warns over 3 s) |
| website.booking_link | critical | live + site URL | the site HTML links to `booking.url` from the site data |
| website.indexable | critical | live + site URL | no `noindex` in `<meta name="robots\|googlebot">` or `X-Robots-Tag`. A live shop whose only site is still the preview URL gets a warning, not a fail |
| website.shows_shop | warning | live + site URL | the HTML shows the shop name and its phone or postcode from the site data |
| website.tls | warning | live + verified own domain | the certificate is valid for more than 14 days |
| website.preview_up | warning | PRELAUNCH + `sitePreviewUrl` | the preview URL returns 200 (noindex is expected there) |
| retail.page | critical | live + retail on | `/shop/<id>` returns 200 and lists at least one active product |
| payments.stripe_account | critical | when payments.connect applies and an account is connected | read-only `GET /v1/accounts/<id>`: charges enabled and no `requirements.disabled_reason`. Warns on `currently_due` items or paused payouts. Cached for 1 h |

The site URL is the origin of the shop's `VERIFIED_LIVE` FullBookingDestination, or else `sitePreviewUrl`.
No URL is ever taken from user input or a request.

## Probe safety (SSRF guard)

Every HTTP probe goes through `probeUrl` (`probe.ts`):

- **https only**, on the default port, with no credentials in the URL. `localhost`, `*.local` and `*.internal` are refused.
- **DNS is resolved once per hop.** Every returned address is checked against the loopback, private (RFC 1918),
  CGNAT, link-local (including the 169.254.169.254 metadata address), documentation, multicast and reserved
  IPv4 ranges. For IPv6 it checks `::`, `::1`, `fc00::/7` (including the `fd00:ec2::254` metadata address),
  `fe80::/10`, multicast and documentation, plus IPv4-mapped, NAT64 and 6to4 addresses (the embedded IPv4 is
  checked). The connection then goes to that **pinned** address with SNI set to the host name, so a DNS
  rebinding answer can never swap it.
- **Redirects are followed by hand:** at most 3, https only, and on the same registrable domain
  (e.g. `fade.co.uk` → `www.fade.co.uk` is allowed, a different site is not). DNS is checked again on each hop.
- **Limits:** 10 s for the whole probe and a 2 MB body cap (declared or streamed).
- **Identity:** `User-Agent: KERSIVO-HealthCheck/1.0` and `X-Kersivo-Health: 1`.

### Probe identity and exemptions

`X-Kersivo-Health: 1` alone proves nothing. KERSIVO's own routes treat a request as a probe only when it
also carries `X-Kersivo-Health-Secret` equal to `KERSIVO_HEALTH_PROBE_SECRET` (constant-time compare,
at least 24 characters, fail closed). The secret is only sent to `https://kersivo.co.uk`, never to a
tenant's website.

Audit of what a probe could count or trigger:

| Concern | Finding |
| --- | --- |
| Preview views (`recordPreviewView`: `firstViewedAt`, `viewCount`, the `preview_viewed` server event) | Skipped for a verified probe (`previewHubPage.ts`, `preview/[token]/website.astro`). Probes do not normally reach `/preview/*`: the site URL is the tenant build, not the hub. |
| Analytics | GA and the funnel events run in the browser; probes do not run JavaScript. No server-side analytics run on `/book`, `/shop` or `/api/public/site`. |
| Rate limits | `checkBookingRateLimit` and the other durable IP limits only guard POST create routes and hub/contact routes. Probes are GET-only and never call them, so no bypass was added. |
| Bookings | The booking proof is the in-process dry run, never an HTTP POST. |

## Cron

`GET /api/cron/shop-health` (Bearer `CRON_SECRET`, every hour at minute 7):

- **Live shops** are shops that are paid, on Starter, launched or on SMS reminders, and have not departed
  (demo shops excluded). They get a full run with probes when last checked more than ~55 minutes ago.
- **Draft shops** are linked to a preview request in IN_PROGRESS / READY / CHANGES_REQUESTED. They get a
  PRELAUNCH run once a day.
- Shops are processed one at a time, oldest `healthCheckedAt` first (never checked first). The cron does not
  start a shop that would likely end past **80% of maxDuration** (`SHOP_HEALTH_CRON_MAX_DURATION_S`,
  default 60 s). The rest stay the oldest, so the next hour resumes with them.
- A shop whose run cannot start is logged and its `healthCheckedAt` is stamped, so it never blocks the queue.
- Runs beyond the newest 50 per shop are deleted.

## Alerts (LIVE shops only, ops only)

- **Red on two consecutive runs** (anti-flap) → a Sentry message (tag `shopId`) plus an email to every
  address in `KERSIVO_OPS_EMAILS`. Subject: `[KERSIVO] Red: <shop> — <first failing check>`. The body lists
  the failing checks and links to `/ops/shops/<id>`. `healthAlertedAt` is stamped.
- **Still red:** no repeat, except one "Still red" reminder per 24 h.
- **No longer red** after an alert → one "Back to green" email (or "No longer red (amber)"), and
  `healthAlertedAt` is cleared.
- Emails use the outbox (`SHOP_HEALTH_ALERT_INTERNAL`, `shopId` null so they never count against the shop's
  own `messaging.email` check), de-duplicated per run and recipient. Outside Production they are stored
  as SUPPRESSED with a `[Preview]` subject, and never sent.
- Launch-guard runs never alert. No email ever goes to shop owners.

## Ops UI

- **`/ops/shops`** (operator only, linked from the `/ops/preview-requests` header): one row per shop the
  cron looks after, plus any shop ever checked. Columns: light (icon + text), shop, plan, mode, last checked,
  failing / warning titles (two, then "+n"), "Run now". Sorted red, amber, not live yet, green, never
  checked; oldest check first inside each. Filter chips by light (`?light=red`).
- **`/ops/shops/[shopId]`**: the big light with a summary line, "Run checks now", checks grouped by area
  (Setup · Booking · Payments · Products · Website · Messages) with status icon + word, message, fix hint and
  collapsible evidence; the last 20 runs as dots (hover or keyboard focus shows time, light, trigger and
  failing checks); the fixed footnote. A GREY draft keeps showing its pre-launch run even after a newer
  launch-guard LIVE run.
- **"System health" card** on `/ops/preview-requests/[id]` (when a draft shop is linked): light with
  readiness, last checked, top 3 issues, "Run checks now", "Open full report".
- **Launch guard**: "Mark live" asks the usual confirm, then runs a LAUNCH health run in LIVE mode for the
  draft shop. GREEN/AMBER → marks live. RED → a "Launch anyway?" dialog lists the failing checks with fixes.
  A run that is rate-limited or fails also asks. It never hard-blocks; Cancel (focused by default) or Escape
  does nothing.
- The light is never colour-only: every light, status and history dot has a distinct glyph
  (✓ ! ✕ ○ – … ?) and text or an accessible label.

### API

| Route | Auth | Notes |
| --- | --- | --- |
| `POST /api/ops/shops/[shopId]/health/run` | Operator, same-origin JSON | Body `{}`: MANUAL run with probes, 1 per minute per shop (429 + `Retry-After`). Body `{ "launch": true }`: LAUNCH run in LIVE mode, own bucket of 3 per minute. Returns the run (light, readiness, failing, warnings, results). |
| `GET /api/ops/shops/[shopId]/health` | Operator | Latest run (display mode) and the last 20 runs. `Cache-Control: private, no-store`. |

## Environment

| Variable | Purpose |
| --- | --- |
| `KERSIVO_HEALTH_PROBE_SECRET` | **New.** Server-only random string, at least 24 characters. Set it in Production and Preview. Without it, probes still run but are never treated as verified. |
| `SHOP_HEALTH_CRON_MAX_DURATION_S` | Optional. The function maxDuration (seconds) the cron budgets against. Default 60. |
| `KERSIVO_OPS_EMAILS` | Existing. The alert recipients (also the ops sign-in allowlist). |
| `CRON_SECRET` | Existing. Cron auth. |

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
