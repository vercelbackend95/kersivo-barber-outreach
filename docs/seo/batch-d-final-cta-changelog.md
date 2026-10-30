# Batch D — Final CTA panel + contact form consistency

## What changed
- **One `FinalCta` component** (`src/components/FinalCta.astro`) now renders every marketing closing panel. Homepage (`LandingFinalCta`) and comparison pages (`ComparisonFinalCta`) pass page-specific props into it; `/pricing` and `/about` call it directly. `fresha-alt-final__actions` is gone.
- **Surface**: `ks-glass-card--accent`, 24px radius, 48px desktop / 28px mobile padding, soft red radial glow in the top-right corner (~10%).
- **Layout**: 7fr / 5fr from 1024px, `align-items: center`, left column max 560px, right column max 400px. Eyebrow is the shared `.ks-eyebrow` pill with a red dot.
- **Right column**: primary button, optional outline secondary, then a 14px centred middot link row (not button-height), then optional 13px small print. 12px between buttons, 16px before the links, 8px before the small print.
- **Contact16**: filled 48px inputs matching `/free-preview` (dark surface, 1px `rgba(255,255,255,0.08)` border, 12px radius, 13px/500 labels, brand border + 3px ring on focus). Eyebrow uses `.ks-eyebrow`. Booking-system options still come from `CURRENT_BOOKING_SYSTEMS`.

## Pages that render FinalCta
See the PR summary for the prop differences per page.
