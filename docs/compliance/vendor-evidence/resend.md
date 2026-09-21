# Provider

**Operational product:** Resend (transactional email)
**Legal entity / DPA entity:** **Plus Five Five, Inc.**
**DPF profile display name:** Resend

| Field | Value |
| --- | --- |
| Production baseline (repo) | `5e47b3369ce3c6f10a4c4ad61ca29b0c45e94dc2` |
| Evidence pass | Official DPF List + Resend DPA/GDPR docs + targeted HR TRA |
| Last reviewed | 2026-09-21 |
| Status | INTERNAL — Non-HR: UK Extension adequacy **ACTIVE** (Re-certification under Review); HR: UK Addendum + SCCs with targeted TRA **COMPLETED — PASS** (2026-09-21) |

Official sources checked:

- Official U.S. Department of Commerce DPF List: Resend / Plus Five Five, Inc. profile — verified manually **2026-09-21**
- Resend DPA: https://resend.com/legal/dpa (Last update **2026-08-27**)
- Resend GDPR: https://resend.com/security/gdpr
- Resend Legal: https://resend.com/legal
- ICO — UK Extension: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/adequacy-regulations/how-does-the-uk-extension-to-the-eu-us-data-privacy-framework-work/
- ICO — TRA using UK government analysis (US): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/completing-a-transfer-risk-assessment/completing-a-tra-using-the-uk-government-s-analysis-us/
- Internal TRA: [tra-resend.md](../tra-resend.md)

---

## Service used

| Service | Status |
| --- | --- |
| Transactional email delivery via Resend API | **CONFIRMED** in application (`RESEND_API_KEY` required on production email paths) |
| Booking confirmation / reschedule / cancellation email | **CONFIRMED** |
| Retail / order confirmation email | **CONFIRMED** where retail flows send mail |
| Team / shop invitation email | **CONFIRMED** (`sendShopTeamInviteEmail`) |
| KERSIVO controller-side account / contact / billing notices | **CONFIRMED** where those paths send via Resend |

---

## KERSIVO role / provider role

| Party | Role |
| --- | --- |
| Barbershop Client | Controller (Customer Personal Data / live-shop CPD email) |
| Bartosz Jasinski trading as KERSIVO | Processor (CPD email) / independent controller (own account, marketing, contact mail) |
| Plus Five Five, Inc. (Resend) | Sub-processor (CPD paths) / processor (controller-side mail) |

---

## Data processed

| Category | Examples |
| --- | --- |
| Customer / end-user transactional (Non-HR by design) | Recipient email; name where included; booking/order content; manage links; delivery metadata |
| Team / staff invitation / operational (may be HR only if employment-context) | Invitee email; role (MANAGER/BARBER); shop name; accept URL |
| KERSIVO controller mail | Account/contact/billing-related recipient and content as sent |

### Special-category position

KERSIVO does **not** require special-category data to be sent through Resend. Ordinary team-invite emails (`sendShopTeamInviteEmail`) include email, shop name, role, and accept URL only — no special-category fields by product design (source: `src/lib/email/sender.ts` / `src/pages/api/admin/members/invite.ts`).

Do **not** classify every barber or contractor as HR Data automatically. Independent/self-employed barbers are **not** automatically HR Data merely because they receive a team invite.

---

## Account / contract configuration

| Item | Status |
| --- | --- |
| Legal entity | **Plus Five Five, Inc.** |
| Public DPA | https://resend.com/legal/dpa — Last update **2026-08-27** |
| DPA applicability | **CONFIRMED by standard Resend contractual terms** — DPA becomes legally binding upon Customer entering into / accepting the Agreement or executing the DPA. Resend states an Article 28 DPA is in force for every Resend account and that no separate counter-signature is required. Do **not** claim KERSIVO separately countersigned a DPA |
| Data storage location | **United States — CONFIRMED** (Resend GDPR documentation). Customer data stored in the US includes message content, delivery logs, webhook payloads, and account records |
| Sending-domain routing region | Do **not** treat domain routing region as data-storage location |

### Retention (vendor contractual)

| Item | Recorded fact |
| --- | --- |
| After Customer terminates use of the Services | Customer/user data deleted **within 90 days** — vendor contractual statement in current Resend DPA |
| Individual sent-message retention | **Not inferred** from the termination clause — do **not** claim every email/message is retained for 90 days |

---

## International transfer position

### Restricted / international transfer?

**YES** — Personal Data is stored / processed in the **United States**.

### Split transfer mechanism

#### Non-HR Data

| Item | Status |
| --- | --- |
| Primary mechanism | **UK adequacy regulations — UK Extension to the EU-U.S. DPF** |
| DPF profile / entity | Resend / **Plus Five Five, Inc.** |
| Participant status | **Active Participant** |
| UK Extension | **ACTIVE — RE-CERTIFICATION UNDER REVIEW** |
| Original certification | **2025-02-20** |
| Next certification due | **2027-03-03** |
| Data collected / covered | **Non-HR Data ONLY** |
| Other covered entities | None |
| Verification date | **2026-09-21** (official U.S. Department of Commerce DPF List) |
| TRA / data protection test | **NOT REQUIRED** while Resend remains ACTIVE under the UK Extension, certification continues to cover Non-HR Data, and the transferred data is Non-HR Data |

“Re-certification under review” must **not** be treated as inactive. Periodic re-check required.

Do **not** state that UK Extension covers HR Data.

#### HR Data (employment-context only)

| Item | Status |
| --- | --- |
| When HR applies | Individual is an employee / former employee **and** information is transferred in the employment-relationship context |
| Mechanism | Resend DPA: **2021 SCCs** + **UK Addendum**; **Module Three** where KERSIVO is Processor and Resend is Sub-processor |
| UK Extension adequacy | **Does not apply** (registration covers Non-HR only) |
| Targeted data protection test / TRA | **COMPLETED — PASS** on **2026-09-21** — see [tra-resend.md](../tra-resend.md) |

---

## Transfer mechanism evidence inputs

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **Plus Five Five, Inc.** (Resend) |
| Roles (CPD) | KERSIVO **Processor** → Resend **Sub-processor** |
| Destination | **United States — CONFIRMED** |
| Non-HR mechanism | UK Extension adequacy (ACTIVE — Re-certification under Review; Non-HR only) |
| Non-HR TRA status | **NOT REQUIRED** where certification conditions apply |
| HR mechanism | UK Addendum + 2021 SCCs, Module Three where KERSIVO is processor |
| HR TRA status | **COMPLETED — PASS** (2026-09-21) |
| DPA applicability | **CONFIRMED** via standard Resend agreement / DPA incorporation |

---

## Evidence checked

| Source | Date |
| --- | --- |
| U.S. DoC DPF List: Resend / Plus Five Five, Inc. Active Participant; UK Extension ACTIVE — Re-certification under Review; Non-HR Data only; original certification 2025-02-20; next due 2027-03-03; no other covered entities | 2026-09-21 |
| Resend DPA (Last update 2026-08-27): SCCs + UK Addendum; Module Three; binding on Agreement acceptance; termination deletion within 90 days | 2026-09-21 |
| Resend GDPR page: US storage (message content, delivery logs, webhook payloads, account records); Article 28 DPA in force for every account | 2026-09-21 |
| Targeted HR TRA completed — PASS ([tra-resend.md](../tra-resend.md)) | 2026-09-21 |
| Application email paths / team invite content (`src/lib/email/sender.ts`, invite API) | 2026-09-21 |

---

## Unknowns / VERIFY

1. **VERIFY** — exact production enablement details for each mail path remain ops hygiene (API key present; which transactional purposes are live).
2. **VERIFY** — contact-form / mailbox copy retention outside Resend if any.
3. **VERIFY** — individual message retention / log retention periods (do not equate to the 90-day post-termination deletion window).
4. Periodically re-check DPF / UK Extension status (especially while **Re-certification under Review**).

---

## Required next actions

### P0 BEFORE FIRST LIVE CLIENT

1. Periodically verify **Plus Five Five, Inc. / Resend** remains an **ACTIVE** UK Extension participant and continues to cover **Non-HR Data** (next due **2027-03-03**; current note: Re-certification under Review). If status becomes **INACTIVE**: stop relying on UK Extension for new Non-HR transfers; use DPA UK Addendum/SCCs; perform any required data protection test before continuing reliance on Article 46.
2. Refresh the **HR TRA** if the DSIT analysis materially changes or is withdrawn, or if Resend processing/terms materially change.

### P1 BEFORE MATERIAL SCALE

1. Document contact-form / inbox copy retention outside Resend if applicable.
2. Clarify any controller-side Resend retention schedule for KERSIVO’s own mail.

### P2 ONGOING HYGIENE

1. Re-read Resend DPA on material update.
2. Re-check DPF status on certification renewal / re-certification outcomes.

---

## Last reviewed

**2026-09-21**
