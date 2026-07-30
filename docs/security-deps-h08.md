# H08 — Dependency security (deps audit)

## Before Phase A (baseline)

Captured: 2026-07-29

### Full tree (`npm audit`)

**21 vulnerabilities** (1 low, 6 moderate, 9 high, 5 critical)

Notable clusters:

| Area | Severity | Notes |
|------|----------|--------|
| `astro` ≤7.0.9 | high | XSS advisories; fix requires **Astro 7** (`npm audit fix --force`) → **Phase B** |
| `esbuild` (via Astro) | — | Dev-server file read on Windows; force path pulls Astro 7 → **Phase B** |
| `sharp` &lt;0.35 | high (prod) | libvips CVEs; force → sharp 0.35.x / Astro chain → **Phase B** careful |
| `to-ico` → `jimp` / `request` / `form-data` / `minimist` / `jpeg-js` | critical/high | Favicon **dev** script only; removable in Phase A |
| `brace-expansion`, `fast-uri` | high | Often fixable via `npm audit fix` (no force) |

### Production only (`npm audit --omit=dev`)

**3 vulnerabilities** (1 low, 2 high) — primarily Astro/esbuild/sharp runtime chain.

## Phase A goals

- `npm audit fix` **without** `--force`
- Remove `to-ico` (rewrite favicons with `sharp` + small ICO packer)
- Overrides only if safe transitive pins remain
- Leave Astro 6.x / sharp major bump for **Phase B**

## After Phase A (DONE 2026-07-29)

### Actions taken

1. `npm audit fix` (no `--force`) — lockfile semver-safe bumps
2. Removed `to-ico` from `devDependencies`; rewrote [`scripts/generate-favicons.mjs`](../scripts/generate-favicons.mjs) to use `sharp` + local PNG→ICO packer
3. No `overrides` needed — remaining issues all require breaking upgrades

### Audit result

| Scope | Before | After |
|-------|--------|-------|
| Full `npm audit` | 21 (5 critical, 9 high, …) | **6** (0 critical, 5 high, 1 low) |
| `npm audit --omit=dev` | 3 | **3** (Astro / esbuild / sharp — Phase B) |

Critical tooling chain (`form-data` / `request` / `jimp` via `to-ico`) is **gone**.

### Remaining → Phase B (controlled Astro 7 branch)

Do **not** run `npm audit fix --force` on main.

| Package | Issue | Plan |
|---------|--------|------|
| `astro` 6.4.x | XSS (View Transitions / HTML attrs) | Upgrade to Astro **7.x** + `@astrojs/vercel` / React adapter alignment |
| `esbuild` | Windows **dev server** arbitrary file read | Comes with Astro/tooling upgrade; low prod Vercel risk |
| `sharp` &lt;0.35 | libvips CVEs | Bump with Astro 7 / verified image upload regression |
| `path-to-regexp` (via `@vercel/routing-utils`) | ReDoS | Resolved by `@astrojs/vercel` major in Phase B |

Phase B checklist: separate branch → upgrade → vitest + `astro build` → smoke landing /admin / API / uploads / Stripe webhooks → deploy.

## Before Phase B (baseline)

Captured: 2026-07-29 — branch stacked on Phase A (`chore/h08-phase-a-safe-deps` @ `2b6234c`; PR #8 still open).

### Full tree (`npm audit`)

**6 vulnerabilities** (1 low, 5 high, 0 critical)

Remaining clusters: `astro` XSS, `sharp` &lt;0.35 libvips, `path-to-regexp` via `@astrojs/vercel` / `@vercel/routing-utils` (and related).

## After Phase B (DONE 2026-07-30, landed onto main)

### Actions taken

1. `npx @astrojs/upgrade` → `astro@^7.1.6`, `@astrojs/react@^6.0.2`, `@astrojs/vercel@^11.0.4`, `@astrojs/check@^0.9.10`
2. `sharp@^0.35.3`, direct `vite@^8.1.5`
3. `compressHTML: true` in [`astro.config.mjs`](../astro.config.mjs) (Astro 7 default is `'jsx'`)
4. npm `overrides` for `path-to-regexp@6.3.0` (ReDoS via `@vercel/routing-utils`)
5. Prisma server client loads `.env` via `dotenv`, but **only when `DATABASE_URL` is missing** from `process.env` (Vercel already has it; local `astro dev` under Astro 7 / Vite 8 does not reliably). No `import.meta.env.DATABASE_URL` fallback — secrets stay out of the client bundle graph.
6. Sharp regression test: [`src/lib/storage/convertImageToWebp.test.ts`](../src/lib/storage/convertImageToWebp.test.ts)
7. Small typecheck / reschedule-test fixes required for green CI on Astro 7 check
8. Kept `@sentry/astro` integration intact (do not drop Sentry when landing this on main)
9. Public booking availability (`/api/public/bookings/[shopId]/availability`) and `BookingFlow`'s `publicShopId`-aware fetch were **already shipped on main** ahead of this branch — Phase B did not need to reintroduce them, only kept the SaaS-gated `book/[shopId].astro` as-is.

### Audit result

| Scope | Before Phase B | After Phase B |
|-------|----------------|---------------|
| Full `npm audit` | 6 (5 high, 1 low) | see `npm audit --omit=dev` run in the landing PR |
| Critical / Astro XSS / sharp libvips / path-to-regexp | present | **cleared** |

### Residual

- **esbuild** (low): Windows `astro dev` arbitrary file read advisory. Prod Vercel build path is not the primary exposure. Revisit when a patched esbuild lands without breaking Astro 7.

### Versions pinned by upgrade

- `astro` ^7.1.6 · `@astrojs/react` ^6.0.2 · `@astrojs/vercel` ^11.0.4 · `sharp` ^0.35.3 · `vite` ^8.1.5
