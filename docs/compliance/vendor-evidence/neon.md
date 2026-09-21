# Provider

**Operational product:** Neon (managed PostgreSQL / Lakebase Postgres)  
**Public contracting baseline (Neon Product Specific Schedule, Last Updated 5 August 2026):** **Databricks, Inc.**, parent company of **Neon, LLC**  
**Account contracting entity for KERSIVO:** **VERIFY CONTRACTING ENTITY** in Neon/Databricks console / invoice / accepted terms (do not invent)

| Field | Value |
| --- | --- |
| Production baseline (repo) | `8f3e428f4bc7c6d28cc5ab14776f089f2d0ed9c4` |
| Evidence pass | Vendor verification + Databricks UK Extension / Non-HR adequacy + targeted HR TRA |
| Last reviewed | 2026-09-21 |
| Status | INTERNAL — Non-HR: UK Extension adequacy **ACTIVE**; HR: UK Addendum + SCCs with targeted TRA **COMPLETED — PASS** (2026-09-21) |

Official sources checked:

- Neon Product Specific Schedule: https://neon.com/msa / https://neon.com/platform-terms
- Databricks DPA: https://www.databricks.com/legal/dpa (and published PDF variants)
- Databricks MCSA: https://www.databricks.com/legal/mcsa
- Databricks subprocessors: https://www.databricks.com/legal/databricks-subprocessors
- Databricks International Data Transfers FAQ: https://www.databricks.com/legal/tia-faq
- Neon regions: https://neon.com/docs/introduction/regions
- ICO — UK Extension: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/adequacy-regulations/how-does-the-uk-extension-to-the-eu-us-data-privacy-framework-work/
- ICO — TRA using UK government analysis (US): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/completing-a-transfer-risk-assessment/completing-a-tra-using-the-uk-government-s-analysis-us/
- Official U.S. Department of Commerce DPF List: Databricks, Inc. (verified 2026-09-21)
- Internal ops: `docs/ops/backup-restore-neon.md`
- Internal TRA: [tra-neon-databricks.md](../tra-neon-databricks.md)

---

## Service used

| Service | Status |
| --- | --- |
| Managed PostgreSQL as KERSIVO production database | **CONFIRMED** |
| Prisma ORM / migrations against Neon | **CONFIRMED** |
| Neon PITR / branching as backup mechanism (no custom dump cron) | **CONFIRMED** in ops docs |
| Neon plan (Free / Launch / Scale / etc.) | **VERIFY IN NEON CONSOLE** |
| Read replicas | **VERIFY IN NEON CONSOLE** |
| Branch structure / production branch name | **VERIFY IN NEON CONSOLE** (ops drill uses restore branches) |

---

## KERSIVO role / provider role

| Party | Role (Customer Personal Data) |
| --- | --- |
| Barbershop Client | Controller |
| Bartosz Jasinski trading as KERSIVO | Processor |
| Neon / Databricks (account entity) | Sub-processor |

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

Derived **safely** from production connection hostname metadata only (password / full `DATABASE_URL` **not** recorded):

| Field | Value |
| --- | --- |
| Hostname pattern | `ep-….eu-west-2.aws.neon.tech` |
| Endpoint id (non-secret) | `ep-dark-flower-abnkv6he` |
| Region | **`eu-west-2`** — AWS Europe (**London**) / Neon `aws-eu-west-2` |
| Cloud provider | **AWS** |
| Database name | `neondb` |
| TLS | `sslmode=require` present on connection query |
| Evidence source | Local `.env` / `.env.production.local` hostname metadata matching Neon docs (“region is the segment before `.aws.neon.tech`”) |

**CONFIRMED:** AWS Europe (London) `eu-west-2`. Primary database data plane remains London. This does **not** by itself eliminate restricted-transfer risk for US corporate/support/onward layers.

Still **VERIFY IN NEON CONSOLE**: project Settings widget region display, plan, branches, PITR window, compute endpoints, and that production Vercel env points at the same project (hostname match expected).

### Other config

| Fact | Status |
| --- | --- |
| Region changeability | Fixed at project creation (Neon docs) |
| PITR / branch restore | Ops target RPO ≤ 5 minutes; quarterly drill log still pending |
| Backup residual after purge | Residual copies may remain for provider retention window — **VERIFY** exact clock |

---

## Contract / DPA

| Item | Recorded fact |
| --- | --- |
| Operational provider name | Neon (Databricks Neon product family) |
| Public schedule contracting party | **Databricks, Inc.** (parent of Neon, LLC) — Product Specific Schedule Last Updated **5 August 2026** |
| Fees billed by | Databricks (or affiliate Neon, LLC on Databricks’ behalf) per Schedule |
| DPA source (public) | Databricks DPA at https://www.databricks.com/legal/dpa |
| MCSA | https://www.databricks.com/legal/mcsa — incorporates the DPA by reference for processing Personal Data |
| Product-specific schedule | https://neon.com/msa / https://neon.com/platform-terms |
| Security measures | Exhibit A to Neon Product Specific Schedule; Databricks Security Addendum references |
| Subprocessors (Neon schedule) | Grafana Labs (**United States**) **plus** Databricks list at https://www.databricks.com/legal/databricks-subprocessors — do **not** claim Grafana necessarily receives database row content unless official evidence establishes this |
| Infrastructure subprocessor (region-selected) | **Amazon Web Services, Inc.** (customer-selected region = London for this project) |
| UK transfer clauses (public DPA) | **2021 EU SCCs** + **UK International Data Transfer Addendum** (UK Addendum); Module **Three** where Customer is processor |
| KERSIVO account contracting entity proof | **VERIFY CONTRACTING ENTITY** |
| Signed/accepted DPA on account | **VERIFY** |

Do **not** preserve stale “Neon, LLC only” as the sole contracting story without checking the live account terms.

---

## International transfer position

### ICO three-layer view

| Layer | Finding |
| --- | --- |
| **A. Hosting / storage location** | **CONFIRMED** database region **AWS London `eu-west-2`**. Storage of Customer Personal Data at rest is in the UK region selected for the Neon project. |
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
| Data importer | **VERIFY CONTRACTING ENTITY** (public baseline: Databricks, Inc.; covered entity Neon, LLC) |
| Roles | KERSIVO **Processor** → Neon/Databricks **Sub-processor** |
| Data subjects | Booking clients, shop customers, staff/barbers, invitees, persons referenced in CRM/notes |
| Data categories | DATABASE DATA listed above (exclude Blob file bytes); HR subset only where employment-context applies |
| Purpose | Store and query application database to provide Client Services |
| Frequency | Continuous while Services are live |
| Duration | Active service + export window + Neon PITR/backup residual |
| Special-category position | Not required; free-text risk possible; special-category HR not required by design |
| Technical safeguards | TLS (`sslmode=require`); tenant scoping; authz; purgeShopData; secrets outside git |
| Known destination (data plane) | AWS London `eu-west-2` |
| Known additional destinations | US (Grafana Labs listed; Databricks corporate/support); other subprocessors **VERIFY** — do not claim Grafana receives DB row content without evidence |
| Non-HR mechanism | UK Extension adequacy (ACTIVE; Non-HR only) |
| HR mechanism | UK Addendum + 2021 SCCs, Module Three where KERSIVO is processor |
| Non-HR TRA status | **NOT REQUIRED** where certification conditions apply |
| HR TRA status | **COMPLETED — PASS** (2026-09-21) |

---

## Technical safeguards

- TLS required on DB connections (`sslmode=require`)
- Application tenant scoping / RBAC
- Shop purge deletes live tenant rows; residual PITR/backups documented as temporary residual risk
- No full PAN stored by KERSIVO
- File bytes separated to private Vercel Blob

---

## Evidence checked

| Source | Date |
| --- | --- |
| Official U.S. Department of Commerce DPF List: Databricks, Inc. Active Participant; UK Extension Active; Non-HR Data only; Neon, LLC covered entity; original certification 2023-08-15; next due 2027-08-10 | 2026-09-21 |
| Databricks DPA (SCCs + UK Addendum, Module 3); MCSA incorporates DPA | 2026-09-21 |
| Databricks International Data Transfers FAQ (no government request for customer data to date; subprocessor contractual controls) | 2026-09-21 |
| Targeted HR TRA completed — PASS ([tra-neon-databricks.md](../tra-neon-databricks.md)) | 2026-09-21 |
| Production hostname metadata (`*.eu-west-2.aws.neon.tech`) | 2026-09-21 |
| Neon regions documentation | 2026-09-21 |
| Neon Product Specific Schedule (Databricks, Inc.) | 2026-09-21 |
| Databricks subprocessors list / Grafana Labs US listing | 2026-09-21 |
| `docs/ops/backup-restore-neon.md` | 2026-09-21 |
| `prisma/schema.prisma` category mapping | 2026-09-21 |

---

## Unknowns / VERIFY

1. **VERIFY CONTRACTING ENTITY** on the live KERSIVO Neon/Databricks account (invoice/legal entity).
2. **VERIFY IN NEON CONSOLE** — plan, project id display, branches, PITR retention window, compute endpoints, replicas.
3. **VERIFY** — production Vercel `DATABASE_URL` host matches the same `eu-west-2` endpoint (expected; confirm in dashboard without exporting secrets).
4. **VERIFY** — which Databricks/Neon subprocessors are actually engaged for this project’s features.
5. **VERIFY** — backup residual retention clock after `purgeShopData`.
6. **VERIFY** — whether any Neon console integrations (auth, schema sync tools, AI Gateway, etc.) are enabled beyond Postgres.

---

## Required next actions

### P0 BEFORE FIRST LIVE CLIENT

1. Confirm **contracting entity** and that the **Databricks DPA + Neon Product Specific Schedule** apply to the live account.
2. Confirm console region display matches **AWS London `eu-west-2`** (already evidenced by hostname).
3. Periodically verify **Databricks, Inc.** remains an **ACTIVE** UK Extension participant; **Neon, LLC** remains a covered entity; and certification continues to cover **Non-HR Data** (next due **2027-08-10**). If adequacy can no longer be relied upon for Non-HR: fall back to Databricks DPA UK Addendum/SCCs and perform any required data protection test.
4. Refresh the **HR TRA** if the DSIT analysis materially changes or is withdrawn, or if the Neon/Databricks processing chain materially changes.

### P1 BEFORE MATERIAL SCALE

1. Document PITR / backup residual retention clock for deletion completeness.
2. Complete first quarterly restore drill log entry in `docs/ops/backup-restore-neon.md`.
3. Confirm branch strategy (production vs preview databases).

### P2 ONGOING HYGIENE

1. Re-read Neon Product Specific Schedule / Databricks DPA on material update.
2. Refresh subprocessor list before TRA refresh.
3. Re-check region after any project migration (region is immutable per project).
4. Re-check DPF / UK Extension status on certification renewal cycle.

---

## Last reviewed

**2026-09-21**
