# Provider

**Vercel Inc.** (Delaware corporation)  
Operational product: Vercel application hosting, Vercel Functions, Vercel Cron, Vercel Blob  
Public DPA: [https://vercel.com/legal/dpa](https://vercel.com/legal/dpa)  
Security / Trust: [https://security.vercel.com](https://security.vercel.com)

| Field | Value |
| --- | --- |
| Production baseline (repo) | `15ab15b68a4796656d9648fd94b8cccc50b2cfcd` |
| Evidence pass | Vendor verification + Blob public/private store split (code) |
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
| Function region | **CONFIRMED: `iad1` / United States** (Washington, D.C.). **No region migration in this task.** |
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
| **A. Hosting / storage location** | Functions: **`iad1` United States CONFIRMED**. Blob (public + private): **LHR1 London CONFIRMED**. |
| **B. Provider corporate / access / support** | Public DPA: **primary processing facilities in the United States**; may process globally. |
| **C. Onward Sub-processors** | Listed at security.vercel.com; may be outside UK. |

### Restricted transfer (UK GDPR)?

**YES**

London Blob storage (**LHR1**) does **not** by itself eliminate the wider Vercel international-transfer assessment, because:

1. Production Functions currently run in **`iad1` (United States)**; and
2. Vercel’s DPA states primary processing facilities are in the United States and contemplates corporate/support/sub-processor processing beyond the Blob region.

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
| Known destinations | Functions `iad1` US; Blob LHR1 London (public + private); US primary facilities / global subprocessors per DPA |
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
| Operator confirmation: Pro plan; Functions `iad1`; Blob stores LHR1 | 2026-09-21 |
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

1. Complete **TRA / data protection test** for Vercel (Functions `iad1` + Blob LHR1 + US primary facilities / subprocessors). Do not treat SCCs/IDTA or London Blob alone as completion.
2. Confirm production `PRIVATE_BLOB_READ_WRITE_TOKEN` is present on Production before any live Client private uploads.
3. Keep dual-store credential separation in any future Blob refactors.

### P1 BEFORE MATERIAL SCALE

1. **Evaluate** moving production Functions from `iad1` to **LHR1** (UK market; Neon `eu-west-2`; both Blob stores LHR1) to reduce cross-region latency/data movement. **Not legally mandatory** as a sole conclusion; separate controlled infrastructure change — **not performed in this task**.
2. Document log hygiene / retention.
3. Subscribe to Vercel subprocessor notices if not already.

### P2 ONGOING HYGIENE

1. Re-read DPA on material update.
2. Refresh this evidence after region/plan/Blob changes.

---

## Last reviewed

**2026-09-21**
