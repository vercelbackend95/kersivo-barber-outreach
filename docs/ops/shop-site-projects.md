# Shop website projects

The single reference for the website KERSIVO builds for each shop. Every shop website lives **outside this
repo**, in its own GitHub repo and its own Vercel project (decision: `docs/free-preview-discovery.md` §14),
and reads every shop fact from the SiteData API ([`docs/site-data-contract.md`](../site-data-contract.md)).

**Founder rule: the design work is never lost.** A shop website project is never deleted. When a preview is
not converted, the project is archived as a reusable design template. Personal data (the shop's photos,
team names and photos, contact details) still follows the retention schedule below.

## Naming

| Thing | Name |
| --- | --- |
| GitHub repo | `vercelbackend95/kersivo-site-<shop-slug>` |
| Vercel project | `kersivo-site-<shop-slug>` in team `vercelbackend95s-projects` |

`<shop-slug>` is the shop's booking slug at the time the project is created. It never changes afterwards,
even if the slug does.

- Repos are **private**. They hold shop photos and team photos, which are personal data.
- Create these projects from the shop project's own folder (or the Vercel dashboard). Never run `vercel` /
  `vercel link` in this repo's folder or any folder that is not linked to the right project (`CLAUDE.md`).

## Modes (`SITE_MODE`)

One environment variable in the shop's Vercel project decides what the site serves.

| `SITE_MODE` | Data | Indexing | Framing | Domain |
| --- | --- | --- | --- | --- |
| `preview` | Private preview data: `GET /api/public/site-preview` with header `X-Kersivo-Preview-Token: <KERSIVO_PREVIEW_TOKEN>` (server-side only) | `noindex, nofollow` (header and meta) | `Content-Security-Policy: frame-ancestors https://kersivo.co.uk` (the preview hub frames it) | `*.vercel.app` |
| `live` | Public data: `GET /api/public/site/{slug or own domain}` | Indexable | Not framed | The shop's own domain |
| `template` | The fictional fixture [`docs/site-data/fixture.json`](../site-data/fixture.json), bundled in the repo. No API call, no shop content. | `noindex, nofollow` | Not framed | `*.vercel.app` |

In every mode the site follows the contract: render a section only when its `has.*` flag is true, use the
`*Display` strings as they are, embed `seo.jsonLd` unchanged.

## Lifecycle

1. **Build.** Create the repo and the Vercel project (naming above), `SITE_MODE=preview`, set
   `KERSIVO_PREVIEW_TOKEN`. Build the design from the ops build pack ([`build-pack.md`](./build-pack.md)).
2. **Preview URL in ops.** Set the project's `*.vercel.app` URL as the website preview URL on
   `/ops/preview-requests/[id]` (it must be https, frameable from kersivo.co.uk and send noindex), then
   **Mark ready and send**.
3. **Changes.** The owner asks for changes in the preview hub; push them to the same project. The preview
   URL stays the same.
4. **Subscribe and approve.** The owner subscribes to Full KERSIVO and approves the site.
5. **Domain.** Add the shop's own domain to **the same Vercel project**. Never move the site to a new project.
6. **`SITE_MODE=live`.** Switch the project to live data and redeploy. Remove `KERSIVO_PREVIEW_TOKEN`. The
   project must serve `/book` as a `307` to `booking.hostedUrl` (contract §7, "Own-domain booking path").
7. **Ops marks the destination live.** Register `https://<shop-domain>/book` as the Full booking destination
   and complete the attestation. From then on `booking.url` is the own-domain URL.

## Expiry

A preview expires `PREVIEW_EXPIRY_DAYS` (30) days after it is sent (`src/lib/freePreview/config.ts`).

- After expiry the preview API answers `404`, so the site shows a neutral "not available" page. It shows no
  shop content and no error details.
- The code and the design stay untouched. Nothing is changed in the project.
- Re-sending the preview from ops sets a new expiry; the API answers again and the site is back, with no
  redeploy.

## Archive (not converted)

For `EXPIRED`, `DECLINED` and `REJECTED` requests the retention job purges the draft shop and the personal
data `PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY` (90) days after expiry (`src/lib/freePreview/lifecycle.ts`;
`CONVERTED` requests are never purged). The job cannot touch the external project. It logs:

```
[free-preview] retention: archive the shop website project (template mode, remove the shop's content) { id, sitePreviewUrl }
```

When that log appears for a request (or earlier, if the owner declines), archive the project:

1. Set `SITE_MODE=template`.
2. Remove the shop's photos, logo and copy from the repo (anything that came from the build pack or the
   owner). The design, components and styles stay.
3. Remove `KERSIVO_PREVIEW_TOKEN` from the Vercel project.
4. Redeploy, and check the site shows only the fixture shop.
5. Old deployments may still hold the photos. Delete those deployments in Vercel, keeping the latest
   template deployment.
6. Keep the repo (private) and the Vercel project. Do not delete either.

## Reuse for another shop

- Duplicate the repo into `kersivo-site-<new-slug>` and create a new Vercel project for it. Then start at
  step 1 of the lifecycle.
- Never repoint an archived project at a different shop. A project belongs to one shop for life; its
  history, deployments and domain settings are that shop's.

## Related

- Data contract, booking deep links and the own-domain `/book` redirect:
  [`docs/site-data-contract.md`](../site-data-contract.md)
- Build pack for the design: [`build-pack.md`](./build-pack.md)
- Shop health checks of the live site and the preview: [`shop-health.md`](./shop-health.md)
