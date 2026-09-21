# Provider

**Operational product:** Sentry (server/application error monitoring)
**Legal entity / DPA entity:** **Functional Software, Inc. d/b/a Sentry**
**DPF profile display name:** Sentry.io

| Field | Value |
| --- | --- |
| Production baseline (repo) | `e19f4953fa3b2ca429e7eadc3e8a99f6e1daf2c0` |
| Evidence pass | Production DSN match + account Security & Privacy + DPA acceptance + official DPF List |
| Last reviewed | 2026-09-21 |
| Status | INTERNAL — Production **ACTIVE** (server); UK transfer: **UK Extension adequacy** for current **Non-HR** telemetry; TRA **NOT REQUIRED** while adequacy applies |

Official / account sources checked:

- Official U.S. Department of Commerce DPF List: Sentry.io / Functional Software Inc. — verified manually **2026-09-21**
- Sentry Data Processing Addendum **v5.1.0** (dated **2024-05-29**) — accepted in Organization → Legal & Compliance
- Sentry organization Security & Privacy / project Data Scrubber settings — verified manually **2026-09-21**
- ICO — UK Extension: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/adequacy-regulations/how-does-the-uk-extension-to-the-eu-us-data-privacy-framework-work/
- ICO — Completing a TRA (adequacy means no TRA required for covered transfers)
- Repo: `@sentry/astro` `10.69.0`; `sentry.server.config.ts`; `sentry.client.config.ts`; `src/lib/ops/sentry.ts`; `src/lib/ops/sentryPiiScrub.ts`

Do **not** record DSN values or other secrets in this file.

---

## Service used

| Service | Status |
| --- | --- |
| Server-side error / ops exception capture (`captureOpsException` + request-handler auto-instrumentation) | **ACTIVE** in Production when `SENTRY_DSN` is set |
| Browser / client Sentry SDK | **INACTIVE** in Production — `PUBLIC_SENTRY_DSN` **ABSENT** |
| Session Replay | **NOT CONFIGURED / INACTIVE** |
| Profiling | **NOT CONFIGURED / INACTIVE** |
| Sentry Logs | **NOT CONFIGURED / INACTIVE** |
| User Feedback | **NOT CONFIGURED / INACTIVE** |
| Seer / Autofix code integration | **NOT FOUND** in application code — do **not** describe normal KERSIVO events as Seer-processed without separate evidence |

---

## KERSIVO role / provider role

| Party | Role |
| --- | --- |
| Barbershop Client | Controller (where residual Customer Personal Data / pseudonymous identifiers relate to Client-controlled records) |
| Bartosz Jasinski trading as KERSIVO | **Processor** for residual Client-linked telemetry; may be independent **controller** for limited KERSIVO-own operational security telemetry |
| Functional Software, Inc. d/b/a Sentry | **Sub-processor** (Client CPD residual path) / **processor** where KERSIVO is controller for the relevant data |

---

## Production account configuration (CONFIRMED — 2026-09-21)

| Item | Status |
| --- | --- |
| Production status | **ACTIVE** |
| Production Vercel project | **`kersivo-barber-outreach`** (do **not** treat unused project name `kersivo` as Production) |
| Production env | `SENTRY_DSN` **PRESENT**; `SENTRY_ENVIRONMENT` **PRESENT** |
| Preview / Development Sentry env | **ABSENT** (current audit) |
| Production DSN ↔ Sentry project | **MATCH CONFIRMED** (value not recorded) |
| Sentry organization | **Kersivo** |
| Sentry project | **`javascript-astro`** |
| Data storage region | **European Union (EU)** |
| Ingestion endpoint | **`ingest.de.sentry.io`** / **`de.sentry.io`** |
| Plan | **Developer** (non-paid; no billing/payment method configured) |
| DPA | **Data Processing Addendum v5.1.0** |
| DPA acceptance | **CONFIRMED** — electronically accepted **2026-09-21** |
| Separately negotiated DPA | **Not claimed** |

EU organization storage does **not** eliminate all international / onward transfers. Sentry’s DPA and subprocessor model may involve processing outside the storage region where applicable. Primary UK safeguard for covered US transfers remains the active **UK Extension** while Non-HR adequacy applies.

---

## SDK / data-flow (repo-confirmed)

| Item | Status |
| --- | --- |
| Package | `@sentry/astro` **10.69.0** |
| Server init | `sentry.server.config.ts` — `enabled: Boolean(dsn)`; `sendDefaultPii: false`; `tracesSampleRate: 0.05` |
| Client init | `sentry.client.config.ts` — prefers `PUBLIC_SENTRY_DSN` (absent in Production) |
| Source maps upload | **Disabled** (`astro.config.mjs`) |
| Request handler auto-instrumentation | **Enabled** (server) |
| KERSIVO scrubber | `scrubSentryEvent` via server `beforeSend` |

---

## Account privacy hardening (CONFIRMED — 2026-09-21)

| Setting | Status |
| --- | --- |
| Organization — Require Data Scrubber | **ON** |
| Organization — Require Using Default Scrubbers | **ON** |
| Organization — Prevent Storing of IP Addresses | **ON** |
| Project `javascript-astro` — Data Scrubber | **ON** |
| Project `javascript-astro` — Use Default Scrubbers | **ON** |
| Custom Safe Fields | **None configured** (UI placeholder text such as `business-email` is **not** a saved exception) |
| Advanced data-scrubbing rules | **None configured** |
| Use of aggregated identifying data | **OFF** |

Hardening is acceptable alongside KERSIVO’s own `beforeSend` scrubber; do **not** claim zero Personal Data.

---

## Data processed

### Designed / expected telemetry

| Category | Examples |
| --- | --- |
| Technical | Route, HTTP method/status, stack traces, exception class/message, runtime/request technical metadata |
| Pseudonymous / indirect identifiers | `shopId`, `bookingId`, Stripe Checkout Session / PaymentIntent-style IDs, `refundId`, `emailOutboundId`, webhook `eventType` |
| Direct customer email / phone / name | **Not** intentionally sent as tags; scrubber removes `event.user`, redacts email/phone patterns on common surfaces, strips URL query strings, redacts sensitive headers/keys |

Do **not** call residual UUIDs / record IDs “anonymous” — they can relate back to identifiable persons via KERSIVO systems.

### Sensitive / special-category / criminal-offence

| Item | Status |
| --- | --- |
| Designed path | **No** — not an intentional Sentry data path |
| Sentry DPA | Prohibits Customer submission of Sensitive Data |
| Operational requirement | KERSIVO **must not** intentionally send special-category / sensitive data to Sentry |
| Residual risk | Accidental free-text in unexpected error messages only (not evidenced as designed capture of client notes) |

### HR Data

| Item | Status |
| --- | --- |
| Current telemetry classification | **Non-HR Data** |
| Designed employment/HR record path | **No** |
| UK Extension coverage relied upon | **Non-HR Data only** (per current DPF List entry) |

If future Sentry configuration begins sending employee personal information collected in the context of employment: **TRANSFER BASIS MUST BE REASSESSED** before relying on UK Extension (current certification does **not** cover HR Data).

### Stripe / payment

No card/PAN path into Sentry found. Residual Stripe identifiers (session / PaymentIntent / refund IDs) and provider error text may appear — treat as technical/pseudonymous residual risk, not card data.

---

## Retention

| Item | Recorded fact |
| --- | --- |
| Error / event operational retention | **30-day** current free/Developer-plan baseline (Sentry Help Center SaaS Free Plan wording; account UI label **Developer plan**) |
| 90-day live event retention | **Not recorded** |
| Backup residual deletion timing | **VERIFY** / not separately confirmed — do not equate to live event retention |

---

## International transfer position

### Restricted / international transfer?

**YES** — international / onward transfer may occur (Functional Software, Inc. / US layers and subprocessors), even though organization data storage is **European Union (EU)** and ingestion uses **`de.sentry.io`**. Do **not** claim EU region eliminates international transfers.

### Primary transfer mechanism (current Non-HR telemetry)

**UK adequacy regulations — UK Extension to the EU-U.S. Data Privacy Framework**

Verified against the official U.S. Department of Commerce Data Privacy Framework List (**2026-09-21**):

| Item | Status |
| --- | --- |
| Entity / listing | **Sentry.io** (Functional Software Inc. in contact/legal information) |
| Participant status | **Active Participant** |
| EU-U.S. DPF | **Active** |
| UK Extension to the EU-U.S. DPF | **Active** |
| UK Extension original certification | **2023-09-13** |
| Next certification due | **2027-05-28** |
| Data collected / covered | **Non-HR Data** |
| EU-U.S. original certification | **2016-12-19** |
| Other covered entities | **None** |

### TRA / data protection test

| Item | Status |
| --- | --- |
| Primary mechanism | **UK adequacy / UK Extension** for current **Non-HR** scope |
| TRA / data protection test | **NOT REQUIRED** while the transfer remains covered by active adequacy regulations for Non-HR Data |
| Internal TRA file | **Not created** — do **not** record “TRA COMPLETED — PASS” |

### Fallback mechanism (Schedule 3 — where DPF does not apply)

| Item | Status |
| --- | --- |
| Fallback | **2021 SCCs** + **UK Addendum** (Sentry DPA Schedule 3) |
| Module Three | Where KERSIVO acts as **Processor** for Client-controlled Personal Data and Sentry is another processor / sub-processor |
| Module Two | Only where KERSIVO acts as **Controller** for the relevant data |

Do **not** treat the fallback as the current primary basis while the active UK Extension applies to the current Non-HR transfer.

---

## Transfer summary (current Production telemetry)

| Field | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **Functional Software, Inc. d/b/a Sentry** |
| Roles (Client residual CPD) | KERSIVO Processor → Sentry Sub-processor |
| Storage region | **European Union (EU)** (`javascript-astro` / `ingest.de.sentry.io`) |
| Data classification | **Non-HR** technical/error telemetry + pseudonymous IDs |
| Primary mechanism | **UK Extension** adequacy |
| Fallback | **2021 SCCs + UK Addendum** |
| TRA status | **NOT REQUIRED — ACTIVE UK EXTENSION ADEQUACY FOR CURRENT NON-HR DATA** |
| DPA | v5.1.0 accepted **2026-09-21** |
| Event retention baseline | **30 days** (Developer / free-plan baseline) |
| Backup deletion clock | **VERIFY** |

---

## Evidence log

| Evidence | Date |
| --- | --- |
| Production `SENTRY_DSN` + `SENTRY_ENVIRONMENT` present on `kersivo-barber-outreach`; Preview/Dev absent; DSN matches project `javascript-astro` (value not recorded) | 2026-09-21 |
| Org **Kersivo**; region **EU**; ingestion **de.sentry.io**; plan **Developer**; DPA v5.1.0 accepted 2026-09-21 | 2026-09-21 |
| Org Require Data Scrubber / Default Scrubbers / Prevent IP storage **ON**; project scrubbers **ON**; no Safe Field exception; aggregated identifying data **OFF** | 2026-09-21 |
| Repo: server SDK active path; browser inactive without `PUBLIC_SENTRY_DSN`; `sendDefaultPii: false`; traces 0.05; Replay/logs/profiling/feedback inactive; no Seer code integration; `scrubSentryEvent` | 2026-09-21 |
| U.S. DoC DPF List: Sentry.io Active Participant; UK Extension Active; Non-HR; next due 2027-05-28 | 2026-09-21 |

---

## Unknowns / VERIFY / hygiene

1. Periodically re-check DPF / UK Extension **ACTIVE** status and **Non-HR** coverage (next certification due **2027-05-28**).
2. If UK Extension becomes inactive or narrowed: stop Non-HR adequacy reliance; use SCCs + UK Addendum and perform any required data protection test.
3. If Sentry begins processing **HR Data**: reassess transfer basis before relying on UK Extension.
4. Backup-specific residual deletion timing remains **VERIFY** unless separately evidenced.
5. Do not enable Session Replay, browser SDK (`PUBLIC_SENTRY_DSN`), or intentional Sensitive Data capture without a fresh compliance reassessment.

---

## Related records

- [subprocessor-transfer-register.md](../subprocessor-transfer-register.md)
- [ropa.md](../ropa.md)
