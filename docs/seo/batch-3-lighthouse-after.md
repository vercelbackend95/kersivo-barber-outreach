# Batch 3 Lighthouse after

Recorded on 28 October 2026 against the same local dev server and the same Lighthouse flags as the baseline. `astro preview` is unavailable because the Vercel adapter does not support it. Mobile LCP on `/pricing` is still a dev-server figure.

| Page | Form | Performance | Accessibility | LCP | TBT | CLS | Versus baseline |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | mobile | 88 | 91 | 2.2 s | 342 ms | 0 | Performance +41, accessibility +7, CLS unchanged at 0 |
| `/` | desktop | 94 | 94 | 0.5 s | 160 ms | 0 | Performance +14, accessibility +7, CLS 0.009 → 0 |
| `/pricing` | mobile | 63 | 94 | 43.7 s | 406 ms | 0 | Performance unchanged, accessibility unchanged, CLS unchanged at 0 |
| `/pricing` | desktop | 76 | 97 | 7.2 s | 21 ms | 0 | Performance unchanged, accessibility unchanged, CLS unchanged at 0 |

Gate: mobile performance did not drop, accessibility did not drop, and CLS stayed 0 on both mobile runs.

Homepage scroll height at 375px: 17118px before the section-order change, 14764px after. The first heading in `main` is the single H1. At 375×812 and 1440×900, with the cookie banner dismissed, the H1, lead, primary CTA and meta row are all inside the first viewport.
