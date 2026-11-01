# Admin Hub — Batch 6 plan (Phase 3 card, real-stack QA, production switch)

Spec: `ADMIN_HUB_SPEC.md` §5 phase 3 + Batch 6 in `CURSOR_PROMPTS.md`. Branch `admin-hub-batch-6` from `admin-hub-batch-5`.

## Files

New
- Additive `ShopSettings.nextStepsDismissedAt` + `nextStepsWebsiteViewedAt` (migration).
- `src/lib/adminHub/nextSteps.ts` — eligibility + done rules for the live-admin card.
- `src/pages/api/admin/next-steps/view-site.ts` + `dismiss.ts` — session-only POSTs.
- `src/components/admin/AdminNextStepsCard.tsx` — red card in the full admin sidebar.

Changed
- `setupCard.ts` — Phase 3 hrefs (live site, `/admin/test-book`, `/admin/retail-onboarding`).
- `AdminSidebarLaunchCta` + `launch-context` — show Phase 3 instead of hiding the CTA **only** when the shop came through a preview and is live.
- Ops hub APIs + owner hub emails treat `ADMIN_HUB_ENABLED` as “hub on” (production will not set `PREVIEW_HUB_ENABLED`).
- Seed + `scripts/admin-hub-real.spec.ts` — live shop, paid-direct, Starter, full journey, negatives, 360–1440 shots.

Not touched
- `PREVIEW_HUB_ENABLED` on Vercel. Flag-off `/admin` and `/preview` stay byte-for-byte when `ADMIN_HUB_ENABLED` is off.
- Old `/preview/{token}` hub pages (still gated by `PREVIEW_HUB_ENABLED` only).

## Approach

1. Reuse existing `[TEST]` booking notes for “Make a test booking”. Do not add `testBookingCompletedAt`.
2. Retail is done only when `retailOnboardingCompleted` (skip is not complete).
3. Card hides when dismissed or all 3 rows are done. Starter and paid shops without a live preview keep today’s hide/Starter card (regression tests).
4. Hardening from old Batch 7 part C is already on this branch — list it in the report, do not re-implement.
5. After CI + Vercel preview: founder merges. Production `ADMIN_HUB_ENABLED=true` is a separate step (ask for the founder email; do not invent one).

## Risks

- Shared Neon `DATABASE_URL`: migration is additive only.
- Ops launch-steps / messages currently 404 unless `PREVIEW_HUB_ENABLED`. Must accept `ADMIN_HUB_ENABLED` or production smoke cannot mark live or reply.
- Owner ack/ready emails currently use `isPreviewHubEnabled()` for the hub link. Same fix, or the production request will not get an `/admin` email link.
