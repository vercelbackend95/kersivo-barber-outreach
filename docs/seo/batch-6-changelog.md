# Batch 6 changelog — technical hygiene

Branch: `claude/seo-batch-6-technical-hygiene`, from `main` at `869e3473` (after #135). Roadmap section “Batch 6 — Technical hygiene (P3)”. No copy, pricing, legal text or competitor figure changed. Prisma, booking and payment code were not touched.

## Before (production, 28 October 2026)

| Check | Result |
|---|---|
| `https://kersivo-barber-outreach.vercel.app/pricing` | 200, duplicate of the apex |
| `https://kersivo.co.uk/pricing/` | 200, duplicate of `/pricing` |
| `https://www.kersivo.co.uk/pricing` | 301 from **Cloudflare** → apex. The `www` rule in `vercel.json` never runs. |
| `/_astro/*.css` | `Cache-Control: public, max-age=0, must-revalidate` |
| `/fonts/*.woff2` | `max-age=0, must-revalidate` |
| Lighthouse accessibility (mobile) | `/` 90, `/pricing` 94, `/starter` 93, `/barbershop-online-booking` 94 |

The Astro Vercel adapter does add `immutable` for `/_astro/*`. In the generated `.vercel/output/config.json` that route sits after `handle: filesystem`, so static files never get it.

## Done

1. **`vercel.app` → apex** (`vercel.json`): 308 from `kersivo-barber-outreach.vercel.app/:path` to `https://kersivo.co.uk/:path` for every path except `/api/*`.
   - Crons (9, all under `/api/cron` and `/api/ops`), Stripe webhooks (`/api/shop/webhook`, `/api/setup/...`) and better-auth (`/api/auth/...`) keep working on that host even if something still calls it.
   - Preview deployments (`kersivo-barber-outreach-git-…vercel.app`) are not matched.
2. **Trailing slash**: `"trailingSlash": false`, so `/pricing/` → 308 `/pricing`. The separate `/barbershop-booking-system/` rule was removed; the slash redirect plus the existing `/barbershop-booking-system` rule cover it.
3. **Dead `www` rule** removed from `vercel.json`. Cloudflare already answers `www` with a 301 before Vercel.
4. **Cache headers** (`vercel.json` `headers`):
   - `/_astro/(.*)` → `public, max-age=31536000, immutable` (hashed file names).
   - `/fonts/(.*)` → `public, max-age=2592000, stale-while-revalidate=86400` (30 days). Font file names are not hashed, so a year-long `immutable` would pin an old file after a change.
5. **Client Sentry removed**: `sentry({ enabled: { client: false, server: true } })` and `sentry.client.config.ts` deleted.
   - Production has `SENTRY_DSN` but no `PUBLIC_SENTRY_DSN`, so the browser SDK loaded on every page and was always disabled.
   - Server Sentry (`sentry.server.config.ts`, `src/lib/ops/sentry.ts`) is unchanged.
6. **ClientRouter removed from marketing pages** (`LandingLayout`).
   - `GoogleAnalytics.astro` sends a manual `gtag('config', …page_path)` on every client-side navigation. GA4 enhanced measurement (“page changes based on browser history events”, on by default) also counts those history changes. That risks two page views per click.
   - Without the router, every marketing click is a normal page load: one `page_view`.
   - All 41 scripts that listen for `astro:page-load` also run once on load, so nothing depends on the router. The route-transition veil only listens for router events and now stays idle.
   - `MainLayout` (shop), `DemoLayout` and `MinimalLayout` keep ClientRouter.
7. **`robots.txt`**: explicit allow groups with the same private-path rules for `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot` and `Perplexity-User`.
   - Training-only crawlers (GPTBot, CCBot, Google-Extended) are still not named and fall under `*` (allowed), as before.
   - `/seo-growth` is not mentioned (a test guards this).
8. **Accessibility** (`src/styles/components/marketing-a11y.css`, scoped to marketing pages; admin and booking tokens unchanged):
   - Skip link “Skip to main content” → `#main-content` (the page content wrapper). It is hidden until focused.
   - Red primary buttons: text dark → white (3.91:1 → 4.97:1). Hover red #ff2e45 → #b91c2c (6.43:1 with white).
   - Plain text links use `--accent-text` (#dc4e5b, 4.90:1) instead of #d72638 (3.91:1). Links inside paragraphs and list items are underlined.
   - Small red labels: post-purchase eyebrow → `--accent-text`; switcher badge and “after” tag → #e8646f (5.25:1 on their tinted pill).
   - Cookie banner policy link: 24px minimum target.
   - `/starter`: fine print #66666a → #8a8a8f and “Last updated” #55555a → #8a8a8f (6.0:1).
   - Online-booking entry illustration “Book” badge #2f6bff → #2a62f0 (4.49 → 5.12:1).
   - Focus ring: the global `:focus-visible` (3px #6366f1, 4.36:1 on the page background) was already in place; no change.

## After

Lighthouse accessibility, mobile, local dev server: `/` 100, `/pricing` 100, `/starter` 100, `/barbershop-online-booking` 97. The one remaining failure is `target-size` on the avatars inside the live admin timeline demo widget (`admin-vtl-avatar`, shared with the real admin panel), left alone.

## Not done — needs a decision or data from the founder

1. **Static / edge-cached marketing HTML.** The header’s primary button is personalised per visitor: the middleware sets `navbarPreviewCta` from the session. A shared HTML cache would show one person’s button to everyone. This first needs the header CTA to resolve in the browser (a small session endpoint), then marketing pages can be prerendered or given `s-maxage`. Proposed as a separate task.
2. **GSC 404 export → 301/410.** No export is in the repo. Please export *Pages → Not found (404)* from Search Console. Once the file is here, the redirects are a small follow-up.
3. **`barberdemo.kersivo.co.uk`** already answers 308 → `/demo` (both `vercel.json` rules kept). Removing the domain from Vercel or Cloudflare is a dashboard action.
4. **Server-side `signup_completed`** needs a GA4 Measurement Protocol API secret. Production env has only `PUBLIC_GA4_MEASUREMENT_ID`. It also touches the signup code path. Create the secret in GA4 (Admin → Data streams → Measurement Protocol API secrets) and add it to Vercel, then this is a small follow-up.
5. **Training crawlers.** Say if you want GPTBot / CCBot / Google-Extended blocked. Today they are allowed via `*`.
6. **GA4 DebugView.** Not checked. After deploy, a click between two marketing pages should show exactly one `page_view` per page.

## Tests

- `navigationPage.test.ts`: LandingLayout must not contain ClientRouter; Main/Minimal still do.
- `robotsTxt.test.ts`: one group per AI search crawler, identical to `*`; no `seo-growth`; still no GPTBot.

## Verification

- `npm run claims:check`: pass. `npm run typecheck`: 0 errors.
- `npm test`: 5067 passed, 1 failed (known `financialEndpoints` MANAGER 403 timeout; passed alone, 25/25).
- `npm run build`: passed. No Sentry code in `.vercel/output/static/_astro/*.js`.
- Skip link checked in the browser: first Tab focuses it; target `#main-content` exists.
- `vercel.json` headers and redirects are applied by Vercel, not the build: checked on the preview (see PR).
