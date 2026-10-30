# Batch E — Clean-up and QA after batches A–D

Cleanup only: shared tokens, one eyebrow, less CSS on `/pricing`, mobile a11y, no redesigns.

## Surfaces
Marketing cards now use `--ks-glass-top` / `--ks-glass-bottom` (the `.ks-glass-card` gradient) plus one flat `--ks-tile` (`#0d0d0e`). Admin/booking `--surface-1` (`#11151b`) is unchanged.

| Page | Element | Before | After |
| --- | --- | --- | --- |
| Site-wide | `.ks-glass-card` | Hardcoded `#0d0d0e → #080809` | `var(--ks-glass-top/bottom)` |
| `/` | Switcher panels, chips, tags | `--surface-1` / mix | `--ks-tile` / mix |
| `/` | FAQ badge | `--surface` (`#11151b`) | `--ks-tile` |
| `/` | Full offer glass wrap | Hardcoded glass gradient | `--ks-glass-*` |
| `/pricing` | Plan-compare toggle | Hardcoded glass gradient | `--ks-glass-*` |
| `/barbershop-websites` | Essentials test tile, offer panel | `--surface-1` | `--ks-tile` |
| `/compare` | `--hub-surface` | `#0d0e11` | `--ks-tile` |
| `/about`, `/seo-growth` | `.company-group`, `.company-summary` | `color-mix(--surface-1 72%)` | `--ks-tile` |

## CSS weight
Dev inlines CSS, so `<link rel=stylesheet>` counts are 0. Source graph after the change:

| Page | CSS files | Change |
| --- | --- | --- |
| `/` | 26 | Layout + homepage sections. Unchanged set aside from `ks-eyebrow.css`. |
| `/pricing` | 20 | Dropped `fresha-alternative.css` (~1,500 lines) and `company-pages.css`. Now loads `ks-hero.css` only. |
| `/free-preview` | 15 | Still loads `barbershop-websites-hero.css` for the CUTSTATE mock. |

## Eyebrows
One site-wide `.ks-eyebrow` pill (optional red dot; `--neutral` / `--plain`). The red outlined-box variant is gone. Markup on comparison pages, `/about`, `/starter`, `/pricing`, `/free-preview`, `/compare`, calculators, SectionHeader, FinalCta and Contact now uses that class. `ks-eyebrow.css` is imported from `LandingLayout`.

## Fonts
Marketing still loads one variable Inter file (100–900) and Bebas Neue 400. No Antonio preload on marketing. `/free-preview` title `font-weight: 650 → 600`. Admin, booking and shop still use 650/750 (out of scope). Antonio remains only on the noindex `/facebook-cover` page.

## Mobile QA (375 / 390)
No horizontal overflow. No first-viewport fade. No H1 hidden behind sticky bars. `/free-preview` sticky CTA is hidden while the form is on screen, then shown after scrolling. Breadcrumb “Home” is a 44×44 tap target and keeps inherited colour. `.fp-note__toggle` is 44px tall.

## Links
34 navbar/footer/CTA paths checked: no 404s, no extra redirects. Sitemap (54 URLs) still lists every public marketing page, including `/free-preview` when the flag is on. `/demo`, `/admin`, `/seo-growth` stay off the sitemap.

## Lighthouse (astro dev, 30 Oct 2026)
`astro preview` is unavailable (Vercel adapter). Scores are from the local dev server with the consent cookie set. CLS is 0 on every run. Accessibility 100 except `/compare` 97 (`target-size` on the sources list; `label-content-name-mismatch` on filter pills — pre-existing, not changed). Best Practices 96 is the localhost HTTP warning. Performance is a dev-server figure (LCP 6–15 s); production after Batch 3 was `/` mobile 96 / `/pricing` mobile 98.

| Page | Form | Performance | Accessibility | Best Practices | SEO | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | mobile | 55 | 100 | 96 | 100 | 0 |
| `/` | desktop | 55 | 100 | 96 | 100 | 0 |
| `/barbershop-websites` | mobile | 60 | 100 | 96 | 100 | 0 |
| `/barbershop-websites` | desktop | 60 | 100 | 96 | 100 | 0 |
| `/pricing` | mobile | 64 | 100 | 96 | 100 | 0 |
| `/pricing` | desktop | 64 | 100 | 96 | 100 | 0 |
| `/starter` | mobile | 65 | 100 | 96 | 100 | 0 |
| `/starter` | desktop | 66 | 100 | 96 | 100 | 0 |
| `/free-preview` | mobile | 59 | 100 | 96 | 100 | 0 |
| `/free-preview` | desktop | 59 | 100 | 96 | 100 | 0 |
| `/compare` | mobile | 61 | 97 | 96 | 100 | 0 |
| `/compare` | desktop | 62 | 97 | 96 | 100 | 0 |

## Remaining legacy classes
Comparison pages keep `.fresha-alt-hero` / `fresha-alt__*` as their layout system. `/about` and `/seo-growth` keep `.company-checks`. `/pricing` still uses `.fresha-alt-hero` / `.company-hero` (styles now live in `ks-hero.css`). Homepage Full offer keeps `rate-card1__*`.
