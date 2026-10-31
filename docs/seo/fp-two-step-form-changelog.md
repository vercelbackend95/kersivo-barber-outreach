# /free-preview two-step form

Step 1 asks only for what we need to send a request; everything else moves to an optional Step 2 on the same card. This replaces the required fields in `docs/free-preview-spec.md` §4–5 and its submit label.

## Step 1
`shopName`, `townCity`, one smart link field and `email`, plus the honeypot. The platform tiles, per-platform rows, selects, first name, note and consent checkbox are gone. Card height: 1449px → about 700px at 375px, 988px → about 590px at 1440px. The whole card now fits at 1366×768, so the existing two-column hero stays as it was.

Link parsing is in `workLinkNormalise.ts` (`parseLinkInput`, `splitLinkInput`); the field itself is `initSmartLinks.ts`. A comma only splits links when another link follows it, because Google Maps URLs contain commas.

## Step 2
`initPreviewDetails.ts` posts answered fields only to `POST /api/free-preview/details`. The request gets a separate 256-bit token, valid for 24 hours and stored only as a SHA-256 hash. It is not `publicToken`, which is the private preview URL and must never reach the browser here. The schema is strict, so a non-Step-2 field is rejected.

## Consent
Submitting under the statement sets `authorisationConsentAt` and `authorisationStatementVersion`. Rows from the checkbox form keep a null version. The wording and version live together in `intake.ts`, pinned by a test: change the wording, bump the version. The Terms text already covers this, so there is no Terms version bump. The marketing opt-in is a separate, unticked Step 2 checkbox.

## Emails
E1 is unchanged. E2 shows "No links provided" when there are none, and `—` for unanswered questions. Step 2 sends a short follow-up internal email with only the new answers, through the outbox with the existing internal purpose, so no enum migration was needed.

## Retries
The same email and shop within 10 minutes returns the existing request with a fresh token and sends no emails. The per-email rate limit still counts these attempts.

## Migration
`20261031200000_free_preview_two_step_form` is backwards compatible: three columns become nullable and three are added. It runs on the production build only (`scripts/build-plan.mjs`), so a Vercel preview has the new code without the new columns and cannot save a request until production has migrated.

## Analytics
`fp_form_start`, `fp_link_added`, `fp_no_link_prompt_shown`, `fp_submit_success`, `fp_submit_error`, `fp_step2_saved`, `fp_step2_skipped`, all through `trackConsentedEvent`. `preview_form_start` and `preview_request_submitted` still fire so existing funnels continue. `preview_work_platform_selected` and `preview_work_platform_autodetected` are removed with the tiles.
