# Admin Hub — Batch 3 plan (Overview bento)

Branch: `admin-hub-batch-3`, stacked on `admin-hub-batch-2`. Flag, cookie, `/admin` shell and apps stay as Batch 2 left them. `ADMIN_HUB_ENABLED` stays off on Vercel. `PREVIEW_HUB_ENABLED` is not touched. No migration.

## Files

New
- `src/lib/adminHub/overview.ts` (+ test): view-model for the bento (now boxes, amber, locked tiles, colours summary, change counters, activity icons, header actions, step dates including “Today”).
- `src/components/adminHub/AdminHubOverview.astro` (+ source test): header + 12/6/1-col bento. Used only by `/admin/hub.astro`.
- `docs/admin-hub/screens/batch-3/` and this report.

Changed
- `src/pages/admin/hub.astro`: render `AdminHubOverview` instead of `HubOverview`. Old `HubOverview.astro` stays for the flag-off `/preview/{token}` path.
- `src/lib/adminHub/hubView.ts`: on Overview, also load the latest message and change items (counters + two latest).
- `src/lib/freePreview/hubMessages.ts`: `loadLatestHubMessage`.
- `src/lib/adminHub/copy.ts`: tile titles, colours status, unread count, change foot, “Today”.
- `src/styles/components/admin-hub.css`: tile DNA (mockup tokens), grid, header, skeletons, messages-app chrome.
- `src/components/freePreview/PreviewTopBar.tsx`: new `chrome="checkout-outline"` for the header launch button (old `checkout` chrome unchanged).
- `src/components/previewHub/HubMessages.tsx` + `MessagesApp.tsx`: optional `chrome="app"` — hide the page H1, sticky composer inside the 720px window / sheet.
- `src/components/adminHub/AdminHubShell.astro`: mobile setup card moves into Overview (header → actions → card → bento, matching mockup 04).
- `scripts/preview-hub/seed-real.ts`: one KERSIVO message + two draft changes on the READY shop (QA only; no Northgate copy).
- `scripts/admin-hub-real.spec.ts`: tile states, links, unread/badge, axe 390/768/1440, screenshots.

## Approach

1. **Progress tile is not a link** (spec §4 table). Activity is a quiet section; “Show all” is the only link (`?app=activity`).
2. **Linkable tiles** (`colours`, `messages`, `changes` when unlocked) are a single `<a href>` so they work without JS.
3. **Preview tile** cannot nest two destinations inside one `<a>`. It is an `<article>` with a stretched hit to `?section=website` and two real sibling links (Open website / Try booking). Locked before Review.
4. **Colours** open `?app=colours` (still the logo app until Batch 4). No invented palette: show stored Main/Accent hex if present; status is always “Not sent yet” until Batch 4 fields exist. No “N colours found in your logo”.
5. **Phone thumbnail**: CSS composition (logo or initials on brand colour). There is no server screenshot in the schema — no iframe, no mock “Northgate” site copy.
6. **Header**: one primary from `HUB_PRIMARY` + outline “Launch this website £39/month” (`PreviewTopBar` checkout-outline) when `canCheckout`. Desktop right; mobile 2-up under the header. The old stacked `HubOverview` red+secondary pair is not used in `/admin`.
7. **Stage variants**: Requested/Designing lock preview + changes; Launch right box is *Our steps*; Expired/Declined replace the bento with a calm full-width card (§9.2 copy).
8. **Performance**: SSR tiles, reserved min-heights, image width/height, no overview island except the checkout button. Lighthouse mobile on seeded Overview.

## Risks

- Nested interactive controls vs “whole tile is an `<a>`” — resolved as in (2)–(3).
- Colours tile cannot match mockup 01’s four extracted swatches until Batch 4.
- Lighthouse against the QA server needs the hub cookie; extra-headers Cookie on the `/admin` URL.
