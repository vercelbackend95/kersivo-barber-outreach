# Data protection test / TRA — OpenAI OpCo, LLC (Admin AI Customer Personal Data)

| Field | Value |
| --- | --- |
| Document type | Internal transfer risk assessment / **data protection test** (ICO 2026 terminology) |
| Scope | **Admin AI Customer Personal Data** — free-text Personal Data that an OWNER/MANAGER may voluntarily include in the KERSIVO Admin Assistant and that is transferred to OpenAI for language-model processing |
| Out of scope (primary) | Catalogue / recommendation classification designed around product/service semantics (not Client CRM/booking data by design). Unexpected Personal Data in catalogue free-text fields remains a residual hygiene risk, not the primary assessed path |
| Approach | ICO guidance: *Completing a TRA using the UK government's analysis (US)* as an **assessment input** for government-access and enforceability risks under Article 46 |
| Assessment date | **2026-09-21** |
| Result | **COMPLETED — PASS** |
| Production baseline (repo) | `99ee23b7352d580b1a529ba8e8c2470cdbd3768a` |

---

## 1. Purpose and legal framing

This assessment addresses the restricted international transfer that occurs when:

1. a barbershop Client uses the KERSIVO Admin AI assistant;
2. an authorised user (**OWNER** or **MANAGER**) submits free-text that may include **Customer Personal Data**; and
3. KERSIVO transmits that content to **OpenAI OpCo, LLC** under the OpenAI Services Agreement / Data Processing Addendum for `/v1/chat/completions` processing.

It does **not**:

- rely on UK Extension / EU-U.S. Data Privacy Framework adequacy as the transfer mechanism for OpenAI OpCo, LLC (not evidenced for this assessment);
- claim Zero Data Retention or Modified Abuse Monitoring (Production Default project retention control = **None**);
- claim UK or EU data residency (project residency = **Global**);
- claim that KERSIVO automatically injects CRM, booking, or customer records into prompts;
- claim that special-category or criminal-offence data is intentionally required;
- expand the primary scope to catalogue/recommendation semantics (designed non-CPD product/service data).

Related evidence: [vendor-evidence/openai.md](./vendor-evidence/openai.md); [subprocessor-transfer-register.md](./subprocessor-transfer-register.md); [ropa.md](./ropa.md).

---

## 2. Official sources relied upon

| Source | URL / reference |
| --- | --- |
| ICO — Completing a TRA using the UK government’s analysis (US) | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/completing-a-transfer-risk-assessment/completing-a-tra-using-the-uk-government-s-analysis-us/ |
| OpenAI Services Agreement | Effective **2026-01-01** |
| OpenAI Data Processing Addendum | Updated **2025-12-01**; Effective **2026-01-01** — https://openai.com/policies/data-processing-addendum/ |
| OpenAI — Data controls / Your data | https://platform.openai.com/docs/guides/your-data |
| OpenAI subprocessor list | https://platform.openai.com/subprocessors |
| KERSIVO Production OpenAI project Data Controls | Verified manually **2026-09-21** (Default project; Global residency; retention None; sharing disabled) |
| Application sources | `src/pages/api/admin/ai/chat.ts`; `src/components/admin/AiAssistantPanel.tsx`; `src/lib/admin/ai/systemPrompt.ts`; `src/lib/admin/rbac/permissions.ts` |

---

## 3. Transfer description (Admin AI CPD path)

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Exporter role | **Processor** for barbershop-controlled Customer Personal Data |
| Data importer | **OpenAI OpCo, LLC** |
| Importer role | **Sub-processor** for Client-controlled Customer Personal Data |
| Destination / geography | **Global** project residency; United States contracting/importer entity; OpenAI Affiliates / subprocessors may process in multiple countries per the current subprocessor list — do **not** claim UK/EU residency |
| Frequency | As authorised OWNER/MANAGER users invoke Admin AI |
| Duration | Request processing plus OpenAI endpoint-specific retention while the account/project configuration remains as verified |
| API path | Server-side OpenAI SDK → **`/v1/chat/completions`** (`chat.completions.create`, streaming) |
| Default model | **`gpt-4o-mini`** |
| `store` parameter | **OMITTED** (not set `true`) |

### Data categories in scope

- Free-text Admin Assistant prompts and prior messages in the current browser chat session
- Fixed KERSIVO system / knowledge prompt (product/UI coaching content — not live tenant CRM)
- Generated assistant responses and necessary technical request metadata processed by OpenAI

**Customer Personal Data** enters only if voluntarily typed by the user. KERSIVO does **not** automatically inject shop, client, booking, note, email, or phone records.

### Access control

- Permission `ai.use`: **OWNER**, **MANAGER**
- **BARBER** cannot use Admin AI
- Public demo path does **not** call live OpenAI

### Special-category / criminal-offence position

KERSIVO does **not** require or intentionally send special-category or criminal-offence data. Residual risk exists only through unexpected free-text entry. This aligns with OpenAI DPA Schedule 1 wording that sensitive data is not intended unless unexpectedly included in unstructured data.

Verified UI notice (Admin Assistant composer):

> Do not enter client personal data, sensitive information or confidential booking notes unless it is necessary for your request.

This is hygiene only — **not** a technical control and **not** a substitute for Schedule 2 listing or this TRA.

---

## 4. Nature, purpose, and frequency

| Factor | Assessment |
| --- | --- |
| Nature | Unstructured free text that **may** include ordinary Personal Data (names, contacts, booking context) when a user chooses to type it; not a systematic CRM export |
| Purpose | Provide Admin Assistant coaching / product guidance responses to authorised shop admins |
| Frequency | Continuous conditional use while Admin AI is enabled and users invoke it |
| Volume / sensitivity by design | Limited by role gate and no auto-injection; sensitivity can rise if a user pastes sensitive content |

---

## 5. Why reliance on the UK government’s DSIT analysis is reasonable and proportionate

**Legal-mechanism distinction (do not conflate):**

- This transfer uses **Article 46** safeguards: OpenAI DPA **2021 SCCs** as amended by the **UK Addendum**, **Module Three** where KERSIVO is Processor and OpenAI is Sub-processor.
- **UK Extension / DPF adequacy is not** the transfer mechanism for this assessment.

**Assessment input (not the transfer mechanism):** For this data protection test, KERSIVO uses the ICO method that permits reliance on the UK government’s (**DSIT**) analysis of relevant US laws and practices for:

1. third-party / government access risk; and
2. enforceability risk.

That DSIT analysis is an **assessment input** under the ICO Article 46 TRA method. It does **not** replace the SCCs / UK Addendum.

Reliance on that US-law analysis is **reasonable and proportionate** for this Admin AI path because:

1. **Scope is limited:** free-text Admin Assistant content only; no automatic CRM/booking injection.
2. **Role gate:** OWNER/MANAGER only; public demo offline from OpenAI.
3. **Contractual measures:** OpenAI Services Agreement applicability **CONFIRMED** through live API use; DPA applicability **CONFIRMED**; UK Data processed by **OpenAI OpCo, LLC** under SCCs + UK Addendum; Module Three for Client CPD; no separately signed DPA claimed.
4. **Training / sharing:** KERSIVO organization Data Controls confirm model feedback, evaluation/fine-tuning, and inputs/outputs sharing are **all DISABLED** — API inputs/outputs are **not** opted into model-improvement sharing.
5. **KERSIVO-side minimisation:** raw Admin AI prompts/responses are **not** durably stored by KERSIVO in Neon/Blob/filesystem/durable browser storage/analytics/Slack/Sentry on the audited path (page-memory only); error logs do not dump prompt bodies.
6. **Security / TOMs:** OpenAI DPA requires appropriate security measures and processor obligations; Customer remains responsible for configuration choices (including retention controls).
7. **Retention honesty:** Project retention control = **None** (ZDR/MAM **not** enabled). Standard `/v1/chat/completions` abuse-monitoring retention of **up to 30 days** therefore applies. Application-state retention baseline is **None** for this endpoint (subject to OpenAI-documented exceptions); `store` is omitted. Do **not** equate “not used for training” with “not retained.”

---

## 6. Government / third-party access and enforceability

| Risk | Position |
| --- | --- |
| Government / third-party access | Assessed using ICO-permitted reliance on the UK government’s DSIT analysis of relevant US laws and practices as an **input**, together with OpenAI DPA confidentiality, security, and law-enforcement request handling obligations |
| Enforceability | SCCs + UK Addendum provide contractual enforceability framework for UK Data; Module Three applies for processor → sub-processor Client CPD transfers |
| Geography residual | **Global** residency and multi-country subprocessors increase geographic complexity versus a UK/EU-resident project — recorded as residual risk, not ignored |

---

## 7. Article 46 safeguard applied

| Item | Status |
| --- | --- |
| Mechanism | OpenAI DPA: **2021 EU SCCs** as amended by the **UK Addendum** |
| Module | **Module Three** where KERSIVO is Processor and OpenAI is Sub-processor (Client-controlled Admin AI Personal Data) |
| Module Two | Only where KERSIVO independently acts as **Controller** for the relevant data |
| UK Extension / DPF adequacy | **Not relied upon** for this assessment |

---

## 8. Mitigating facts and residual risks

### Mitigating facts

- No automatic CRM / shop / customer / booking injection
- Admin AI limited to OWNER/MANAGER (`ai.use`)
- Public demo cannot invoke OpenAI
- Raw Admin AI prompts/responses not durably stored by KERSIVO on the audited path
- Data-sharing / training opt-ins all **DISABLED**
- Catalogue/recommendation path designed around product/service semantics
- OpenAI acts under a current DPA; SCCs + UK Addendum apply
- Standard OpenAI security / TOM obligations apply
- UI minimisation notice present (hygiene)

### Residual risks (not minimised)

- Admin AI free text **can** contain Personal Data
- A user may unexpectedly enter special-category or criminal-offence information
- No server-side free-text PII / sensitive-data scrub on this path
- OpenAI standard abuse-monitoring logs may retain content for **up to 30 days**
- Project uses **Global** residency (not UK/EU)
- **ZDR** and **MAM** are **not** enabled
- Expanding AI into CRM-aware auto-injection workflows would materially change this assessment (**P1** operational action: stronger UX / technical restriction before such expansion)

---

## 9. Data protection test conclusion

For the **Admin AI Customer Personal Data** path assessed — voluntary free-text Personal Data transferred from the United Kingdom by KERSIVO as processor to **OpenAI OpCo, LLC** as sub-processor for `/v1/chat/completions` processing under Global project residency, with **2021 SCCs + UK Addendum (Module Three)**, confirmed DPA applicability via Services Agreement / API use, training/sharing opt-ins disabled, no automatic CRM injection, OWNER/MANAGER-only access, and KERSIVO non-persistence of raw chat content, and with DSIT US-law analysis used as an ICO-permitted assessment input for government-access and enforceability risks — the standard of protection is **not materially lower** after transfer, taking the documented residual risks into account.

| Field | Result |
| --- | --- |
| ADMIN AI DATA PROTECTION TEST / TRA | **COMPLETED — PASS** |
| Date | **2026-09-21** |

---

## 10. Refresh triggers

Refresh this assessment if:

- the DSIT analysis materially changes or is withdrawn;
- OpenAI DPA / Services Agreement / data-controls rules materially change;
- KERSIVO enables ZDR, MAM, data residency, or changes sharing/training toggles;
- KERSIVO begins automatic CRM/booking injection or expands Admin AI beyond OWNER/MANAGER free text;
- Production moves to a non-Global residency project or a different OpenAI contracting entity;
- KERSIVO begins requiring or systematically soliciting special-category data via Admin AI.

---

## 11. Related records

- [vendor-evidence/openai.md](./vendor-evidence/openai.md)
- [subprocessor-transfer-register.md](./subprocessor-transfer-register.md)
- [ropa.md](./ropa.md)
