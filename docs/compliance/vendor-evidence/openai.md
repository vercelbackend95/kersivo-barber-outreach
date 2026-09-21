# Provider

**Operational product:** OpenAI API (Admin AI assistant + catalogue/recommendation classification)
**UK Data processing entity (DPA):** **OpenAI OpCo, LLC**
**Contracting path:** OpenAI Services Agreement (effective **2026-01-01**) incorporating the OpenAI Data Processing Addendum when Personal Data is processed

| Field | Value |
| --- | --- |
| Production baseline (repo) | `99ee23b7352d580b1a529ba8e8c2470cdbd3768a` |
| Evidence pass | Production project Data Controls + OpenAI Services Agreement / DPA + targeted Admin AI TRA |
| Last reviewed | 2026-09-21 |
| Status | INTERNAL — Production **ACTIVE**; UK transfer: **2021 SCCs + UK Addendum**; Admin AI CPD TRA **COMPLETED — PASS** (2026-09-21) |

Official / account sources checked:

- OpenAI Services Agreement (effective **2026-01-01**) — Customer agrees by clicking “I agree”, accepting an Order Form, or **using the Services**; §5.3 incorporates the DPA when Personal Data is processed
- OpenAI Data Processing Addendum — Updated **2025-12-01**; Effective **2026-01-01** — https://openai.com/policies/data-processing-addendum/
- OpenAI platform — Data controls / Your data — https://platform.openai.com/docs/guides/your-data
- OpenAI subprocessor list — https://platform.openai.com/subprocessors
- ICO — Completing a TRA using the UK government’s analysis (US) — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/completing-a-transfer-risk-assessment/completing-a-tra-using-the-uk-government-s-analysis-us/
- Internal TRA: [tra-openai.md](../tra-openai.md)
- KERSIVO Production OpenAI project Data Controls — verified manually **2026-09-21** (no secrets recorded)

---

## Service used

| Service | Status |
| --- | --- |
| Admin AI assistant (`POST /api/admin/ai/chat`) | **ACTIVE** in Production where `OPENAI_API_KEY` is set; server-side `chat.completions.create` (streaming) |
| Catalogue / recommendation classification | **ACTIVE** capability via same Production key; server-side `chat.completions.parse` |
| Public / demo Admin Assistant | **Does not** call live OpenAI (canned replies only) |

---

## KERSIVO role / provider role

| Party | Role |
| --- | --- |
| Barbershop Client | Controller (Customer Personal Data voluntarily entered into Admin AI free text) |
| Bartosz Jasinski trading as KERSIVO | **Processor** for Client-controlled Admin AI Personal Data; may be independent **controller** for limited KERSIVO-own operational AI use where no Client CPD is involved |
| OpenAI OpCo, LLC | **Sub-processor** for Client-controlled Customer Personal Data; **processor** where KERSIVO is controller for the relevant data |

---

## Production account configuration (CONFIRMED — 2026-09-21)

| Item | Status |
| --- | --- |
| Production status | **ACTIVE** (`OPENAI_API_KEY` present in Production) |
| Production project | **Default project** |
| Project residency | **Global** — do **not** claim UK or EU residency |
| Project Data Retention control | **None** — disables Zero Data Retention / Modified Abuse Monitoring controls for this project; normal endpoint-specific retention rules apply |
| Zero Data Retention (ZDR) | **NOT ENABLED** |
| Modified Abuse Monitoring (MAM) | **NOT ENABLED** |
| Model feedback sharing | **DISABLED** |
| Evaluation and fine-tuning data sharing | **DISABLED** |
| Inputs and outputs sharing | **DISABLED** |

Do **not** record API keys, key suffixes, tracking IDs, or other secret identifiers in this file.

---

## API implementation (repo-confirmed)

| Item | Status |
| --- | --- |
| SDK | Official `openai` Node SDK |
| Primary endpoint style | **`/v1/chat/completions`** via `chat.completions.create` / `chat.completions.parse` |
| Default model | **`gpt-4o-mini`** (`OPENAI_MODEL` / `OPENAI_RECOMMENDATION_MODEL` absent in Production → code default) |
| `store` parameter (Admin AI) | **OMITTED** on `chat.completions.create` (`src/pages/api/admin/ai/chat.ts`) |
| `store` parameter (catalogue/rerank) | **OMITTED** on `chat.completions.parse` (`src/lib/recommendations/ai/classify.ts`) |
| Admin AI roles | `ai.use` — **OWNER**, **MANAGER** only (**BARBER** cannot invoke) |

Do **not** conflate OpenAI dashboard “API call logging” with API endpoint **application-state** retention.

---

## Data processed

### A. Admin AI (material Client CPD path)

| Category | Examples |
| --- | --- |
| System content | Fixed KERSIVO Admin Assistant system / knowledge prompt (no live CRM inject) |
| User content | Free-text prompts and prior user/assistant messages from the current browser chat session |
| Customer Personal Data | **Only if** an OWNER/MANAGER voluntarily types it into free text — **not** automatically injected |
| Special-category / criminal-offence data | **Not required or intended**; residual risk only if unexpectedly typed into free text (matches OpenAI DPA Schedule 1 unstructured-data caveat) |

### B. Catalogue / recommendation (designed non-CPD)

| Category | Examples |
| --- | --- |
| Catalogue semantics | Product/service `id`, `name`, `description`, `category`; rerank uses service/product semantic summaries |
| Customer / booking data | Prompt design states **do not use** customer or booking data |

Derived recommendation **semantic profiles** may be persisted in Neon. That is **not** the same as storing raw Admin AI prompts/responses.

---

## Retention

### KERSIVO application retention

| Item | Recorded fact |
| --- | --- |
| Admin AI raw prompts / streaming responses | **Not** persisted in Neon, Vercel Blob, filesystem, durable browser storage, analytics, Slack, or Sentry on the audited path — page-memory / React state only |
| Admin AI error logs | Narrow `{ name, message }` only — no prompt body |
| Recommendation derived profiles | May be stored in Neon (structured semantic profiles / recommendation sets) |

### OpenAI provider retention (project retention control = None)

| Item | Recorded fact |
| --- | --- |
| Training use of API inputs/outputs | **NO by default**; KERSIVO sharing/training opt-ins are **all DISABLED** — do **not** confuse “not used for training” with “not retained” |
| `/v1/chat/completions` abuse-monitoring retention | **Up to 30 days** by default (OpenAI current data-controls documentation), unless longer retention is required by law or reasonably necessary to protect the services |
| `/v1/chat/completions` application-state retention | **None**, subject to OpenAI-documented exceptions — `store` is omitted on KERSIVO production-reachable calls |
| ZDR / MAM | **Not enabled** on the Production Default project — do **not** claim Zero Data Retention or immediate deletion of prompts by OpenAI |

---

## International transfer position

### Restricted / international transfer?

**YES** for Admin AI Customer Personal Data — project residency **Global**; UK importer entity **OpenAI OpCo, LLC**; processing may involve OpenAI Affiliates / subprocessors in multiple countries per the current OpenAI subprocessor list. Do **not** claim UK Extension / DPF adequacy for OpenAI OpCo, LLC without separately evidenced active participation.

### Mechanism (CONFIRMED contractual path)

| Item | Status |
| --- | --- |
| Services Agreement applicability | **CONFIRMED** through live API use of the Services |
| DPA applicability | **CONFIRMED** via Services Agreement / DPA incorporation — do **not** claim a separately signed DPA |
| UK Data processor entity | **OpenAI OpCo, LLC** |
| Primary mechanism | **2021 SCCs** as amended by the **UK Addendum** (OpenAI DPA §4.2) |
| Module (Client CPD Admin AI) | **Module Three** — KERSIVO Processor → OpenAI Sub-processor |
| Module (KERSIVO-controller data only) | **Module Two** where KERSIVO independently acts as Controller for the relevant data |
| Destination | **Global** project residency / United States importer and applicable OpenAI/subprocessor infrastructure |
| Admin AI TRA | **COMPLETED — PASS** 2026-09-21 — [tra-openai.md](../tra-openai.md) |

---

## Transfer summary (Admin AI CPD)

| Field | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **OpenAI OpCo, LLC** |
| Roles (Client CPD) | KERSIVO Processor → OpenAI Sub-processor |
| Destination | **Global** (not UK/EU residency) |
| Mechanism | UK Addendum + 2021 SCCs, Module Three |
| TRA status | **COMPLETED — PASS** (2026-09-21) |
| DPA applicability | **CONFIRMED** via Services Agreement / API use |
| ZDR / MAM | **Not enabled** |
| Sharing / training opt-ins | **All disabled** |
| Provider abuse-monitoring retention | Up to **30 days** (chat completions baseline) |

---

## Evidence log

| Evidence | Date |
| --- | --- |
| Production `OPENAI_API_KEY` present; Default project; residency Global; project retention None; ZDR/MAM not enabled; all three sharing controls disabled — operator confirmation (no secrets recorded) | 2026-09-21 |
| OpenAI Services Agreement effective 2026-01-01; DPA effective 2026-01-01 / updated 2025-12-01; UK Data → OpCo, LLC; SCCs + UK Addendum; Module Two/Three schedule | 2026-09-21 |
| Platform data-controls: chat/completions training No; abuse monitoring up to 30 days; application state None (exceptions documented); ZDR eligible but not enabled on this project | 2026-09-21 |
| Repo: `store` omitted on Admin AI create + catalogue parse; `ai.use` OWNER/MANAGER; no CRM auto-inject; demo offline; UI minimisation notice present | 2026-09-21 |
| Targeted Admin AI TRA completed — PASS ([tra-openai.md](../tra-openai.md)) | 2026-09-21 |

---

## Unknowns / VERIFY / hygiene

1. Periodically re-check OpenAI project **Data Retention**, residency, and sharing toggles after any org/project change.
2. Re-read OpenAI DPA / Services Agreement on material update.
3. Refresh the Admin AI TRA if DSIT analysis, OpenAI terms, or KERSIVO AI processing scope materially changes (especially CRM-aware auto-injection).
4. **P1:** consider stronger UX warning and/or technical restriction before expanding AI into CRM-aware workflows (no product change in this documentation pass).

---

## Related records

- [tra-openai.md](../tra-openai.md)
- [subprocessor-transfer-register.md](../subprocessor-transfer-register.md)
- [ropa.md](../ropa.md)
