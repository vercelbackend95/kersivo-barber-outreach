# KERSIVO — Sub-processor & International Transfer Register

| Field | Value |
| --- | --- |
| Status | Internal compliance record |
| Last reviewed | 2026-09-21 |
| Related contract | `/dpa` version `2026-09-21` |
| Production baseline (repo) | `185745d8eaf7a9b84e97260207a8eb925ecb0c08` |
| Companion record | [ropa.md](./ropa.md) |
| Review trigger | Provider, processing-location, DPA, transfer mechanism, or product-use change |

This register is **internal**. It is **not** published on the public website. It must **not** contradict `/dpa`.

---

## Regulatory basis

This register supports UK GDPR documentation of recipients and international transfers alongside Article 30-style records:

- Distinguishes **processor / sub-processor** arrangements for Customer Personal Data from **KERSIVO controller** vendors and **Client-direct** relationships
- Records whether a transfer is **restricted**, what **safeguard** is relied on (if known), and whether a **data protection test / TRA** has been completed
- Does **not** treat “vendor DPA exists” as automatic compliance completion

**ICO terminology (2026):** a transfer risk assessment (TRA) is also referred to as the **data protection test**. Where an Article 46 safeguard is used for a restricted transfer, KERSIVO’s DPA commits to completing any required test. **No completed internal TRA artifact exists in this repository** as of the Last reviewed date.

---

## Classification legend

| Code | Meaning |
| --- | --- |
| **A** | Sub-processor for Customer Personal Data (DPA Schedule 2) |
| **B** | KERSIVO independent-controller vendor |
| **C** | Client / direct third-party relationship (not a normal KERSIVO Sub-processor) |
| **D** | Currently no Customer Personal Data by design (residual risk may still exist) |

---

## Register

| # | Provider / service | KERSIVO use | Data involved | KERSIVO role | Provider role | Conditional or always used | Destination / processing location | Restricted transfer? | Transfer mechanism | DPA / contractual source | TRA / data protection test status | Additional safeguards / notes | Last verified | Action required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Vercel** | Application hosting/runtime; Vercel Blob storage (incl. private note/onboarding assets) | Customer Personal Data necessary to host/run the application and files; also KERSIVO controller data in same runtime | Processor (for CPD); also hosts controller processing | Sub-processor (CPD) / processor or service provider (controller data) — **VERIFY** contracting entity labels on account | **Always** for hosted production service | **VERIFY** (Vercel project / Blob region; hostnames include `kersivo.co.uk`, `*.vercel.app`; Blob API `blob.vercel-storage.com`) | **VERIFY** (may leave UK) | Current Vercel DPA / applicable UK transfer safeguards — **exact mechanism VERIFY** | `/dpa` Schedule 2; Privacy recipients | **TRA STATUS: NOT YET COMPLETED** | HTTPS; private Blob for note/onboarding assets; env secrets | 2026-09-21 (repo audit) | P0: pin region; confirm signed DPA + mechanism; complete TRA if restricted |
| 2 | **Neon (Databricks)** | Managed PostgreSQL | Customer Personal Data in application DB; also KERSIVO controller records in same DB | Processor (CPD) / controller (own records) | Sub-processor (CPD) | **Always** for hosted production service | **VERIFY** from Neon console / production `DATABASE_URL` host (not asserted in committed repo config) | **VERIFY** | Current Neon/Databricks contractual safeguards applicable to the KERSIVO account — **exact mechanism VERIFY** | `/dpa` Schedule 2; Privacy; `docs/ops/backup-restore-neon.md` (PITR) | **TRA STATUS: NOT YET COMPLETED** | TLS to DB (`sslmode=require` expected); PITR backups (residual copies after purge) | 2026-09-21 | P0: confirm region; signed terms; TRA; document backup retention clock |
| 3 | **Resend / Plus Five Five, Inc.** | Transactional email delivery | Recipient email, name where included, booking/order/account transactional content, manage links, delivery metadata | Processor for live-shop CPD email; **controller** for KERSIVO account/marketing/contact mail | Sub-processor (CPD paths) / processor for controller mail | Used where transactional email is sent (`RESEND_API_KEY` required in prod paths) | **VERIFY** | **VERIFY** | Current Resend DPA, including applicable UK transfer safeguards — **exact mechanism VERIFY** | `/dpa` Schedule 2; Privacy email delivery | **TRA STATUS: NOT YET COMPLETED** | Outbox tracking; payload clearing on SENT where implemented | 2026-09-21 | P0: confirm signed DPA + destination; TRA |
| 4 | **Twilio** | SMS delivery — **ACTIVE CURRENT PROVIDER** | Phone number, reminder message content, delivery metadata | Processor (CPD) when SMS reminders enabled | Sub-processor | **Conditional / ACTIVE** — only where SMS functionality is enabled (`TWILIO_*` creds + `SMS_REMINDERS_ENABLED` + shop `smsRemindersEnabled`). **Not deprecated.** | **VERIFY** (`api.twilio.com`) | **VERIFY** | Current Twilio DPA / applicable UK transfer safeguards — **exact mechanism VERIFY** | `/dpa` Schedule 2 | **TRA STATUS: NOT YET COMPLETED** | Feature-gated; outbox purge with shop | 2026-09-21 | P0: confirm whether enabled in prod; if yes, DPA + TRA |
| 5 | **Sentry** | Server/application error monitoring | Minimised/scrubbed operational telemetry; direct customer PII not intentionally sent; residual tenant/record IDs / error context possible | Processor (residual CPD risk) when enabled | Sub-processor (as listed in DPA) | **Conditional** — only where `SENTRY_DSN` / monitoring configured | **VERIFY** | **VERIFY** | Current Sentry DPA / applicable UK transfer safeguards — **exact mechanism VERIFY** | `/dpa` Schedule 2; Schedule 3 F | **TRA STATUS: NOT YET COMPLETED** | `sendDefaultPii: false`; `scrubSentryEvent` / `beforeSend` | 2026-09-21 | P0: confirm prod DSN; TRA; residual ID risk accepted |
| 6 | **Slack** | Operational alert delivery / incident notification | Minimised operational telemetry; emails/phones intentionally sanitised; alerts may contain tenant-linked or record-linked operational identifiers and technical error context | Processor (residual CPD risk) when enabled | Sub-processor (as listed in DPA) | **Conditional** — only where `OPS_SLACK_WEBHOOK_URL` configured and Slack operational alerting enabled | **VERIFY** (webhook destination / Slack workspace region) | **VERIFY** | Current Slack data-processing terms and applicable lawful UK transfer safeguards — **exact contracting entity / mechanism VERIFY** (do not invent entity) | `/dpa` Schedule 2 Slack row | **TRA STATUS: NOT YET COMPLETED** | `sanitizeOpsText` in `alertSink.ts`; no-op if webhook unset | 2026-09-21 | P0: confirm prod webhook; TRA; accept residual identifier risk |
| 7 | **Stripe** (KERSIVO platform) | SaaS subscription / setup deposit billing on KERSIVO’s Stripe account | Customer name/email, shop details, payment status, Stripe customer/subscription/session identifiers; no full PAN on KERSIVO servers | **Independent controller** | Payment service provider / processor under Stripe terms — **VERIFY** role labels on Stripe account | Used for KERSIVO billing/checkout | **VERIFY** (`api.stripe.com`) | **VERIFY** | Stripe data-processing / transfer terms — **VERIFY** | Privacy recipients (“other providers”); DPA Schedule 2 **excludes** Stripe platform billing as CPD sub-processor | **TRA STATUS: NOT YET COMPLETED** (controller-side transfer) | Webhook signature validation; durable webhook ledger | 2026-09-21 | P0/P1: confirm Stripe DPA/transfer terms for controller data |
| 8 | **Stripe Connect** | Live barbershop deposits and retail card payments | Limited identifiers/statuses on KERSIVO; card data on Client’s Stripe; Client is seller of record for shop payments | Facilitator / limited processor of status ids — **not** listed as normal CPD Sub-processor | Client’s payment provider relationship | Used when Client Connect account linked / payments enabled | **VERIFY** | **VERIFY** (Client/Stripe boundary) | Client’s Stripe terms + Connect arrangements — **VERIFY** | `/dpa` Schedule 2 Stripe Connect note; Privacy | **TRA STATUS: NOT YET COMPLETED** (boundary responsibility **VERIFY**) | No full PAN stored by KERSIVO | 2026-09-21 | P1: document Client vs KERSIVO transfer responsibilities at onboarding |
| 9 | **Google Analytics 4** | Marketing-site analytics | Pseudonymous usage analytics as described in Privacy | **Independent controller** | Analytics provider | Conditional on `PUBLIC_GA4_MEASUREMENT_ID` + analytics consent + layout `enableAnalytics` (**off** on live tenant book/shop) | **VERIFY** (Google; CSP includes `region1.google-analytics.com` etc.) | **VERIFY** | Google terms / UK transfer safeguards — **VERIFY** | Privacy; DPA Schedule 2 exclusions (marketing-controller) | **TRA STATUS: NOT YET COMPLETED** | Consent Mode; tenant analytics disabled | 2026-09-21 | P1: TRA if restricted; keep tenant-off tests green |
| 10 | **Google Ads** | Advertising measurement / optional remarketing on marketing site | Ads measurement / audience tags; **no** Enhanced Conversions (no hashed email/phone) | **Independent controller** | Ads provider | Conditional on Ads IDs + advertising / personalised-ads consent | **VERIFY** | **VERIFY** | Google terms — **VERIFY** | Privacy; DPA exclusions | **TRA STATUS: NOT YET COMPLETED** | Separate consent for personalised advertising | 2026-09-21 | P1: TRA if restricted |
| 11 | **Google OAuth** | Admin “Continue with Google” sign-in | Account identifiers/tokens in `Account` model | **Independent controller** (account/auth) | Identity provider | Conditional on `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | **VERIFY** | **VERIFY** | Google OAuth / data terms — **VERIFY** | DPA Schedule 2 exclusions; `src/lib/auth.ts` | **TRA STATUS: NOT YET COMPLETED** | Better Auth integration | 2026-09-21 | P0: confirm if enabled in prod; TRA |
| 12 | **OpenAI** | **A — CONDITIONAL SUB-PROCESSOR** for Admin AI assistant / language-model processing. Separately: catalogue/recommendation AI designed around product/catalogue semantics (not CPD by design) | Free-text prompts, conversation context, generated responses and necessary technical metadata; Customer Personal Data only if included in the Client user's prompt/context. KERSIVO does not auto-inject Client CRM/booking rows | Processor when the prompt contains Customer Personal Data controlled by the barbershop Client | Sub-processor in that context | **Yes — conditional** — admin AI assistant enabled and `OPENAI_API_KEY` configured | **VERIFY** actual KERSIVO OpenAI account/project configuration (do not claim regional hosting) | **VERIFY** based on actual processing location and applicable mechanism | Current OpenAI DPA / applicable UK transfer mechanism (public baseline includes SCCs as amended by the UK Addendum) — **VERIFY** exact current account applicability | `/dpa` Schedule 2 OpenAI row; Privacy OpenAI bullet | **TRA / data protection test: NOT YET COMPLETED** | Client-facing minimisation notice; no claim that CPD is required in prompts; investigate available OpenAI project retention/privacy configuration; **no Zero Data Retention claim until verified**. Public baseline: API business data not used for training by default; abuse-monitoring logs may retain content up to ~30 days by default — account settings = **VERIFY**. Narrow admin-AI error logging (message only). KERSIVO does not persist AI conversation content in the application database; does not persist AI conversation content in localStorage/sessionStorage; conversation history is page-memory only; user-facing minimisation notice is shown | 2026-09-21 | **P0 before first live Client using admin AI assistant** |

---

## Providers classified as Sub-processors (A)

Per `/dpa` Schedule 2:

1. Vercel  
2. Neon (Databricks)  
3. Resend / Plus Five Five, Inc.  
4. Twilio (conditional — SMS) — **ACTIVE CURRENT PROVIDER**  
5. Sentry (conditional — `SENTRY_DSN`)  
6. Slack (conditional — `OPS_SLACK_WEBHOOK_URL`)  
7. OpenAI (conditional — admin AI assistant / `OPENAI_API_KEY`)

## Providers NOT classified as Sub-processors (and why)

| Provider | Class | Why not a normal KERSIVO CPD Sub-processor |
| --- | --- | --- |
| Stripe (platform) | **B** | KERSIVO independent-controller billing; DPA exclusion |
| Stripe Connect | **C** | Client’s Stripe relationship; DPA Connect note |
| Google Analytics 4 | **B** | KERSIVO marketing-controller; tenant tags off; DPA exclusion |
| Google Ads | **B** | KERSIVO marketing-controller; DPA exclusion |
| Google OAuth | **B** | KERSIVO account/auth context; DPA exclusion |

---

## Catalogue vs admin AI (OpenAI)

OpenAI is classified **A** for the **admin AI assistant** free-text path. Catalogue/recommendation classification remains **designed not to send Customer Personal Data** (product/catalogue semantics). That design path is not a Schedule 2 exclusion that overrides the admin chat listing.

## Privacy vs DPA list note

Public Privacy and DPA Schedule 2 were aligned in the same-day OpenAI correction to list Vercel, Neon, Resend, Twilio, Sentry, Slack, and OpenAI (each with applicable conditions). Stripe and Google remain in separate controller/functional contexts. This register follows the **DPA**.

---


## Planned provider — AWS End User Messaging SMS (NOT ACTIVE)

| Field | Value |
| --- | --- |
| Provider | AWS End User Messaging SMS |
| Status | **PLANNED PROVIDER — NOT ACTIVE** |
| Current processing | None |
| Customer Personal Data currently sent | None |
| Reason for planned evaluation | Potential future replacement for Twilio, primarily for SMS cost optimisation |

**Do not** list AWS on public `/dpa` Schedule 2 or Privacy as an active Sub-processor until production migration prerequisites below are complete.

### P0 BEFORE SMS MIGRATION (required before production use)

1. Verify exact AWS service/product to be used
2. Verify KERSIVO AWS contracting/account position
3. Verify UK Sender ID registration requirements
4. Verify exact UK outbound SMS pricing for intended origination identity
5. Verify production AWS region/account configuration
6. Verify actual processing/storage locations
7. Verify AWS DPA
8. Verify sub-processor terms applicable to the service
9. Verify UK international-transfer mechanism
10. Complete required data protection test / TRA
11. Test SMS delivery and reliability
12. Prepare Client sub-processor change notice if live Clients exist
13. Update DPA Schedule 2
14. Update Privacy
15. Update ROPA
16. Update Sub-processor Transfer Register
17. Migrate production traffic
18. Verify Twilio no longer receives Customer Personal Data
19. Only then retire Twilio from active-provider records

**Notice / consent:** The current DPA gives general written authorisation for Sub-processor changes, with a planned **14-day** notice where reasonably practicable. Clients do **not** need a new consent checkbox for a future Twilio → AWS migration.

---
## Open compliance actions

### P0 — before first live Client

1. Complete **TRA / data protection test** for each restricted transfer actually used (Vercel, Neon, Resend, and any enabled Twilio/Sentry/Slack/Google/Stripe/OpenAI path).
2. Obtain/confirm **signed current vendor DPAs** and record the **exact** UK safeguard (adequacy / IDTA / Addendum / SCCs), including OpenAI DPA + UK Addendum terms for the live account.
3. Pin **Neon** and **Vercel/Blob** processing locations from vendor consoles.
4. Confirm production enablement of **Twilio**, **Sentry**, **Slack**, **Google OAuth**, **OpenAI** admin AI.
5. Confirm OpenAI **project data-residency**, **retention**, and whether **Zero Data Retention** applies (**VERIFY** — do not claim ZDR without account proof). Admin AI is listed on Schedule 2; catalogue path remains designed non-CPD.
6. Confirm **Slack** workspace/account contracting entity from actual terms (do not invent).

### P1 — before material scale

1. Keep public **Privacy** recipients aligned with DPA Schedule 2 after future vendor changes (Sentry/Slack/OpenAI aligned in same-day correction).
2. Document **Neon backup residual** retention for transfer/deletion completeness.
3. Clarify **Stripe Connect** transfer-risk ownership between Client and KERSIVO in onboarding pack.
4. Controller-side TRA coverage for **Stripe**, **GA4**, **Google Ads**, **Google OAuth**.

### P2 — ongoing hygiene

- Keep AWS planned migration checklist current; do not treat AWS as active until all P0 migration steps complete.


1. Refresh **Last verified** after each material vendor or product change.
2. Re-read vendor DPAs on renewal / material update.
3. Keep conditional env flags mirrored in ops docs (`docs/ops/alerts.md`, messaging, etc.).
