# Data protection test / TRA — Neon / Databricks (HR Data only)

| Field | Value |
| --- | --- |
| Document type | Internal transfer risk assessment / **data protection test** (ICO 2026 terminology) |
| Scope | **HR Data only** — transfers of employment-context staff data to Databricks, Inc. / Neon, LLC US processing layers **not** covered by the UK Extension |
| Out of scope | **Non-HR Data** transfers covered by the **ACTIVE** UK Extension to the EU-U.S. DPF (adequacy — TRA **not** required while certification conditions remain satisfied) |
| Approach | ICO guidance: *Completing a TRA using the UK government's analysis (US)* |
| Assessment date | **2026-09-21** |
| Result | **COMPLETED — PASS** |
| Production baseline (repo) | `8f3e428f4bc7c6d28cc5ab14776f089f2d0ed9c4` |

---

## 1. Purpose and legal framing

This assessment addresses only the path where:

1. a restricted international transfer of **HR Data** to Databricks, Inc. / covered entity **Neon, LLC** may occur (e.g. US corporate/support/onward processing layers); and
2. the Databricks UK Extension certification **does not** cover HR Data (coverage verified as **Non-HR Data only**).

It does **not**:

- claim that UK adequacy covers HR Data;
- re-assess Non-HR transfers under Article 46 while UK Extension conditions are met;
- claim that the London database region means no restricted transfer can occur;
- claim that every barber record is HR Data (independent / self-employed barbers are **not** automatically HR Data merely because they use KERSIVO).

Related Non-HR position (not re-tested here): see [vendor-evidence/neon.md](./vendor-evidence/neon.md) and [subprocessor-transfer-register.md](./subprocessor-transfer-register.md).

---

## 2. Official sources relied upon

| Source | URL / reference |
| --- | --- |
| ICO — How the UK Extension works | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/adequacy-regulations/how-does-the-uk-extension-to-the-eu-us-data-privacy-framework-work/ |
| ICO — Completing a TRA using the UK government's analysis (US) | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/completing-a-transfer-risk-assessment/completing-a-tra-using-the-uk-government-s-analysis-us/ |
| Databricks DPA | https://www.databricks.com/legal/dpa |
| Databricks MCSA | https://www.databricks.com/legal/mcsa |
| Databricks International Data Transfers FAQ | https://www.databricks.com/legal/tia-faq |
| Neon Product Specific Schedule | https://neon.com/platform-terms |
| U.S. Department of Commerce DPF List | Databricks, Inc. profile — verified manually **2026-09-21** |

---

## 3. DPF / UK Extension facts (context — Non-HR only)

Verified on the official U.S. Department of Commerce DPF List (**2026-09-21**):

| Item | Status |
| --- | --- |
| Entity | **Databricks, Inc.** |
| Participant status | **Active Participant** |
| UK Extension | **Active** |
| UK Extension original certification | **2023-08-15** |
| Next certification due | **2027-08-10** |
| Covered data | **Non-HR Data ONLY** |
| Covered entity | **Neon, LLC** |

These facts justify **not** running an Article 46 TRA for Non-HR transfers while ACTIVE status, Neon, LLC coverage, and Non-HR certification continue. They do **not** provide adequacy for HR Data.

---

## 4. Transfer description (HR path assessed)

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **Databricks, Inc.** — contracting entity **CONFIRMED** for the live KERSIVO Neon Self-Service account; **Neon, LLC** is the covered entity and confirmed billing entity. Databricks DPA applicability **CONFIRMED via MCSA incorporation by reference** (not a separately signed DPA) |
| Roles (CPD / Client staff HR path) | KERSIVO **Processor** → Databricks/Neon **Sub-processor** (**Module Three** where KERSIVO is processor) |
| Destination country for assessed risk | **United States** (potential corporate / support / onward processing) |
| Normal primary Neon database data plane | **AWS London `eu-west-2`** (**CONFIRMED** — not the selected primary storage location for US processing) |
| Frequency | Continuous while Services are live (potential access/processing layers; not primary row storage in US) |
| Duration | Active service + export window + Neon PITR/backup residual |

### HR Data categories in scope (limited; case-by-case)

Where the individual is an **employee** and information is collected in the **employment relationship** context, examples may include:

- employee name / contact details
- shop membership / role
- work scheduling / availability
- employment-related operational account data

**Not automatic HR Data:** independent / self-employed barbers recorded for roster or booking assignment are not classified as HR Data solely because they appear in KERSIVO staff tables.

### Special-category position

KERSIVO does **not** require special-category HR data by product design.

---

## 5. Why reliance on the UK government’s DSIT analysis is reasonable and proportionate

**Legal-mechanism distinction (do not conflate):**

- **UK Extension adequacy** applies only to covered **Non-HR Data** transfers to Databricks, Inc. / Neon, LLC while ACTIVE certification conditions remain satisfied. It is **not** the transfer mechanism for HR Data.
- **HR Data** on this path is transferred under **Article 46** using the Databricks DPA **UK Addendum + 2021 SCCs** (**Module Three** where KERSIVO is processor). The UK Extension does **not** cover HR Data.

**Assessment input (not the HR transfer mechanism):** For this HR data protection test, KERSIVO uses the ICO method that permits reliance on the UK government’s (**DSIT**) analysis of relevant US laws and practices for:

1. third-party / government access risk; and
2. enforceability risk.

That DSIT analysis is an **assessment input** under the ICO Article 46 TRA method. It does **not** replace, and is **not**, UK Extension adequacy for HR Data.

Reliance on that US-law analysis is **reasonable and proportionate** for this limited HR transfer path because:

1. **Destination context:** assessed importer-side risk is US corporate/support/onward processing, not selection of the US as primary database storage.
2. **Primary storage:** Neon production database data plane is **AWS London `eu-west-2`**.
3. **Data volume / sensitivity design:** KERSIVO HR categories are limited operational staff data by product design; special-category HR data is not required.
4. **Technical measures:** TLS (`sslmode=require`) for database connections; application tenant scoping / RBAC; secrets outside git.
5. **Contractual measures:** Databricks DPA contains **2021 SCCs** + **UK International Data Transfer Addendum**; **Module Three** applies where KERSIVO is processor and Databricks is sub-processor; the Databricks **MCSA** incorporates the DPA by reference for processing Personal Data.
6. **Confidentiality / security:** Databricks DPA requires confidentiality and security measures.
7. **Government / legal requests:** Databricks DPA contains government/legal request provisions.
8. **Vendor statements (FAQ):** Databricks states in its International Data Transfers FAQ that it has **not** received a government request for customer data to date; and that it contracts with subprocessors using data-protection / transfer mechanisms.
9. **Onward subprocessors:** Grafana Labs (**US**) is listed as a Neon infrastructure subprocessor — **do not** claim it necessarily receives database row content unless official evidence establishes this. Other onward subprocessors remain subject to Databricks contractual controls.

---

## 6. Article 46 safeguard applied (HR Data)

| Item | Status |
| --- | --- |
| Mechanism | Databricks DPA: **2021 EU SCCs** + **UK International Data Transfer Addendum** |
| Module | **Module Three** where KERSIVO is processor and Databricks is sub-processor |
| MCSA | Incorporates the DPA by reference for processing Personal Data |
| UK Extension adequacy for this HR path | **Does not apply** (certification covers **Non-HR Data only**) |

---

## 7. Data protection test conclusion

For the limited **HR Data** transfer path assessed — potential US corporate/support/onward processing layers for employment-context staff data, with primary Neon storage remaining in AWS London `eu-west-2`, and with UK Addendum + 2021 SCCs (Module Three where applicable) plus the documented Databricks safeguards above — the standard of protection is **not materially lower** after transfer.

| Field | Result |
| --- | --- |
| HR DATA PROTECTION TEST / TRA | **COMPLETED — PASS** |
| Date | **2026-09-21** |

---

## 8. Refresh triggers

Refresh this assessment if:

- the DSIT analysis materially changes or is withdrawn;
- Databricks UK Extension status, Neon, LLC covered-entity status, or Non-HR coverage changes in a way that alters the Non-HR/HR split;
- the Neon/Databricks processing chain materially changes (region, support model, subprocessors with new access to HR Data);
- KERSIVO begins requiring or systematically processing special-category HR data.

---

## 9. Related records

- [vendor-evidence/neon.md](./vendor-evidence/neon.md)
- [subprocessor-transfer-register.md](./subprocessor-transfer-register.md)
- [ropa.md](./ropa.md)

---

## Last reviewed

**2026-09-21**
