# Provider

**Operational product:** Neon (managed PostgreSQL / Lakebase Postgres)  
**Contracting entity (KERSIVO account):** **Databricks, Inc.** — **CONFIRMED** (Neon Product Specific Schedule Last Updated **2026-08-05** is entered into between Databricks, Inc. and Customer; Launch Self-Service Plan)
**Billing entity (KERSIVO account):** **Neon, LLC** — **CONFIRMED** from live account invoice (Neon, LLC, Wilmington, DE; Launch Plan). Invoice PDF **not** stored in git. Do **not** treat Neon, LLC as the contracting entity merely because it issued the invoice.
**Parent / affiliate context:** Neon, LLC is the affiliate that may bill fees on Databricks’ behalf per the Schedule.

| Field | Value |
| --- | --- |
| Production baseline (repo) | `fe330922e0f3b153abf9738538115f21d8f34ad3` |
| Evidence pass | Account-specific Neon Console + invoice verification; Databricks UK Extension / Non-HR adequacy; targeted HR TRA |
| Last reviewed | 2026-09-21 |
| Status | INTERNAL — Contracting entity **Databricks, Inc. CONFIRMED**; billing **Neon, LLC CONFIRMED**; DPA applicability **CONFIRMED** via MCSA incorporation; Non-HR UK Extension **ACTIVE**; HR TRA **COMPLETED — PASS** |

Official sources checked:

- Neon Product Specific Schedule: https://neon.com/platform-terms (Last Updated **2026-08-05**)
- Databricks DPA: https://www.databricks.com/legal/dpa (and published PDF variants)
- Databricks MCSA: https://www.databricks.com/legal/mcsa
- Databricks subprocessors: https://www.databricks.com/legal/databricks-subprocessors
- Databricks International Data Transfers FAQ: https://www.databricks.com/legal/tia-faq
- Neon regions: https://neon.com/docs/introduction/regions
- ICO — UK Extension: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/adequacy-regulations/how-does-the-uk-extension-to-the-eu-us-data-privacy-framework-work/
- ICO — TRA using UK government analysis (US): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/completing-a-transfer-risk-assessment/completing-a-tra-using-the-uk-government-s-analysis-us/
- Official U.S. Department of Commerce DPF List: Databricks, Inc. (verified 2026-09-21)
- Account evidence: Neon Console reviewed **2026-09-21**; Neon account invoice reviewed **2026-09-21** (invoice not stored in git)
- Internal ops: `docs/ops/backup-restore-neon.md`
- Internal TRA: [tra-neon-databricks.md](../tra-neon-databricks.md)

---

## Service used

| Service | Status |
| --- | --- |
| Managed PostgreSQL as KERSIVO production database | **CONFIRMED** |
| Prisma ORM / migrations against Neon | **CONFIRMED** |
| Neon PITR / branching as backup mechanism (no custom dump cron) | **CONFIRMED** in ops docs |
| Neon plan | **Launch — CONFIRMED** (Neon Console + invoice) |
| Default / production branch | **production — CONFIRMED** (Never expires — **CONFIRMED**) |
| History retention (visible PITR/history window) | **6 hours — CONFIRMED** current account/project setting |
| Postgres version | **17 — CONFIRMED** |
| Compute range | **0.25 ↔ 8 CU — CONFIRMED** |
| Read replicas | **VERIFY** if any beyond default compute (not separately confirmed) |

---

## KERSIVO role / provider role

| Party | Role (Customer Personal Data) |
| --- | --- |
| Barbershop Client | Controller |
| Bartosz Jasinski trading as KERSIVO | Processor |
| Databricks, Inc. (contracting) / Neon product family | Sub-processor |

Same database also stores KERSIVO independent-controller records (accounts, billing, legal acceptance). Controller vs processor rows must stay separated in ROPA.

---

## Data processed

### DATABASE DATA (Neon) — Customer Personal Data where applicable

Derived from `prisma/schema.prisma` + ROPA Part B (not Blob file bytes):

| Area | Examples |
| --- | --- |
| CRM | `Client` fullName, email, phone, notes, tags, avatar URL |
| Notes metadata | `ClientNote` body; `ClientNoteImage` pathname metadata (bytes live in **Vercel Blob**) |
| Bookings | `Booking` name/email/phone/notes, tokens/status, deposit identifiers/status |
| Staff / team | `Barber`, `ShopMember`, `ShopInvite` contact/role data — **may** be HR Data only where the individual is an employee and data is collected in an employment-relationship context; independent/self-employed barbers are **not** automatically HR Data |
| Retail | `Order` / `OrderItem` customer email, snapshots, payment status ids |
| Messaging metadata | `EmailOutbound`, `SmsOutbound` (payload clearing on SENT where implemented) |
| Onboarding metadata | `ClientOnboarding*`, asset metadata (files in Blob) |
| Legal / ops tenant-linked | Where stored with shop linkage; purge exclusions for some controller artefacts |

### BLOB/FILE DATA (not Neon)

Private/public file bytes are stored in **Vercel Blob**. Neon holds pathnames/metadata only.

### Special-category position

Not required by product design. Free-text notes / migration materials may include sensitive content — Client responsibility under DPA. KERSIVO does not require special-category HR data.

---

## Account-specific configuration

### Production region — CONFIRMED

| Field | Value |
| --- | --- |
| Neon Console project region | **AWS Europe West 2 (London) — CONFIRMED** (Neon Console, 2026-09-21) |
| Hostname pattern (supporting) | `ep-….eu-west-2.aws.neon.tech` |
| Endpoint id (non-secret, supporting) | `ep-dark-flower-abnkv6he` |
| Region code | **`eu-west-2`** — AWS Europe (**London**) / Neon `aws-eu-west-2` |
| Cloud provider | **AWS** |
| Database name | `neondb` |
| TLS | `sslmode=require` present on connection query |
| Evidence sources | Neon Console region display **CONFIRMED**; hostname metadata matching Neon docs (“region is the segment before `.aws.neon.tech`”) |

**CONFIRMED:** AWS Europe West 2 (London) `eu-west-2`. Primary database data plane remains London. This does **not** by itself eliminate restricted-transfer risk for US corporate/support/onward layers.

### Plan / branch / compute — CONFIRMED (Neon Console 2026-09-21)

| Fact | Status |
| --- | --- |
| Plan | **Launch — CONFIRMED** |
| Default branch | **production — CONFIRMED** |
| Production branch expiry | **Never expires — CONFIRMED** |
| History retention | **6 hours — CONFIRMED** (current visible PITR/history window only) |
| Postgres | **17 — CONFIRMED** |
| Compute range | **0.25 ↔ 8 CU — CONFIRMED** |
| Region changeability | Fixed at project creation (Neon docs) |
| Quarterly restore drill | Still pending in `docs/ops/backup-restore-neon.md` |
| Backup / residual deletion beyond visible 6-hour history window | **VERIFY** — do **not** treat “history retention = 6 hours” as proof that all provider residual copies expire after 6 hours |

---

## Contract / DPA

| Item | Recorded fact |
| --- | --- |
| Operational provider name | Neon (Databricks Neon product family) |
| Contracting entity (KERSIVO) | **Databricks, Inc. — CONFIRMED** (Schedule between Databricks, Inc. and Customer; Launch Self-Service Plan) |
| Billing entity (KERSIVO) | **Neon, LLC — CONFIRMED** from account invoice (affiliate may bill on Databricks’ behalf per Schedule) |
| Public schedule | Neon Product Specific Schedule Last Updated **2026-08-05** — https://neon.com/platform-terms |
| DPA source (public) | Databricks DPA at https://www.databricks.com/legal/dpa |
| MCSA | https://www.databricks.com/legal/mcsa — “The terms of the DPA are incorporated by reference and shall apply to the processing of Personal Data as described in the DPA.” Neon Product Specific Schedule is subject to the MCSA |
| DPA applicability (KERSIVO account) | **CONFIRMED** — Databricks DPA applicability **CONFIRMED through MCSA incorporation by reference** for the standard Neon Self-Service Plan. Do **not** claim a separately signed DPA |
| Security measures | Exhibit A to Neon Product Specific Schedule; Databricks Security Addendum references |
| Subprocessors (Neon schedule) | Grafana Labs (**United States**) **plus** Databricks list at https://www.databricks.com/legal/databricks-subprocessors — do **not** claim Grafana necessarily receives database row content unless official evidence establishes this |
| Infrastructure subprocessor (region-selected) | **Amazon Web Services, Inc.** (customer-selected region = London for this project) |
| UK transfer clauses (public DPA) | **2021 EU SCCs** + **UK International Data Transfer Addendum** (UK Addendum); Module **Three** where Customer is processor |

Do **not** describe Neon, LLC as the contracting entity merely because it issued the invoice.

---

## International transfer position

### ICO three-layer view

| Layer | Finding |
| --- | --- |
| **A. Hosting / storage location** | **CONFIRMED** database region **AWS London `eu-west-2`** (Neon Console + hostname). Storage of Customer Personal Data at rest is in the UK region selected for the Neon project. |
| **B. Provider corporate / access / support** | Databricks, Inc. is a US company. Product Specific Schedule / Security Measures describe employee access for support, security, development via controlled/JITA interfaces. This is a separate processing layer from the London data plane. |
| **C. Onward Sub-processors** | AWS (customer-selected region); **Grafana Labs (US)** explicitly added for Neon Platform Services; other Databricks subprocessors may process outside UK depending on feature/support path. |

### Restricted transfer (UK GDPR)?

| Question | Classification |
| --- | --- |
| Is London DB region alone enough to conclude “no international transfer”? | **No** |
| Restricted / international transfer may occur? | **YES** (at least for provider corporate/support/telemetry/onward US subprocessors such as Grafana Labs), **even though** the database region is London |
| Storage-location-only transfer to a non-UK country | **Not established** for the primary data plane (London) |

### Split transfer mechanism

#### Non-HR Data

| Item | Status |
| --- | --- |
| Primary mechanism | **UK adequacy regulations — UK Extension to the EU-U.S. DPF** |
| DPF entity | **Databricks, Inc.** — **Active Participant** |
| Covered entity | **Neon, LLC** |
| UK Extension | **Active** |
| UK Extension original certification | **2023-08-15** |
| Next certification due | **2027-08-10** |
| Data covered | **Non-HR Data ONLY** |
| Verification date | **2026-09-21** (official U.S. Department of Commerce DPF List) |
| TRA / data protection test | **NOT REQUIRED** while Databricks remains ACTIVE under the UK Extension, Neon, LLC remains a covered entity, and the transferred data is Non-HR Data |

Do **not** state that UK adequacy covers HR Data.

#### HR Data

| Item | Status |
| --- | --- |
| Mechanism | Databricks DPA: **2021 SCCs** + **UK International Data Transfer Addendum**; **Module Three** where KERSIVO is processor |
| MCSA | Incorporates DPA by reference for processing Personal Data |
| UK Extension adequacy | **Does not apply** (certification covers Non-HR only) |
| Targeted data protection test / TRA | **COMPLETED — PASS** on **2026-09-21** — see [tra-neon-databricks.md](../tra-neon-databricks.md) |

Do **not** classify every barber as HR Data automatically. Independent/self-employed barbers are not automatically HR Data merely because they use KERSIVO.

Do **not** state that all Neon transfers require SCCs — Non-HR transfers rely on adequacy while certification conditions apply.

---

## Transfer mechanism evidence inputs

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **Databricks, Inc. — CONFIRMED** contracting entity; covered entity **Neon, LLC**; billing entity **Neon, LLC — CONFIRMED** |
| Roles | KERSIVO **Processor** → Neon/Databricks **Sub-processor** |
| Data subjects | Booking clients, shop customers, staff/barbers, invitees, persons referenced in CRM/notes |
| Data categories | DATABASE DATA listed above (exclude Blob file bytes); HR subset only where employment-context applies |
| Purpose | Store and query application database to provide Client Services |
| Frequency | Continuous while Services are live |
| Duration | Active service + export window + Neon history/PITR residual (visible window **6 hours CONFIRMED**; residual beyond that **VERIFY**) |
| Special-category position | Not required; free-text risk possible; special-category HR not required by design |
| Technical safeguards | TLS (`sslmode=require`); tenant scoping; authz; purgeShopData; secrets outside git |
| Known destination (data plane) | AWS London `eu-west-2` |
| Known additional destinations | US (Grafana Labs listed; Databricks corporate/support); other subprocessors **VERIFY** — do not claim Grafana receives DB row content without evidence |
| Non-HR mechanism | UK Extension adequacy (ACTIVE; Non-HR only) |
| HR mechanism | UK Addendum + 2021 SCCs, Module Three where KERSIVO is processor |
| Non-HR TRA status | **NOT REQUIRED** where certification conditions apply |
| HR TRA status | **COMPLETED — PASS** (2026-09-21) |
| DPA applicability | **CONFIRMED** via MCSA incorporation by reference |

---

## Technical safeguards

- TLS required on DB connections (`sslmode=require`)
- Application tenant scoping / RBAC
- Shop purge deletes live tenant rows; residual provider copies beyond the visible 6-hour history window remain a **VERIFY** risk
- No full PAN stored by KERSIVO
- File bytes separated to private Vercel Blob

---

## Evidence checked

| Source | Date |
| --- | --- |
| Neon Console: Launch plan; AWS Europe West 2 (London); default branch `production` (Never expires); history retention 6 hours; Postgres 17; compute 0.25 ↔ 8 CU | 2026-09-21 |
| Neon account invoice: billing entity Neon, LLC (Wilmington, DE); Launch Plan — invoice not stored in git | 2026-09-21 |
| Neon Product Specific Schedule Last Updated 2026-08-05 (Databricks, Inc. ↔ Customer; fees may be billed by Databricks or Neon, LLC on Databricks’ behalf) | 2026-09-21 |
| Databricks MCSA (DPA incorporated by reference) + Databricks DPA | 2026-09-21 |
| Official U.S. Department of Commerce DPF List: Databricks, Inc. Active Participant; UK Extension Active; Non-HR Data only; Neon, LLC covered entity; original certification 2023-08-15; next due 2027-08-10 | 2026-09-21 |
| Databricks International Data Transfers FAQ (no government request for customer data to date; subprocessor contractual controls) | 2026-09-21 |
| Targeted HR TRA completed — PASS ([tra-neon-databricks.md](../tra-neon-databricks.md)) | 2026-09-21 |
| Production hostname metadata (`*.eu-west-2.aws.neon.tech`) | 2026-09-21 |
| Neon regions documentation | 2026-09-21 |
| Databricks subprocessors list / Grafana Labs US listing | 2026-09-21 |
| `docs/ops/backup-restore-neon.md` | 2026-09-21 |
| `prisma/schema.prisma` category mapping | 2026-09-21 |

---

## Unknowns / VERIFY

1. **VERIFY** — provider backup / residual deletion beyond the visible **6-hour** history window after `purgeShopData` (do not equate history retention with complete residual expiry).
2. **VERIFY** — which Databricks/Neon subprocessors are actually engaged for this project’s features.
3. **VERIFY** — whether any Neon console integrations (auth, schema sync tools, AI Gateway, etc.) are enabled beyond Postgres.
4. **VERIFY** — read replicas if any beyond the confirmed compute range.
5. **VERIFY** — production Vercel `DATABASE_URL` host continues to match the same `eu-west-2` endpoint (expected; confirm in dashboard without exporting secrets).

---

## Required next actions

### P0 BEFORE FIRST LIVE CLIENT

1. Periodically verify **Databricks, Inc.** remains an **ACTIVE** UK Extension participant; **Neon, LLC** remains a covered entity; and certification continues to cover **Non-HR Data** (next due **2027-08-10**). If adequacy can no longer be relied upon for Non-HR: fall back to Databricks DPA UK Addendum/SCCs and perform any required data protection test.
2. Refresh the **HR TRA** if the DSIT analysis materially changes or is withdrawn, or if the Neon/Databricks processing chain materially changes.

### P1 BEFORE MATERIAL SCALE

1. Document provider backup / residual deletion beyond the visible **6-hour** history window for deletion-completeness claims.
2. Complete first quarterly restore drill log entry in `docs/ops/backup-restore-neon.md`.
3. Confirm whether any preview/non-production branches exist beyond default `production`.

### P2 ONGOING HYGIENE

1. Re-read Neon Product Specific Schedule / Databricks DPA / MCSA on material update.
2. Refresh subprocessor list before TRA refresh.
3. Re-check region after any project migration (region is immutable per project).
4. Re-check DPF / UK Extension status on certification renewal cycle.

---

## Last reviewed

**2026-09-21**
