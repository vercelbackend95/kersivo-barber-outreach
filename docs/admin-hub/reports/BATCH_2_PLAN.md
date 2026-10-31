# Admin Hub — Batch 2 plan (red card + app windows)

Branch: `admin-hub-batch-2`, stacked on `admin-hub-batch-1`. Flag, cookie and `/admin` hub shell stay as Batch 1 left them. `ADMIN_HUB_ENABLED` stays off on Vercel. `PREVIEW_HUB_ENABLED` is not touched. No migration.

## Files

New
- `src/lib/adminHub/apps.ts` (+ test): app ids, titles, breadcrumbs, window width, parse helpers.
- `src/components/adminHub/AppHost.tsx` (+ test): `?app=` window/sheet, focus trap, Esc, history, focus return, View Transitions / 160ms fade-scale, lazy bodies.
- `src/components/adminHub/apps/*`: logo, photos, review (services/team/hours), about, setup, activity, launch (phase-2 items), messages wrapper.
- `src/styles/components/admin-hub-apps.css`: mockup 02/07/08 tokens (scrim, window, sheet).

Changed
- `src/lib/adminHub/setupCard.ts`: phase 2 (Launch · n of 4 / Let's put you live) + typed phase-3 stub. Phase 1 done rules unchanged.
- `src/components/adminHub/AdminHubSetupCard.astro`: the card is no longer one link; every row is an `<a href="/admin?app=…">`. Same `--conversion` family.
- `src/lib/adminHub/hubView.ts`: `parseAdminHubLocation` returns `section` + `app` (the section stays under the overlay). Load launch progress whenever the stage is launch (for the card).
- `src/pages/admin/hub.astro`: always render the section body; mount `AppHost` with the current app and island props.
- `src/components/previewHub/HubYourShop.tsx`: optional `focus` (`logo` | `photos` | `about`) and `chrome` so the logo/photos/about apps reuse the existing upload/autosave logic. Default = today's full page.
- `src/components/previewHub/HubReviewCards.tsx`: optional `only` section.
- `src/components/previewHub/HubLaunchChecklist.tsx`: optional `initialItem`, `embedded`, `websiteHref`, `bookingHref`. Defaults keep `/admin/preview-launch` as it is.

## App system

Ids: `logo, photos, services, team, hours, about, colours, messages, activity, setup` plus phase-2 `business, domain, payments, approve`. `colours` opens the logo app until Batch 4.

Desktop ≥1024: centred window, max 1120px (messages 720px), radius 22, title bar, scroll body, sticky footer slot. Mobile: bottom sheet under the top bar, grab handle. Focus trap, Esc, one `pushState` per open, back/`X` close, focus returns to the opener, `aria-modal` + `aria-labelledby`. View Transitions morph when supported and motion is allowed; otherwise 160ms fade/scale. Apps `React.lazy` on open.

## Setup card phases

- Phase 1 (requested/designing/review): existing six rows and done rules.
- Phase 2 (launch): Business details, Domain, Payments (Optional), Approve your website — done flags from `loadHubLaunchProgress` (migration is not on this card). Rows open the launch apps.
- Phase 3: typed stub only (`view-site`, `test-booking`, `retail`). Not rendered.

Copy from mockup 06 / spec §5. Mobile: first block on Overview.

## Launch apps vs full-admin APIs

`HubLaunchChecklist` talks to `/api/admin/preview-launch`, which needs a real owner session. Spec §2.3 forbids cookie-only access to full-admin APIs. So:

- Signed-in owner of this draft shop → live checklist (same logic, restyled in the window).
- Cookie-only or operator → read-only steps from `loadHubLaunchProgress`. Cookie-only owners see “Sign in to finish these steps.” Flagged in the report.

## Tests

- Done-rule unit tests per phase-1 and phase-2 step; phase by stage; phase-3 stub shape.
- `parseAdminHubLocation` app routing (section stays).
- AppHost: open from a link, Esc, back button, focus return, `aria-modal`.
- Axe on each app at 390 and 1440 in the real-stack Playwright file (screenshots to `docs/admin-hub/screens/batch-2/`).
