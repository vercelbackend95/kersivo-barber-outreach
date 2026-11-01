# Shop Hub runbook

For the founder. British English. The Shop Hub is **off** until you set the flag.

## Real-stack QA (local only)

The Batch 6 fixture harness is gone. Use the real app against a **local** Postgres:

```
npm run test:preview-hub-real
```

That script:

1. Refuses to run if `DATABASE_URL` is not localhost / 127.0.0.1 (Preview and Production share Neon — do not point this at it).
2. Starts `docker-compose.preview-hub.yml` (port 55432) or an embedded Postgres if Docker is missing.
3. Applies the current Prisma schema (`db push` — historical migrations are not replayable on an empty cluster) and runs `scripts/preview-hub/seed-real.ts`.
4. Starts `astro dev` with `PREVIEW_HUB_ENABLED=true`, `FREE_PREVIEW_FLOW_ENABLED=true`, `PRIVATE_BLOB_DRIVER=memory`, `PREVIEW_HUB_STRIPE_STUB=true`.
5. Starts `astro dev` on `127.0.0.1:4397`, runs Playwright (`scripts/preview-hub-real.spec.ts`), then restarts the same port with the hub flag off to prove REQUESTED tokens 404 and the old acknowledgement email.

Optional: after a seed, `node scripts/preview-hub/start-real-qa.mjs --serve` and `node scripts/preview-hub/lighthouse-real.mjs` for mobile Lighthouse on the real routes.

Do **not** set `PREVIEW_HUB_ENABLED` on the Vercel Preview environment. Do not run this against the production `DATABASE_URL`.

## Turn the flag on or off

Two Vercel environment variables, both must be the exact value `true`:

| Variable | Meaning |
|---|---|
| `FREE_PREVIEW_FLOW_ENABLED` | Public `/free-preview` form and emails |
| `PREVIEW_HUB_ENABLED` | Private `/preview/{token}` hub, hub emails, hub APIs, rebuilt launch checklist |

Both default **off**. With `PREVIEW_HUB_ENABLED` off, owners see today's preview page, acknowledgement email (no hub link), and the old `/admin/preview-launch` form. Production owner behaviour stays the same.

**On (Production only):** Vercel → project `kersivo-barber-outreach` → Settings → Environment Variables → set `PREVIEW_HUB_ENABLED=true` on **Production only**. Never set it on Preview or Development — Preview deployments share the production database. Redeploy Production.  
**Off:** set `PREVIEW_HUB_ENABLED` back to empty / `false` on Production and redeploy. Existing hub rows stay in the database; owners fall back to the previous flow.

Do not run `vercel` / `vercel link` from a folder that is not this project.

## Work a request end-to-end (ops)

Sign in with a Google account that is on `KERSIVO_OPS_EMAILS`. Open **Ops → Preview requests** (`/ops/preview-requests`).

1. **New request (Requested).** Open the row. Overview has the links they sent. Files / Messages tabs show anything they added in the hub. Create or link a draft shop, fill services / team / hours in the usual dashboard tools, set the site preview URL, then **Mark ready and send**.
2. **Review.** The owner sees the website, review cards and changes. Unread messages and open changes sort to the top of the list.
3. **Changes sent.** Content tab: Apply or Dismiss each proposal. Changes tab: set In progress / Done / Not possible (note required for Not possible). When the website build is updated, **Mark ready and send** again — the owner gets the “We've updated your preview” email listing Done / Not possible items.
4. **Subscribed (Launch).** The owner pays, then finishes `/admin/preview-launch` (login). When they approve, the list shows **Approved — ready to launch**.
5. **Our steps.** On the request: **Domain connected**, **SSL active**, then **Mark live**. Mark live emails the owner and moves the hub to Live.

Operators can open any hub with **Open hub as KERSIVO**. Those views are not counted as owner views.

## Apply corrections

On `/ops/preview-requests/{id}` → **Content**:

- Each card shows the latest proposal against the draft shop.
- **Apply** writes services / team / hours through the existing service-layer helpers. The booking preview updates immediately. The framed website is a separate build — update that URL too if the page itself must change.
- **Dismiss with note** if you will not apply it. The owner sees the note.
- If the draft shop changed since the proposal, Apply returns a conflict — refresh and try again.

Corrections do **not** use the included design-change round.

## Grant a round

On the **Changes** tab: **Grant extra round**. Use this when the included round is used and a further design pass is fair. The owner can then send drafts again.

## Mark launch steps and live

On the request Overview (hub flag on):

| Action | What it records | Owner sees |
|---|---|---|
| Domain connected | `ourStepDomainAt` | Our steps → Connect your domain → Done |
| SSL active | `ourStepSslAt` | Our steps → Secure it (SSL) → Done |
| Mark live | `liveAt` + site-live email | Hub stage **Live** |

Confirm each prompt. Mark live emails the owner. It does **not** set `goLiveAt` (that is the old site-preview approval timestamp).

## If an upload fails

Owner-facing errors are already specific (“This file is over 4 MB”, “Only JPG, PNG, WEBP or PDF”).

1. Ask them to try a smaller JPG/PNG from their phone (the hub compresses to 4 MB before upload).
2. HEIC: they should not pick “Keep original” on iPhone — Safari converts HEIC when the input accepts JPEG.
3. SVG/PDF logos are stored privately and only served as downloads, not as an inline image.
4. Caps: 60 files, 250 MB, 40 shop photos, 5 price lists, 3 logos per request.
5. If every file fails: check Vercel `PRIVATE_BLOB_READ_WRITE_TOKEN` is set on the **private** store (not the public blob token). Without it, uploads fail closed.

Ops can download originals from the Files tab. Blob URLs are never shown.

## If an email fails

Hub mail goes through the existing outbox (`EmailOutbound`) then Resend.

1. Check `/api/cron/email-outbox` (every 5 minutes) is healthy.
2. In the database, look at `EmailOutbound` for that request’s `dedupeKey` (`free-preview:…`). Failed rows retry on the cron.
3. File and message **ops** digests are at most one per request per 15 minutes. If you expected mail and none arrived, wait for that window or check `opsFilesNotifiedAt` / `opsMessagesNotifiedAt`.
4. Owner “KERSIVO sent a message” mail is immediate and transactional (still sent if they opted out of follow-ups).
5. Reply-to is `hello@kersivo.co.uk`. Owners reply **in the shop hub** — inbound email into the thread is not enabled (Resend receiving + `reply.` DNS were not verified on this plan).

Production must have `RESEND_API_KEY` and `FROM_EMAIL`. Locally, without the key, mail is logged to the console (`dev-log`) and still queued.

## Owner stages (what they can do)

| Stage | They can |
|---|---|
| Requested / Designing | Upload files, shop details, messages |
| Review | Website, review cards, draft/send one round of changes, subscribe, messages |
| Launch | Launch progress (no address/legal/Stripe under the token). Checklist is `/admin/preview-launch` after login |
| Live | Dashboard next steps + messages |
| Expired | HTTP 410 + “Ask us to reopen it” (creates a message) |
| Declined | Closed state + messages until purge |
| Rejected / unknown | 404, same as a bad link |

## Retention

Expired, declined or rejected requests are anonymised 90 days after expiry. Hub files (blobs + rows), messages, change requests and reviews are deleted. File names and message bodies must not remain. Converted (paying) shops are never purged by this job.
