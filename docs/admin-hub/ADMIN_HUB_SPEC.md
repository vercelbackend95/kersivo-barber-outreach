# KERSIVO Admin Hub — spec v2.0 (Shop Hub moves into /admin)

Status: APPROVED FOR BUILD (founder decision, 31 Oct 2026). Implementation: Cursor, Batches 1–6 (`docs/admin-hub/CURSOR_PROMPTS.md`).
Supersedes the *layout and routing* parts of `docs/preview-hub/HUB_SPEC.md` (§3 IA, §3.2 shell, §4.1 Overview, §4.3 Website). Everything else in HUB_SPEC (data model, uploads pipeline, security §11, retention, emails, ops console, analytics, copy rules, founder decisions D1–D6) **still applies** unless this file says otherwise.

Visual source of truth: `docs/admin-hub/mockups/*.png` (2× PNG) and the matching `mockups/html/*.html` (open in a browser; `styles.css` holds the exact tokens, spacing and radii). Sample shop "Northgate Barbers" is fictional mock data — never ship it.

---

## 1. What changes and why

| Before (Batches 1–6) | After (this spec) |
|---|---|
| Hub lives at `/preview/{token}/…` with its own shell | Hub lives at **`/admin`**, inside the real KERSIVO admin shell (same sidebar, theme `admin-theme-premium-black`, same components) |
| Nav: Overview · Website · Your shop · Changes · Messages | Nav: **Your website** (Overview · Changes · Website · Messages) plus the real **Booking system** (Team · Services) and **Shop / Retail** (Products) groups — seven items, same `AdminLayout` as paid admin |
| "Your shop" page with stacked forms | Each shop detail is an **app** opened from the red setup card or a bento tile |
| Overview = vertical list of cards | Overview = **bento grid** of tiles; each tile opens its app |
| Messages = page | Messages = **app** (tile + top-bar icon) |
| Colour chips under the logo uploader | **Brand colours app**: extract from logo → choose roles → fine-tune → live preview → send to KERSIVO |
| Website toolbar with generic buttons; desktop view broken on phones | Calculator-style **segmented pills**; desktop view **scaled to fit** on phones |
| Paid shops: sidebar CTA hidden | Red card has **3 phases**: shop details → launch → "Get the most from KERSIVO" |

The owner's first screen of KERSIVO is now the product they will use every day. One place for the whole journey: preview → launch → live.

## 2. Access model (the "engine")

### 2.1 Modes of `/admin`
| Who | How they arrive | `/admin` renders |
|---|---|---|
| Prospect (no account) | Clicks email link `/preview/{token}` | **Hub mode — Preview phase** (stages Requested / Designing / Review) |
| Paid owner, site not live | Logs in (account created at checkout/launch) | **Hub mode — Launch phase** (stage Launch) |
| Paid owner, site live | Logs in | **Full admin** (today's dashboard) + red card phase 3 |
| Existing Starter / direct-subscribe shops without a preview request | Logs in | Full admin, **unchanged** (current launch CTA logic stays) |
| Operator | Opens `/preview/{token}` or ops "View as owner" | Hub mode + "Viewing as KERSIVO" banner; views never counted |

### 2.2 Hub session bridge (no account needed before payment)
- `/preview/{token}` stays the entry point (all emails already sent keep working). For a valid, visible token it sets a hub cookie and **303-redirects to `/admin`**, mapping old sub-routes: `/website` → `/admin?section=website`, `?view=booking` → `/admin?section=website&view=booking`, `/changes` → `?section=changes`, `/messages` → `?app=messages`, `/details` → `?app=setup`, `/overview` → `/admin`. `/no-thanks` stays where it is.
- Cookie `ks_hub`: value `v1.<previewRequestId>.<expiresAtUnix>.<hmac>`; HMAC-SHA256 with a key derived (HKDF, label `ks-hub-v1`) from the existing auth secret — no new env var unless the repo already has a pattern for one. `HttpOnly; Secure; SameSite=Lax; Path=/`; Max-Age = min(30 days, time until preview expiry). Operator variant carries an `op` flag and is never written for an owner.
- Every request re-resolves the cookie → PreviewRequest and re-checks stage visibility (REJECTED/unknown → clear cookie, render the normal admin sign-in; EXPIRED → hub in expired state). The token **never appears in `/admin` URLs or HTML**.
- New API namespace `/api/admin-hub/*` resolves the request from the cookie and calls the **same service functions** as `/api/preview-hub/[token]/*` (one shared resolver, e.g. `resolveHubContext({ token } | { cookie })`). Same pipeline: flag → rate limit → resolve → stage capability → zod → action → event. Token routes stay for back-compat.
- Precedence: a real better-auth session wins. If its shop **is** the converted preview's draft shop and the site is not live → Hub mode (Launch phase). Otherwise → full admin.
- "Leave preview" link in the account row clears `ks_hub`.
- Headers on `/admin` in hub mode and all `/api/admin-hub/*`: `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`. (Also confirm `/admin` is noindex in every mode.)
- Feature flag `ADMIN_HUB_ENABLED` (server-only). Off → today's behaviour exactly (`/preview/{token}` renders the old hub if `PREVIEW_HUB_ENABLED`, otherwise the legacy preview).

### 2.3 Hub mode must never expose full admin
In hub mode the client receives hub chrome plus the real Team, Services and Products screens, bound to the **ownerless draft shop**. The first visit to `/admin/team`, `/admin/services` or `/admin/products` creates that shop if it is missing — the owner lands on the same KERSIVO admin as after payment, not a setup placeholder. `ks_hub` is tenant access only through `resolveHubAdminAccess()` (`via: 'hub'`).

Default-deny on `/api/admin/*`:
- Middleware (`isHubOnlyAdminApiRequest` + `isHubAdminApiAllowed`) allows only the exact method+path pairs in `HUB_ADMIN_API_ALLOWLIST` (session, services, barbers, team cards / booking-only seats / hours / time blocks, products). No prefix wildcard.
- Everything else returns **403** with `Not available in your preview.` before the handler runs.
- `access.shopId` always comes from the cookie’s draft shop. Client `shopId` in the body or query is ignored.
- Invites (`denyHubInvite`) stay off until the shop is paid and live. No email, SMS or Stripe from allowlisted handlers.
- Product create does **not** mark retail onboarding complete when `via === 'hub'`. Adding products does not enable retail.
- Draft shops stay under construction (`publicActivityPaused`, no `PUBLIC_BOOKING` entitlement). Hub edits cannot make the shop public or bookable.
- Converted / launch / live / expired / rejected / anonymised requests, and an operator cookie without a live operator session, get no hub admin access.
- A Better Auth session still wins. After checkout the owner uses the same screens with the full menu.

The inventory walker (`src/lib/adminHub/adminApiInventory.ts`) and `docs/admin-hub/reports/H4_SECURITY.md` are the living table of every `/api/admin/*` method+path.

## 3. Shell (hub mode)

**Desktop ≥1024px** (mockups 01, 03): left sidebar 256px, reusing `AdminLayout` with `mode="preview"`:
1. KERSIVO wordmark (red dot) · 2. shop chip (logo or initials on brand colour, name, town) · 3. stage pill · 4. nav groups — **Your website:** Overview, Changes (badge = open items), Website, Messages · **Booking system:** Team (`/admin/team`), Services (`/admin/services`) · **Shop / Retail:** Products (`/admin/products`) · spacer · 5. **red setup card** (§5) · 6. "Private · hidden from search engines" · 7. account row (email or "Viewing as KERSIVO"; "Leave preview").

The three real-admin items open `ServicesAdminPanel`, `BookingsAdminPanel` (`mode="blocks"`) and `ShopAdminPanel` (products tab) inside the hub chrome. Do not fork or restyle those panels. LIVE badges, dashboard invites, Orders and Sales stay hidden until the shop is paid.

**Mobile <1024px** (mockups 04, 05): top bar = wordmark · shop name · stage pill · Messages icon with unread dot. The same seven links are in the mobile drawer (no separate 3-tab bar). The red setup card sits at the top of Overview (above the bento), full width.

Main column: max 1180px, padding 28/36px desktop, 16px mobile. Page header = eyebrow (red dot + section name), H1, one-line sub, actions on the right (desktop) / 2-up buttons under the header (mobile).

**One primary action per screen.** Requested / Designing: primary header **Add** (the add menu). Review: primary "Open your preview", outline **Add**, outline "Launch this website £39/month". Messages stay a sidebar / top-bar destination (`/admin/messages`), not an Overview tile.

## 4. Overview — bento (A4)

12-column grid, gap 14px, tiles: radius 20px, `#0D0D0E → #080809` gradient, 1px `rgba(255,255,255,.08)` border, inset top highlight, deep shadow, 1px red→transparent line on the top edge (the `/starter` premium card DNA). Tile header: 30px icon chip · uppercase eyebrow title · circular "open" button (↗) top-right where the tile is a link. Hover/focus: lift 2px, border brightens, ↗ turns red. `prefers-reduced-motion: reduce` disables the lift.

| Tile | Desktop placement (≥1280) | Content | Opens |
|---|---|---|---|
| **Your website build** | cols 1–8, row 1 | 5-step progress Requested → Designing → Review → Launch → Live (done / current / upcoming markers). No percentages. | — (not a link) |
| **Your preview** | cols 9–12, rows 1–2 | Static phone-frame thumbnail (server-rendered screenshot if one exists, otherwise a CSS composition with logo/initials on brand colours). Before Review: locked state "Your preview will appear here". Buttons "Open website" / "Try booking". **No iframe in the tile.** | `/admin/website` |
| **Website content** | cols 1–4, row 2 | Empty: one-line prompt + **Add to your website**. Filled: up to 4 shop-photo thumbs + status rows (Logo, Shop photos, Team photos, Text; Other files only once a file exists). Inline **Add** opens the same menu. | `?app=materials&item=…` |
| **Your shop** | cols 5–8, row 2 | Team / Services / Products counts, or "Add your first …" → `/admin/{team\|services\|products}?add=1`. Hidden after Review (launch / live). | Real admin screens |
| **Changes** | cols 1–8, row 3 | Counters Drafts / With KERSIVO / Done, two latest items with page chip + status chip, round info | `/admin/changes` |
| **Brand colours** | cols 9–12, row 3 | Logo + "N colours found in your logo", swatches with role labels, status pill (Not sent yet / Sent / Using KERSIVO's choice) | `?app=colours` |
| **Activity** | cols 1–12, row 4 | Latest events grouped by day; "Show all" opens `?app=activity` | `?app=activity` |

768–1279px: 6 columns — progress full width; preview + content; shop + colours; changes; activity. <768px: single column in order progress, preview, content, shop, changes, colours, activity. The `+` materials tile from the earlier polish is gone (`admin-hub-add-tile` must stay at count 0).

Stage variants: Requested/Designing — preview tile locked, changes tile locked ("Available when your preview is ready"). Launch — shop tile hidden. Expired/Declined — calm full-width state card replaces the bento (copy from HUB_SPEC §9.2).

### 4.1 Add menu (A2)

Header control labelled **Add** (`aria-haspopup="menu"`, `aria-label` on the menu: "Add to your website or shop"). Desktop: dropdown. ≤640px: bottom sheet. Groups:

| Group | Items | Destination |
|---|---|---|
| **Your website** | Shop photos · Logo · Text for your website · Team photos · Price list · Other files | `?app=materials&item=` (`photos`, `logo`, `text`, `team-photos`, `price-list`, `other`) — in-place app |
| **Your shop** | Team member · Service · Product | `/admin/team?add=1` · `/admin/services?add=1` · `/admin/products?add=1` — only in requested / designing / review |

Website items follow `canUpload` / `canEditDetails`. Shop items follow the H1 draft-shop stages. Keyboard: Arrow / Home / End, `Escape` returns focus to **Add**. Opening a website item from the menu, then closing the app, returns focus to **Add** (the menuitem unmounts). Analytics: `hub_add_menu_open`, `hub_add_menu_item` (allowlisted `item` only) via `POST /api/admin-hub/event`.

## 5. Red setup card (mockup 06)

Same component family as `AdminLaunchCtaButton` `--conversion` (red gradient, icon chip, uppercase status, title) plus: progress bar (white on dark red), checklist rows (white check discs for done, outline circles for to-do), the **next** item highlighted (darker row + →), "Optional" tags. Each row is a link that opens its app.

| Phase | Status / title | Rows → app |
|---|---|---|
| 1 · Preview (Requested→Review) | "YOUR SHOP · n OF 7" / "Help us build your site" | Logo → `?app=materials&item=logo` · Shop photos → `?app=materials&item=photos` · Services & prices → `/admin/services` · Team → `/admin/team` · Opening hours → `?app=hours` · About your shop (Optional) → `?app=materials&item=text` · Products (Optional) → `/admin/products` |
| 2 · Launch (paid, not live) | "LAUNCH · n OF 4" / "Let's put you live" | Business details · Domain · Payments (Optional) · Approve your website → the existing launch checklist items (`/admin/preview-launch#item`, restyled in this shell) |
| 3 · Live (full admin) | "YOU'RE LIVE · n OF 3" / "Get the most from KERSIVO" | View your website (opens live site, marks done) · Make a test booking (`/admin/test-book`) · Set up retail (Optional, existing retail onboarding) |

Done rules phase 1: Logo = ≥1 LOGO asset; Shop photos = ≥1 SHOP_PHOTO; Services = ≥1 active service on the draft shop; Team = ≥1 active barber on the draft shop; Hours = review state CONFIRMED or CORRECTIONS_SENT/APPLIED; About = aboutText present; Products (optional) = ≥1 product on the draft shop. Hours still uses the hub Hours app and, before Review, may show tag "From your links". `?app=services` and `?app=team` 303 to the real screens. `?app=about` rewrites to the materials window on the text card. Phase 3: card hides when all done or after "Dismiss" (stored per shop). Starter and non-hub shops keep today's card logic untouched.

## 6. Apps (window on desktop, sheet on mobile)

- Opened by `?app=<id>` (ids: `logo, photos, materials, hours, about, colours, messages, activity, setup, business, domain, payments, approve`). `materials` is **Add to your website** (A3): logo, shop photos, team photos, price list, other files, and the text card. `about` is an alias that opens `materials` with `item=text`. `setup` = list of the remaining detail apps (target of old `/details`). **Services, Team and Products are not apps** — they are the real admin screens at `/admin/services`, `/admin/team` and `/admin/products`.
- **Materials / text card fields** (autosave, do not consume a change round): About your shop (`aboutText`, ≤600), Instagram (`instagramUrl` — `@handle`, handle or instagram.com URL, stored as `https://www.instagram.com/<handle>/`), Anything else (`websiteExtraText`, ≤2000). Ops Files tab shows the same three fields plus last-updated; Astro interpolates them (escaped). Caption on an asset ≤140.
- **Labelled add actions (A1)** on the shared panels (hub and paid): `AdminAddButton` visible label "Add service" / "Add team member" / "Add product". Empty states: "Add your first …". `?add=1` opens the create sheet once, then is stripped. One interface — do not fork a panel for the hub.
- Desktop: centred window over a blurred scrim, max-width 1120px (messages 720px), radius 22px, title bar (icon, title, breadcrumb "Overview › …", optional action, close), scrollable body, sticky footer with the single primary action. Mobile: bottom sheet at full height minus top bar, grab handle, sticky footer. Materials uses a full-screen sheet below 640px.
- Behaviour: focus trap, `Esc` closes, back button closes (history entry per open), focus returns to the tile/row/Add trigger that opened it, `aria-modal`, title as `aria-labelledby`. View Transitions API morph from tile → window when supported and `prefers-reduced-motion` is not set; otherwise 160ms fade/scale.
- Content reuses existing islands: `HubYourShop` / `HubUploader` (materials), `HubReviewCards` (hours only — services/team review cards are retired; POSTing those kinds returns 410), `HubMessages` (messages page), activity feed. Restyle only; keep their logic and tests.

`/api/admin-hub/*` is a separate namespace from `/api/admin/*`. Hub-only visitors (valid `ks_hub`, no Better Auth cookie) never hit `HUB_ADMIN_API_ALLOWLIST` for these routes. Missing or invalid cookie → handler `404 { error: 'Not found.' }` (not the allowlist 403). Each handler binds to the cookie's PreviewRequest; a client `requestId` in the body is ignored.

## 7. Brand colours app (mockups 02, 07)

**Goal:** tell KERSIVO which colours the owner likes, before we design. It is input for the designer, not a theme switcher.

Layout desktop: three columns — (1) Your logo on dark + light tiles, "Found in your logo" list (chip, name, hex, bar showing share of logo), buttons "Pick from a photo" (EyeDropper API; hidden where unsupported) and "# Hex"; (2) two role cards **Main** and **Accent** (click a role, then click a swatch to assign), "Fine-tune" panel; (3) "How it looks on your site" live mini-site + contrast check. Footer: "Not sure? Let KERSIVO choose" link · "Save draft" · primary "Send colours to KERSIVO". Mobile: preview on top, swatch row, Main/Accent segmented control, sliders, sticky send button.

**Extraction (client-side, no upload needed beyond the logo already stored):**
1. Draw the logo thumbnail (≤256px) to canvas; for SVG/PDF use the server-rasterised PNG.
2. Drop pixels with alpha < 0.5. Convert to OKLab. k-means (k=6, k-means++ seeding, max 12 iterations, deterministic seed) → merge clusters with ΔE_OK < 0.06 → keep up to 5 by pixel share.
3. Name each swatch with a small fixed name table by hue/lightness (e.g. Teal, Brass, Ink, Cream, Red, Navy, Charcoal). Near-black (L<0.18) and near-white (L>0.94) or low-chroma (C<0.03) clusters are kept but labelled Ink/Cream/Grey and never auto-assigned as Main.
4. Default roles: Main = highest-share chromatic cluster; Accent = most hue-distant chromatic cluster with share ≥ 5%, else none. No chromatic colours → Main empty, show "Your logo is black and white — pick a colour or let us choose".

**Fine-tune:** sliders change only OKLCH **lightness** (Depth: Lighter ↔ Deeper) and **chroma** (Intensity: Muted ↔ Vivid) of the selected role; hue is locked to the shop's colour. Clamp to sRGB gamut (reduce chroma until in gamut). "Quick picks" = 7 lightness steps of the same hue. Hex input accepts #RGB/#RRGGBB. "Reset to logo" restores extracted values. Website background toggle: Dark / Light.

**Contrast check:** button text on Accent (white or #141414, whichever is higher) must reach 4.5:1; Main vs background ≥ 3:1. Pass → green "Text on your buttons is easy to read". Fail → amber "Hard to read on buttons" + one-tap "Make it deeper"/"Make it lighter" that moves lightness to the nearest passing value.

**Data (additive):** `PreviewRequest.brandPrimaryColour`, `brandSecondaryColour` (exist) + `brandBackgroundTone` (`DARK|LIGHT`, nullable), `brandColoursSource` (`LOGO|MANUAL|KERSIVO_CHOOSES`, nullable), `brandPaletteExtracted Json?` (≤5 `{hex, share}`), `brandColoursSentAt DateTime?`. "Save draft" writes values without `brandColoursSentAt`; "Send" sets it, writes event `BRAND_COLOURS_SENT`, shows in activity, and appears in ops (swatches + hex + source + tone, copy-to-clipboard per hex). Changing after sending is allowed until Launch (new event each time). Validation: hex regex, zod.

Copy (British English, final): title "Brand colours"; "Found in your logo"; "Main"; "Accent"; "Fine-tune main colour"; "Lighter / Deeper"; "Muted / Vivid"; "Quick picks"; "Website background"; "Dark / Light"; "How it looks on your site"; "This is a guide, not your final design. We'll build your website in these colours."; "Send colours to KERSIVO"; "Not sure? Let KERSIVO choose — we'll pick from your logo."; sent toast "Thanks — we'll use these colours for your website."

## 8. Website page (mockups 03, 05)

- Toolbar card: segmented **Website | Booking** and **Phone | Desktop** using the calculator's pill control (extract `.calc-segmented` into a shared `SegmentedControl` component + shared CSS; the calculator must render identically afterwards). Then test-bookings note, spacer, ghost "Open in new tab", outline "Suggest a change". Launch CTA moves to the page header as an outline button.
- Device default: Desktop ≥1024px, Phone <1024px; remember choice per viewer (localStorage, try/catch).
- **Desktop on any screen:** render the iframe at its true size (1280 × 800, or 1440 × 900 when the stage is wider than 1440) and scale it with `transform: scale(stageWidth / 1280)`; the wrapper height = frame height × scale, so there is no empty space and no horizontal scroll. Show a small badge "1280px · scaled to fit". On phones add "Full screen" (opens the preview in a new tab).
- Phone: 390 × 844 frame scaled down only when the stage is narrower than 390.
- Booking view uses the same device stage (BookingFlow in a 1280-wide or 390-wide container, scaled the same way).
- Pin mode (HUB_SPEC §10) is unchanged and still conditional.

## 9. Changes page

Existing `HubChanges` logic in the new shell: header "Changes", counters row (same as tile), list with page chip + status chip, composer as an app sheet ("Suggest a change"), sticky "Send changes to KERSIVO" footer. Locked before Review with the stage reason.

## 10. Quality bar
WCAG 2.2 AA; keyboard for everything (tiles, apps, sliders with arrow keys and `aria-valuetext` like "Depth 46%"); `prefers-reduced-motion`; no horizontal scroll at 360/390/768/1024/1280/1440; Lighthouse mobile on hub Overview ≥ 90 performance, ≥ 95 accessibility, CLS < 0.05; hub-mode JS for shell ≤ 90 KB gzip (apps lazy-loaded on open). Every app has loading / empty / error (retry) / success states.
