# Provider

**Operational product:** Neon (managed PostgreSQL / Lakebase Postgres)  
**Public contracting baseline (Neon Product Specific Schedule, Last Updated 5 August 2026):** **Databricks, Inc.**, parent company of **Neon, LLC**  
**Account contracting entity for KERSIVO:** **VERIFY CONTRACTING ENTITY** in Neon/Databricks console / invoice / accepted terms (do not invent)

| Field | Value |
| --- | --- |
| Production baseline (repo) | `15ab15b68a4796656d9648fd94b8cccc50b2cfcd` |
| Evidence pass | First KERSIVO vendor verification pass |
| Last reviewed | 2026-09-21 |
| Status | INTERNAL — fact gathering + classification (TRA **NOT YET COMPLETED**) |

Official sources checked:

- Neon Product Specific Schedule: https://neon.com/msa (also linked as platform terms)
- Databricks DPA: https://www.databricks.com/legal/dpa (and published PDF variants)
- Databricks subprocessors: https://www.databricks.com/legal/databricks-subprocessors
- Neon regions: https://neon.com/docs/introduction/regions
- Neon transfer FAQ context: https://www.databricks.com/legal/tia-faq
- Internal ops: `docs/ops/backup-restore-neon.md`

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
| Staff / team | `Barber`, `ShopMember`, `ShopInvite` contact/role data |
| Retail | `Order` / `OrderItem` customer email, snapshots, payment status ids |
| Messaging metadata | `EmailOutbound`, `SmsOutbound` (payload clearing on SENT where implemented) |
| Onboarding metadata | `ClientOnboarding*`, asset metadata (files in Blob) |
| Legal / ops tenant-linked | Where stored with shop linkage; purge exclusions for some controller artefacts |

### BLOB/FILE DATA (not Neon)

Private/public file bytes are stored in **Vercel Blob**. Neon holds pathnames/metadata only.

### Special-category position

Not required by product design. Free-text notes / migration materials may include sensitive content — Client responsibility under DPA.

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

**CONFIRMED:** AWS Europe (London) `eu-west-2`.

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
| Product-specific schedule | https://neon.com/msa |
| Security measures | Exhibit A to Neon Product Specific Schedule; Databricks Security Addendum references |
| Subprocessors (Neon schedule) | Grafana Labs (**United States**) **plus** Databricks list at https://www.databricks.com/legal/databricks-subprocessors |
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
| Restricted transfer status for Customer Personal Data in Neon | **YES** (at least for provider corporate/support/telemetry/onward US subprocessors such as Grafana Labs), **even though** the database region is London |
| Storage-location-only transfer to a non-UK country | **Not established** for the primary data plane (London) |
| Article 46 safeguard (public baseline) | Databricks DPA: **SCCs + UK Addendum** (Module 3 for processor→processor) |
| Data protection test / TRA | **NOT YET COMPLETED** |

Rationale: UK GDPR restricted-transfer analysis must consider the **complete processing chain**, not only the Postgres region string. London hosting reduces data-plane location risk but does not automatically eliminate US importer / support / monitoring subprocessor transfers.

---

## Data protection test status

**TRA / data protection test: NOT YET COMPLETED**

No completed KERSIVO TRA artefact exists in this repository.

### Inputs for a later Neon/Databricks data protection test (evidence only)

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | **VERIFY CONTRACTING ENTITY** (public baseline: Databricks, Inc.) |
| Roles | KERSIVO **Processor** → Neon/Databricks **Sub-processor** |
| Data subjects | Booking clients, shop customers, staff/barbers, invitees, persons referenced in CRM/notes |
| Data categories | DATABASE DATA listed above (exclude Blob file bytes) |
| Purpose | Store and query application database to provide Client Services |
| Frequency | Continuous while Services are live |
| Duration | Active service + export window + Neon PITR/backup residual |
| Special-category position | Not required; free-text risk possible |
| Technical safeguards | TLS (`sslmode=require`); tenant scoping; authz; purgeShopData; secrets outside git |
| Encryption in transit | TLS to Neon |
| Encryption at rest | Claimed in Neon/Databricks Security Measures — accept as vendor TOM; verify in TRA |
| Known destination (data plane) | AWS London `eu-west-2` |
| Known additional destinations | US (Grafana Labs; Databricks corporate/support); other subprocessors **VERIFY** at TRA time |

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
| Production hostname metadata (`*.eu-west-2.aws.neon.tech`) | 2026-09-21 |
| Neon regions documentation | 2026-09-21 |
| Neon Product Specific Schedule (Databricks, Inc.) | 2026-09-21 |
| Databricks DPA (SCCs + UK Addendum, Module 3) | 2026-09-21 |
| Databricks subprocessors list | 2026-09-21 |
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
3. Complete **TRA / data protection test** covering London data plane **plus** US support/Grafana/subprocessor layers (do not mark complete because region is UK or because SCCs exist).

### P1 BEFORE MATERIAL SCALE

1. Document PITR / backup residual retention clock for deletion completeness.
2. Complete first quarterly restore drill log entry in `docs/ops/backup-restore-neon.md`.
3. Confirm branch strategy (production vs preview databases).

### P2 ONGOING HYGIENE

1. Re-read Neon Product Specific Schedule / Databricks DPA on material update.
2. Refresh subprocessor list before TRA refresh.
3. Re-check region after any project migration (region is immutable per project).

---

## Last reviewed

**2026-09-21**
