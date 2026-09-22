# KERSIVO — Sub-processor & International Transfer Register

| Field | Value |
| --- | --- |
| Status | Internal compliance record |
| Last reviewed | 2026-09-22 |
| Related contract | `/dpa` version `2026-09-22` |
| Production baseline (repo) | `288a0aefce74bc02e2c4ecf381e074cce798158d` |
| Companion record | [ropa.md](./ropa.md) |
| Vendor evidence | [vendor-evidence/vercel.md](./vendor-evidence/vercel.md); [vendor-evidence/neon.md](./vendor-evidence/neon.md); [vendor-evidence/resend.md](./vendor-evidence/resend.md); [vendor-evidence/openai.md](./vendor-evidence/openai.md); [vendor-evidence/sentry.md](./vendor-evidence/sentry.md) |
| Review trigger | Provider, processing-location, DPA, transfer mechanism, or product-use change |

This register is **internal**. It is **not** published on the public website. It must **not** contradict `/dpa`.

---

## Regulatory basis

This register supports UK GDPR documentation of recipients and international transfers alongside Article 30-style records:

- Distinguishes **processor / sub-processor** arrangements for Customer Personal Data from **KERSIVO controller** vendors and **Client-direct** relationships
- Records whether a transfer is **restricted**, what **safeguard** is relied on (if known), and whether a **data protection test / TRA** has been completed
- Does **not** treat “vendor DPA exists” as automatic compliance completion

**ICO terminology (2026):** a transfer risk assessment (TRA) is also referred to as the **data protection test**. Where an Article 46 safeguard is used for a restricted transfer, KERSIVO’s DPA commits to completing any required test. Completed internal TRA artefacts: [tra-neon-databricks.md](./tra-neon-databricks.md) (Neon/Databricks HR — **COMPLETED — PASS**, 2026-09-21); [tra-resend.md](./tra-resend.md) (Resend HR — **COMPLETED — PASS**, 2026-09-21); [tra-openai.md](./tra-openai.md) (OpenAI Admin AI CPD — **COMPLETED — PASS**, 2026-09-21). Adequacy-covered Non-HR transfers (no TRA file): **Vercel Inc.** (UK Extension); **Databricks, Inc. / Neon, LLC** Non-HR; **Plus Five Five, Inc. / Resend** Non-HR; **Functional Software, Inc. d/b/a Sentry** Non-HR ([vendor-evidence/sentry.md](./vendor-evidence/sentry.md)). Other vendor TRAs remain incomplete unless noted.

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
| 1 | **Vercel** — legal entity **Vercel Inc.** (public DPA). Plan: **CONFIRMED Pro** | Application hosting/runtime (Astro SSR + Serverless Functions **`lhr1`**); Vercel Cron; **dual Blob stores** — public `barberdemo-uploads` + private `kersivo-private`. Project `kersivo-barber-outreach` / org `team_GdO6pCXk8YyVs4tlwuRltvbJ` | **DATABASE/runtime CPD** via server routes; **BLOB/FILE DATA** in **private** store (client-note images, migration CSV, private onboarding assets). Public store holds intentionally public website images only (products/services/avatars/logos) | Processor (CPD) | Sub-processor (CPD). Public contracting entity: **Vercel Inc.** | **Always** for hosted production | Functions: **CONFIRMED `lhr1` / London, United Kingdom** (migrated from HISTORICAL `iad1` on 2026-09-21; production validated). Public Blob: **LHR1 London** (`barberdemo-uploads`, Public, `BLOB_READ_WRITE_TOKEN`). Private Blob: **LHR1 London** (`kersivo-private`, Private, Production-connected, `PRIVATE_BLOB_READ_WRITE_TOKEN`). Public DPA: primary processing facilities in the **United States**; additional global processing possible | **YES** / international transfer may occur, but covered by **UK adequacy** where the UK Extension applies to Vercel Inc. | **PRIMARY:** UK adequacy regulations / **UK Extension to EU-U.S. DPF** (Vercel Inc. ACTIVE; HR and Non-HR Data; next due 2027-04-29). **FALLBACK:** Vercel DPA **UK IDTA + 2021 SCCs**. Public DPA Last Updated 17 Mar 2026 / Effective 31 Mar 2026 | `/dpa` Schedule 2; Privacy; [vendor-evidence/vercel.md](./vendor-evidence/vercel.md); https://vercel.com/legal/dpa; U.S. DoC DPF List | **TRA / data protection test: NOT REQUIRED where UK Extension applies** | HTTPS; dual-store credential split (private fail-closed, no public-token fallback); private Blob + authenticated stream; tenant analytics off; env secrets. Periodically re-verify DPF/UK Extension ACTIVE status. P1: special-category / criminal-offence handling for free-text notes/uploads | 2026-09-21 | **P0:** confirm Production `PRIVATE_BLOB_READ_WRITE_TOKEN`; periodically verify UK Extension ACTIVE + HR/Non-HR coverage |
| 2 | **Neon** — contracting entity **Databricks, Inc. CONFIRMED**; billing entity **Neon, LLC CONFIRMED** (invoice). Plan: **Launch CONFIRMED** | Managed PostgreSQL (production DB) | **DATABASE DATA** only (CRM, bookings, staff, retail, outbox metadata, onboarding metadata, etc.). File bytes are **Vercel Blob**, not Neon. Also stores KERSIVO controller records in same DB. Staff may be **HR Data** only where employment-context applies (not every barber automatically) | Processor (CPD) / controller (own records) | Sub-processor (CPD) | **Always** for hosted production | **CONFIRMED** data plane: **AWS Europe West 2 (London) `eu-west-2`** (Neon Console + hostname `*.eu-west-2.aws.neon.tech`). Default branch **production** (Never expires); history retention **6 hours CONFIRMED** (visible window only). Postgres **17**; compute **0.25 ↔ 8 CU**. Onward: AWS (selected region); Grafana Labs **US** (Neon schedule — do not claim DB row content without evidence); other Databricks subprocessors **VERIFY** | **YES** — international transfer may occur for US corporate/support/onward layers **despite** London DB region. Do **not** treat UK region as “no international transfer” | **NON-HR PRIMARY:** UK adequacy / **UK Extension to EU-U.S. DPF** (Databricks, Inc. ACTIVE; Neon, LLC covered entity; **Non-HR Data only**; next due 2027-08-10). **HR:** Databricks DPA **UK Addendum + 2021 SCCs**, **Module Three** where KERSIVO is processor (adequacy does **not** cover HR) | `/dpa` Schedule 2; Privacy; `docs/ops/backup-restore-neon.md`; [vendor-evidence/neon.md](./vendor-evidence/neon.md); [tra-neon-databricks.md](./tra-neon-databricks.md); https://neon.com/platform-terms (Last Updated 2026-08-05); https://www.databricks.com/legal/mcsa; https://www.databricks.com/legal/dpa; U.S. DoC DPF List | **NON-HR:** TRA **NOT REQUIRED** where certification conditions apply. **HR:** TRA **COMPLETED — PASS** 2026-09-21 | TLS `sslmode=require`; visible history **6h CONFIRMED** — residual deletion beyond that window **VERIFY**; tenant scoping; periodically re-verify DPF/UK Extension ACTIVE + Neon, LLC coverage + Non-HR scope. DPA applies via **MCSA incorporation by reference** (not a separately signed DPA) | 2026-09-21 | **P0:** periodically verify Databricks UK Extension ACTIVE / Neon, LLC covered / Non-HR coverage; refresh HR TRA if DSIT analysis or processing chain materially changes; document residual deletion beyond 6h history window |
| 3 | **Resend / Plus Five Five, Inc.** | Transactional email delivery | Recipient email, name where included, booking/order/account transactional content, manage links, delivery metadata; team invite email may be **HR Data** only where employment-context applies (not every barber automatically) | Processor for live-shop CPD email; **controller** for KERSIVO account/marketing/contact mail | Sub-processor (CPD paths) / processor for controller mail | Used where transactional email is sent (`RESEND_API_KEY` required in prod paths) | **United States — CONFIRMED** (Resend GDPR: message content, delivery logs, webhook payloads, account records). Do not confuse sending-domain routing with storage location | **YES** — US storage/processing. **NON-HR** covered by UK adequacy where UK Extension applies | **NON-HR PRIMARY:** UK adequacy / **UK Extension to EU-U.S. DPF** (Plus Five Five, Inc. / Resend **ACTIVE — Re-certification under Review**; **Non-HR Data only**; next due 2027-03-03). **HR:** Resend DPA **UK Addendum + 2021 SCCs**, **Module Three** where KERSIVO is processor (adequacy does **not** cover HR) | `/dpa` Schedule 2; Privacy email delivery; [vendor-evidence/resend.md](./vendor-evidence/resend.md); [tra-resend.md](./tra-resend.md); https://resend.com/legal/dpa (Last update 2026-08-27); https://resend.com/security/gdpr; U.S. DoC DPF List | **NON-HR:** TRA **NOT REQUIRED** where certification conditions apply. **HR:** TRA **COMPLETED — PASS** 2026-09-21 | Outbox tracking; payload clearing on SENT where implemented. DPA applicability **CONFIRMED** via standard Agreement/DPA incorporation (no separate counter-signature claimed). Post-termination deletion within **90 days** (vendor contractual — do not equate to per-message retention). Periodically re-check DPF status while Re-certification under Review | 2026-09-21 | **P0:** periodically verify UK Extension ACTIVE + Non-HR coverage; if INACTIVE stop Non-HR adequacy reliance and use UK Addendum/SCCs + any required test; refresh HR TRA if DSIT/terms change |
| 4 | **Twilio** | SMS delivery — **ACTIVE CURRENT PROVIDER** | Phone number, reminder message content, delivery metadata | Processor (CPD) when SMS reminders enabled | Sub-processor | **Conditional / ACTIVE** — only where SMS functionality is enabled (`TWILIO_*` creds + `SMS_REMINDERS_ENABLED` + shop `smsRemindersEnabled`). **Not deprecated.** | **VERIFY** (`api.twilio.com`) | **VERIFY** | Current Twilio DPA / applicable UK transfer safeguards — **exact mechanism VERIFY** | `/dpa` Schedule 2 | **TRA STATUS: NOT YET COMPLETED** | Feature-gated; outbox purge with shop | 2026-09-21 | P0: confirm whether enabled in prod; if yes, DPA + TRA |
| 5 | **Sentry** — **Functional Software, Inc. d/b/a Sentry**; org **Kersivo**; project **`javascript-astro`**; plan **Developer** | Server/application error monitoring (Production **ACTIVE**; browser SDK **INACTIVE**) | Minimised/scrubbed operational telemetry; direct customer email/phone/name not intentionally sent as tags; residual pseudonymous IDs (`shopId`, `bookingId`, Stripe session/PI/refund IDs, `emailOutboundId`), route/status, stack/error context. **Non-HR** classification for current telemetry. Sensitive Data not intended/permitted | Processor (residual CPD risk) | Sub-processor (CPD residual) / processor (KERSIVO-controller ops) | **ACTIVE** in Production (`SENTRY_DSN` + `SENTRY_ENVIRONMENT` PRESENT on `kersivo-barber-outreach`; DSN matches project; Preview/Dev ABSENT). Browser inactive (`PUBLIC_SENTRY_DSN` ABSENT) | Organization storage **European Union (EU)**; ingestion **`ingest.de.sentry.io`**. International / onward transfer may still occur — do **not** treat EU region as eliminating transfers | **YES** — international transfer may occur; **NON-HR** covered by UK adequacy where UK Extension applies | **NON-HR PRIMARY:** UK adequacy / **UK Extension to EU-U.S. DPF** (Sentry.io **Active Participant**; UK Extension **Active**; **Non-HR Data only**; next due **2027-05-28**). **FALLBACK:** Sentry DPA Schedule 3 **2021 SCCs + UK Addendum** (**Module Three** for Client CPD processor path; Module Two only where KERSIVO is controller). If future processing includes **HR Data**, reassess before relying on UK Extension | `/dpa` Schedule 2; Schedule 3 F; [vendor-evidence/sentry.md](./vendor-evidence/sentry.md); Sentry DPA v5.1.0 (accepted **2026-09-21**); U.S. DoC DPF List | **TRA: NOT REQUIRED — ACTIVE UK EXTENSION ADEQUACY FOR CURRENT NON-HR DATA** | `sendDefaultPii: false`; KERSIVO `scrubSentryEvent` / `beforeSend`; org Require Data Scrubber + Default Scrubbers + Prevent IP storage **ON**; project scrubbers **ON**; no Safe Field exception; aggregated identifying data **OFF**; Replay/logs/profiling/feedback inactive; no Seer code integration; event retention baseline **30 days** (Developer/free-plan); backup deletion **VERIFY**. Periodically re-check DPF/UK Extension ACTIVE + Non-HR scope | 2026-09-21 | **P0:** periodically verify UK Extension ACTIVE + Non-HR coverage (next due 2027-05-28); reassess if HR Data or Sensitive Data scope changes |
| 6 | **Stripe** (KERSIVO platform) | SaaS subscription / setup deposit billing on KERSIVO’s Stripe account | Customer name/email, shop details, payment status, Stripe customer/subscription/session identifiers; no full PAN on KERSIVO servers | **Independent controller** | Payment service provider / processor under Stripe terms — **VERIFY** role labels on Stripe account | Used for KERSIVO billing/checkout | **VERIFY** (`api.stripe.com`) | **VERIFY** | Stripe data-processing / transfer terms — **VERIFY** | Privacy recipients (“other providers”); DPA Schedule 2 **excludes** Stripe platform billing as CPD sub-processor | **TRA STATUS: NOT YET COMPLETED** (controller-side transfer) | Webhook signature validation; durable webhook ledger | 2026-09-21 | P0/P1: confirm Stripe DPA/transfer terms for controller data |
| 7 | **Stripe Connect** | Live barbershop deposits and retail card payments | Limited identifiers/statuses on KERSIVO; card data on Client’s Stripe; Client is seller of record for shop payments | Facilitator / limited processor of status ids — **not** listed as normal CPD Sub-processor | Client’s payment provider relationship | Used when Client Connect account linked / payments enabled | **VERIFY** | **VERIFY** (Client/Stripe boundary) | Client’s Stripe terms + Connect arrangements — **VERIFY** | `/dpa` Schedule 2 Stripe Connect note; Privacy | **TRA STATUS: NOT YET COMPLETED** (boundary responsibility **VERIFY**) | No full PAN stored by KERSIVO | 2026-09-21 | P1: document Client vs KERSIVO transfer responsibilities at onboarding |
| 8 | **Google Analytics 4** | Marketing-site analytics | Pseudonymous usage analytics as described in Privacy | **Independent controller** | Analytics provider | Conditional on `PUBLIC_GA4_MEASUREMENT_ID` + analytics consent + layout `enableAnalytics` (**off** on live tenant book/shop) | **VERIFY** (Google; CSP includes `region1.google-analytics.com` etc.) | **VERIFY** | Google terms / UK transfer safeguards — **VERIFY** | Privacy; DPA Schedule 2 exclusions (marketing-controller) | **TRA STATUS: NOT YET COMPLETED** | Consent Mode; tenant analytics disabled | 2026-09-21 | P1: TRA if restricted; keep tenant-off tests green |
| 9 | **Google Ads** | Advertising measurement / optional remarketing on marketing site | Ads measurement / audience tags; **no** Enhanced Conversions (no hashed email/phone) | **Independent controller** | Ads provider | Conditional on Ads IDs + advertising / personalised-ads consent | **VERIFY** | **VERIFY** | Google terms — **VERIFY** | Privacy; DPA exclusions | **TRA STATUS: NOT YET COMPLETED** | Separate consent for personalised advertising | 2026-09-21 | P1: TRA if restricted |
| 10 | **Google OAuth** | Admin “Continue with Google” sign-in | Account identifiers/tokens in `Account` model | **Independent controller** (account/auth) | Identity provider | Conditional on `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | **VERIFY** | **VERIFY** | Google OAuth / data terms — **VERIFY** | DPA Schedule 2 exclusions; `src/lib/auth.ts` | **TRA STATUS: NOT YET COMPLETED** | Better Auth integration | 2026-09-21 | P0: confirm if enabled in prod; TRA |
| 11 | **OpenAI / OpenAI OpCo, LLC** — Production **ACTIVE** (Default project) | **A. Admin AI (Client CPD path):** free-text prompts/conversation context/responses; CPD only if OWNER/MANAGER voluntarily types it; no automatic CRM/booking injection. **B. Catalogue/recommendation:** product/service semantic fields (id/name/description/category); designed **not** CPD — do not classify as personal data merely because OpenAI is used | Processor when Admin AI prompt contains Client-controlled CPD; may be controller for KERSIVO-own non-CPD AI use | Sub-processor (Client CPD Admin AI) / processor (KERSIVO-controller data) | **Yes — ACTIVE** where OPENAI_API_KEY configured and Admin AI / recommendation paths run | **Global** project residency CONFIRMED (do not claim UK/EU residency); OpenAI OpCo, LLC UK importer; subprocessors may process in multiple countries | **YES** for Admin AI CPD (Global / US importer path) | **A Admin AI CPD:** OpenAI DPA **2021 SCCs + UK Addendum**, **Module Three** (KERSIVO processor → OpenAI sub-processor). **Module Two** only where KERSIVO is independent controller. **B Catalogue:** designed non-CPD product/service semantics. Do **not** rely on UK Extension/DPF for OpenAI without separate evidence | /dpa Schedule 2; Privacy; [vendor-evidence/openai.md](./vendor-evidence/openai.md); [tra-openai.md](./tra-openai.md); https://openai.com/policies/data-processing-addendum/ | **Admin AI CPD TRA: COMPLETED — PASS** 2026-09-21. Catalogue path not the primary TRA scope | DPA applicability **CONFIRMED** via Services Agreement / live API use (no separately signed DPA). Sharing/training opt-ins **all DISABLED**. Project retention **None** → ZDR/MAM **not enabled**. /v1/chat/completions abuse-monitoring retention up to **30 days**; store **omitted**. Default model **gpt-4o-mini**. KERSIVO does not durably store raw Admin AI prompts/responses. UI minimisation notice present | 2026-09-21 | **P1:** stronger UX/technical restriction before CRM-aware AI expansion; periodically re-check Data Controls |

---

## Providers classified as Sub-processors (A)

Per `/dpa` Schedule 2:

1. Vercel  
2. Neon (Databricks)  
3. Resend / Plus Five Five, Inc.  
4. Twilio (conditional — SMS) — **ACTIVE CURRENT PROVIDER**  
5. Sentry — **ACTIVE** in Production (`SENTRY_DSN`; project `javascript-astro`; server SDK only)
6. OpenAI (conditional — admin AI assistant / `OPENAI_API_KEY`)

## Removed / inactive providers (historical)

| Provider | Status | Notes |
| --- | --- | --- |
| **Slack** | **REMOVED** 2026-09-22 | Previously listed as conditional Schedule 2 ops alerting (`OPS_SLACK_WEBHOOK_URL` / AlertSink). Runtime Slack delivery and Production env were removed; material operational events now use Sentry only (`opsAlert=true` → Production ops alert rule). Slack TRA / transfer work was **not** completed — provider was removed instead. Dormant `OpsAlertDedupe` Prisma model remains for later schema cleanup. |

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

OpenAI is classified **A** for the **admin AI assistant** free-text path (Production **ACTIVE**; Default project; **Global** residency). Catalogue/recommendation classification remains **designed not to send Customer Personal Data** (product/catalogue semantics). That design path is not a Schedule 2 exclusion that overrides the admin chat listing. Admin AI CPD transfer mechanism: **2021 SCCs + UK Addendum**, **Module Three**; TRA **COMPLETED — PASS** 2026-09-21 ([tra-openai.md](./tra-openai.md)). ZDR/MAM are **not** enabled; sharing/training opt-ins are **disabled**; provider abuse-monitoring retention for chat completions is up to **30 days**.

## Privacy vs DPA list note

Public Privacy and DPA Schedule 2 list Vercel, Neon, Resend, Twilio, Sentry, and OpenAI (each with applicable conditions). **Slack was removed** from public disclosures and this register’s active table on **2026-09-22** after runtime/Production env removal. Stripe and Google remain in separate controller/functional contexts. This register follows the **DPA**.

---

## Vercel — transfer mechanism inputs (UK Extension ACTIVE)

Evidence sheet for Vercel Inc. transfers. **TRA is NOT REQUIRED where the active UK Extension applies.** Retain SCC/IDTA as fallback documentation only.

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | Vercel Inc. |
| Roles | KERSIVO Processor → Vercel Sub-processor (Customer Personal Data) |
| Data subjects | Booking clients; shop customers; Client staff/barbers; invitees; persons in notes/uploads |
| Data categories | Runtime CPD handled by server routes; private/public Blob file bytes; residual log risk **VERIFY** |
| Purpose | Host/run Services; store Blob assets under Client instructions |
| Frequency | Continuous while live |
| Duration | Active service + export/retention + provider residual per Vercel DPA |
| Special-category position | Not required by design; free-text/images may contain sensitive content (Client responsibility). UK Extension additional-handling caveat → **P1** operational control (not a TRA gate) |
| Technical safeguards | HTTPS; RBAC/tenant scoping; private Blob + authenticated streaming; env secrets; tenant analytics off |
| Encryption in transit | TLS/HTTPS |
| Storage separation | Neon = DATABASE DATA; Vercel Blob = BLOB/FILE DATA |
| Primary transfer mechanism | **UK adequacy / UK Extension to EU-U.S. DPF** — Vercel Inc. **ACTIVE**; HR and Non-HR Data; next certification due **2027-04-29** |
| Fallback contractual safeguards | Vercel DPA (Pro/Enterprise), **SCCs + UK IDTA**, subprocessors at security.vercel.com |
| Known destinations | Functions **`lhr1` London CONFIRMED**; Blob public+private **LHR1 London CONFIRMED**; United States primary facilities per DPA; additional global locations possible |
| Unknown / VERIFY | Log CPD; project Analytics toggle; periodic DPF status re-check |
| TRA status | **NOT REQUIRED where UK Extension applies** |

Full write-up: [vendor-evidence/vercel.md](./vendor-evidence/vercel.md)

---

## Neon / Databricks — transfer mechanism inputs (Non-HR / HR split)

Evidence sheet for Databricks, Inc. / Neon, LLC transfers. **Do not** treat London `eu-west-2` as eliminating restricted-transfer risk for US layers.

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **Databricks, Inc. — CONFIRMED** contracting entity; covered entity **Neon, LLC**; billing entity **Neon, LLC — CONFIRMED** |
| Roles | KERSIVO Processor → Neon/Databricks Sub-processor |
| Data subjects | Booking clients; shop customers; staff/barbers; invitees; persons in CRM/notes |
| Data categories | DATABASE DATA only (see ROPA Part B / Prisma). Exclude Blob file bytes. HR subset only where employment-context applies |
| Purpose | Store/query application database for Client Services |
| Frequency | Continuous while live |
| Duration | Active service + export window + history/PITR residual (visible window **6 hours CONFIRMED**; residual beyond that **VERIFY**) |
| Special-category position | Not required; free-text risk possible; special-category HR not required by design |
| Technical safeguards | TLS `sslmode=require`; tenant scoping; purgeShopData; secrets outside git |
| Known data-plane destination | **CONFIRMED** AWS Europe West 2 (London) `eu-west-2` (Neon Console + hostname) |
| Account config | Plan **Launch CONFIRMED**; default branch **production** (Never expires); Postgres **17**; compute **0.25 ↔ 8 CU** |
| Additional destinations | US corporate/support; Grafana Labs US (listed — do not claim DB row content without evidence); other Databricks subprocessors **VERIFY** |
| Non-HR primary mechanism | **UK adequacy / UK Extension to EU-U.S. DPF** — Databricks, Inc. **ACTIVE**; Neon, LLC covered; **Non-HR Data only**; next due **2027-08-10** (verified 2026-09-21) |
| Non-HR TRA status | **NOT REQUIRED** where certification conditions apply |
| HR mechanism | Databricks DPA **UK Addendum + 2021 SCCs**, **Module Three** where KERSIVO is processor |
| HR TRA status | **COMPLETED — PASS** 2026-09-21 — [tra-neon-databricks.md](./tra-neon-databricks.md) |
| Account applicability | Databricks DPA applicability **CONFIRMED through MCSA incorporation by reference** for the standard Neon Self-Service Plan (not a separately signed DPA) |

Full write-up: [vendor-evidence/neon.md](./vendor-evidence/neon.md)

---

## Resend / Plus Five Five, Inc. — transfer mechanism inputs (Non-HR / HR split)

Evidence sheet for Plus Five Five, Inc. (Resend) transfers. US storage is **CONFIRMED**; do not confuse sending-domain routing with storage location.

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **Plus Five Five, Inc.** (Resend) |
| Roles (CPD) | KERSIVO Processor → Resend Sub-processor |
| Data subjects | Booking/retail customers; invitees/staff where employment-context may apply; KERSIVO controller contacts |
| Data categories | Email recipient + transactional/invite content + delivery metadata. HR subset only where employment-context applies |
| Purpose | Deliver transactional / invitation / account email |
| Frequency | Continuous while mail paths are live |
| Duration | Active service + Resend processing; post-termination deletion within **90 days** (vendor contractual — not per-message retention) |
| Special-category position | Not required; ordinary team-invite content is email/role/shop/accept URL only |
| Destination | **United States — CONFIRMED** |
| Non-HR primary mechanism | **UK adequacy / UK Extension to EU-U.S. DPF** — **ACTIVE — Re-certification under Review**; **Non-HR Data only**; next due **2027-03-03** (verified 2026-09-21) |
| Non-HR TRA status | **NOT REQUIRED** where certification conditions apply |
| HR mechanism | Resend DPA **UK Addendum + 2021 SCCs**, **Module Three** where KERSIVO is processor |
| HR TRA status | **COMPLETED — PASS** 2026-09-21 — [tra-resend.md](./tra-resend.md) |
| Account applicability | DPA applicability **CONFIRMED** via standard Resend Agreement / DPA incorporation (no separately countersigned DPA claimed) |

Full write-up: [vendor-evidence/resend.md](./vendor-evidence/resend.md)

---

## OpenAI / OpenAI OpCo, LLC — transfer mechanism inputs (Admin AI CPD)

Evidence sheet for OpenAI Admin AI Customer Personal Data transfers. Project residency is **Global** — do not claim UK/EU residency. Do not claim ZDR.

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **OpenAI OpCo, LLC** |
| Roles (Client CPD) | KERSIVO Processor → OpenAI Sub-processor |
| Data subjects | Individuals whose Personal Data an OWNER/MANAGER voluntarily includes in Admin AI free text |
| Data categories | Free-text prompts/conversation context/responses; fixed system prompt; technical metadata. No automatic CRM injection |
| Purpose | Admin Assistant language-model responses |
| Frequency | Continuous while Admin AI is used |
| Duration | Request processing + OpenAI endpoint retention (chat completions abuse-monitoring up to **30 days** while project retention = None) |
| Special-category position | Not required/intended; residual unexpected free-text risk only; UI minimisation notice present |
| Destination | **Global** project residency; US importer; multi-country subprocessors possible |
| Mechanism | OpenAI DPA **UK Addendum + 2021 SCCs**, **Module Three** for Client CPD |
| TRA status | **COMPLETED — PASS** 2026-09-21 — [tra-openai.md](./tra-openai.md) |
| Account applicability | Services Agreement / DPA applicability **CONFIRMED** via live API use (no separately signed DPA). Sharing/training opt-ins **DISABLED**. ZDR/MAM **not enabled** |
| Catalogue path | Designed non-CPD product/service semantics — not the primary TRA scope |

Full write-up: [vendor-evidence/openai.md](./vendor-evidence/openai.md)

---

## Sentry / Functional Software, Inc. — transfer mechanism inputs (Non-HR)

Evidence sheet for Functional Software, Inc. d/b/a Sentry transfers. Organization storage is **European Union (EU)** with **`de.sentry.io`** ingestion — do **not** treat that as eliminating international / onward transfers. Current telemetry is classified **Non-HR**.

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **Functional Software, Inc. d/b/a Sentry** |
| Roles (Client residual CPD) | KERSIVO Processor → Sentry Sub-processor |
| Data subjects | Indirectly individuals via residual shop/booking/provider identifiers and error context |
| Data categories | Technical/error telemetry + pseudonymous IDs; direct email/phone/name not intentionally tagged; Sensitive Data not intended/permitted |
| Purpose | Server-side operational error monitoring |
| Frequency | Continuous while Production DSN is set |
| Duration | Active service + provider event retention (current baseline **30 days** Developer/free-plan); backup residual deletion **VERIFY** |
| Special-category position | Not a designed path; Sentry DPA prohibits Sensitive Data; operational requirement not to send it |
| Storage / ingestion | **European Union (EU)**; project **`javascript-astro`**; **`ingest.de.sentry.io`** |
| Account | Org **Kersivo**; plan **Developer**; DPA v5.1.0 accepted **2026-09-21** |
| Non-HR primary mechanism | **UK adequacy / UK Extension to EU-U.S. DPF** — Sentry.io **Active Participant**; UK Extension **Active**; **Non-HR Data only**; next due **2027-05-28** (verified 2026-09-21) |
| Non-HR TRA status | **NOT REQUIRED — ACTIVE UK EXTENSION ADEQUACY FOR CURRENT NON-HR DATA** |
| Fallback mechanism | Sentry DPA Schedule 3 **2021 SCCs + UK Addendum** (Module Three for Client CPD processor path; Module Two only where KERSIVO is controller) — not the primary basis while UK Extension applies |
| HR caveat | Current certification is **Non-HR only**. If future Sentry processing includes **HR Data**, DPF coverage must be reassessed before relying on UK Extension |
| Technical safeguards | `sendDefaultPii: false`; KERSIVO `scrubSentryEvent`; org/project scrubbers ON; Prevent IP storage ON; browser SDK inactive; Replay inactive |

Full write-up: [vendor-evidence/sentry.md](./vendor-evidence/sentry.md)

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

1. Complete **TRA / data protection test** for each restricted transfer actually used **except** (a) transfers to **Vercel Inc.** covered by its **ACTIVE UK Extension**, (b) **Non-HR** transfers to **Databricks, Inc. / Neon, LLC** covered by its **ACTIVE UK Extension** (Non-HR only), (c) **Non-HR** transfers to **Plus Five Five, Inc. / Resend** covered by its **ACTIVE UK Extension** (Non-HR only; currently Re-certification under Review), and (d) **Non-HR** transfers to **Functional Software, Inc. d/b/a Sentry** covered by its **ACTIVE UK Extension** (Non-HR only). Remaining: any enabled Twilio/Google/Stripe path. Vendor SCCs/IDTA alone do **not** complete a required test where adequacy does not apply. **Neon HR**, **Resend HR**, and **OpenAI Admin AI CPD** paths: TRA **COMPLETED — PASS** 2026-09-21 ([tra-neon-databricks.md](./tra-neon-databricks.md); [tra-resend.md](./tra-resend.md); [tra-openai.md](./tra-openai.md)).
2. **Vercel:** plan **Pro CONFIRMED**; Functions **`lhr1` CONFIRMED** (migrated from HISTORICAL `iad1` 2026-09-21; production validated); Blob public+private **LHR1 CONFIRMED** with dual-store credential split; UK Extension **ACTIVE** (HR and Non-HR Data; next due 2027-04-29) — **periodically verify** DPF/UK Extension ACTIVE status; confirm Production `PRIVATE_BLOB_READ_WRITE_TOKEN` before live private uploads — see [vendor-evidence/vercel.md](./vendor-evidence/vercel.md). If adequacy can no longer be relied upon: fall back to Vercel DPA UK IDTA/SCCs and perform any required data protection test.
3. **Neon:** contracting entity **Databricks, Inc. CONFIRMED**; billing entity **Neon, LLC CONFIRMED**; DPA applicability **CONFIRMED via MCSA incorporation by reference**; plan **Launch CONFIRMED**; region **AWS Europe West 2 (London) `eu-west-2` CONFIRMED** (Neon Console + hostname); default branch **production** (Never expires); history retention **6 hours CONFIRMED** (visible window — residual deletion beyond that **VERIFY**) — see [vendor-evidence/neon.md](./vendor-evidence/neon.md). **Periodically verify** Databricks UK Extension remains **ACTIVE**, Neon, LLC remains a covered entity, and certification continues to cover **Non-HR Data** (next due 2027-08-10). Refresh the HR TRA if the DSIT analysis materially changes or is withdrawn, or if the Neon/Databricks processing chain materially changes.
4. **Resend:** legal entity **Plus Five Five, Inc.**; US storage **CONFIRMED**; DPA applicability **CONFIRMED** via standard Agreement/DPA incorporation; Non-HR primary UK Extension (**ACTIVE — Re-certification under Review**; Non-HR only; next due 2027-03-03); HR uses UK Addendum + SCCs with TRA **COMPLETED — PASS** 2026-09-21 — see [vendor-evidence/resend.md](./vendor-evidence/resend.md). **Periodically re-check** DPF status. If INACTIVE: stop Non-HR adequacy reliance; use UK Addendum/SCCs and perform any required data protection test.
5. **OpenAI:** UK entity **OpenAI OpCo, LLC**; Production **ACTIVE** (Default project; **Global** residency; project retention **None** → ZDR/MAM **not enabled**; sharing/training opt-ins **DISABLED**); DPA applicability **CONFIRMED** via Services Agreement / live API use; Admin AI CPD uses UK Addendum + SCCs Module Three with TRA **COMPLETED — PASS** 2026-09-21 — see [vendor-evidence/openai.md](./vendor-evidence/openai.md); [tra-openai.md](./tra-openai.md). Periodically re-check Data Controls; refresh TRA if AI scope expands to CRM auto-injection.
6. **Sentry:** legal entity **Functional Software, Inc. d/b/a Sentry**; Production **ACTIVE** (server) on `kersivo-barber-outreach` → org **Kersivo** / project **`javascript-astro`** / region **EU** / **`de.sentry.io`**; browser SDK **INACTIVE**; DPA v5.1.0 accepted **2026-09-21**; Non-HR primary UK Extension (**ACTIVE**; Non-HR only; next due **2027-05-28**); TRA **NOT REQUIRED** for current covered Non-HR transfer; fallback SCCs + UK Addendum — see [vendor-evidence/sentry.md](./vendor-evidence/sentry.md). **Periodically verify** UK Extension ACTIVE + Non-HR coverage. If future processing includes **HR Data**, reassess before relying on UK Extension.
7. Obtain/confirm **signed current vendor DPAs** and record the **exact** UK safeguard for remaining providers (enabled Twilio/Google/Stripe).
8. Confirm production enablement of **Twilio** and **Google OAuth** (OpenAI Admin AI and Sentry Production enablement **CONFIRMED**; **Slack REMOVED** 2026-09-22 — no longer a current provider).
### P1 — before material scale

1. Keep public **Privacy** recipients aligned with DPA Schedule 2 after future vendor changes.
2. Document **Neon backup residual** deletion beyond the visible **6-hour** history window for transfer/deletion completeness.
3. Clarify **Stripe Connect** transfer-risk ownership between Client and KERSIVO in onboarding pack.
4. Controller-side TRA coverage for **Stripe**, **GA4**, **Google Ads**, **Google OAuth**.
5. Vercel log hygiene / Analytics project-toggle confirmation.
6. **OpenAI:** consider stronger UX warning and/or technical restriction before expanding Admin AI into CRM-aware auto-injection workflows; periodically re-check Data Controls (residency / retention / sharing).

### P2 — ongoing hygiene

- Keep AWS planned migration checklist current; do not treat AWS as active until all P0 migration steps complete.
- Refresh **Last verified** after each material vendor or product change.
- Re-read vendor DPAs on renewal / material update.
- Keep conditional env flags mirrored in ops docs (`docs/ops/alerts.md`, messaging, etc.).
