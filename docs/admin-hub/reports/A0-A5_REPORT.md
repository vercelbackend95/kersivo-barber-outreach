# A0–A5 — hub Add journey QA

Stacked on `main` @ `5500d1c` (H1–H5). Branch `a5-hub-qa` (A0–A4 plus this QA). Do not merge from the agent.

## Fixes in this QA

1. **Focus return from the Add menu.** Opening materials from a menuitem unmounted the opener. `AppHost` now restores focus to the still-mounted **Add** trigger (`aria-controls` / test-id fallback).
2. **Escape / Close after a pushed app.** `close()` no longer waits for `popstate` before hiding the window — it pops history *and* unmounts immediately.
3. **Playwright fill() on controlled fields.** Messages (and the A5 change composer) now dispatch a React `input` so Send enables. A0 was failing with the textarea filled, char count still `0 / 2000`.
4. **File-level serial Playwright.** A0 failure was skipping A1–A5. Serial is scoped to batch 1 and batch 6 only.
5. **Inventory QA** returns `hubRows` so the live walk can assert `/api/admin-hub/*` is outside the `/api/admin` allowlist.

## What shipped (A0–A4)

| Batch | What |
| --- | --- |
| **A0** | Prefix trap: `isAdminApiPath` matches `/api/admin` only. `/api/admin-hub/*` is outside `HUB_ADMIN_API_ALLOWLIST`. Hub-only visitors can upload, save text, message and start checkout. |
| **A1** | Shared `AdminAddButton` visible labels: "Add service", "Add team member", "Add product". Empty-state "Add your first …". `?add=1` opens the create sheet once, then is stripped. Same panels in hub and paid admin. |
| **A2** | Overview header **Add** menu: website files (materials `?item=`) + shop items (`/admin/{team\|services\|products}?add=1`). Keyboard + mobile sheet. |
| **A3** | Materials app = **Add to your website**. Logo, shop photos, team photos, price list, other files, text card (about ≤600, Instagram, anything else ≤2000). Ops Files tab shows the new fields. Edits do not consume a change round. |
| **A4** | Overview bento: Website content + Your shop tiles; Messages tile removed (Messages stays `/admin/messages`). `+` materials tile gone. |
| **A5** | This QA. Focus return after closing an app opened from the Add menu (the menuitem unmounts — restore to the **Add** trigger). Live journey + security walk. Spec + this report. |

## Hub-only session

Asserted on every A0 / A3 / A5 Playwright path: `ks_hub` present, no `better-auth.session_token`, no `kersivo_shop_preview`.

Journey (A5 Playwright + A0–A3):

| Step | Result |
| --- | --- |
| Overview → Add menu → every item href | Website items → `?app=materials&item=`; shop items → `?add=1` |
| Upload / text save | `POST /api/admin-hub/assets`, `PATCH /api/admin-hub/details` 2xx |
| Team / Services / Products `?add=1` | Sheet / labelled button; `add` stripped |
| Changes draft + send | `POST /api/admin-hub/changes` then `/changes/send` 2xx. Text / catalogue edits do not increment `changeRoundsUsed` |
| Messages send | `POST /api/admin-hub/messages` 2xx |
| Checkout start | Launch sheet, "Continue to secure checkout" |
| "Not available in your preview." | Only on non-allowlisted `/api/admin/*`. Never on `/api/admin-hub/*` |

## Security

H4 walker rerun (unit + live Playwright). Classifier unchanged: exact method+path, no prefix wildcard.

| Check | Result |
| --- | --- |
| Disk inventory vs allowlist | Living walker `src/lib/adminHub/adminApiInventory.ts`. Unit lock `h4Security.test.ts`. |
| `/api/admin-hub/*` vs allowlist | `isAdminApiPath` is false. Middleware does not return the preview-unavailable 403. `hubRows` now on `/api/preview-hub-qa/admin-api-inventory`. |
| No cookie / invalid cookie | Handler `404 { error: 'Not found.' }` — existing hub convention (does not confirm the request). Not 401. Origin-missing mutations still 403 `Forbidden.` |
| Cross-tenant details | Cookie A `PATCH /api/admin-hub/details` with `requestId` of B still writes A. Cookie B cannot change A's about text. Schema strips `requestId` / `previewRequestId`. |
| Cross-tenant assets | `findFirst` / `softDelete` always include `previewRequestId: ctx.request.id`. Cookie B `GET`/`PATCH` of A's asset → 404. |
| Length limits | about 600, style notes 500, website extra 2000, asset caption 140. Oversize extra → 400. |
| Escaping | Ops Files tab interpolates `aboutText`, `instagramUrl`, `websiteExtraText`, `styleNotes` — no `set:html`. |
| Change rounds | `saveHubDetails` does not write `changeRoundsUsed`. Only `sendHubChanges` increments. |
| Public / bookable / outbound | Unchanged from H4: draft stays paused, retail off, no email/SMS/invites. |

**No cookie is 404, not 401/403.** Same as `/api/preview-hub/{token}` on a bad token. Founder: keep 404 (no leak) or switch hub-cookie misses to 401.

H4 finding 1 (HMAC replay after Leave preview) is unchanged.

## Paid admin regression

- Labelled add buttons on Services / Team / Products (same `AdminAddButton`).
- `?add=1` works on `/admin?section=services&add=1` (paid redirect keeps the query).
- Empty states still "Add your first service / team member / product".
- Sidebar unchanged: Booking system (Bookings, Team, Reports, Clients, Services) · Shop / Retail (Products, Orders, Sales) · Assistant.
- `AdminLayout.menu.test.tsx` snapshot still the paid menu.

## UX

Shots: `/tmp/kersivo-shots/a5/` (Windows `C:/tmp/kersivo-shots/a5/`). A0–A4 shots remain under `a0`–`a4`.

Checked at 375 / 768 / 1024 / 1440: no horizontal scroll; sidebar from 1024 up; mobile chrome below 1024; `prefers-reduced-motion: reduce` on tiles and the Add chevron.

| Name | Accessible name |
| --- | --- |
| Header add | button **Add** |
| Menu | **Add to your website or shop** |
| Menu items | Shop photos, Logo, Text for your website, Team photos, Price list, Other files, Team member, Service, Product |
| Section headers | **Add service** / **Add team member** / **Add product** |

Focus: `Escape` on the menu returns to **Add**. Closing the materials app opened from a menu item also returns to **Add** (A5 fix — previously the opener was a detached menuitem).

## Spec

`docs/admin-hub/ADMIN_HUB_SPEC.md` updated: §3 primary action + Messages as a page; §4 bento + Add menu; §5 setup rows → materials; §6 materials app, details fields, labelled add buttons, `/api/admin-hub` session rules.

## Founder decisions

1. **HMAC replay after Leave preview** — still open from H4.
2. **Hub-cookie miss status** — today 404 `Not found.` Confirm that, or switch to 401.
3. Merge A0–A5 only after this PR’s GitHub Actions `build` and the Vercel preview (`kersivo-barber-outreach`) are green. Do not merge from the agent.

## Checks

| Check | Result |
| --- | --- |
| `npm run claims:check` | pass |
| A0–A5 / H4 unit tests | pass (AppHost, Add menu, hubDetails, ops text, h4Security, adminHubRoutes, hubAdminAccess, AdminAddButton, overview, addMenu) |
| A4 bento Playwright | 3 passed (requested / designing / review at 375–1440) |
| H4 Playwright | 3 passed (allowlist walk, conversion + paid menu, UX 375–1440) |
| A0–A3 Playwright | 5 passed (upload/about/message/checkout, labelled add hub+paid, Add menu, materials text + OTHER) |
| A5 Playwright | 3 passed (journey, hub APIs + cross-tenant, keyboard / reduced motion / paid labels) |
| `npm test` | 6183 passed; known `financialEndpoints` MANAGER 403 timed out once; 25/25 alone |
| `npm run typecheck` | 0 errors |
| `npm run build` | pass |
