# Data protection test / TRA — Resend / Plus Five Five, Inc. (HR Data only)

| Field | Value |
| --- | --- |
| Document type | Internal transfer risk assessment / **data protection test** (ICO 2026 terminology) |
| Scope | **HR Data only** — limited employment-context staff/team email data transferred to Plus Five Five, Inc. (Resend) in the United States, **not** covered by the UK Extension |
| Out of scope | **Non-HR Data** transfers covered by the **ACTIVE** UK Extension to the EU-U.S. DPF (adequacy — TRA **not** required while certification conditions remain satisfied), including ordinary customer/end-user transactional email |
| Approach | ICO guidance: *Completing a TRA using the UK government's analysis (US)* |
| Assessment date | **2026-09-21** |
| Result | **COMPLETED — PASS** |
| Production baseline (repo) | `5e47b3369ce3c6f10a4c4ad61ca29b0c45e94dc2` |

---

## 1. Purpose and legal framing

This assessment addresses only the path where:

1. a restricted international transfer of **HR Data** to **Plus Five Five, Inc.** (Resend) in the United States may occur (e.g. employment-context team invitation / operational staff email); and
2. Resend’s UK Extension certification **does not** cover HR Data (coverage verified as **Non-HR Data only**).

It does **not**:

- claim that UK adequacy covers HR Data;
- re-assess Non-HR transfers under Article 46 while UK Extension conditions are met;
- expand scope to all Resend traffic (booking/order/customer transactional mail remains Non-HR out of scope);
- claim that every barber or contractor is HR Data (independent / self-employed recipients are **not** automatically HR Data merely because they receive a team invite).

Related Non-HR position (not re-tested here): see [vendor-evidence/resend.md](./vendor-evidence/resend.md) and [subprocessor-transfer-register.md](./subprocessor-transfer-register.md).

---

## 2. Official sources relied upon

| Source | URL / reference |
| --- | --- |
| ICO — How the UK Extension works | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/adequacy-regulations/how-does-the-uk-extension-to-the-eu-us-data-privacy-framework-work/ |
| ICO — Completing a TRA using the UK government's analysis (US) | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/completing-a-transfer-risk-assessment/completing-a-tra-using-the-uk-government-s-analysis-us/ |
| Resend DPA | https://resend.com/legal/dpa |
| Resend GDPR | https://resend.com/security/gdpr |
| Resend Legal | https://resend.com/legal |
| U.S. Department of Commerce DPF List | Resend / Plus Five Five, Inc. profile — verified manually **2026-09-21** |

---

## 3. DPF / UK Extension facts (context — Non-HR only)

Verified on the official U.S. Department of Commerce DPF List (**2026-09-21**):

| Item | Status |
| --- | --- |
| Profile display | Resend |
| Legal entity | **Plus Five Five, Inc.** |
| Participant status | **Active Participant** |
| UK Extension | **ACTIVE — RE-CERTIFICATION UNDER REVIEW** |
| Original certification | **2025-02-20** |
| Next certification due | **2027-03-03** |
| Covered data | **Non-HR Data ONLY** |
| Other covered entities | None |

These facts justify **not** running an Article 46 TRA for Non-HR transfers while ACTIVE status and Non-HR certification continue. They do **not** provide adequacy for HR Data. “Re-certification under review” is **not** treated as inactive; periodic re-check remains required.

---

## 4. Transfer description (HR path assessed)

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Exporter role | **Processor** where barbershop-controlled Personal Data is concerned |
| Data importer | **Plus Five Five, Inc.** / Resend |
| Importer role | **Sub-processor** for Customer Personal Data |
| Destination | **United States** |
| Frequency | As team/staff invitation or employment-context operational email is sent |
| Duration | Message delivery + Resend processing/storage while Services are used; after Customer terminates Services, customer/user data deleted within **90 days** per current Resend DPA (termination window only — do not equate to per-message retention) |

### HR Data categories in scope (limited; case-by-case)

Only where the individual is an **employee / former employee** and information is transferred in the **employment relationship** context. Likely categories:

- staff/team email address
- name where included
- role / invitation context
- message content associated with team access or operations

**Not automatic HR Data:** independent / self-employed barbers or contractors receiving invite/ops email are not classified as HR Data solely for that reason.

### Ordinary team-invite content (source-verified; narrow)

`sendShopTeamInviteEmail` / invite API transmit recipient email, shop name, role (`MANAGER`/`BARBER`), and accept URL. By product design this path does **not** include special-category HR data (`src/lib/email/sender.ts`, `src/pages/api/admin/members/invite.ts`).

KERSIVO does **not** require special-category HR data to be sent through Resend.

---

## 5. Why reliance on the UK government’s DSIT analysis is reasonable and proportionate

**Legal-mechanism distinction (do not conflate):**

- **UK Extension adequacy** applies only to covered **Non-HR Data** transfers to Plus Five Five, Inc. / Resend while ACTIVE certification conditions remain satisfied. It is **not** the transfer mechanism for HR Data.
- **HR Data** on this path is transferred under **Article 46** using the Resend DPA **UK Addendum + 2021 SCCs** (**Module Three** where KERSIVO is processor). The UK Extension does **not** cover HR Data.

**Assessment input (not the HR transfer mechanism):** For this HR data protection test, KERSIVO uses the ICO method that permits reliance on the UK government’s (**DSIT**) analysis of relevant US laws and practices for:

1. third-party / government access risk; and
2. enforceability risk.

That DSIT analysis is an **assessment input** under the ICO Article 46 TRA method. It does **not** replace, and is **not**, UK Extension adequacy for HR Data.

Reliance on that US-law analysis is **reasonable and proportionate** for this limited HR transfer path because:

1. **Scope is narrow:** limited employment-context staff/team email data only — not all Resend traffic.
2. **Sensitivity by design:** KERSIVO does not require special-category HR data via Resend; ordinary invite content is email/role/shop/accept URL only.
3. **Contractual measures:** Resend DPA contains **2021 SCCs** + **UK Addendum**; **Module Three** applies where KERSIVO is Processor and Resend is Sub-processor; DPA applicability is **CONFIRMED** by standard Agreement acceptance (not a separately countersigned paper DPA).
4. **Confidentiality / security:** Resend DPA requires confidentiality and security obligations; technical and organisational measures in Exhibit C.
5. **Subprocessor / supplementary measures:** Resend DPA contains subprocessor obligations and supplementary measures.
6. **Government / legal requests:** Resend DPA addresses government/legal request handling; Resend states it has not received formal government intelligence/security requests for Customer Personal Data as of the current DPA — recorded as **one** supporting factor, **not** the sole basis for PASS.
7. **Destination clarity:** US storage of message content / delivery logs / related records is acknowledged; assessment does not confuse sending-domain routing with storage location.

---

## 6. Article 46 safeguard applied (HR Data)

| Item | Status |
| --- | --- |
| Mechanism | Resend DPA: **2021 EU SCCs** + **UK Addendum** |
| Module | **Module Three** where KERSIVO is Processor and Resend is Sub-processor |
| UK Extension adequacy for this HR path | **Does not apply** (certification covers **Non-HR Data only**) |

---

## 7. Data protection test conclusion

For the limited **HR Data** transfer path assessed — employment-context staff/team email to Plus Five Five, Inc. / Resend in the United States, with UK Addendum + 2021 SCCs (Module Three where applicable) plus the documented Resend DPA safeguards above, and with DSIT US-law analysis used as an ICO-permitted assessment input for government-access and enforceability risks — the standard of protection is **not materially lower** after transfer.

| Field | Result |
| --- | --- |
| HR DATA PROTECTION TEST / TRA | **COMPLETED — PASS** |
| Date | **2026-09-21** |

---

## 8. Refresh triggers

Refresh this assessment if:

- the DSIT analysis materially changes or is withdrawn;
- Resend DPF / UK Extension status, Non-HR coverage, or legal entity changes in a way that alters the Non-HR/HR split;
- Resend DPA/terms or US processing chain materially changes;
- KERSIVO begins requiring or systematically sending special-category HR data via Resend;
- UK Extension becomes **INACTIVE** (also triggers Non-HR fallback to Article 46 + any required test for new Non-HR transfers).

---

## 9. Related records

- [vendor-evidence/resend.md](./vendor-evidence/resend.md)
- [subprocessor-transfer-register.md](./subprocessor-transfer-register.md)
- [ropa.md](./ropa.md)

---

## Last reviewed

**2026-09-21**
