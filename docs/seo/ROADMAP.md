# KERSIVO SEO/CRO roadmap — remaining batches

Status as of 28 October 2026. Production = `main` @ `2811007`.
Source plan: "KERSIVO Sitewide SEO, CRO & Quality Implementation Plan" (task IDs like P1-11 refer to it).
Commercial source of truth: Commercial Offer v2.0 (founder decisions FD01–FD12) and `src/lib/pricing/claimsPolicy.ts`.

## Done

| Batch | PR | Changelog |
|---|---|---|
| 1 — commercial truth & safety | #128 | `docs/seo/batch-1-changelog.md` |
| 2 — brand trust, shared footer, measurement tag, QR Kit for Full | #128 | `docs/seo/batch-2-changelog.md` |
| 3 — Full-first homepage + `/pricing`, deferred demo widgets, FAQ/JSON-LD | #129, #130 | `docs/seo/batch-3-changelog.md` |
| 4 — comparison engine: shared CTAs, `/compare` answer + FAQ, tier-1 titles/PAA, calculator worked examples | #132 | `docs/seo/batch-4-changelog.md` |
| 5 — cluster & content linking: `/starter` free qualifier + Full fit box, online-booking breadcrumb/payment flows/intent chooser, design page trim, Insights link budget + category links | #135 | `docs/seo/batch-5-changelog.md` |
| 6 — technical hygiene: vercel.app → apex, trailing-slash 308, asset/font cache headers, client Sentry off, no ClientRouter on marketing, AI crawler groups, a11y (100/100/100/97) | #136 | `docs/seo/batch-6-changelog.md` |
| 7 — optional: `/llms.txt`, square 512px logo in schema, homepage FAQPage in the main @graph | #138 | `docs/seo/batch-7-changelog.md` |

Production Lighthouse after Batch 3: `/` mobile 96 (LCP 2.4 s, CLS 0), desktop 100; `/pricing` mobile 98, desktop 100.

## Remaining

| Batch | Name | Size | Priority |
|---|---|---|---|

### Batch 4 — Comparison engine (P1-11, P2-04, P2-06, P2-07, P2-09, P2-15) — DONE, see `docs/seo/batch-4-changelog.md`
Pages: `/compare`, `/barber-software-cost-calculator`, 10 alternatives (`booksy`, `fresha`, `treatwell`, `nearcut`, `vagaro`, `timely`, `phorest`, `square-appointments`, `squire`, `setora`).

1. **One shared closing CTA.** Today there are 11 near-identical files (`src/components/*Alternative/*FinalCta.astro`, `alternativesHub/HubFinalCta.astro`) that lead with "Start KERSIVO Starter" + "Compare Starter and Full". Replace them with one component:
   - H2 "Ready to move your bookings onto your own website?"
   - primary **Start Full KERSIVO — £39/month** → `/admin/launch` (`saas_subscribe_click`)
   - text link "Only need bookings for up to 4 barbers? Start on Starter (£0/month) →" `/starter`
   - text link "Ask us about switching from {Competitor} →" `#contact`
2. **Hero CTAs** on every comparison page: primary "See Full KERSIVO pricing" → `/pricing#plan`, secondary "See it working" → `/demo`.
3. **`/compare` flagship:** 3-sentence direct answer under the H1 ("There's no single best system for every UK barbershop. If marketplace discovery brings you most new clients, Booksy, Fresha or Treatwell may suit you. If you want clients to book on your own website and domain for one flat price per location, that's what Full KERSIVO is built for."); keep methodology and "not an independent ranking" disclosure; add FAQ "Booksy or Fresha: which is better for a barbershop?" (neutral, sourced); title `Best Barber Booking Software UK: 11 Systems Compared`.
4. **Tier-1 alternatives** (Booksy → Treatwell → Fresha → Nearcut): read the page first; team-size cost table where missing (Fresha per member, Treatwell commission example); honest "When {competitor} may suit you better" block; answer PAA questions from official sources ("Is Fresha no longer free?", "How much does Treatwell charge?", "Can clients book Booksy without the app?"); Booksy page: "KERSIVO has no customer app; clients book in the browser" objection. Titles: `Booksy Alternative UK: No Per-Barber Fees | KERSIVO`, `Treatwell Alternative UK: No New-Client Commission | KERSIVO`, `Fresha Alternative UK: Own Website & Flat Price | KERSIVO`.
5. **Tier-2 alternatives:** shared fixes only (CTAs, dated sources); title tweaks only where already top-10.
6. **Calculator:** remove or finish the unfinished "Worked examples" text (`src/lib/seo/barberCostCalculatorPage.ts` ~line 537: "Scenario figures will be generated…"); preferred = generate the four scenarios from the engine and publish them as static tables; add the Full closing CTA.
7. **Competitor facts:** every price must come from the `src/lib/seo/*Facts.ts` files with a checked date; re-verify against the official UK page before changing any figure (90-day freshness rule).

### Batch 5 — Cluster & content linking (P2-02, P2-03, P2-10, P2-11, P2-12) — DONE, see `docs/seo/batch-5-changelog.md`
- `/starter`: title `Free Barber Booking System UK – £0/Month | KERSIVO Starter`; "free" always next to the £5 deposit / Stripe qualifier; "When Full is the better fit" box.
- `/barbershop-online-booking`: breadcrumb Home › Online booking (not under websites); show both payment flows (Starter vs Full) in the main walkthrough; intent-based plan chooser.
- `/barbershop-website-design`: trim sales blocks to one closing block linking `/barbershop-websites`; commercial anchors always point to `/barbershop-websites`.
- Insights: 1–2 contextual product links + one end box per buyer-adjacent article (max 3 commercial links per article; none forced into off-buyer articles); category intros link the relevant product page.
- Verify Article (author = Organization KERSIVO, no Person) and BreadcrumbList JSON-LD on one article and one inner page.

### Batch 6 — Technical hygiene (P3) — DONE except static HTML, GSC 404s and server-side signup_completed (founder input), see `docs/seo/batch-6-changelog.md`
- Redirect `kersivo-barber-outreach.vercel.app` → apex (first confirm no Stripe webhook, cron or OAuth callback uses that host; `vercel.json` has 9 crons).
- Trailing-slash 308s; delete the dead `www` rule in `vercel.json` if Cloudflare handles it.
- Long-lived cache headers for hashed `/_astro/*` and fonts.
- Static or edge-cached marketing HTML (homepage no longer needs the database).
- Client Sentry: remove from marketing pages or configure DSN.
- ClientRouter (view transitions) on marketing pages: restored in BATCH A. One `page_view` per client-side navigation measured with real gtag.js (collect hits stubbed); it relies on GA4 enhanced measurement's history setting. Still to confirm in GA4 DebugView on production.
- `robots.txt`: explicit AI-crawler groups; do not use robots for `/seo-growth` (it must stay public for Google OAuth verification).
- GSC 404 export → 301/410 old pre-September URLs; `barberdemo.kersivo.co.uk` cleanup.
- Accessibility: contrast on red buttons, skip link, focus ring (target a11y ≥ 95).
- Server-side `signup_completed` (Starter account created) — currently defined but never fired.

### Batch 7 — Optional — DONE except sameAs URLs, H2 typeface, nav (founder input), see `docs/seo/batch-7-changelog.md`
`/llms.txt`, square 512px logo for schema/OG, Facebook vanity URL in `sameAs`, one display typeface for H2s, nav simplification (only with GA4 click data), merge FAQPage into the main `@graph`.

## Small leftovers
- New OG image (no "ZERO COMMISSION"; needs a design).
- Virtual office address → `LEGAL_OPERATOR_SERVICE_ADDRESS` in `src/lib/legal/businessIdentity.ts` (footer line appears automatically).

## Founder actions (outside code)
- GA4: key events `saas_subscription_paid`, `setup_enquiry_submit`; Data filter "Internal traffic" → Active; visit `/?internal=1` once per own device.
- Search Console: request indexing for `/`, `/pricing`, `/barbershop-websites`.
- Off-site (not in this roadmap, high value): directory listings (Capterra/GetApp, G2, etc.) to fix the brand SERP.
