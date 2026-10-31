# Admin Hub — Batch 1 plan (hub engine moves into /admin)

Branch: `admin-hub-batch-1`, stacked on `preview-hub-batch-7` (PR #181, open, CI green). Batch 7 rewrites many of the
same hub files (hubApi, hubReviews, HubShell, preview pages). Branching from `main` would mean rebuilding on code that
#181 replaces and a large conflict later, so this PR targets `preview-hub-batch-7`; GitHub retargets it to `main`
when #181 is merged. Part D of Batch 7 (setting `PREVIEW_HUB_ENABLED` in production) is not done and stays cancelled.

## Flags

- New `ADMIN_HUB_ENABLED` (server-only, `isAdminHubEnabled()` in `src/lib/freePreview/config.ts`).
- Admin hub needs `FREE_PREVIEW_FLOW_ENABLED` (the token page already 404s without it) and `ADMIN_HUB_ENABLED`. It does
  **not** need `PREVIEW_HUB_ENABLED`: production keeps that one off.
- Flag off: no code path added in this batch runs. `/admin`, `/preview/{token}/*` and `/api/preview-hub/*` behave as
  today; `/api/admin-hub/*` returns 404.

## Files

New
- `src/lib/adminHub/hubSession.ts` (+ test): `ks_hub` sign/verify. `v1.<previewRequestId>.<expUnix>.<hmac>`; operator
  variant `v1.<id>.<exp>.op.<hmac>`. HMAC-SHA256, key = HKDF-SHA256(auth secret, info `ks-hub-v1`), auth secret =
  `BETTER_AUTH_SECRET || ADMIN_SECRET` (same order as `src/lib/auth.ts`, no new env var). `timingSafeEqual`. Cookie
  string builders: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=…` and a clearing cookie.
- `src/lib/adminHub/hubContext.ts` (+ test): `resolveHubContext({ token } | { cookie })` → `HubPageContext | null`.
  Shared by `/api/preview-hub/[token]/*` (via `resolveHubApiContext`), `/api/admin-hub/*` and `/admin`.
- `src/lib/adminHub/bridge.ts` (+ test): `/preview/{token}[/sub]` → set cookie → `303` to the mapped `/admin` URL.
- `src/lib/adminHub/adminMode.ts` (+ test): server decision for `/admin`: `full` | `hub` (+ precedence, headers).
- `src/lib/adminHub/links.ts`: client-safe hub link/API-base maps (token links for the old hub, `/admin` links for the
  new shell).
- `src/lib/previewHub/handlers/*.ts`: the bodies of the 9 `/api/preview-hub/[token]/*` routes moved into factories
  that take a source (`token` or `admin`). Token route files become one-line re-exports, so their tests keep passing.
- `src/pages/api/admin-hub/*`: 1:1 mirror (assets, assets/[id], changes, changes/[id], changes/send, details,
  messages, messages/read, reviews) + `checkout`, `event`, `domain-search` (the hub's "Launch this website" button
  calls `/api/free-preview/{token}/…` today) + `leave` (POST, clears `ks_hub`, 303 → `/`).
- `src/components/adminHub/AdminHubShell.astro` + `src/styles/components/admin-hub.css`: the hub-mode shell.
- `src/components/adminHub/AdminHubMain.astro`: picks the section/app content (temporary bodies below).

Changed
- `src/pages/admin.astro`: flag on → decide mode on the server; hub mode renders `AdminHubShell` (no `AdminPanel`, so
  no flash of the full admin). Flag off → the file renders exactly what it renders today.
- `src/pages/preview/[token].astro` and `overview|website|details|changes|messages.astro`: one bridge call at the top.
  `no-thanks.astro` untouched.
- Hub islands (`HubChanges`, `HubMessages`, `HubReviewCards`, `HubUploader`, `HubYourShop`, `HubWebsiteView`,
  `PreviewTopBar`) and `HubOverview.astro`: optional `apiBase` / `links` props. Absent → today's token URLs, so the
  old hub's output does not change. In the new shell they get `/api/admin-hub` and `/admin?…` links and `token=""`.
- `src/lib/freePreview/hubApi.ts`: `resolveHubApiContext` gains an optional `source`; rate-limit helpers take a key.
- `src/lib/freePreview/launchCheckout.ts`: split so checkout can run from a resolved request (cookie) with
  `cancelPath = /admin`.
- `src/lib/freePreview/previewAccess.ts`: export `resolvePreviewRequestById` / `…ByDraftShopId` (same select).

## Access model (spec §2)

`/admin` with the flag on:
1. Valid `ks_hub` with the **op** flag **and** a live operator session → hub mode + "Viewing as KERSIVO". (Without
   this step an operator with their own shop could never see the hub: their session would win.) An op cookie without
   an operator session is invalid → cleared.
2. Better Auth session (`resolveAdminAccess`, `via === 'session'`, role OWNER) whose shop is a preview draft shop in
   the **launch** stage (converted, not live) → hub mode, launch phase. An owner `ks_hub` for that request is minted so
   `/api/admin-hub/*` works.
3. Any other session → full admin (session wins over `ks_hub`).
4. Owner `ks_hub` → re-resolved every request; REJECTED/unknown/bad signature/expired cookie → cleared, normal admin
   sign-in. EXPIRED request → hub shows the expired state. DECLINED → closed state.
5. Nothing → today's admin (sign-in).

Operators: `isOperator` = operator session present (as on the token routes today). Owner-view analytics
(`recordHubOwnerView`, `recordPreviewView`, `preview_viewed`) never run for operators.

Cookie lifetime: `min(30 days, preview expiry)` when the preview has a future `expiresAt`. REQUESTED/DESIGNING (no
expiry yet), launch and declined → 30 days. Already EXPIRED → 24 hours (long enough to show the expired state and
message us; a 0/negative Max-Age would delete it).

Bridge map (§2.2): `/preview/{t}` → `/admin` (`?view=booking` → `/admin?section=website&view=booking`),
`/overview` → `/admin`, `/website` → `/admin?section=website` (keeps `view=booking`), `/changes` →
`/admin?section=changes`, `/messages` → `/admin?app=messages` (keeps `draft=`), `/details` → `/admin?app=setup`.
REJECTED/unknown → today's 404. Bridge response carries the private preview headers.

Headers (flag on): `/admin` in every mode and `/api/admin-hub/*` → `X-Robots-Tag: noindex, nofollow`,
`Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`.

Same-origin: every POST/PATCH/DELETE in `/api/admin-hub/*` uses the existing `evaluateExactSameOrigin` gate (plus the
global middleware origin gate). `ks_hub` is never accepted by `resolveAdminAccess`, so every `/api/admin/*` endpoint
still needs a real session (tested with a sample).

## Shell (spec §3, mockups 01/03/04/05)

- Desktop ≥1024: 256px sidebar — wordmark with red dot, shop chip (logo thumb via `/api/admin-hub/assets/{id}` or
  initials on the brand colour), stage pill, group "YOUR WEBSITE": Overview / Changes (open-items badge) / Website,
  spacer, red setup card (placeholder: `AdminLaunchCtaButton --conversion`, "YOUR SHOP · n OF 6" / "Help us build your
  site", static list of the six rows, links to `?app=setup`), "Private · hidden from search engines", account row
  (owner email or "Viewing as KERSIVO") with "Leave preview".
- Mobile <1024: sticky top bar (wordmark · shop name · stage pill · Messages icon + unread dot), 3-tab bottom bar
  (Overview, Changes + count, Website; red top indicator; safe-area; ≥44px). The setup card sits at the top of
  Overview on mobile.
- Sections `?section=overview|changes|website` (default overview). Temporary bodies: `HubOverview`, `HubChanges`,
  `HubWebsiteView`. Old `/details` and `/messages` targets (`?app=setup`, `?app=messages`, and the six detail app ids)
  temporarily render `HubYourShop` / `HubMessages` full-width in the main column until Batch 2's app windows.
- `HubShell.astro` stays only for the flag-off `/preview/{token}/*` path.

## Tests

Unit (vitest): hubSession (round-trip, tamper, expiry, wrong version, op flag, wrong key, cookie attributes,
max-age rules); bridge (every sub-route mapping, REJECTED/unknown 404, EXPIRED/DECLINED cookie + redirect, operator op
cookie, flag off → null); hubContext (token and cookie paths agree, op cookie without operator → null); admin mode
(precedence, headers, flag off → untouched); `/api/admin-hub/*` (404 flag off, cookie required, same-origin 403,
mirrors call the same services); cookie-only on a sample of `/api/admin/*` (bookings, clients, settings, team,
retail) → 401/403; admin.astro/flag-off source guards; full admin unchanged for a paid shop and a Starter shop
(mode resolver returns `full`, `AdminPanel` branch unchanged).

Real stack (Playwright, local Postgres via the existing harness, `ADMIN_HUB_ENABLED=true`, `PREVIEW_HUB_ENABLED` off):
seeded REQUESTED and READY open from the email link → land on `/admin` with the new shell at 390 and 1440; the token
is absent from the `/admin` HTML; cookie attributes; rejected 404; cookie-only full-admin APIs 401/403.

## Risks

- **Byte-for-byte flag off.** Mitigated by early returns behind `isAdminHubEnabled()` and optional props whose
  defaults reproduce today's URLs; source-guard tests on the pages.
- **Token leakage into `/admin` HTML** (island props, image URLs, checkout cancel URL). Mitigated by `token=""` +
  `apiBase`, cookie-based checkout with `cancelPath=/admin`, and an HTML assertion in the real-stack test.
- **Shared DATABASE_URL.** No migration in this batch. The real-stack suite refuses non-localhost databases.
- **Operator precedence** (see access model step 1) is my reading of §2.1 + §2.2; flagged in the report.
- **Session-launch owners** get hub mode on `/admin` once the flag is on; their current route is the full admin +
  `/admin/preview-launch`. That is the spec's intent, but it changes what converted-not-live owners see.
