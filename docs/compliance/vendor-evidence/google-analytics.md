# Provider

**Operational product:** Google Analytics 4 (GA4) — KERSIVO marketing-site analytics
**Direct contractual entity (standard Google Analytics UK Terms):** **Google Ireland Limited**
**Processor terms:** Google Analytics Terms incorporate the applicable **Google Ads Data Processing Terms** for Processor Services
**DPF profile (onward US path evidence):** Google LLC

| Field | Value |
| --- | --- |
| Production runtime baseline (repo) | `1843c0fbc42328f57a3fdd74bf08acae33bfc513` |
| Evidence pass | Account controls + DPF List + official Google Analytics / transfer documentation + ICO adequacy guidance |
| Last reviewed | 2026-09-25 |
| Status | INTERNAL — Production **ACTIVE** (consent-gated, marketing site only); direct KERSIVO → Google Ireland transfer: **UK adequacy — TRA NOT REQUIRED**; Google LLC UK Extension **ACTIVE** (HR + Non-HR) as onward-path evidence |

Official / account sources checked:

- Google Analytics Admin account configuration — verified manually **2026-09-25**
- Official U.S. Department of Commerce DPF List: Google LLC — verified manually **2026-09-25**
- Official Google Analytics UK Terms / Ads Data Processing Terms (processor path)
- Official Google international-transfer documentation for advertising / analytics products
- ICO — adequacy regulations (EEA / Ireland covered); UK Extension guidance; TRA not required where adequacy applies
- Repo: `GoogleAnalytics.astro`; `src/lib/consent/*`; Cookie Policy; Privacy Policy; Compliance Diary Phase 2B / 2D

Do **not** record Measurement IDs, secrets, or full account identifiers beyond the already-public Production measurement ID pattern where needed for ops.

---

## Service / scope

| Item | Status |
| --- | --- |
| Google Analytics 4 on KERSIVO marketing pages | **ACTIVE** — loads only after Analytics consent |
| Live tenant booking / storefront analytics tags | **OFF** — tenant hard-off **CLOSED** (`enableAnalytics={false}`) |
| Google Ads website tags / remarketing | **INACTIVE / DORMANT** — separate from GA4; do not merge |
| Enhanced Conversions | **NOT USED** |
| Google products & services data sharing | **OFF** |

---

## Production enablement

| Item | Status |
| --- | --- |
| Consent Mode | Privacy-first; analytics tags not loaded until Analytics permission |
| Consent UI (Production) | **Necessary** + **Analytics** only |
| `CONSENT_VERSION` | **3** (Phase 2B runtime) |
| Measurement | Consent-gated GA4 on marketing layouts when `PUBLIC_GA4_MEASUREMENT_ID` present |
| Tenant marketing analytics hard-off | **CLOSED** / unchanged |

---

## Current role

| Party | Role |
| --- | --- |
| Bartosz Jasinski trading as KERSIVO | **Controller** for deciding to use GA4 on the marketing site and for the analytics purposes described in Privacy |
| Google Ireland Limited | **Processor** for current Analytics-service processing under the Google Ads Data Processing Terms (as incorporated) |
| Google (if products & services sharing were enabled) | May act as **independent controller** for data separately shared under applicable controller–controller terms — **do not enable** without re-review |

Current verified products & services sharing = **OFF**. Do **not** use blanket current-role wording “Independent controller” for GA4 Analytics-service data.

---

## Contractual entity

| Item | Value |
| --- | --- |
| Direct contractual GA4 provider (standard UK path) | **Google Ireland Limited** |
| Processor instrument | Google Analytics Terms + incorporated Google Ads Data Processing Terms for Processor Services |
| Google LLC as direct KERSIVO GA4 contracting party | **Not claimed** on current standard UK terms evidence |

---

## Account controls (CONFIGURED / VERIFIED — 25 SEP 2026)

| Control | Status |
| --- | --- |
| Google products & services data sharing | **OFF** |
| GA4 ↔ Google Ads active links | **0** |
| Google Signals | **OFF** |
| Granular location / device data collection | **OFF** |
| User-provided data collection | **OFF** |
| Event data retention | **2 months** |
| User data retention | **2 months** |
| Reset user data retention on new activity | **OFF** |

Configured and verified in GA4 Admin on **25 Sep 2026**. Google states retention-setting changes may take up to approximately **24 hours** to fully apply. Provider-side propagation follow-up remains due after that application window — **do not** claim independent backend propagation verification yet. This is a narrow propagation follow-up, **not** a reason to reopen the contract / direct-transfer assessment.

---

## Direct UK → Ireland transfer

| Item | Status |
| --- | --- |
| Direct processor relationship | KERSIVO → **Google Ireland Limited** |
| Destination | **Ireland / EEA** |
| ICO position | EEA countries including Ireland are covered by full UK adequacy regulations |
| Mechanism | **UK adequacy** |
| TRA / data protection test | **NOT REQUIRED** for this adequacy-covered direct transfer |

**Conclusion:** DIRECT KERSIVO → GOOGLE IRELAND TRANSFER = **ADEQUACY — TRA NOT REQUIRED**.

Do **not** create `tra-google-analytics.md`. Do **not** write “TRA COMPLETED — PASS”. No TRA was required for the adequacy-covered direct transfer.

---

## Google onward-transfer mechanisms

Keep this **distinct** from KERSIVO’s direct UK → Ireland transfer.

Google Ireland (and Google’s processing model) may involve other Google entities / subprocessors. Google may process Customer Personal Data in countries where Google or its subprocessors maintain facilities, under the processor terms.

| Path | Framing |
| --- | --- |
| Eligible US onward transfers | Google documents reliance on the **UK Extension to the EU-U.S. DPF** in certain circumstances for advertising / analytics products where applicable and coverage conditions are met |
| Where DPF / UK Extension does not apply | Google’s processor terms provide contractual transfer mechanisms including applicable **SCCs** |

Do **not** write:

- “all Google international processing is covered by UK Extension”
- “KERSIVO directly transfers GA4 data to Google LLC under the UK Extension” (unless independently proven)

---

## Google LLC DPF evidence (verified 25 Sep 2026)

| Field | Value |
| --- | --- |
| EU-U.S. Data Privacy Framework | **ACTIVE** |
| UK Extension to EU-U.S. Data Privacy Framework | **ACTIVE** |
| Data Collected | **HR and Non-HR Data** |
| Current GA4 telemetry classification | **Non-HR** |
| Next Certification Due Date | **13 Sep 2027** |

Treat DPF / UK Extension as **applicable Google onward-transfer safeguard evidence**, not as automatic proof of a direct KERSIVO → Google LLC transfer path.

---

## TRA determination

| Question | Answer |
| --- | --- |
| Did KERSIVO complete a GA4 TRA? | **No** — not required for the adequacy-covered direct transfer |
| Direct transfer TRA status | **NOT REQUIRED** (Ireland / EEA adequacy) |
| Fake TRA artefact | **Do not create** |

---

## Retention

| Layer | Setting | Note |
| --- | --- | --- |
| GA4 **account** event data retention | **2 months** | Configured / verified in Admin UI **25 Sep 2026** |
| GA4 **account** user data retention | **2 months** | Same |
| Reset user retention on new activity | **OFF** | Same |
| Provider propagation | **FOLLOW-UP PENDING** after Google’s stated application window (~24h) | Narrow follow-up only |
| Browser cookie TTL (`_ga` / `_ga_*`) | Provider cookie default up to **2 years**, subject to browser limits | **Separate** from account retention — see Cookie Policy |

---

## Periodic recheck requirements

| Item | Requirement |
| --- | --- |
| Google LLC UK Extension ACTIVE + HR/Non-HR coverage | Recheck before / around **13 Sep 2027** certification renewal and on material Google contract / transfer change |
| If Google LLC becomes inactive or relevant data is no longer covered | Do **not** continue relying on UK Extension for that applicable onward path |
| Products & services sharing / Ads links / Signals / collection toggles | Re-verify on material account change |
| Retention propagation | Confirm after Google’s application window (narrow follow-up) |

---

## Unresolved / separate matters

| Matter | Status |
| --- | --- |
| Campaign attribution (`gclid` / `gbraid` / `wbraid` / UTMs) | **OPEN / LEGAL REVIEW** — separate from GA4 contract / transfer |
| Google Ads website measurement / remarketing | **CLOSED — DORMANT** — reopen only if Ads re-enabled |
| Twilio SMS | **DEFERRED — PENDING SMS PROVIDER MIGRATION** |
| Historical Google-held Ads records erasure | **Not claimed** |

---

## Change log

| Date | Change |
| --- | --- |
| 2026-09-25 | Initial GA4 vendor-evidence sheet: Google Ireland processor path; Ireland adequacy (TRA not required); Google LLC UK Extension ACTIVE (HR + Non-HR); account controls verified; retention 2m/2m with propagation follow-up. |
