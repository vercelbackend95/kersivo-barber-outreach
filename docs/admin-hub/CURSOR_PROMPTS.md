# Cursor prompts — KERSIVO Admin Hub (hub moves into /admin)

Run the batches in order, one PR each. Paste the GLOBAL RULES block at the top of every batch.
Before Batch 1: copy the whole `docs/admin-hub/` folder from the pack (spec, prompts, `mockups/`) into the repo.

---

## GLOBAL RULES (paste at the top of every batch)

```
[GLOBAL RULES — KERSIVO Admin Hub]
Source of truth: docs/admin-hub/ADMIN_HUB_SPEC.md (layout, routing, colour picker, website page) + docs/preview-hub/HUB_SPEC.md (data model, uploads, security, retention, emails, ops, analytics, copy rules) where ADMIN_HUB_SPEC does not override it.
Visual target: docs/admin-hub/mockups/*.png. Open mockups/html/*.html in a browser for exact spacing; mockups/html/styles.css holds the tokens used. Match them closely; where the real app's existing admin components already do the job (sidebar link, launch CTA, buttons, inputs), reuse them and adjust styles rather than duplicating. "Northgate Barbers" is mock data — never ship it.
Read CLAUDE.md first and follow it (branch per batch, British English for all UI copy, no invented claims, claims:check, WCAG 2.2 AA, reduced motion, no horizontal scroll).
Everything new is behind ADMIN_HUB_ENABLED (server-only). With the flag off, behaviour must be byte-for-byte what it is today. Do not set the flag on Vercel until Batch 6 says so. Never touch PREVIEW_HUB_ENABLED in production — the old /preview hub launch (old Batch 7 part D) is CANCELLED; this work replaces it.
DATABASE_URL on Vercel serves Production AND Preview: migrations must be additive only; never run destructive scripts against it.
Existing Starter, direct-subscribe and paid shops without a preview request must see the current admin exactly as today (add regression tests).
Every batch ends with: npm test, npm run typecheck, npm run claims:check, npm run build all green; Playwright screenshots of every touched screen at 390 and 1440 (plus 768 and 1280 where layout changes) saved to docs/admin-hub/screens/batch-N/, each placed next to the matching mockup in docs/admin-hub/reports/BATCH_N_REPORT.md with a short "differences from mockup" list; open a PR, wait for CI + Vercel preview, do not merge.
If anything in the spec conflicts with what the code can safely do, stop and write the question in the report instead of guessing.
```

---

## Batch 1 — Foundation: hub session bridge + /admin hub-mode shell

```
[GLOBAL RULES]

BATCH 1 — Move the hub's engine into /admin. No new features yet; existing hub content renders inside the new shell.

1. Read: src/pages/admin.astro, src/components/admin/AdminPanel.tsx, AdminLayout.tsx, AdminSidebarLaunchCta.tsx, src/lib/auth.ts, src/lib/freePreview/hubApi.ts, hubStage.ts, hubPage.ts, src/pages/preview/[token].astro and src/pages/preview/[token]/*, src/pages/api/preview-hub/[token]/*. Write docs/admin-hub/reports/BATCH_1_PLAN.md (files, approach, risks) before editing.

2. Hub session bridge (ADMIN_HUB_SPEC §2.2):
   - src/lib/adminHub/hubSession.ts: sign/verify `ks_hub` (v1.<previewRequestId>.<expUnix>.<hmac>, HMAC-SHA256, key = HKDF(auth secret, "ks-hub-v1")), constant-time compare, max age = min(30 days, preview expiry). Unit tests: tamper, expiry, wrong version, operator flag.
   - /preview/{token} (and its sub-routes) when ADMIN_HUB_ENABLED: valid visible token → set cookie → 303 to the mapped /admin URL (map in §2.2). Operators get the op-flag cookie and the "Viewing as KERSIVO" banner; owner-view analytics never fire for them. REJECTED/unknown → unchanged 404; EXPIRED → cookie + /admin shows the expired state. /no-thanks unchanged.
   - Shared resolver resolveHubContext({ token } | { cookie }) used by both /api/preview-hub/[token]/* (unchanged behaviour) and a new /api/admin-hub/* namespace that mirrors every existing hub endpoint 1:1 using the cookie. Same flag → rate limit → resolve → stage capability → zod → action → event pipeline. Same-origin checks on POST/PATCH/DELETE.
   - Headers on /admin (all modes) and /api/admin-hub/*: X-Robots-Tag noindex, nofollow; Referrer-Policy no-referrer; Cache-Control private, no-store. Test them.
   - Precedence rules from §2.1–2.3. Test: with only ks_hub, a sample of full-admin endpoints (bookings, clients, settings, team, retail) return 401/403.

3. /admin hub mode shell (§3), server-decided in admin.astro (no flash of the full admin):
   - Desktop sidebar exactly as mockups 01/03: wordmark, shop chip (logo or initials), stage pill, group "YOUR WEBSITE" with Overview / Changes (badge) / Website, spacer, red setup card slot (placeholder in this batch: reuse AdminLaunchCtaButton with the phase-1 title and a static list), private label, account row with "Leave preview" (clears cookie → /).
   - Mobile: top bar (wordmark, shop name, stage pill, messages icon + unread dot) and 3-tab bottom bar (mockups 04/05).
   - Sections via ?section=overview|changes|website (default overview). Temporarily render the existing HubOverview / HubChanges / HubWebsiteView content inside the new shell so nothing is lost while Batches 2–5 rebuild them.
   - Old hub shell (HubShell.astro) stays only for the flag-off path.

4. Tests: bridge redirects (every old sub-route), cookie security attributes, expired/declined/rejected paths, operator path, flag off = old behaviour, hub-mode render for each stage, full admin unchanged for a normal paid shop and a Starter shop.

Acceptance: a seeded REQUESTED and READY request can be opened from their email link and land on /admin with the new shell at 390 and 1440; the token never appears in /admin HTML (assert in test).
```

---

## Batch 2 — Red setup card (3 phases) + app window/sheet system + shop-detail apps

```
[GLOBAL RULES]

BATCH 2 — The red card and the "apps" that it opens. Visual targets: mockups 06 (card states), 02/07 (window/sheet frame), 08 (window frame).

1. App system (§6): src/components/adminHub/AppHost.tsx reading ?app=<id>; desktop centred window (max 1120px; messages 720px), mobile bottom sheet; title bar with icon/title/breadcrumb/close; sticky footer slot; focus trap, Esc, back button closes (one history entry per open), focus return to opener, aria-modal + aria-labelledby; View Transitions morph when supported and motion allowed, else 160ms fade/scale; apps lazy-loaded on open. Loading/empty/error(retry)/success states.

2. Shop-detail apps, reusing existing islands (restyle only, keep logic + tests):
   - logo → HubUploader (LOGO), shows logo on dark/light tiles
   - photos → HubUploader (SHOP_PHOTO) + second section "Price list" (PRICE_LIST)
   - services / team / hours → HubReviewCards sections; before Review show the "We'll fill these from your links…" state from §5
   - about → aboutText (≤600 chars, autosave "Saving…" → "Saved")
   - setup → list of the six above with their state (target of old /details)
   - activity → full activity feed

3. Red setup card component (§5), same family as AdminLaunchCtaButton --conversion: status, title, white progress bar, checklist with done discs / to-do circles, next item highlighted with →, "Optional" and "From your links" tags, every row a link to its app. Phases:
   - Phase 1 (hub, preview stages): Logo, Shop photos, Services & prices, Team, Opening hours, About your shop — done rules in §5.
   - Phase 2 (hub, Launch stage): Business details, Domain, Payments (Optional), Approve your website → existing launch checklist items, restyled inside the hub shell (keep HubLaunchChecklist logic).
   - Phase 3 is built in Batch 6 — leave a typed stub.
   Copy exactly as in mockup 06 / spec §5. Mobile: card is the first block on Overview.

4. Tests: done-rule unit tests per step, card phase by stage, app routing/back-button/focus tests, axe on each app at 390 and 1440.
```

---

## Batch 3 — Overview bento

```
[GLOBAL RULES]

BATCH 3 — Rebuild Overview as the bento in mockup 01 (desktop) and 04 (mobile). Spec §4.

1. Tile component (radius 20, #0D0D0E→#080809, 1px rgba(255,255,255,.08), inset highlight, deep shadow, 1px red→transparent top line; header icon chip + uppercase eyebrow + ↗ circle; hover/focus lift and red ↗). Whole tile is an <a href> to its app/section, so it works without JS.
2. Tiles: Your website build (5-segment bar, labels, dates, "What we're doing" / "What we need from you" — amber when the owner has something to do; stage copy from HUB_SPEC §9.2), Your preview (static phone thumbnail — server screenshot if available, else CSS composition with logo/initials on brand colours; locked before Review; "Open website" / "Try booking"; no iframe), Brand colours (summary + status pill; opens ?app=colours — the app itself is Batch 4, until then it opens the logo app), Messages (latest message, unread count; opens ?app=messages with HubMessages restyled as an app, 720px window / full sheet, composer sticky), Changes (counters + 2 latest + round info), Activity (latest 5, "Show all" → ?app=activity).
3. Grid: 12 cols ≥1280 (placements in §4), 6 cols 768–1279, 1 col <768 in the order in §4. Stage variants for Requested/Designing, Launch, Expired/Declined.
4. Header: one primary ("Open your preview") + outline "Launch this website £39/month" (desktop right, mobile 2-up under the header). Remove the duplicate red button from today's Review header.
5. Performance: no layout shift (reserve tile heights), skeletons per tile, Lighthouse mobile ≥90/≥95, CLS <0.05 on seeded data. Report the numbers.
6. Tests: tile states per stage, links, unread/badge counts, axe 390/768/1440.
```

---

## Batch 4 — Brand colours app

```
[GLOBAL RULES]

BATCH 4 — Build the Brand colours app exactly as spec §7 and mockups 02 (desktop) / 07 (mobile).

1. src/lib/adminHub/colour/: pure TS, no dependencies unless one is already in the repo — sRGB↔linear↔OKLab↔OKLCH, ΔE_OK, gamut clamp (reduce chroma), WCAG contrast, k-means (k=6, k-means++ with fixed seed, ≤12 iterations), cluster merge (ΔE_OK < 0.06), naming table, default role assignment, lightness steps for quick picks. Unit tests with fixed fixtures: two-colour logo, black-and-white logo, transparent PNG, logo with gradient, very small logo; contrast pass/fail and auto-fix ("Make it deeper/lighter" moves lightness to nearest passing value).
2. Extraction runs client-side in a Web Worker on the stored logo thumbnail (SVG/PDF → use the server-rasterised PNG). Must finish < 150 ms on a mid-range phone for a 256px image; show a skeleton meanwhile.
3. UI: three columns desktop / stacked sheet mobile as in the mockups; role cards (Main, Accent) + click-a-swatch assignment; sliders (Depth = OKLCH L, Intensity = C; hue locked) with keyboard arrows, aria-valuetext; quick picks (7 steps); hex input; EyeDropper "Pick from a photo" only where supported; Website background Dark/Light; live mini-site preview; contrast check row; footer: "Let KERSIVO choose" link, "Save draft", primary "Send colours to KERSIVO". Copy exactly from §7.
4. Data (additive migration): brandBackgroundTone, brandColoursSource, brandPaletteExtracted (Json, ≤5 {hex, share}), brandColoursSentAt. Endpoint PATCH /api/admin-hub/brand-colours (+ token twin) with zod (hex regex, enum), stage capability until Launch, event BRAND_COLOURS_SENT on send, activity entry, analytics hub_brand_colours_sent (no personal data).
5. Ops: request workspace Overview shows the swatches with hex, role, source, tone, sent time, copy-to-clipboard per hex.
6. Overview tile now opens this app and shows Not sent yet / Sent / Using KERSIVO's choice.
7. Tests: API validation + capability by stage, worker integration (jsdom canvas mock), UI interaction tests, axe 390/1440.
```

---

## Batch 5 — Website page + Changes page

```
[GLOBAL RULES]

BATCH 5 — Website (mockups 03 desktop, 05 mobile) and Changes page. Spec §8–9.

1. Extract the calculator pill control (.calc-segmented in src/styles/components/barber-cost-calculator-tool.css, used by CostCalcPanel.astro and CostResults.astro) into a shared SegmentedControl (Astro + React variants, shared CSS: black track, pill radius, active = light fill + inset red underline, focus ring). Switch the calculator to it with zero visual change — prove it with before/after screenshots of /barber-software-cost-calculator at 390 and 1440.
2. Website toolbar card: SegmentedControl Website|Booking (icons), SegmentedControl Phone|Desktop (icons), test-bookings note, spacer, ghost "Open in new tab", outline "Suggest a change". Launch CTA moves to the page header as outline. Mobile: two full-width segmented controls stacked, then the stage, then "Full screen" + "Suggest" 2-up.
3. Fix desktop view on small screens: iframe rendered at true size (1280×800; 1440×900 when the stage is wider than 1440), scaled with transform to the stage width, wrapper height = frame height × scale, badge "1280px · scaled to fit". Phone frame 390×844 scaled only when the stage is narrower. Same stage for Booking (BookingFlow in a 1280- or 390-wide container). ResizeObserver; no horizontal scroll at any width; default device by width, remembered per viewer (localStorage in try/catch).
4. Changes page in the new shell: header, counters, list with page + status chips, "Suggest a change" opens the composer as an app sheet, sticky "Send changes to KERSIVO" footer, locked state before Review. Keep HubChanges logic and tests.
5. Tests: scale maths unit test (widths 360, 390, 768, 1024, 1280, 1600), device toggle, keyboard on segmented controls, axe; screenshots of Website (phone + desktop mode) at 360, 390, 768, 1440 and Booking at 390/1440.
```

---

## Batch 6 — Post-payment card in the real admin, real-stack QA, production switch

```
[GLOBAL RULES]

BATCH 6 — Phase 3 card, end-to-end QA on the real stack, then turn ADMIN_HUB_ENABLED on in production.

1. Phase 3 red card in the FULL admin for shops that came through a preview and are live (§5): "YOU'RE LIVE · n OF 3" / "Get the most from KERSIVO": View your website (opens the live site in a new tab, marks done), Make a test booking (/admin/test-book — find how that flow marks a completed test booking; reuse it, otherwise store testBookingCompletedAt when it completes), Set up retail (Optional; done when the existing retail onboarding is complete). Card hides when all done or after "Dismiss" (store nextStepsDismissedAt per shop). Replace today's "paid → hide CTA" only for these shops; Starter and other paid shops keep current behaviour (regression tests).
2. Real-stack Playwright suite (reuse scripts/preview-hub-real.* if it exists, otherwise create it per old Batch 7 part A: local Postgres with a localhost guard, seed, fake only blob/Resend/Stripe/operator-auth boundaries). Journey: request → email link → /admin hub (Requested) → upload logo + photos → colours extracted, tuned, sent → ops sees colours → READY: bento, website desktop-on-phone, confirm services, draft + send changes → checkout stub → login → Launch phase card → approve → ops marks live → full admin with phase-3 card → test booking → card shows 2 of 3. Negative: rejected/unknown token 404, tampered cookie, cookie-only access to full-admin APIs 401/403, flag off = old behaviour.
3. Old Batch 7 part C hardening items (retention of never-ready requests, orphan attachments, transactional review apply, real body-size cap, SVG sanitising, payment on rejected request) — implement any that are not already on main; list which were already done.
4. Final screenshots at 360, 390, 768, 1280, 1440 for every hub screen and app, side by side with mockups in BATCH_6_REPORT.md. Lighthouse mobile numbers for /admin hub Overview and Website.
5. After merge and a READY production deployment: set ADMIN_HUB_ENABLED=true for Production only, redeploy, smoke test on kersivo.co.uk with the founder's email (ask for it; do not invent one): request "KERSIVO Test Shop" → email link → /admin hub → upload logo → send colours → message → ops reply → headers check (noindex, no-referrer, private) → no runtime errors → reject the test request. If any step fails: unset the flag, redeploy, report with logs. If you lack Vercel CLI access, stop and tell the founder exactly what to set.
```
