# Ops build pack

KERSIVO builds every client website individually. `/ops/preview-requests/[id]` shows everything the owner
supplied on **Overview › Build brief**, and **Download build pack (.zip)** hands all of it over in one file,
ready to give to an AI tool (or a designer) to design a unique site.

## Where it lives

| Piece | File |
| --- | --- |
| Loader (one source of truth) | `src/lib/ops/buildPack.ts` → `loadBuildPack(requestId)` |
| Field coverage (mapped vs excluded) | `src/lib/ops/buildPackFields.ts`, guarded by `buildPack.coverage.test.ts` |
| Overview UI | `src/components/ops/previewRequests/OpsBuildBrief.astro` |
| Zip layout, `shop.json`, README | `src/lib/ops/buildPackZipPlan.ts` |
| `brief.md` | `src/lib/ops/buildPackBrief.ts` |
| Streaming zip | `src/lib/ops/streamZip.ts` (fflate) |
| Endpoint | `GET /api/ops/preview-requests/[id]/build-pack` (`?format=md`, `?format=json`) |

The loader is read-only and returns `null` once the request is anonymised. When two sources hold the same
fact and disagree, both values are returned and listed under `conflicts`; nothing is silently picked.

## What it contains

```
kersivo-build-pack_<shop-slug>_<YYYY-MM-DD>/
  README.md                      how to use, contents, not provided, conflicts, files that failed
  brief.md                       the design brief (British English)
  shop.json                      the BuildPack as JSON (schemaVersion 1), paths relative to this folder
  brand/logo/<name>              all LOGO uploads, originals
  brand/colours.json             primary, secondary, tone, source, extracted palette, snapshot
  photos/shop/NN_<caption>.<ext> SHOP_PHOTO in sortOrder
  photos/team/<barber>.<ext>     TEAM_PHOTO named after the linked barber
  documents/price-list/…         PRICE_LIST
  documents/other/…              OTHER
  revisions/change-requests.md   open change requests (SENT, IN_PROGRESS)
  revisions/attachments/…        CHANGE_ATTACHMENT and MESSAGE_ATTACHMENT
```

Originals come from private Blob (`storagePath`), never thumbnails. Every path segment is sanitised to ASCII
(no separators, no `..`) and de-duplicated case-insensitively. A file that cannot be read is skipped, and the
download carries on; README lists it under "Files that could not be included" and its `path` in `shop.json`
is `null`. Each zip download records `ops_build_pack_downloaded` (operator email, file counts) in History.

## Field → source

| Build brief | Source |
| --- | --- |
| Shop name, town | `PreviewRequest.shopName/townCity` (preview form) and draft `ShopSettings.name/townCity` (hub › Business details); conflict if they differ |
| Tagline, address, postcode, phone, public email | draft `ShopPublicProfile` |
| Own domain, barbers, booking system, notes | `PreviewRequest.hasOwnDomain/barberCount/currentBookingSystem/notes` |
| Opening hours | `ShopOpeningHours` of the draft shop → 7-day week |
| Logo | `PreviewHubAsset` kind LOGO (current = snapshot logo once sent, else newest); `ShopSettings.logoUrl` shown if set |
| Colours | `PreviewRequest.brand*` (hub Colours) and `ShopPublicProfile.brandPrimary/SecondaryColour`; `brandSubmittedSnapshot` = what was sent to KERSIVO; conflicts listed |
| Style notes | `PreviewRequest.styleNotes` |
| About / description | `PreviewRequest.aboutText` (hub) and `ShopPublicProfile.description` (dashboard); conflict if both set and different |
| Anything else | `PreviewRequest.websiteExtraText` |
| Links | `PreviewRequest.workLinks` (or the four legacy URL columns), `instagramUrl`; profile Instagram, Facebook, TikTok, other |
| Services | `Service` (active), ordered by `displayOrder` |
| Team | `Barber` (active and shown on website); team photos matched by `PreviewHubAsset.barberId` |
| Products | `Product` (active); stock is not included |
| Photos, documents | `PreviewHubAsset` (not deleted), grouped by kind, ordered by `sortOrder`, `createdAt` |
| Change requests | `PreviewChangeRequest` with status SENT or IN_PROGRESS; legacy `changesRequestedText` |

Deliberately **not** in the pack (data minimisation, since the pack is pasted into AI tools): the owner's
first name and personal request email, consent and marketing records, internal notes, tokens, Stripe ids,
barber emails, stock levels. The full list with reasons is `BUILD_PACK_EXCLUDED_FIELDS`. A new column on
PreviewRequest, ShopPublicProfile, Service, Barber, Product, PreviewHubAsset or PreviewChangeRequest fails
`buildPack.coverage.test.ts` until it is mapped or excluded with a reason.

## Using it with an AI tool

1. Download the pack from the request (or **Copy brief** for the text alone).
2. Start a new conversation, paste `brief.md`, and attach the logo, `brand/colours.json` and the photos you
   want used. Attach `shop.json` when the tool should generate pages from structured data.
3. Ask for a design for this shop only. The brief already tells the tool to use only the facts provided,
   to leave placeholders for anything under "Not provided", and to write in British English.
4. Resolve anything under "Conflicts to confirm" with the owner before building.
5. Check the output against KERSIVO's rules before it goes live: no invented prices, reviews, awards,
   opening hours or claims.

## Vercel limits (checked 2026-11-04)

- Functions limits page (last updated 2026-08-24): request/response body limit is 4.5 MB; duration with
  Fluid compute defaults to 300 s on Hobby and Pro (Pro maximum 800 s).
- The limits page gives no streaming exception to the 4.5 MB limit; the Vercel KB article on the body size
  limit says streaming functions do not have it. The zip is streamed for that reason.
- The Astro Vercel adapter bundles all routes into one function, so `maxDuration` is left at the default.
- Preview deployments share the production database and Blob store (`DATABASE_URL`,
  `BLOB_READ_WRITE_TOKEN` are set for Production and Preview).
