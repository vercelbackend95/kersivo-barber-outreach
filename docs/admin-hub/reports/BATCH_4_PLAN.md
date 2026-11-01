# Admin Hub — Batch 4 plan (Brand colours)

Branch: `admin-hub-batch-4`, stacked on `admin-hub-batch-3`. `ADMIN_HUB_ENABLED` stays off on Vercel. `PREVIEW_HUB_ENABLED` is not touched. Migration is additive only.

## Files

New
- `src/lib/adminHub/colour/` — sRGB↔linear↔OKLab↔OKLCH, ΔE_OK, gamut clamp, WCAG, k-means++ (seeded), merge, naming, roles, quick picks, worker.
- `src/lib/adminHub/brandColours.ts` — zod + save (draft / send / KERSIVO chooses).
- `src/lib/previewHub/handlers/brandColours.ts` — shared PATCH handler.
- `src/pages/api/admin-hub/brand-colours.ts` + token twin.
- `src/components/adminHub/apps/ColoursApp.tsx` — three-column / stacked sheet UI.
- `src/components/ops/previewRequests/OpsBrandColours.tsx` — ops Overview swatches + copy.
- `prisma/migrations/20261031260000_admin_hub_brand_colours/` — four nullable columns.
- this report folder + `docs/admin-hub/screens/batch-4/`.

Changed
- Prisma `PreviewRequest` + `previewAccess` select + anonymise.
- App registry (`apps.ts`, `loadApp.ts`, AppHost icon/chrome).
- Overview tile (extracted count, status from sent/source).
- Ops request workspace Overview.
- Activity label + `FUNNEL_EVENTS.hub_brand_colours_sent`.
- QA seed (palette + colours on the Ready shop; no Northgate copy).
- Playwright batch 4.

## Approach

1. **Colour science** is pure TS, no new dependencies. Extraction is client-side on the stored logo thumbnail (SVG/PDF → server-rasterised PNG). Worker posts `ImageData`; main thread shows a skeleton until it returns.
2. **Roles:** Main = highest-share chromatic cluster; Accent = most hue-distant chromatic with share ≥ 5%. Near-black / near-white / low-chroma never auto-assigned as Main. B&W logo → empty Main + spec sentence.
3. **Fine-tune** changes only OKLCH L (Depth) and C (Intensity); hue locked; chroma reduced until in sRGB. Sliders are native `input[type=range]` (arrow keys + `aria-valuetext`).
4. **API** reuses details capability (`canEditDetails`, until Launch) and the details IP rate limit. `send: true` sets `brandColoursSentAt`, writes `BRAND_COLOURS_SENT`, activity, and `hub_brand_colours_sent` (no personal data; not for operators).
5. **Overview tile** already links to `?app=colours`. This batch stops remapping that to the logo app and shows Not sent yet / Sent / Using KERSIVO's choice from the new fields.
6. **Live preview** uses the real shop name. No Northgate tagline or invented prices.

## Risks

- Shared Production+Preview `DATABASE_URL` — columns are nullable; no backfill.
- EyeDropper is Chromium-only; the button is hidden where `window.EyeDropper` is missing.
- QA shops have no uploaded logo in blob storage; the app hydrates from a seeded palette so screenshots are honest. Extraction is covered by fixtures + a canvas-mocked worker test.
