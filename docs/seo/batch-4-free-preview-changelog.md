# Batch 4 — `/free-preview` premium redesign

Screenshots: `docs/seo/batch-4-free-preview-screenshots/` (`before-1440`, `before-375`, `after-1440`, `after-375`).

## What changed

The public `/free-preview` page is now a conversion layout: hero copy + sticky form card on desktop, CUTSTATE preview visual, 2×2 “What you’ll get”, a You/KERSIVO how-it-works timeline, and the shared Accordion FAQ.

URL, title, meta description, JSON-LD, form field names, `/api/free-preview` handler, honeypot, consent/opt-in wording and `data-track` attributes are unchanged.

## Files

- `src/pages/free-preview/index.astro` — 12-column hero, sections, sticky mobile CTA
- `src/components/freePreview/FreePreviewForm.astro` — filled inputs, 3 groups, loading/success
- `src/components/freePreview/FreePreviewVisual.astro` — scaled CUTSTATE browser + booking step
- `src/styles/components/free-preview.css`
- `src/lib/forms/currentBookingSystems.ts` — shared booking-system list
- `src/lib/seo/freePreviewPage.ts` — owner labels on steps, form/confirmation copy
- Contact form + API now read the same booking-system list
- Navbar primary CTA on this page stays hidden (existing `isMarketingNavSelfHref`)

## Flagged

- Current booking system values now match the contact form: `other` → `other-platform`, plus `mixed-manual`. Ops still labels legacy `other` rows.
- Confirmation heading now ends with a full stop; demo link is “Explore the demo while you wait”.
- Form ready line uses the existing claim (“Usually within a few working days.”) rather than adding “ready”.
- Lighthouse was not run in this pass; layout was checked at 375 / 768 / 1024 / 1440×900 (H1, trust row and form group 1 visible at 1440×900; no horizontal overflow).
