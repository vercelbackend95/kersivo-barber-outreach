# Batch 2 changelog — brand, trust, measurement

Branch: `seo/batch-2-brand-trust`. `CURRENT_TERMS_VERSION` is `2026-10-27`. `CURRENT_DPA_VERSION` stays `2026-10-06`. `ACCEPTED_PRIOR_TERMS_VERSIONS` includes `2026-10-06`.

## Task 1 — one shared footer

- Added `src/lib/nav/footerNavigation.ts` with Product, Compare, Resources and Legal columns, plus the Full KERSIVO product CTA to `/admin/launch`.
- `footer50.astro` always renders those columns. Page-level `navigation` and `legal` props are ignored so `/seo-growth` was not edited and still typechecks.
- Footer grid: 4 columns, 2 at ≤768px, 1 at ≤420px.
- `LEGAL_OPERATOR_SERVICE_ADDRESS` is `null`. The trading-name line is not rendered. `footerTradingNameLine` is unit-tested for both states.

## Task 2 — legal pages on the marketing layout

- `/terms`, `/privacy`, `/cookies` and `/dpa` use `LandingLayout`. Body copy, anchors, indexable state, canonicals, JSON-LD and `legal-pages.css` stay.
- Titles end `| KERSIVO`. `SITE_NAME` is `KERSIVO`, so `og:site_name` is KERSIVO. `PAGE_DESCRIPTIONS` use KERSIVO. JSON-LD `alternateName` was not changed.

## Task 3 — `/#pricing` links

- Cross-page pricing links now go to `/pricing`. The homepage `#pricing` id is unchanged.
- Remaining `/#pricing` matches are test fixtures that assert the hash is not used, or hash-navigation cases.

## Task 4 — compact header button

- Below the desktop nav, a compact primary button uses the same href and `data-track` as the resolved primary action. The anonymous label is `Get started`. Session labels keep their wording, without a `— £NN/month` suffix.
- Measured at 320px and 375px: label `Get started`, 44px tall, one row, no horizontal overflow. At 1440px the compact button is hidden and the desktop actions show `Get started — £39/month`.

## Task 5 — cookie banner height

- Before: banner inner height 268px on 375×812 (33.1%) and 269px on 390×844 (31.9%).
- After tighter mobile spacing and type: 187px (23.1% of 812) and 187px (22.2% of 844). Accept and Reject stay 44px tall. Consent copy, cookie names and Consent Mode are unchanged.

## Task 6 — contact form

- Only email is required in the form and in `POST /api/contact`. Optional fields keep their max lengths. The honeypot still blocks. Empty optionals are sent as “Not provided”.
- Submit control is `btn btn--primary`. Under it: “We’ll reply by email to the address you enter.” Success copy no longer says “shortly”.

## Task 7 — QR Kit on Starter and Full

- `FREE_BOOKING` and `FULL_KERSIVO` can request one kit. `SETUP` is `PLAN_NOT_ELIGIBLE`.
- `SAAS_CHECKOUT` counts as a qualifying terms acceptance, as do the existing Starter acceptances.
- A second request after a plan change does not create another kit (`shopId` lookup runs before eligibility).
- Public claim, pricing lists, Starter FAQ, starter scene, Terms `QR Kit` opening sentence and the Privacy sentence now say Starter or Full. The rest of the Terms paragraph is unchanged.
- New acceptances record `2026-10-27`. `2026-10-06` remains accepted. The DPA version was not bumped.

## Task 8 — About

- Full is listed before Starter. Last updated `2026-10-27` / 27 October 2026.
- Added How setup works, Support and contact, and Your data and leaving. The website-update sentence reuses `WEBSITE_UPDATE_SUPPORT_CLAIM`. No founder, team or address was added.

## Task 9 — SMS allowance and setup time

- Landing rate-card line now says email confirmations plus SMS appointment reminders within a monthly allowance.
- Pricing36 landing anchors now say the site is typically ready 1–2 weeks after all required information is received. Those cards are not rendered while `SHOW_SETUP_PLAN_CARDS` is false.
- Plan cards and FAQ answers that listed KERSIVO SMS reminders now say “within a monthly allowance”. No allowance number or price was added.
- Short comparison cells left as they are, because the same page already states the allowance elsewhere or the cell is a comparison label rather than a plan promise: `squareFacts.ts`, `treatwellFacts.ts`, `vagaroAlternativeContent.ts`, `timelyFacts.ts`, `setoraFacts.ts`, `nearcutFacts.ts`. Phorest, Squire and the Square FAQ already say the allowance applies. `PLAN_SCOPE_FULL_LIST` in Terms stays, next to the existing monthly-allowance clause.

## Task 10 — internal traffic

- `?internal=1` sets `kersivo_internal=1` (`Path=/`, one year, `SameSite=Lax`, `Secure` on https) and `history.replaceState` removes the parameter. `?internal=0` clears it.
- The inline `gaConfig()` adds `traffic_type: 'internal'` when the cookie is `1`. The same rule is unit-tested in `src/lib/analytics/internalTraffic.ts`.
- Canonicals are built from the page path, so the query is not in the canonical URL.
- The cookie policy already named the consent cookie, so the Necessary section now names `kersivo_internal`.

## Task 11 — unused components

- Deleted `src/components/compare3Table.astro` and `src/components/hero/HeroHeadlineLines.tsx`. Nothing else imported them.
- `compare3.css` stays (used by `pricing36.tsx` and `LaunchWizard.tsx`). `hero227.css` stays (used by `facebook-cover.astro`).

## Verification

- `npm run claims:check` passed.
- `npm test`: 6 failures in the full run. Five were footer/layout assertions and were updated to the shared footer and `LandingLayout`. Re-run of those files passed. `financialEndpoints.test.ts` “rejects MANAGER with 403” timed out at 5000ms in the full run and passed alone in about 2.8s.
- `npm run typecheck`: 0 errors, 0 warnings, 216 hints.
- `npm run build` completed. The first attempt failed because the dev server locked the Prisma query engine. After stopping the dev server, the build finished in about 32 seconds.
- Browser check on the dev server: shared footer columns on `/`, `/pricing`, `/starter`, `/about`, `/compare`, `/booksy-alternative`, `/barbershop-online-booking`, `/terms`, `/privacy` and `/insights/google-reviews-barbershop-uk-rules`. No footer link to `/#pricing`, `#home` or `#paths`. No trading-name line. Legal titles end `| KERSIVO`. `og:site_name` is KERSIVO. `/terms` shows Last updated: 27 October 2026. About shows the three new sections. `/?internal=1` set the cookie and `/?internal=0` cleared it; the address bar no longer contained `internal`.
- A numeric Lighthouse comparison with Batch 1 was not run. No Batch 1 mobile scores were stored in the repo.

## Current-state mismatches

- `/seo-growth` still passes its own footer props. The component ignores them, so the rendered footer matches the shared columns. The page file was not edited.
- The admin sidebar QR checklist stays Starter-only. Full shops see the settings card.
- Pricing36 plan cards are not on the page while setup plan cards are hidden.
- Shop pages still pass `brandName: 'Kersivo'`.
- Navbar17 on `MainLayout` pages such as `/shop` still has in-page Home, Paths and FAQ links. Its Pricing link is now `/pricing`.
- The live `gtag('config')` call was not observed in the browser. Analytics stays off until consent, and the config object is inside the inline script. The cookie set/clear was observed, and `gaConfig()` is unit-tested with and without `traffic_type`.
- Contact submit with only an email was covered by `contact.test.ts`, not by posting through the dev-server mail transport.
