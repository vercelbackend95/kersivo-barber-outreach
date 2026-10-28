# KERSIVO — notes for Claude Code

UK SaaS for independent barbershops (kersivo.co.uk). Astro 7 + React islands + Prisma, deployed on Vercel from `main`.

## Current work
SEO/CRO roadmap with the remaining batches: **`docs/seo/ROADMAP.md`**. Changelogs of finished batches are in `docs/seo/`.

## Rules for marketing copy and pages
- All public copy in **British English** (UK spelling, £). The founder writes in Polish.
- **Full KERSIVO (£39/month per location) is the primary offer**; Starter (£0) is a visible secondary option, never the primary CTA (except on `/starter`).
- KERSIVO is presented as a brand. No founder name, photo, "our team", "Ltd" or "founded by" on marketing pages. Legal identity lives only in `src/lib/legal/businessIdentity.ts` and the legal pages (sole trader).
- Never invent claims, numbers, reviews, testimonials or customers. Approved wording lives in `src/lib/pricing/claimsPolicy.ts`; competitor figures in `src/lib/seo/*Facts.ts` with a checked date.
- "0% KERSIVO commission" always with "Stripe fees apply" nearby. Setup time on marketing pages: "a few days" (e.g. "typically ready in a few days once we receive all required information") — never a fixed number of days or "1–2 weeks". The Terms timeline (`ONBOARDING_TIMELINE_CLAIM`) is separate legal text. SMS reminders: "within a monthly allowance" (no number).
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
