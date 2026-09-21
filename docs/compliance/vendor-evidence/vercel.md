# Provider

**Vercel Inc.** (Delaware corporation)  
Operational product: Vercel application hosting, Vercel Functions, Vercel Cron, Vercel Blob  
Public DPA: [https://vercel.com/legal/dpa](https://vercel.com/legal/dpa)  
Security / Trust: [https://security.vercel.com](https://security.vercel.com)

| Field | Value |
| --- | --- |
| Production baseline (repo) | `5c0e6bac84a247652bfc97631187490f7ecaad00` |
| Evidence pass | Vendor verification + Blob public/private store split (code); Functions region migration to `lhr1` production-validated |
| Last reviewed | 2026-09-21 |
| Status | INTERNAL — fact gathering + classification (TRA **NOT YET COMPLETED**) |

---

## Service used

| Service | Status |
| --- | --- |
| Application hosting / SSR runtime (`output: 'server'` + `@astrojs/vercel`) | **CONFIRMED** |
| Vercel Serverless Functions (Node) for API / SSR | **CONFIRMED** |
| Vercel Cron Jobs (`vercel.json` crons) | **CONFIRMED** |
| Vercel Blob — dual stores (public + private) | **CONFIRMED** |
| Vercel Analytics / Speed Insights on tenant surfaces | Not injected in app code; tenant `enableAnalytics={false}` — project-level toggle still **VERIFY** if needed |
| Edge Middleware / Edge Functions | Not configured in repo |

Project link (local `.vercel/project.json`, non-secret):

- Project name: `kersivo-barber-outreach`
- Project id: `prj_wjYONueOLAYyeyTbg9sT3jv1KUta`
- Org / team id: `team_GdO6pCXk8YyVs4tlwuRltvbJ`
- Production hostname evidence: `kersivo.co.uk`
- GitHub deploy owner slug (public): `vercelbackend95`

**Plan:** **CONFIRMED — Pro** (account-operator confirmation, 2026-09-21). Public DPA applies to Pro and Enterprise.

---

## KERSIVO role / provider role

| Party | Role (Customer Personal Data) |
| --- | --- |
| Barbershop Client | Controller |
| Bartosz Jasinski trading as KERSIVO | Processor |
| Vercel Inc. | Sub-processor |

---

## Data processed

### Customer Personal Data (processor path)

- Runtime CPD via server routes (bookings, CRM, etc.)
- **Private Blob file bytes** (client-note images; migration CSV; private onboarding assets/documents/images) — **BLOB/FILE DATA**
- Residual runtime log risk — **VERIFY** retention/scrubbing

### Intentionally public website assets (not CPD by design)

Product / service / barber / logo / admin avatar images on the **public** Blob store.

### Environment variables (names only)

Public store: `BLOB_READ_WRITE_TOKEN` (alias `VERCEL_BLOB_READ_WRITE_TOKEN`)  
Private store: `PRIVATE_BLOB_READ_WRITE_TOKEN` (custom prefix `PRIVATE_BLOB`; Production-connected)  
**Values not recorded.**

---

## Account-specific configuration

| Fact | Status |
| --- | --- |
| Plan | **CONFIRMED: Pro** |
| Function region (CURRENT) | **CONFIRMED: `lhr1` / London, United Kingdom** (eu-west-2). `iad1` deselected in project settings. |
| Function region (HISTORICAL) | Previous production region: **`iad1` / Washington, D.C., United States**. Migrated to `lhr1` on **2026-09-21**; production redeployed; production smoke test passed. Region migration did **not** cause the BLACKLINE admin hydration regression (that was client `sharp` dependency contamination, fixed in `5c0e6ba`). |
| Function region pin in `vercel.json` | None |
| Public Blob store | **CONFIRMED:** name `barberdemo-uploads`; access **Public**; region **LHR1 / London, United Kingdom**; credential `BLOB_READ_WRITE_TOKEN` |
| Private Blob store | **CONFIRMED:** name `kersivo-private`; access **Private**; region **LHR1 / London, United Kingdom**; Production-connected; env prefix `PRIVATE_BLOB`; credential `PRIVATE_BLOB_READ_WRITE_TOKEN` |
| Application credential split | **CONFIRMED** in code: public helper never used for private ops; private helper has **no** fallback to public token (fail-closed) |
| Edge vs Serverless | Serverless Functions for Astro SSR/API |
| Cron processing | Confirmed in `vercel.json` |

### Private Blob categories (application)

- Client-note images (`storeNoteImage` → private put; authenticated stream retrieve)
- Migration CSV and other `ClientOnboardingAsset` private uploads
- Private onboarding documents/images (brand guidelines, gallery uploads in onboarding, etc. via private store)

### Public Blob categories (application)

- Product images
- Service images
- Barber / public profile avatars
- Shop logo / admin avatar public uploads

---

## Contract / DPA

| Item | Recorded fact |
| --- | --- |
| Contracting entity (public DPA) | **Vercel Inc.** |
| Public DPA URL | https://vercel.com/legal/dpa |
| Last Updated / Effective (checked 2026-09-21) | Last Updated **17 March 2026**; Effective **31 March 2026** |
| Plan coverage | **Pro and Enterprise** — KERSIVO plan **Pro CONFIRMED** |
| Module for KERSIVO CPD chain | **Module Three** (Processor → Processor) |
| Subprocessors list | https://security.vercel.com |
| Account DPA acceptance proof | Still retain billing/terms confirmation as hygiene — Pro coverage satisfied for applicability baseline |

Public `/dpa` wording “Application hosting/runtime and Vercel Blob storage” remains structurally correct with two Blob stores (same provider/service family). **No DPA text change required** for the dual-store split alone.

---

## International transfer position

### ICO three-layer view

| Layer | Finding |
| --- | --- |
| **A. Hosting / storage location** | Functions: **`lhr1` London CONFIRMED**. Blob (public + private): **LHR1 London CONFIRMED**. |
| **B. Provider corporate / access / support** | Public DPA: **primary processing facilities in the United States**; may process globally. |
| **C. Onward Sub-processors** | Listed at security.vercel.com; may be outside UK. |

### Restricted transfer (UK GDPR)?

**YES**

Application runtime and Blob storage are configured in London (`lhr1` / LHR1). UK-local hosting does **not** by itself remove potential restricted transfers arising from:

1. Vercel Inc. corporate / support processing and the public DPA statement that primary processing facilities are in the United States; and
2. Onward subprocessors that may process outside the UK.

Do **not** treat London Functions + London Blob alone as “no international transfer.”

| Item | Status |
| --- | --- |
| Restricted transfer | **YES** |
| Article 46 safeguard (public DPA) | **2021 EU SCCs** + **UK IDTA/Addendum** |
| Data protection test / TRA | **NOT YET COMPLETED** |

---

## Data protection test status

**TRA / data protection test: NOT YET COMPLETED**

### Inputs for a later Vercel data protection test (evidence only)

| Input | Value |
| --- | --- |
| Data exporter | Bartosz Jasinski, trading as KERSIVO |
| Exporter location | United Kingdom |
| Data importer | Vercel Inc. |
| Roles | KERSIVO **Processor** → Vercel **Sub-processor** |
| Known destinations | Functions **`lhr1` London CONFIRMED**; Blob LHR1 London (public + private); Vercel Inc. / US primary facilities / global subprocessors per DPA |
| Technical safeguards | HTTPS; private Blob fail-closed credential; authenticated note-image streaming; tenant analytics off |
| TRA status | **NOT YET COMPLETED** |

---

## Technical safeguards

- Dual Blob stores with separated credentials (no private→public token fallback)
- Private put/get/del use `access: 'private'` only
- Authenticated server-side streaming for client-note images
- Public uploads remain `access: 'public'` on public store only
- Secrets resolved at operation time (build/CI does not require production private token)

---

## Evidence checked

| Source | Date |
| --- | --- |
| Operator confirmation: Pro plan; Blob stores LHR1 | 2026-09-21 |
| Functions region manually changed `iad1` → `lhr1`; production redeploy; production smoke passed | 2026-09-21 |
| GitHub Actions CI run `35606649723` for SHA `5c0e6bac84a247652bfc97631187490f7ecaad00` completed successfully | 2026-09-21 |
| Vercel production deployment for SHA `5c0e6ba` completed successfully | 2026-09-21 |
| BLACKLINE hydration regression fixed in `5c0e6ba` (client `sharp` isolation — not a Function Region issue) | 2026-09-21 |
| Repo Blob credential split + tests | 2026-09-21 |
| Aggregate DB audit (ClientNoteImage / ClientOnboardingAsset counts only) | 2026-09-21 |
| Public Vercel DPA | 2026-09-21 |

---

## Unknowns / VERIFY

1. Project-level Web Analytics / Speed Insights toggle (if any)
2. Runtime log CPD content / retention
3. Current Vercel subprocessor list snapshot at TRA time
4. Whether preview/non-production environments intentionally lack `PRIVATE_BLOB_READ_WRITE_TOKEN` (expected: private ops fail-closed there)

---

## Required next actions

### P0 BEFORE FIRST LIVE CLIENT

1. Complete **TRA / data protection test** for Vercel (Functions `lhr1` + Blob LHR1 + Vercel Inc. US primary facilities / subprocessors). Do not treat SCCs/IDTA or London Functions/Blob alone as completion.
2. Confirm production `PRIVATE_BLOB_READ_WRITE_TOKEN` is present on Production before any live Client private uploads.
3. Keep dual-store credential separation in any future Blob refactors.

### P1 BEFORE MATERIAL SCALE

1. Document log hygiene / retention.
2. Subscribe to Vercel subprocessor notices if not already.

### P2 ONGOING HYGIENE

1. Re-read DPA on material update.
2. Refresh this evidence after region/plan/Blob changes.

---

## Last reviewed

**2026-09-21**
