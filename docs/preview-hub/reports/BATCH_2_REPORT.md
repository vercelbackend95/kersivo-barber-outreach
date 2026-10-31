# Batch 2 report — Uploads and Your shop

**Date:** 31 October 2026  
**Branch:** `preview-hub-batch-2` (from `preview-hub-batch-1`)  
**Spec:** `docs/preview-hub/HUB_SPEC.md` v1.0  

---

## What changed (files)

### Data
| File | Why |
|---|---|
| `prisma/schema.prisma` | Additive `PreviewHubAssetKind` enum, `PreviewHubAsset` model, `PreviewRequest.hubAssets` relation, `EmailOutboundPurpose.FREE_PREVIEW_HUB_FILES_INTERNAL`. |
| `prisma/migrations/20261031220000_preview_hub_2/migration.sql` | One migration, named `preview_hub_2`. |

### Upload pipeline
| File | Why |
|---|---|
| `src/lib/storage/fileSniff.ts` | Magic-byte sniffer for JPEG / PNG / WEBP / PDF / SVG. Never trusts extension or client MIME. |
| `src/lib/storage/fileSniff.test.ts` | Sniff happy path + renamed executable. |
| `src/lib/freePreview/hubAssets.ts` | Process (sharp rotate, strip metadata, ≤2560px, 480px WEBP thumb; SVG original + raster PNG; PDF as-is), caps, private blob path, serve plan, soft-delete + immediate blob delete, purge helpers. |
| `src/lib/freePreview/hubAssets.test.ts` | EXIF/GPS strip, `.exe` as `.jpg`, SVG+script not inline, PDF attachment, caps, fake-blob purge. |
| `src/lib/freePreview/hubApi.ts` | Shared hub API gate: both flags, exact-origin on non-GET, IP + token rates, 413 over 4 MB, capabilities. |
| `src/lib/freePreview/hubApi.flagOff.test.ts` | Source proof that every new hub API goes through `resolveHubApiContext` (404 unless both flags are on) and existing `/api/free-preview/[token]/*` routes are untouched. |
| `src/lib/freePreview/hubDetails.ts` | Zod for PATCH details (hex `#RRGGBB`, style ≤500, about ≤600) and asset PATCH (caption ≤140, sortOrder, barberId). |
| `src/pages/api/preview-hub/[token]/assets.ts` | GET list + POST multipart. `hub_asset_uploaded` event + analytics `{kind}`. |
| `src/pages/api/preview-hub/[token]/assets/[id].ts` | GET stream (`?size=thumb\|full`), PATCH, DELETE. Images inline; SVG originals and PDFs `attachment` + `application/octet-stream`. |
| `src/pages/api/preview-hub/[token]/details.ts` | PATCH brand colours / notes / about. `hub_details_saved`. |
| `src/pages/api/preview-hub/[token]/assets.test.ts` | Happy path, flag-off 404, stage denial, bad kind, 429, 413. |
| `src/pages/api/preview-hub/[token]/assets/[id].test.ts` | Cross-request 404, SVG never inline, PATCH/DELETE, capability denial. |
| `src/pages/api/preview-hub/[token]/details.test.ts` | Happy path, invalid hex, capability denial. |
| `src/components/previewHub/downscaleHubImage.ts` | Client downscale: max 2560px long edge, JPEG 0.85, keep PNG only with transparency. Skip SVG/PDF. |
| `src/components/previewHub/HubUploader.tsx` | Drag & drop, choose, camera (separate `capture="environment"` input so iOS is not forced onto camera), multi-select, 3 parallel XHR, per-file progress / retry / `aria-live`. |
| `src/components/previewHub/HubUploader.test.tsx` | Empty drop zone; Your shop empty + no-upload states. |

### Your shop + Overview
| File | Why |
|---|---|
| `src/lib/freePreview/extractLogoColours.ts` | Client-safe median-cut on RGBA pixels; ignores near-white / near-black / transparent; ≤5 hexes. |
| `src/lib/freePreview/extractLogoColours.test.ts` | Three sharp-generated fixture logos (red, blue+gold, green on white). |
| `src/components/previewHub/HubYourShop.tsx` | Brand (logo swatches, pick-from-logo, hex, style notes), photos (reorder, caption, 5s undo then DELETE), team photos, price list (≤5), about, Batch 4 placeholders. Autosave PATCH details. |
| `src/pages/preview/[token]/details.astro` | Wires `HubYourShop` instead of coming-soon. |
| `src/lib/freePreview/hubChecklist.ts` | Logo / photos to-do; price + about optional; Services / Team / Hours always “On your preview”. |
| `src/lib/freePreview/hubChecklist.test.ts` | Flags and progress. |
| `src/components/previewHub/HubOverview.astro` | Checklist card + grouped activity. |
| `src/pages/preview/[token]/overview.astro` | Loads assets and builds the checklist. |
| `src/lib/freePreview/hubPage.ts` | Groups consecutive `hub_asset_uploaded` (“You added 6 photos”). |
| `src/styles/components/preview-hub.css` | Details, uploader, checklist, toast, reduced-motion. |

### Ops, email, retention, privacy
| File | Why |
|---|---|
| `src/pages/ops/preview-requests/[id].astro` | Files section (grid by kind, thumb, download original, name/size/date/uploader, brand colours + notes). Sets `opsLastSeenAt` on open. |
| `src/pages/ops/preview-requests/index.astro` | “New files” badge; mobile cards so the badge is visible below 48rem (the existing table is `display: none` on small screens). |
| `src/pages/api/ops/preview-requests/[id]/assets/[assetId].ts` | Operator download (attachment, `private, no-store`). |
| `src/pages/api/ops/preview-requests/[id]/assets/[assetId].test.ts` | Auth denial, wrong-request 404, attachment download. |
| `src/lib/freePreview/opsQueries.ts` | `hubAssets` on list/detail; `hasNewHubFiles`; `markPreviewRequestOpsSeen`. |
| `src/lib/freePreview/opsQueries.hubFiles.test.ts` | Badge logic. |
| `src/lib/freePreview/hubFilesNotify.ts` | Send on upload if `opsFilesNotifiedAt` is null or ≥15 min old; otherwise the hourly lifecycle cron picks pending digests up. |
| `src/lib/freePreview/hubFilesNotify.test.ts` | Debounce window. |
| `src/lib/freePreview/emails.ts` | `buildHubFilesAddedInternalEmail` — subject `Files added: {shop}`. |
| `src/lib/freePreview/lifecycle.ts` | Purge hub blobs + rows; `sendPendingHubFileDigests` when the hub flag is on. |
| `src/lib/freePreview/legalCopy.ts` | `FREE_PREVIEW_PRIVACY_HUB_FILES_TEXT`. |
| `src/pages/privacy.astro` | Sentence under the free preview collection item. Unconditional. |
| `src/lib/legal/legalPageDates.ts` | `PRIVACY_POLICY_LAST_UPDATED_ISO` = `2026-10-31` (material legal change). |
| Date assertions | `legalCopy.test.ts`, `privacyDualRole.test.ts`, `starterV118LegalAlignment.test.ts`, `businessIdentityConsistency.test.ts`, `marketingSitemap.test.ts`. |
| `src/styles/components/ops-preview-requests.css` | Files grid + new-files badge. |
| `scripts/preview-hub/capture-batch-2.mjs` | Playwright fixtures at 360 and 1280. |

### Copy, events, access
| File | Why |
|---|---|
| `src/lib/freePreview/hubCopy.ts` | Batch 2 owner / ops / email strings (listed below). |
| `src/lib/freePreview/createPreviewRequest.ts` | `hub_asset_uploaded` / `updated` / `deleted`, `hub_details_saved`, `ops_hub_opened`, `ops_hub_files_notified`. |
| `src/lib/analytics/funnelEvents.ts` | `hub_asset_uploaded`, `hub_details_saved`. |
| `src/lib/freePreview/previewAccess.ts` | Select brand colours, style notes, about text. |

---

## Migrations

`prisma/migrations/20261031220000_preview_hub_2/migration.sql`

- `ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_HUB_FILES_INTERNAL';`
- `CREATE TYPE "PreviewHubAssetKind"` (`LOGO`, `SHOP_PHOTO`, `TEAM_PHOTO`, `PRICE_LIST`, `MESSAGE_ATTACHMENT`, `CHANGE_ATTACHMENT`, `OTHER`)
- `CREATE TABLE "PreviewHubAsset"` with `deletedAt`, `uploadedBy`, indexes, FK to `PreviewRequest` (`ON DELETE CASCADE`)

No drops, no renames. Existing `PreviewRequest` columns unchanged.

---

## New env vars

None. Hub still requires `PREVIEW_HUB_ENABLED=true` **and** `FREE_PREVIEW_FLOW_ENABLED=true`. Default off.

**Do not turn the hub flag on in production until this privacy sentence is live** (it is in this branch, unconditional).

---

## New copy (beyond HUB_SPEC §9)

All in `hubCopy.ts`. Extra Batch 2 strings:

- Upload UI: `HUB_UPLOAD_HINT_*`, `HUB_UPLOAD_DROP`, `HUB_UPLOAD_CHOOSE`, `HUB_UPLOAD_CAMERA`, `HUB_UPLOAD_RETRY`, `HUB_UPLOAD_PROGRESS`, per-error strings (`TYPE`, `TYPE_LOGO`, `TYPE_PHOTO`, `TOO_LARGE`, `TOO_LARGE_BODY`, `EMPTY`, `REJECTED`, cap messages, `GENERIC`, `DENIED`)
- Save: `HUB_SAVING`, `HUB_SAVED`, `HUB_SAVE_FAILED`, `HUB_RETRY`, `HUB_UNDO`, `HUB_DELETE`
- Captions / reorder: `HUB_CAPTION_*`, `HUB_MOVE_UP`, `HUB_MOVE_DOWN`
- Empty states: `HUB_EMPTY_PHOTOS`, `HUB_EMPTY_TEAM_PHOTOS`, `HUB_EMPTY_PRICE`, `HUB_EMPTY_LOGO`
- Details cards: `HUB_DETAILS_*` (brand, photos, team photos, price, about, colours, pick-from-logo, hex, swatches, placeholder links)
- Checklist: `HUB_CHECKLIST_*` including `HUB_CHECKLIST_ON_PREVIEW` and `HUB_CHECKLIST_OPTIONAL`
- Activity grouping: `HUB_ACTIVITY_ADDED`, `HUB_ACTIVITY_KIND_*`
- Ops: `HUB_OPS_NEW_FILES`, `HUB_OPS_FILES_*`, `HUB_OPS_DOWNLOAD`, uploaded-by labels, brand/style/about labels
- Ops email: `HUB_OPS_FILES_EMAIL_SUBJECT` (`Files added: {shop}`), intro, button
- Activity labels: `hub_asset_uploaded` → “Files added”; `hub_details_saved` → “Shop details saved”
- Privacy (legal, not hub-gated): `FREE_PREVIEW_PRIVACY_HUB_FILES_TEXT` — “Files you add in your private shop hub (logo, photos, price lists) are used only to build your preview and website, and are deleted with your preview if you don't launch.”

No response-time promises, no guaranteed dates.

---

## Decisions taken in this batch

1. **Soft-delete + immediate blob delete.** The client waits 5 seconds (Undo) before calling DELETE. The API then sets `deletedAt` and deletes the private blobs immediately so a deleted file cannot be fetched. Retention still deletes leftover rows + any remaining paths. Undo after the API call would need a re-upload; that is acceptable for privacy.
2. **Ops files digest.** On each successful upload: send now if `opsFilesNotifiedAt` is null or ≥15 minutes old; otherwise skip and let `runFreePreviewLifecycleHourly` call `sendPendingHubFileDigests` (BATCH_0_FINDINGS (l) — no new queue).
3. **`opsLastSeenAt` is a cursor, not an event flood.** Opening `/ops/preview-requests/{id}` updates the timestamp only. Writing `ops_hub_opened` on every GET would flood History. File digest send writes `ops_hub_files_notified`.
4. **SVG / PDF never `inline`.** Originals are `Content-Disposition: attachment` and `Content-Type: application/octet-stream`. Display uses the raster thumb (PNG for SVG). An SVG with `<script>` can be stored (owner-supplied) but is never served as a document the browser will execute.
5. **Launch can still upload** (`canUpload`); details PATCH uses `canEditDetails` (false at Launch).
6. **Privacy date bumped** to 31 October 2026 because the collection section changed.
7. **Ops list mobile cards.** The existing table is `display: none` below 48rem. Cards were added so “New files” is visible on a phone.

---

## Screenshots

Saved under `docs/preview-hub/screens/batch-2/` (Playwright, 360px and 1280px, full page). Fixture markup + real hub / ops / legal CSS. Capture script: `scripts/preview-hub/capture-batch-2.mjs`.

| Screen | 360 | 1280 |
|---|---|---|
| Your shop empty | `details-empty-360.png` | `details-empty-1280.png` |
| Your shop filled (logo, colours, photos, team, price, about) | `details-filled-360.png` | `details-filled-1280.png` |
| Uploading / error / undo toast | `details-uploading-360.png` | `details-uploading-1280.png` |
| Overview checklist + “You added 6 photos” | `overview-checklist-360.png` | `overview-checklist-1280.png` |
| Ops list “New files” | `ops-list-new-files-360.png` | `ops-list-new-files-1280.png` |
| Ops Files empty | `ops-files-empty-360.png` | `ops-files-empty-1280.png` |
| Ops Files grid | `ops-files-grid-360.png` | `ops-files-grid-1280.png` |
| Privacy — hub files sentence | `privacy-hub-files-360.png` | `privacy-hub-files-1280.png` |

390 / 768 / 1024 were not separately shot; 360 covers the phone column and 1280 the desktop shell. CSS uses `minmax(0, 1fr)` grids; fixtures show no horizontal scroll.

---

## Test results

| Command | Result |
|---|---|
| `npm run claims:check` | Pass |
| `npm run typecheck` | Pass (0 errors after a `getContext('2d')` cast in `downscaleHubImage.ts`) |
| Hub + ops vitest (20 files, 124 tests) | Pass — sniff, colours (3 fixtures), EXIF/GPS strip, exe-as-jpg, SVG not inline, purge with fake blob, APIs, flag-off, checklist, digest debounce, HubUploader / HubYourShop |
| Full `npm test` | First run: 1 failed / 5588 passed — known-flaky `financialEndpoints` MANAGER 403 timed out (5s). Rerun of that file: 25/25 pass. |
| `npm run build` | Pass |

---

## Anything I could not do

- **Live 390px Fast 3G upload of 10 photos** against a real `/preview/{token}/details` row. No seeded hub request or private-blob credentials in this environment. Covered by: client 3-parallel uploader, 4 MB / 60 file / 250 MB / 40 photo caps, and the processing tests. Confirm on a REQUESTED token after migrate + both flags on, throttled to Fast 3G.
- Live Playwright against hub routes (same reason). Screenshots are CSS-accurate fixtures.
- Apply the migration to a hosted database (`prisma migrate deploy` is for the operator).
- Horizontal-scroll check at 390 / 768 on a running server.

---

## Open questions

Carried from Batch 1:

1. Approve-for-launch: `approveSiteLaunch` vs `PreviewRequest.launchApprovedAt`?
2. D1 dashboard retail product+live gate — out of hub batches unless asked.
3. Converting REJECTED/DECLINED if they pay — current webhook allows it.
4. Direct-subscribe hub (`entryPoint = 'direct_subscribe'`) — Batch 5.
5. Should `/preview/{token}/overview` redirect to `/preview/{token}`?

New:

6. After Undo expires, DELETE removes blobs immediately. If ops wants a recycle window longer than 5 seconds, we would need to delay blob delete (and block GET for `deletedAt` rows, which we already do).
7. Team photos stay a general set until Batch 4 links `barberId`.

---

## Acceptance

| Item | Status |
|---|---|
| Phone (390px) uploads 10 photos on Fast 3G; thumbnails appear | **Not proven live.** Unit/UI in place. Do not treat as done until a throttled pass on a real token. |
| EXIF/GPS absent from stored files (GPS fixture) | Pass (`hubAssets.test.ts` — JPEG with APP1 GPS; `sharp` metadata.exif gone) |
| Renamed `.exe` as `.jpg` rejected | Pass (`processHubUpload` + magic-byte sniff) |
| SVG with `<script>` never served inline | Pass (serve plan + GET test: `attachment` + `application/octet-stream`) |
| Ops can download every file | Pass (ops GET attachment; Files grid “Download original”) |
| Token of another request cannot read the asset | Pass (owner GET and ops GET 404) |
| Colour picker extracts sensible colours from 3 fixture logos | Pass (`extractLogoColours.test.ts`) |
| Flag off: owner behaviour unchanged | Pass (`hubApi.flagOff.test.ts`; existing `/api/free-preview` guards untouched; hub APIs 404) |
| Privacy sentence live in `/privacy` | Pass (unconditional). Keep `PREVIEW_HUB_ENABLED` off in production until this ships. |

**Batch 2 product code is in place** behind `PREVIEW_HUB_ENABLED`. The live Fast 3G 10-photo pass is the remaining acceptance gap — do not mark the batch done until that is confirmed on a seeded token.
