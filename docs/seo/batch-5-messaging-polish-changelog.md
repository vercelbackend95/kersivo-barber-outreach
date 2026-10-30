# Batch 5 — Site-wide messaging consistency + final polish

Canonical commercial strings now live in `src/content/offer.ts`. The four-step setup process lives in `src/content/setupSteps.ts`.

## Part A — Messaging

- Stripe fees, commission, setup, VAT, billing cycle, refund, prices and CTA labels import from `offer`.
- Homepage Stripe-fees sentence: once in the pricing block + once in the final CTA (removed from the hero, difference cards and the pricing-card feature blurb).
- “Or subscribe now — £39/month”: hero, main pricing card and final CTA only. Footer now uses “Start Full KERSIVO — £39/month”. Extra subscribe links removed from getting-started, switching, and the online-booking plan chooser.
- Refund sentence stays in pricing blocks, `/pricing` billing FAQ and Terms. Not in heroes.
- Marketing “standard domain” → “your own domain”, except Terms/FAQ lines that exclude premium names.
- Shared four-step setup on the homepage, `/barbershop-websites` and `/barbershop-website-design`.
- FAQ blocks on most marketing pages now use the Batch 0 Accordion + SectionHeader.

## Part B — Polish

- Marketing `--text-xs` is 14px; leftover 0.78rem / 0.75rem / 0.74rem small print on marketing CSS bumped to tokens.
- Section rhythm token: 64px mobile / 96px desktop (`--section-space-y`).
- Body lead max-width uses `--prose-max` (70ch).
- External `target="_blank"` links marked with ↗.
- Homepage demo captions name CUTSTATE as a fictional demonstration shop.
- `/compare` featured card and pressed filters now use white-on-brand-red (WCAG) instead of dark type on red.

## Lighthouse (local, after)

| Page | Accessibility | Best Practices |
| --- | --- | --- |
| `/` | 100 | 100 |
| `/pricing` | 100 | 100 |
| `/starter` | 100 | 100 |
| `/free-preview` | 97 | 100 |
| `/barbershop-websites` | 100 | 100 |
| `/barbershop-online-booking` | 97 | 100 |
| `/barbershop-website-design` | 97 | 100 |
| `/compare` | 97 (was 93 on contrast) | 100 |
| `/about` | 100 | 100 |
| `/insights` | 96 | 100 |
| `/fresha-alternative` | 100 | 100 |
| `/booksy-alternative` | 100 | 100 |

Before scores were not captured in this pass. Remaining `/compare` axe items are filter-label mismatch (short mobile labels) and small competitor source links.

## Flagged

- Terms still say “Standard Stripe payment-processing fees still apply” (legal copy; not changed).
- Billing short line dropped “billing-cycle” (“same day”) to match the requested canonical sentence. The long Terms claim is unchanged.
- “£39 a month” kept in running sentences (homepage hero lead, homepage FAQ, `/about` H2 and pricing summary).
- Alternative pages still use `fresha-alt__*` layout classes (not a visual-only swap). `/pricing` and `/about` still use `company-*` for hero chrome.
- Custom numbered FAQs remain on `/barbershop-websites` (`bsw-faq-*`) and `/barbershop-website-design` (`bwf-*`).
