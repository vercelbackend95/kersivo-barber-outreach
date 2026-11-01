# Admin Hub — Batch 5 plan (Website + Changes)

Spec: `ADMIN_HUB_SPEC.md` §8–9. Visual: mockups 03 (desktop Website) and 05 (mobile desktop-mode). Branch `admin-hub-batch-5` from `admin-hub-batch-4`.

## Files

New
- `src/styles/components/segmented-control.css` — extracted `.calc-segmented` (black track, pill, inset red underline, focus ring) plus link/button active aliases.
- `src/components/ui/SegmentedControl.astro` + `.tsx` — shared control. Calculator keeps the same radio + span markup.
- `src/lib/adminHub/previewStage.ts` — frame size, scale, wrapper height, badge (pure).
- `src/components/previewHub/useHubChanges.ts` + `HubChangeComposer.tsx` — HubChanges logic extracted; existing UI and tests stay.
- `src/components/adminHub/AdminHubWebsite.tsx` — toolbar, scaled stage, Booking stage, suggest sheet.
- `src/components/adminHub/AdminHubChanges.tsx` — header, counters, chips, sticky send, composer sheet.
- `src/components/adminHub/AdminHubSheet.tsx` — app-window / bottom-sheet chrome reused from AppHost styles.

Changed
- `CostCalcPanel.astro`, `CostResults.astro` — switch to Astro SegmentedControl.
- `barber-cost-calculator-tool.css` — drop the inlined block; `@import` the shared file.
- `src/pages/admin/hub.astro` — Website / Changes / locked states use the new pages.
- `admin-hub.css` — toolbar, stage, changes list, sticky footer, mobile 2-up.
- `hubCopy.ts` / `adminHub/copy.ts` — Website header, Full screen, scaled badge.
- `scripts/admin-hub-real.spec.ts` — batch 5 shots + axe + device toggle.
- `lucide-react.tsx` — Monitor + ExternalLink for the toolbar.

Not touched
- `PREVIEW_HUB_ENABLED`, Vercel flags, `HubWebsiteView` (flag-off `/preview` path), HubChanges tests (same default UI), pin mode, migrations.

## Approach

1. Extract the pill with **identical class names and rules** so the calculator is byte-for-byte the same visually. Prove with before/after shots of `/barber-software-cost-calculator` at 390 and 1440.
2. Website toolbar: Website|Booking (links, icons) and Phone|Desktop (buttons, icons). Launch CTA (`checkout-outline`) moves to the page header. Mobile: stacked full-width segs → stage → Full screen + Suggest 2-up.
3. Scale: iframe (or BookingFlow box) at 1280×800, or 1440×900 when stage > 1440; `transform: scale(stageWidth / frameWidth)`; wrapper height = frame height × scale. Phone 390×844, scale only when stage < 390. ResizeObserver. Device default by width (≥1024 desktop), remembered in `localStorage` (`ks_admin_hub_website_device`) inside try/catch.
4. Changes: reuse `overviewChanges` counters and chips; composer opens `AdminHubSheet` (same visual as apps); sticky send footer; locked before Review with the existing reason. HubChanges logic stays in the hook.
5. Tests: scale maths at 360/390/768/1024/1280/1600; device toggle + keyboard on SegmentedControl; axe on Website and Changes at 390/1440.

## Risks

- Calculator JS keys off `[data-calc-period] input[name="period"]` — the Astro control must keep those attributes.
- `DATABASE_URL` is shared — no migration this batch.
- Flag off = today’s `/preview` hub unchanged (`HubWebsiteView` / `HubChanges` still mounted there).
- QA preview URL may 404 inside the iframe; stage chrome still has to scale and not scroll sideways.
