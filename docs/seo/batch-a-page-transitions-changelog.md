# Batch A — smooth, flash-free page transitions

## What changed
- **ClientRouter is back on marketing pages** (`LandingLayout`, `fallback="none"`). This reverses item 6 of `batch-6-changelog.md`, which removed it over a GA4 double-count risk. Measured with the real gtag.js and data stream (hits stubbed): one `page_view` per client-side navigation, with the right title. See the comment in `GoogleAnalytics.astro`.
- **Route families**: `/free-preview`, `/phorest-alternative`, `/squire-alternative`, `/square-appointments-alternative`, `/dpa`, `/seo-growth` added; a test now fails if a page built on `LandingLayout` is left out.
- **Full reloads** stay only when leaving the family (demo, admin, checkout), with a comment at each site. A cancelled preparation catches links that were not marked, and those links are never prefetched on hover.
- **Fonts**: marketing pages load variable Inter (one file, real weights) and Bebas Neue, with metric-matched fallbacks in `fonts-fallback.css`. Marketing `font-weight` values are normalised to 400/500/600/700. Bebas stays `font-display: swap` because an `optional` font that misses its window would stay in the fallback for the whole client-side visit.
- **No entrance animation in the first viewport**: hero rise and fade rules removed; scroll scenes already on screen are never hidden.
- **Transition polish**: fixed progress bar after 250ms, crossfade of the main content only, cross-document view transition for full reloads, focus to the H1, reduced motion gets an instant swap.

## Scripts and the router
Astro runs a component's bundled `<script>` once per visit. Anything that binds to page content must re-run on `astro:page-load`: use `onPageReady` from `src/lib/navigation/pageReady.ts`.
