# H4 — preview hub security review

Branch `h4-hub-qa-security`, stacked on H3 (`h3-hub-real-entry`). Walk of every exported method on every file under `src/pages/api/admin/**` (126 pairs). Classifier: `isHubAdminApiAllowed` — exact method+path, `:param` is one segment, no prefix wildcard.

Living walker: `src/lib/adminHub/adminApiInventory.ts`. Unit lock: `src/lib/adminHub/h4Security.test.ts`. Live walk: `scripts/admin-hub-real.spec.ts` (H4), table dump at `/tmp/kersivo-shots/h4/allowlist.md` (Windows: `C:/tmp/kersivo-shots/h4/`).

## Verdict

Hub cookie (`ks_hub` only) may call **31** catalogue / team / product routes on the **cookie’s draft shop**. The other **95** `/api/admin/*` pairs are **403** in middleware before the handler. Cross-tenant `shopId` in the body or query is ignored (`access.shopId`). CSRF origin gate still runs on allowlisted writes, including when `Referrer-Policy: no-referrer` strips Referer but Origin is present. Allowlisted files do not import email, SMS or Stripe clients. Invites stay 403 with “Invites are available after your shop goes live.” Draft shops stay paused and without `PUBLIC_BOOKING`.

## Allowlist table

Walked from disk. “Allowlisted” = `HUB_ADMIN_API_ALLOWLIST`. Expected with only `ks_hub`: allowlisted → 2xx or 4xx validation; else 403.

| Method | Path | Allowlisted | Expected with `ks_hub` only |
| --- | --- | --- | --- |
| DELETE | `/api/admin/account` | no | 403 |
| GET | `/api/admin/account` | no | 403 |
| POST | `/api/admin/ai/chat` | no | 403 |
| POST | `/api/admin/analytics/starter-upgrade-event` | no | 403 |
| GET | `/api/admin/availability` | no | 403 |
| POST | `/api/admin/availability` | no | 403 |
| GET | `/api/admin/barbers` | yes | 2xx / 4xx validation |
| POST | `/api/admin/barbers` | yes | 2xx / 4xx validation |
| GET | `/api/admin/barbers/:id/rules` | yes | 2xx / 4xx validation |
| PUT | `/api/admin/barbers/:id/rules` | yes | 2xx / 4xx validation |
| GET | `/api/admin/barbers/:id/services` | yes | 2xx / 4xx validation |
| PUT | `/api/admin/barbers/:id/services` | yes | 2xx / 4xx validation |
| POST | `/api/admin/barbers/delete` | yes | 2xx / 4xx validation |
| POST | `/api/admin/barbers/reorder` | yes | 2xx / 4xx validation |
| GET | `/api/admin/barbershop-settings` | no | 403 |
| GET | `/api/admin/barbershop-settings/deposits` | no | 403 |
| PATCH | `/api/admin/barbershop-settings/deposits` | no | 403 |
| POST | `/api/admin/barbershop-settings/deposits` | no | 403 |
| GET | `/api/admin/barbershop-settings/google-booking` | no | 403 |
| PATCH | `/api/admin/barbershop-settings/google-booking` | no | 403 |
| PUT | `/api/admin/barbershop-settings/hours` | no | 403 |
| PUT | `/api/admin/barbershop-settings/identity` | no | 403 |
| PATCH | `/api/admin/barbershop-settings/pause` | no | 403 |
| GET | `/api/admin/barbershop-settings/retail` | no | 403 |
| PATCH | `/api/admin/barbershop-settings/retail` | no | 403 |
| GET | `/api/admin/bookings` | no | 403 |
| POST | `/api/admin/bookings/:id/force-reschedule` | no | 403 |
| PATCH | `/api/admin/bookings/:id/notes` | no | 403 |
| POST | `/api/admin/bookings/:id/refund-retry` | no | 403 |
| PATCH | `/api/admin/bookings/:id/service` | no | 403 |
| PATCH | `/api/admin/bookings/:id/status` | no | 403 |
| POST | `/api/admin/bookings/cancel` | no | 403 |
| POST | `/api/admin/bookings/manual` | no | 403 |
| GET | `/api/admin/bookings/manual-availability` | no | 403 |
| GET | `/api/admin/bookings/manual-setup` | no | 403 |
| GET | `/api/admin/client-onboarding` | no | 403 |
| PATCH | `/api/admin/client-onboarding` | no | 403 |
| PUT | `/api/admin/client-onboarding` | no | 403 |
| DELETE | `/api/admin/client-onboarding/assets` | no | 403 |
| POST | `/api/admin/client-onboarding/assets` | no | 403 |
| PUT | `/api/admin/client-onboarding/barber-profiles` | no | 403 |
| POST | `/api/admin/client-onboarding/domain-search` | no | 403 |
| POST | `/api/admin/client-onboarding/submit` | no | 403 |
| GET | `/api/admin/clients` | no | 403 |
| DELETE | `/api/admin/clients/:clientId` | no | 403 |
| GET | `/api/admin/clients/:clientId` | no | 403 |
| PATCH | `/api/admin/clients/:clientId` | no | 403 |
| GET | `/api/admin/clients/:clientId/notes` | no | 403 |
| POST | `/api/admin/clients/:clientId/notes` | no | 403 |
| POST | `/api/admin/clients/:clientId/notes/:noteId/like` | no | 403 |
| GET | `/api/admin/clients/:clientId/notes/images/:imageId` | no | 403 |
| POST | `/api/admin/clients/ensure` | no | 403 |
| GET | `/api/admin/departure` | no | 403 |
| POST | `/api/admin/departure` | no | 403 |
| POST | `/api/admin/login` | no | 403 |
| POST | `/api/admin/logout` | no | 403 |
| GET | `/api/admin/members` | no | 403 |
| DELETE | `/api/admin/members/:memberId` | no | 403 |
| PATCH | `/api/admin/members/:memberId` | no | 403 |
| POST | `/api/admin/members/accept` | no | 403 |
| POST | `/api/admin/members/accept-pending` | no | 403 |
| POST | `/api/admin/members/invite` | no | 403 |
| DELETE | `/api/admin/members/invites/:inviteId` | no | 403 |
| POST | `/api/admin/next-steps/dismiss` | no | 403 |
| POST | `/api/admin/next-steps/view-site` | no | 403 |
| GET | `/api/admin/onboarding` | no | 403 |
| PUT | `/api/admin/onboarding` | no | 403 |
| PUT | `/api/admin/onboarding/barbers` | no | 403 |
| POST | `/api/admin/onboarding/complete` | no | 403 |
| PUT | `/api/admin/onboarding/hours` | no | 403 |
| POST | `/api/admin/onboarding/restart` | no | 403 |
| PUT | `/api/admin/onboarding/services` | no | 403 |
| PUT | `/api/admin/onboarding/shop` | no | 403 |
| PUT | `/api/admin/onboarding/shop-hours` | no | 403 |
| GET | `/api/admin/preview-launch` | no | 403 |
| PATCH | `/api/admin/preview-launch` | no | 403 |
| POST | `/api/admin/preview-launch/approve` | no | 403 |
| POST | `/api/admin/preview-launch/domain-confirm` | no | 403 |
| POST | `/api/admin/products/upload-image` | yes | 2xx / 4xx validation |
| GET | `/api/admin/qr-kit` | no | 403 |
| POST | `/api/admin/qr-kit` | no | 403 |
| GET | `/api/admin/reports` | no | 403 |
| POST | `/api/admin/retail-onboarding/reset` | no | 403 |
| POST | `/api/admin/retail-onboarding/skip` | no | 403 |
| GET | `/api/admin/service-categories` | yes | 2xx / 4xx validation |
| POST | `/api/admin/service-categories` | yes | 2xx / 4xx validation |
| GET | `/api/admin/services` | yes | 2xx / 4xx validation |
| POST | `/api/admin/services` | yes | 2xx / 4xx validation |
| PATCH | `/api/admin/services/:id` | yes | 2xx / 4xx validation |
| POST | `/api/admin/services/reorder` | yes | 2xx / 4xx validation |
| POST | `/api/admin/services/upload-image` | yes | 2xx / 4xx validation |
| GET | `/api/admin/session` | yes | 2xx / 4xx validation |
| GET | `/api/admin/shop/orders` | no | 403 |
| GET | `/api/admin/shop/orders/:id` | no | 403 |
| POST | `/api/admin/shop/orders/:id/collect` | no | 403 |
| GET | `/api/admin/shop/products` | yes | 2xx / 4xx validation |
| PATCH | `/api/admin/shop/products/:id` | yes | 2xx / 4xx validation |
| POST | `/api/admin/shop/products/create` | yes | 2xx / 4xx validation |
| POST | `/api/admin/shop/products/delete` | yes | 2xx / 4xx validation |
| POST | `/api/admin/shop/products/reorder` | yes | 2xx / 4xx validation |
| POST | `/api/admin/shop/products/toggle` | yes | 2xx / 4xx validation |
| POST | `/api/admin/shop/products/update` | yes | 2xx / 4xx validation |
| PUT | `/api/admin/shop/products/update` | no | 403 |
| POST | `/api/admin/shop/reset` | no | 403 |
| GET | `/api/admin/shop/sales` | no | 403 |
| POST | `/api/admin/shop/sales/demo` | no | 403 |
| POST | `/api/admin/shop/test-order` | no | 403 |
| GET | `/api/admin/site-launch` | no | 403 |
| POST | `/api/admin/site-launch/approve` | no | 403 |
| POST | `/api/admin/subscription/upgrade-checkout` | no | 403 |
| GET | `/api/admin/team` | yes | 2xx / 4xx validation |
| POST | `/api/admin/team/booking-profiles` | yes | 2xx / 4xx validation |
| PATCH | `/api/admin/team/booking-profiles/:barberId/online-bookings` | yes | 2xx / 4xx validation |
| DELETE | `/api/admin/team/invitations/:inviteId` | no | 403 |
| PATCH | `/api/admin/team/invitations/:inviteId` | no | 403 |
| POST | `/api/admin/team/invitations/:inviteId/resend` | no | 403 |
| POST | `/api/admin/team/invite` | no | 403 |
| PATCH | `/api/admin/team/members/:memberId/bookable` | no | 403 |
| POST | `/api/admin/team/members/:memberId/booking-profile` | no | 403 |
| DELETE | `/api/admin/team/members/:memberId/dashboard-access` | no | 403 |
| GET | `/api/admin/team/shop-hours` | yes | 2xx / 4xx validation |
| GET | `/api/admin/timeblocks` | yes | 2xx / 4xx validation |
| POST | `/api/admin/timeblocks/create` | yes | 2xx / 4xx validation |
| POST | `/api/admin/timeblocks/delete` | yes | 2xx / 4xx validation |
| GET | `/api/admin/timeoff` | no | 403 |
| POST | `/api/admin/timeoff` | no | 403 |

`PUT /api/admin/shop/products/update` is exported on disk but not on the allowlist (the UI uses POST). Default-deny holds.

## Cross-tenant

Every allowlisted handler binds `shopId` from `access.shopId` (cookie → draft shop). Static check: no `body.shopId` / `searchParams.get('shopId')` / `parsed.data.shopId` on those files.

Live (H4 Playwright, Ready hub cookie vs Live shop B):

- `POST /api/admin/services` with `shopId: liveShopId` creates **H4 Fade** on the Ready draft, not shop B.
- `GET /api/admin/services?shopId=liveShopId` returns Ready services; Live `serviceId` is absent.
- `PATCH /api/admin/services/{liveServiceId}` → 404/400 (row is not on shop A).

## Cookie states

| State | Page | `/api/admin/services` |
| --- | --- | --- |
| Valid owner `ks_hub` + ownerless draft + stage requested/designing/review | Hub | Allowlisted 2xx |
| Expired request | Hub expired chrome | 401/403 (`resolveHubAdminAccess` stage gate) |
| Rejected / unknown token | 404, no cookie | n/a |
| Converted request cookie (no Better Auth) | Cookie may set; stage is launch | 401/403 — hub admin stages are preview-only |
| Operator cookie, no operator session | Cookie cleared, not hub | 401/403 |
| Leave preview | Cookie cleared, `/admin` is sign-in | 401/403 (browser no longer sends `ks_hub`) |
| Owned draft (`ownerUserId` set) | Not hub admin | null access |

## CSRF

Middleware order: hub allowlist **then** `evaluateOriginGate`. Allowlisted writes are not exempt.

- Same-origin `Origin` + no Referer (Referrer-Policy: no-referrer) → allowed.
- Missing Origin and Referer → denied.
- Foreign Origin → denied.

Live: `POST /api/admin/services` without Origin and with `Origin: https://evil.example` → 403.

`POST /admin/leave-preview` is outside `/api/` on purpose so `Origin: null` form posts still work (`isSameOriginFormPost` + `Sec-Fetch-Site: same-origin`).

## Outbound email / SMS / Stripe

- Allowlisted handler files do not import `@/lib/email`, `@/lib/sms`, `@/lib/mailer`, `@/lib/shop/stripe` or `stripe`.
- Invite / resend / upgrade-checkout / manual booking are not on the allowlist (middleware 403) and invite handlers also call `denyHubInvite` before `sendShopTeamInviteEmail`.
- Live hub session: QA email log count and Stripe checkout stub are unchanged after catalogue writes; `POST /api/admin/team/invite` returns 403 with the live-shop invite message.

After the shop is live, the same invite route is not hub-blocked (paid admin regression).

## Draft shop stays private

- `createDraftShop` sets `publicActivityPaused` + construction reason. Hub product create skips `markRetailOnboardingCompleted`.
- `shopAcceptsPublicBookings` requires `PUBLIC_BOOKING` (unpaid draft: false).
- `adoptPreviewDraftShop` writes only `ownerUserId` + onboarding-complete + OWNER `ShopMember`. It does not flip `publicActivityPaused`, `retailEnabled` or `bookingPaymentMode`, and it does not create services, barbers or products.
- Live after hub edits: Ready `shop-state` still `acceptingBookings: false`, `retailEnabled: false`, `publicActivityPaused: true`, `ownerUserId: null`. `/book/{draftShopId}` still shows “Online booking is temporarily unavailable.”

## Findings

1. **Leave preview does not revoke the HMAC.** Clearing `ks_hub` is client-side. A captured cookie value still verifies until `expiresAt`. Reminting from the email link produces the same value (expiry is deterministic). Residual risk of any HMAC cookie; more serious now that the cookie can write the draft catalogue. **Founder decision:** accept (same as before H1), or add an issued-at / epoch and a `HUB_LEFT` event so replay fails and the email link still works.
2. **`PUT /api/admin/shop/products/update` exists and is denied.** No change required; default-deny is correct. Optional cleanup later.
3. No other allowlist, tenant-binding, CSRF, outbound or public-booking holes found on this walk.

## Founder decisions

1. HMAC replay after Leave preview — accept or revoke (see finding 1).
2. Confirm hub Full-capability grant (`via === 'hub'` gets Full product capabilities without writing a plan onto the shop) stays the rule. Catalogue/product screens need it; the shop still has no `PUBLIC_BOOKING` entitlement.
