# KERSIVO — notes for Claude Code

UK SaaS for independent barbershops (kersivo.co.uk). Astro 7 + React islands + Prisma, deployed on Vercel from `main`.

## Current work
SEO/CRO roadmap with the remaining batches: **`docs/seo/ROADMAP.md`**. Changelogs of finished batches are in `docs/seo/`.

## Rules for marketing copy and pages
- All public copy in **British English** (UK spelling, £). The founder writes in Polish.
- **Full KERSIVO (£39/month per location) is the primary offer**; Starter (£0) is a visible secondary option, never the primary CTA (except on `/starter`).
- KERSIVO is presented as a brand. No founder name, photo, "our team", "Ltd" or "founded by" on marketing pages. Legal identity lives only in `src/lib/legal/businessIdentity.ts` and the legal pages (sole trader).
- Never invent claims, numbers, reviews, testimonials or customers. Approved wording lives in `src/lib/pricing/claimsPolicy.ts`; competitor figures in `src/lib/seo/*Facts.ts` with a checked date.
- "0% KERSIVO commission" always with "Stripe fees apply" nearby. Setup time on marketing pages: "a few days" (e.g. "typically ready in a few days once we receive all required information") — never a fixed number of days or "1–2 weeks". The Terms timeline (`ONBOARDING_TIMELINE_CLAIM`, rendered on `/terms`) says the same; changing it needs a Terms version bump. SMS reminders: "within a monthly allowance" (no number).
- `/seo-growth` must stay public, `noindex, follow` (Google OAuth app homepage). Do not put it behind auth.
- Terms changes: bump `CURRENT_TERMS_VERSION` and keep old versions valid via `ACCEPTED_PRIOR_TERMS_VERSIONS` (`src/lib/legal/termsVersion.ts`).

## Checks before a PR
- `npm run claims:check` (banned phrases; also runs at the start of `npm run build`)
- `npm test`, `npm run typecheck`, `npm run build`
- Many `src/lib/seo/*.test.ts` files assert exact copy and section order — update them when copy intentionally changes.
- Known flaky under the full run: `financialEndpoints` MANAGER 403 timeout and the client-onboarding hours-save case — rerun the file alone.

## Gotchas
- `src/components/landing/DeferredWidget.tsx` runs in the browser: never import Prisma / `@/lib/db/*` into its graph, and never `import()` a `.css` file dynamically (404s in production). Guarded by `src/lib/seo/deferredWidgetClientSafe.test.ts`.
- The dev server hides some production-only problems (CSS chunks, client bundles). For anything touching islands or dynamic imports, verify with `npm run build` or the Vercel preview.

## Workflow
Branch from `main`, open a PR, wait for the GitHub Actions `build` check and the Vercel preview (`kersivo-barber-outreach`, the only project deploying this repo and serving kersivo.co.uk) to pass. The founder merges.
- Do the loop yourself (commit, push, PR, wait for checks, rerun known-flaky CI jobs); don't hand these steps back to the founder.
- Never run `vercel` / `vercel link` / `vercel build` in a folder that is not linked to `kersivo-barber-outreach`: the CLI creates a new Vercel project named after the folder and connects it to this repo (that is how the deleted `kersivo-production` project appeared).

## KERSIVO marketing site — working rules

Product: kersivo.co.uk, Astro marketing site for KERSIVO (booking software + branded websites for independent UK barbershops). Dark UI, one brand red token, Inter for UI and display, Bebas Neue for section headings.

Visual reference for "premium KERSIVO style": the card .starter-glance-card.starter-hero__card on /starter — near-black vertical gradient (#0D0D0E -> #080809), 1px border rgba(255,255,255,0.08), 20px radius, inset top highlight rgba(255,255,255,0.05), deep soft shadow, 1px red-to-transparent gradient line on the top edge (::before), small uppercase eyebrow with a red dot, large Inter numerals, hairline dividers, inner detail tile. Reuse its tokens instead of inventing new ones.

Non-negotiables:
- Public copy in British English. Do not change commercial terms (Full KERSIVO £39/month per location, KERSIVO Starter £0/month up to 4 barbers, 0% KERSIVO commission, no setup fee, not VAT registered, refund wording). Move or shorten placement only; flag anything unclear.
- Full KERSIVO is primary, Starter secondary. "Get my free preview" is the primary CTA.
- No invented stats, reviews, testimonials, customer logos or founder photos.
- Do not change URLs, titles, meta, canonical, JSON-LD, form field names, form endpoints or data-track attributes unless the task says so.
- WCAG 2.2 AA, visible :focus-visible, keyboard support, prefers-reduced-motion respected.
- Verify at 375, 768, 1024, 1440 px. No horizontal scroll.

Workflow for every task:
1. Read the relevant files first and state the plan (files, approach) before editing.
2. Work on a new git branch named after the batch.
3. Run the dev server and take Playwright screenshots before and after at 375 and 1440 px for every page you touch; save them in /tmp/kersivo-shots/<batch>/ and list them in your summary.
4. Run the build and fix errors you introduced.
5. End with a summary: files changed, what and why, open questions. Commit, push the branch, do not merge to main.
