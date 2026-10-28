# Batch 3 Lighthouse baseline

Recorded on 28 October 2026 against the local dev server at `http://127.0.0.1:4321`.

`astro preview` cannot run in this repo: the Vercel adapter does not support the preview command. Both the baseline and the after run use `npm run dev` with the same Lighthouse flags, so the comparison stays on one method. Mobile LCP on this dev server is inflated by compile and throttling. Treat the scores as a same-method gate, not as production Lighthouse.

Mobile runs are the warm rerun. Desktop runs are the first pass.

| Page | Form | Performance | Accessibility | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | mobile | 47 | 84 | 38.7 s | 487 ms | 0 |
| `/` | desktop | 80 | 87 | 1.3 s | 210 ms | 0.009 |
| `/pricing` | mobile | 63 | 94 | 43.8 s | 429 ms | 0 |
| `/pricing` | desktop | 76 | 97 | 7.2 s | 32 ms | 0 |

Homepage scroll height at 375px before the section-order change: 17118px.
