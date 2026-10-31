# Batch 3 report — Messages

**Date:** 31 October 2026  
**Branch:** `preview-hub-batch-3` (from `preview-hub-batch-2`)  
**Spec:** `docs/preview-hub/HUB_SPEC.md` v1.0  

---

## What changed (files)

### Data
| File | Why |
|---|---|
| `prisma/schema.prisma` | Additive `PreviewHubMessage` model, `PreviewRequest.hubMessages` relation, `EmailOutboundPurpose.FREE_PREVIEW_HUB_MESSAGE_OWNER` and `FREE_PREVIEW_HUB_MESSAGES_INTERNAL`. `opsMessagesNotifiedAt` already existed from Batch 1. |
| `prisma/migrations/20261031230000_preview_hub_3/migration.sql` | One migration, named `preview_hub_3`. |

### Messages lib, emails, retention
| File | Why |
|---|---|
| `src/lib/freePreview/hubMessages.ts` | Zod POST body, load/create/mark-read, attachment ownership, purge helpers. |
| `src/lib/freePreview/hubMessageText.ts` | Excerpt, HTML escape, safe URL split (no Prisma). |
| `src/lib/freePreview/hubMessagesNotify.ts` | Immediate owner email; ops digest debounce (15 min) + hourly pickup. |
| `src/lib/freePreview/emails.ts` | `buildHubMessageFromKersivoEmail`, `buildHubMessagesAddedInternalEmail`. |
| `src/lib/freePreview/lifecycle.ts` | Clear message bodies, delete rows; send pending message digests. |
| `src/lib/freePreview/legalCopy.ts` | Privacy sentence for hub messages. |
| `src/pages/privacy.astro` | Renders the messages sentence. Unconditional. |

### Owner + ops APIs
| File | Why |
|---|---|
| `src/lib/freePreview/hubApi.ts` | Message IP (20/hour) + per-request (20/hour, 100/day) rates; `requireMessageCapability`; `MESSAGE_ATTACHMENT` uploads allowed whenever `canMessage`. |
| `src/pages/api/preview-hub/[token]/messages.ts` | GET/POST. Event `hub_message_sent`; analytics `{actor:'owner'}`. Allowed in every visible stage. |
| `src/pages/api/preview-hub/[token]/messages/read.ts` | Marks KERSIVO messages `readByOwnerAt`. |
| `src/pages/api/preview-hub/[token]/assets.ts` | Kind parsed before capability; `MESSAGE_ATTACHMENT` skipped from the files digest. |
| `src/lib/freePreview/hubAssets.ts` | Owner upload kinds include `MESSAGE_ATTACHMENT`. |
| `src/pages/api/ops/preview-requests/[id]/messages.ts` | GET (marks owner messages read) / POST (KERSIVO reply + immediate owner email). |

### Owner + ops UI
| File | Why |
|---|---|
| `src/components/previewHub/HubMessages.tsx` | Thread, day separators, You/KERSIVO, Seen, attachments, composer, optimistic send + retry, 30s visible-tab poll. |
| `src/components/previewHub/HubUploader.tsx` | Compact mode + `MESSAGE_ATTACHMENT`. |
| `src/components/previewHub/HubShell.astro` | Unread dot on sidebar, top bar, tab bar. |
| `src/components/previewHub/HubOverview.astro` | Declined/expired primary buttons open the composer with a draft. Help card already opened Messages. |
| `src/pages/preview/[token]/messages.astro` | Wires the thread. `?draft=reopen` / `?draft=message`. |
| Hub pages (`overview`, `details`, `website`, `changes`) | Pass unread count into the shell. |
| `src/lib/freePreview/hubPage.ts` | Activity labels: "You sent a message" / "KERSIVO replied" (no body). |
| `src/lib/freePreview/opsQueries.ts` | Unread owner-message count; list sorts unread first. |
| `src/pages/ops/preview-requests/index.astro` | Unread badge on cards + table. |
| `src/pages/ops/preview-requests/[id].astro` | Overview / Files / Messages tabs; opening Messages marks owner messages read. |
| `src/styles/components/preview-hub.css` | Thread, composer, unread dot. |
| `src/styles/components/ops-preview-requests.css` | Unread badge + tabs. |
| `scripts/preview-hub/capture-batch-3.mjs` | Playwright fixtures at 360 and 1280. |

### Copy, events, analytics
| File | Why |
|---|---|
| `src/lib/freePreview/hubCopy.ts` | Batch 3 owner / ops / email strings (listed below). |
| `src/lib/freePreview/createPreviewRequest.ts` | `hub_message_sent`, `hub_messages_read`, `ops_hub_message_sent`, `ops_hub_messages_read`, `ops_hub_messages_notified`. |
| `src/lib/analytics/funnelEvents.ts` | `hub_message_sent`. |

---

## Migrations

`prisma/migrations/20261031230000_preview_hub_3/migration.sql`

- `ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_HUB_MESSAGE_OWNER';`
- `ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_HUB_MESSAGES_INTERNAL';`
- `CREATE TABLE "PreviewHubMessage"` with `attachmentIds TEXT[]`, read timestamps, FK to `PreviewRequest` (`ON DELETE CASCADE`)

No drops, no renames. Existing `PreviewRequest` columns unchanged (`opsMessagesNotifiedAt` already present).

---

## New env vars

None. Hub still requires `PREVIEW_HUB_ENABLED=true` **and** `FREE_PREVIEW_FLOW_ENABLED=true`. Default off.

---

## New copy (beyond HUB_SPEC §9)

All in `hubCopy.ts`. Extra Batch 3 strings:

- Thread: `HUB_YOU`, `HUB_KERSIVO`, `HUB_SEEN`, `HUB_SEND`, `HUB_ATTACH`, `HUB_MESSAGE_PLACEHOLDER`, `HUB_MESSAGE_HINT`, `HUB_MESSAGE_CHAR_COUNT`, `HUB_UNREAD`
- Errors: `HUB_MESSAGE_TOO_LONG`, `HUB_MESSAGE_REQUIRED`, `HUB_MESSAGE_SENDING`, `HUB_MESSAGE_SENT`, `HUB_MESSAGE_FAILED`, `HUB_MESSAGE_LOAD_ERROR`, `HUB_MESSAGE_ATTACH_MAX`, `HUB_MESSAGE_ATTACH_DENIED`
- Drafts: `HUB_DRAFT_REOPEN` (`Please reopen this preview.`), `HUB_DRAFT_DECLINED` (`I'd like to continue with this preview.`)
- Activity: `HUB_ACTIVITY_YOU_SENT`, `HUB_ACTIVITY_KERSIVO_REPLIED`
- Owner email: `HUB_OWNER_MESSAGE_EMAIL_SUBJECT` (`New message from KERSIVO about {shopName}`), intro, button `Reply in your shop hub`
- Ops email: `HUB_OPS_MESSAGES_EMAIL_SUBJECT` (`{n} new message(s) from {shopName}`), intro, button
- Ops UI: `HUB_OPS_MESSAGES_TITLE`, `HUB_OPS_MESSAGES_EMPTY`, `HUB_OPS_UNREAD_MESSAGES`, tab labels
- Privacy: `FREE_PREVIEW_PRIVACY_HUB_MESSAGES_TEXT`

No response-time promises, no guaranteed dates.

---

## Decisions taken in this batch

1. **One event name for owner sends (`hub_message_sent`), `ops_hub_message_sent` for ops.** Activity uses actor / action so the feed never includes the body.
2. **KERSIVO → owner email is transactional** (outbox even if `emailOptOut`). Deduped per message id.
3. **Owner → ops email** uses the Batch 2 files pattern: send now if `opsMessagesNotifiedAt` is null or ≥15 minutes old; otherwise the hourly lifecycle cron picks it up.
4. **`MESSAGE_ATTACHMENT` uploads** are allowed whenever `canMessage` is true (every visible stage, including declined / expired / live). They do not trigger the files digest.
5. **Opening the ops Messages tab** (page + GET) sets `readByOpsAt` on unread owner messages. Owner POST `/messages/read` sets `readByOwnerAt` on KERSIVO messages.
6. **Privacy date stays 31 October 2026** (already bumped in Batch 2). New messages sentence is unconditional.
7. **Operator on the owner hub Messages page** uses the ops API so a reply still emails the owner.

---

## Screenshots

Saved under `docs/preview-hub/screens/batch-3/` (Playwright, 360px and 1280px, full page). Fixture markup + real hub / ops / legal CSS. Capture script: `scripts/preview-hub/capture-batch-3.mjs`.

| Screen | 360 | 1280 |
|---|---|---|
| Messages empty | `messages-empty-360.png` | `messages-empty-1280.png` |
| Messages thread (You / KERSIVO / Seen / 2 photos) | `messages-thread-360.png` | `messages-thread-1280.png` |
| Expired composer with reopen draft | `messages-reopen-360.png` | `messages-reopen-1280.png` |
| Overview unread shell + activity | `messages-unread-shell-360.png` | `messages-unread-shell-1280.png` |
| Overview expired CTA | `overview-expired-cta-360.png` | `overview-expired-cta-1280.png` |
| Ops list unread | `ops-list-unread-360.png` | `ops-list-unread-1280.png` |
| Ops Messages empty | `ops-messages-empty-360.png` | `ops-messages-empty-1280.png` |
| Ops Messages thread | `ops-messages-thread-360.png` | `ops-messages-thread-1280.png` |
| Privacy — hub messages sentence | `privacy-hub-messages-360.png` | `privacy-hub-messages-1280.png` |

390 / 768 were not separately shot; 360 covers the phone column and 1280 the desktop shell.

---

## Test results

| Command | Result |
|---|---|
| `npm run claims:check` | Pass |
| `npm run typecheck` | Pass (0 errors) |
| Hub + ops vitest (Batch 3 files, 95 tests) | Pass — schema/zod, XSS escape + React render, rate constants 20/hour + 100/day, flag-off source proof, owner/ops APIs, digest debounce, email snapshot, activity labels, unread sort, retention clears bodies then deletes rows |
| Full `npm test` | First run: 2 failed / 5621 passed — `brandTokens` (hardcoded `#d72638` fallbacks; fixed) and known-flaky `financialEndpoints` MANAGER 403 timeout. Rerun of both files: 27/27 pass. |
| `npm run build` | Pass |

---

## Anything I could not do

- **Live mobile send of 2 photos** against a real `/preview/{token}/messages` row. No seeded hub request or private-blob credentials in this environment. Covered by: owner POST with two `attachmentIds`, compact uploader + camera, XSS render test, ops GET/POST. Confirm on a REQUESTED token after migrate + both flags on.
- Live Playwright against hub routes (same reason). Screenshots are CSS-accurate fixtures.
- Apply the migration to a hosted database (`prisma migrate deploy` is for the operator).
- Horizontal-scroll check at 390 / 768 on a running server.

---

## Open questions

Carried from Batch 1 / 2:

1. Approve-for-launch: `approveSiteLaunch` vs `PreviewRequest.launchApprovedAt`?
2. D1 dashboard retail product+live gate — out of hub batches unless asked.
3. Converting REJECTED/DECLINED if they pay — current webhook allows it.
4. Direct-subscribe hub (`entryPoint = 'direct_subscribe'`) — Batch 5.
5. Should `/preview/{token}/overview` redirect to `/preview/{token}`?

New:

6. Should unused `MESSAGE_ATTACHMENT` files (uploaded but never sent) stay until purge, or be swept after a timeout?

---

## Acceptance

| Item | Status |
|---|---|
| Owner sends a message with 2 photos from mobile; ops sees it, replies; owner gets the email, clicks through, sees the reply and "Seen" on their message | **Not proven live.** Unit/UI/email in place. Do not treat as done until a real-token pass. |
| Rate limits enforced (test) | Pass (`hubApi.flagOff.test.ts` constants; owner POST returns 429 when the limiter fires) |
| XSS: message body containing HTML renders as text (test) | Pass (`hubMessageText` escape + `HubMessageBody` React test; email snapshot escapes `<img>`) |
| Flag off: owner behaviour unchanged | Pass (new APIs go through `resolveHubApiContext` / `isHubRouteEnabled`; existing `/api/free-preview` guards untouched) |
| Retention: purge deletes messages; anonymisation clears bodies | Pass (`lifecycle.ts` + test: `updateMany` body `''` then `deleteMany`) |
| Privacy sentence for messages | Pass (unconditional). Keep `PREVIEW_HUB_ENABLED` off in production until this ships. |

**Batch 3 product code is in place** behind `PREVIEW_HUB_ENABLED`. The live owner↔ops photo + email pass is the remaining acceptance gap — do not mark the batch done until that is confirmed on a seeded token.
