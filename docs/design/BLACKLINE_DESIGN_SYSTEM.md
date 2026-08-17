# BLACKLINE BARBERS design system

Single source of truth for the isolated `/demo` microsite. Do not apply these tokens to Kersivo landing, admin, or other shop themes.

## Brand

**BLACKLINE BARBERS** — architectural precision. Modern, controlled, premium but approachable. Evokes a defined hairline, an architectural drawing, matte black, brushed steel.

Not a SaaS landing page, not a retro barbershop, not black-and-gold luxury, not Kersivo with a different name.

## Files

| Role | Path |
|---|---|
| Theme stylesheet | `src/styles/demo/blackline.css` |
| Fonts | `src/styles/demo/fonts-blackline.css` |
| Layout (`data-theme="blackline"`) | `src/layouts/DemoLayout.astro` |
| Header / footer | `src/components/demo/` |
| Pages | `src/pages/demo/` |
| Copy / nav data | `src/lib/demo/` |
| Cursor rule | `.cursor/rules/blackline-demo.mdc` |

Import the theme **only** from `DemoLayout`. Never import `src/styles/global.css`, `tokens.css`, Tailwind theme, or Kersivo navbar/footer into demo pages.

## Theme wrapper

```html
<html lang="en-GB" data-theme="blackline">
```

All BLACKLINE CSS is scoped under `[data-theme="blackline"]`.

Surfaces:

```html
<section class="bl-section" data-surface="dark">…</section>
<section class="bl-section" data-surface="dark" data-tone="graphite">…</section>
<section class="bl-section" data-surface="light">…</section>
```

Dark: Ivory text, Silver muted, `--bl-line-dark`.  
Light: Ink text, Slate muted, `--bl-line-light`.  
Never rely on a single global text colour across both.

## Palette

Foundation (do not scatter hex in components — use semantic tokens):

- Carbon `#0b0c0e`, Graphite `#14161a`, Steel `#202329`
- Ivory `#f4f1ea`, Soft ivory `#e8e4dc`, Ink `#111318`
- Silver `#a7abb2`, Slate `#626872`
- Cobalt `#315ef5`, Cobalt hover `#2449cb`, Focus `#91aeff`

Semantic aliases on the theme:

- `--theme-background`, `--theme-surface`, `--theme-surface-raised`
- `--theme-text`, `--theme-text-muted`
- `--theme-accent`, `--theme-accent-hover`, `--theme-on-accent`
- `--theme-border`, `--theme-line`, `--theme-focus`

Cobalt is the only strong accent (about 5–10% of the UI): primary CTAs, active nav line, selected options, focus, small status. No large blue fields or blue gradients.

## Typography

- Display: Barlow Condensed 700–800 — `--bl-font-display`
- Body / UI: Manrope 400–700 — `--bl-font-body`

Classes: `.bl-display`, `.bl-h1`, `.bl-h2`, `.bl-h3`, `.bl-lede`, `.bl-eyebrow`.

Major headings are uppercase condensed. Body copy is sentence case, ~55–70 characters (`--bl-measure`). Scale uses `clamp()`.

## Spacing and shape

4px/8px scale: `--bl-space-1` … `--bl-space-9`.  
Content width `--bl-content-width` (1280px). Gutter `--bl-gutter`. Section padding `--bl-section-space`. Header `--bl-header-height`. Controls `--bl-control-height` (52px).

Radii: buttons/inputs 4px, cards 6px, editorial images 0–2px. No pills. No heavy shadows. Prefer 1px lines, contrast, and space.

## Line motif

1px architectural lines for dividers, nav underline, service/hours rows, heading hairlines. Neutral by default (`--theme-line`). Active/hover may shift to cobalt. Do not line every element.

## Primitives

Use these classes instead of new local colours:

- Layout: `.bl-container`, `.bl-section`, `.bl-divider`
- Type: `.bl-eyebrow`, `.bl-display`, `.bl-h1`–`.bl-h3`, `.bl-lede`
- Actions: `.bl-btn`, `.bl-btn--primary`, `.bl-btn--secondary`, `.bl-link`, `.bl-nav-link`
- Future: `.bl-card`, `.bl-input`, `.bl-select`, `.bl-option`

Primary button: cobalt, white label, ≥44px (52px token), 4px radius, hover/pressed/focus.  
Secondary: transparent, 1px border, line/colour shift on hover.

## Page rhythm

1. Hero — Carbon  
2. Services — Ivory  
3. Barbers — Graphite  
4. Gallery — image-led, usually dark  
5. Shop — Ivory  
6. Location/contact — Carbon  
7. Booking — primarily light, dark chrome (header/footer)

Homepage currently: dark hero, light visit/hours, graphite about.

## Imagery

No random stock. When photos are missing, use a typographic layout or an intentional image-ready frame (as on the homepage). Future photography: desaturated, accurate skin, editorial light, craft close-ups, modern interiors. No vintage sepia, fake reviews, or leather-and-whisky clichés.

## Motion

`--bl-transition-fast` 160ms and `--bl-transition-base` 240ms, cubic-bezier(0.2, 0.8, 0.2, 1). Line movement, colour, 1–2px shifts only. Honour `prefers-reduced-motion`.

## Accessibility

WCAG AA text/controls. Visible `:focus-visible` with `--theme-focus`. Semantic HTML. ≥44px targets. Colour is not the only state signal. No horizontal overflow.

## Prohibited

Kersivo red, gold, neon green, barber poles, moustache/razor/scissors decoration, glassmorphism, heavy gradients, pill controls, excessive shadow/rounding, fake testimonials, Kersivo logo as the Blackline wordmark.

## New pages

1. Wrap with `DemoLayout` (inherits `data-theme="blackline"`).
2. Copy primitives from `blackline.css` — do not invent hex or one-off type.
3. Alternate `data-surface="dark"` / `"light"`.
4. Include hover, focus, disabled, and reduced-motion where interactive.
