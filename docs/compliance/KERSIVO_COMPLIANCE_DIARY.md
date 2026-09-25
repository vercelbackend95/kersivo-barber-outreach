# KERSIVO Compliance & Data-Protection Diary

**Purpose:** Single source of truth for KERSIVO compliance/privacy/data-protection hardening.
**Rule:** Before starting any new compliance task, check this file first. Do **not** reopen a CLOSED item unless new code, provider evidence, or a regression proves the old conclusion is no longer true.

**Last updated:** 25 September 2026
**Latest verified substantive compliance/runtime baseline:** `6ef76ab56134151b12fa4865d2f5da6ce1aaa16f`

---

## Status legend

- **CLOSED** — implemented/reviewed and verified. Do not repeat.
- **DOCS CATCH-UP** — runtime is already fixed; documentation still needs to catch up. *(Not currently active — documentation catch-up CLOSED 24 September 2026.)*
- **OPEN — PRE-LAUNCH** — real remaining work worth doing before/around first live customers.
- **OPEN — MAINTENANCE** — valid backlog, but not the same class of urgent risk as the closed P0/P1 runtime items.
- **DEFERRED** — intentionally postponed; unresolved facts remain; do **not** treat as CLOSED.
- **PLANNED / FUTURE PROVIDER** — not currently active in production processing unless proven by runtime evidence.
- **PERIODIC RECHECK** — not an unfinished project; re-verify periodically or after a material provider/product change.
- **LEGAL REVIEW** — do not invent an answer in code/docs.

**Golden rule:** A stale document is not proof that runtime work is still open.

**Before reopening any CLOSED item:**
1. check this Diary
2. check current git history
3. check current runtime/code
4. require new evidence of regression or changed processing

---

# 1. CURRENT VERIFIED SUBSTANTIVE COMPLIANCE / RUNTIME BASELINE

Latest verified substantive compliance/runtime baseline:

`6ef76ab56134151b12fa4865d2f5da6ce1aaa16f`

**Baseline rule:** Repository `main` HEAD may be newer than this SHA. This baseline is **not** required to equal the latest git `main` HEAD. Diary-only, changelog-only, or other metadata/documentation commits do not advance the substantive compliance/runtime baseline unless they change the factual compliance state, legal disclosure state, runtime processing, or deployed controls. A new baseline is recorded only after a substantive compliance/legal/runtime change has been independently verified. Diary maintenance commits themselves do not trigger baseline churn.

Latest phase:

**Phase 3B — Server-side checkout campaign attribution removal — PRODUCTION VERIFIED / CLOSED (runtime)**

Substantive runtime commit (also the current substantive baseline):

`6ef76ab56134151b12fa4865d2f5da6ce1aaa16f`

Subject:

`fix: remove checkout campaign attribution`

Parent:

`d0e2760183c3f967970d752a5a5694eb1065bca1`

Independent verification of this substantive baseline:

- Local targeted attribution/legal tests = **SUCCESS** (64 / 64)
- Typecheck = **SUCCESS**
- Full test suite = **SUCCESS** (405 files / 2676 tests)
- Production build = **SUCCESS**
- GitHub Actions CI = **SUCCESS** (Run ID `36130527392`)
- Vercel = **SUCCESS**
- Production verification (25 September 2026): **ATTRIBUTION REMOVAL PRODUCTION VERIFIED**
- No migration required

Prior substantive runtime baseline (Phase 2B Google Ads dormant-mode — still CLOSED, do not reopen):

`1843c0fbc42328f57a3fdd74bf08acae33bfc513` — `fix: retire inactive Google Ads tracking`

Prior substantive documentation baseline (Documentation Catch-up — still CLOSED, do not reopen):

`bf9ae379994ad60a4df032800256530c0f4f7b74` — `docs: align compliance records with deployed controls`

Prior substantive runtime baseline (Client Erasure / Retail Identity P1 — still CLOSED, do not reopen):

`49bde6aa8b81074c52ecec88b49922adc3805b93` — `fix: cover retail identity in client erasure` (CI #220 attempt 2 SUCCESS; Vercel SUCCESS)

---

# 2. CLOSED — DO NOT REOPEN WITHOUT NEW EVIDENCE

## 2.1 DPA / processor-contract foundation — CLOSED

Commit: `185745d8eaf7a9b84e97260207a8eb925ecb0c08`
Subject: `legal: add DPA and integrate processor terms`

Completed:
- KERSIVO DPA exists
- DPA integrated with Terms
- Client/controller vs KERSIVO/processor framing added
- Schedules / subprocessor model added
- Return/deletion and processor obligations documented

**Do not start another “create a DPA from scratch” project.**

## 2.2 Internal GDPR / ROPA foundation — CLOSED

Commit: `15ab15b68a4796656d9648fd94b8cccc50b2cfcd`
Subject: `compliance: align AI processing and add internal GDPR records`

Completed:
- internal compliance records
- ROPA structure
- AI processing alignment
- baseline processor/controller documentation

## 2.3 Operational telemetry PII minimisation — CLOSED

Commit: `740382eb672b8f649e0e325b14f049a8f8ca85a5`
Subject: `security: minimise customer PII in ops telemetry`

Completed:
- direct customer PII minimisation in operational telemetry
- later Sentry-specific privacy controls built on top

## 2.4 Public/private Vercel Blob separation — CLOSED

Commit: `424a74533849e6a4b51324785eccbc31c006bef3`
Subject: `security: separate public and private Blob storage`

Completed:
- public Blob and private Blob separated
- private assets moved to private storage model
- credential separation introduced
- private store used for sensitive/private assets

Current known stores:
- Public Blob: `barberdemo-uploads` — LHR1
- Private Blob: `kersivo-private` — LHR1

## 2.5 Vercel region / transfer assessment — CLOSED

Relevant commits:
- `2e9946c835ac3abfba5ffbdf89e0f39bd0ae72d9` — `docs: align compliance records with lhr1 runtime`
- `8f3e428f4bc7c6d28cc5ab14776f089f2d0ed9c4` — `docs: record Vercel UK Extension adequacy`

Completed:
- Functions runtime moved/verified in `lhr1`
- Blob storage region documented
- Vercel transfer position documented
- UK Extension adequacy path documented

Remaining Vercel work is **PERIODIC RECHECK**, not a fresh compliance project.

## 2.6 Neon / Databricks transfer assessment — CLOSED

Relevant commits:
- `fe330922e0f3b153abf9738538115f21d8f34ad3` — `docs: complete Neon transfer assessment`
- `5e47b3369ce3c6f10a4c4ad61ca29b0c45e94dc2` — `docs: confirm Neon account contract details`

Completed:
- production data plane confirmed London / `eu-west-2`
- contracting/billing entity work recorded
- DPA applicability reviewed
- Non-HR adequacy route documented
- targeted HR TRA completed and passed

Remaining Neon residual/back-up-detail questions are not a reason to redo the whole Neon assessment.

## 2.7 Resend transfer assessment — CLOSED

Commit: `99ee23b7352d580b1a529ba8e8c2470cdbd3768a`
Subject: `docs: complete Resend transfer assessment`

Completed:
- provider/legal entity reviewed
- US storage documented
- DPA applicability documented
- Non-HR transfer route documented
- targeted HR TRA completed and passed

Provider-held message residuals remain a caveat; they are not proof that the Resend assessment is unfinished.

## 2.8 OpenAI transfer assessment — CLOSED

Commit: `e19f4953fa3b2ca429e7eadc3e8a99f6e1daf2c0`
Subject: `docs: complete OpenAI transfer assessment`

Completed:
- Admin AI CPD path assessed
- UK Addendum / SCC approach documented
- targeted TRA completed and passed
- production project/data-controls facts recorded
- training/sharing opt-ins documented disabled
- application does not durably store raw admin AI prompts/responses

Future CRM-aware AI expansion would need re-review, but current scope is closed.

## 2.9 Sentry privacy + transfer assessment — CLOSED

Key commits:
- `c19e9aa3f577df354bf716c45c0462b6efe26078` — `docs: complete Sentry transfer assessment`
- `f156f927edcd6364faa78ac74df89fbcacb85498` — `ops: add Sentry coverage for critical alerts`
- `250658c0e841ea0d490f021d90d940d2c645f4f0` — `ops: tag Sentry operational alerts`
- `1fdf72553b7f432ad05f9d0ff43df7c832e1b18b` — `fix: initialize Sentry for API routes`

Completed:
- Sentry provider/transfer review
- privacy scrubbing
- no intentional direct customer email/phone/name tagging
- server-side operational monitoring
- production alert routing

Periodic DPF/UK Extension rechecks are maintenance, not unfinished implementation.

## 2.10 Slack runtime / compliance removal — CLOSED

Relevant commits:
- `288a0aefce74bc02e2c4ecf381e074cce798158d` — `ops: remove Slack runtime alerts`
- `b20164271c61ce019a57f0e8ff818d86625dd3e7` — `docs: remove Slack from current disclosures`

Completed:
- Slack operational alert path removed
- production Slack env removed
- disclosures aligned
- no need to complete a Slack TRA because Slack was removed instead

Dormant schema remnants can be cleaned later as maintenance.

## 2.11 Google Sign-In / OAuth credential minimisation — CLOSED

Relevant commits:
- `d0c6bd16e70c47a19aea015790a15015ae5f072e` — `security: minimise OAuth credential storage`
- `845771346803fb894b9885a91703345c350e6385` — `docs: document Google sign-in privacy handling`

Completed:
- identity scopes only
- no Gmail/Drive/Calendar access
- durable OAuth access/refresh/ID token persistence guarded off
- legacy credential scrub performed
- Privacy/ROPA/register updated
- not treated as a Schedule-2 Customer Personal Data subprocessor path

Do not reopen as a generic “Google OAuth compliance” project unless scopes/runtime change.

## 2.12 Stripe checkout security hardening — CLOSED

Commit: `1d492ce8fed235d6b3c9693f6534187f7161fadd`
Subject: `security: harden Stripe checkout flows`

Completed:
- checkout metadata minimisation
- relevant payment-flow security hardening
- no need to repeat the checkout metadata audit unless flow changes

## 2.13 Stripe compliance review — CLOSED

Commit: `778b579a984fce5b5fde77853adf859bc71253cf`
Subject: `docs: complete Stripe compliance review`

Completed:
- SaaS Stripe account role reviewed
- Stripe Connect role differentiated
- transfer/legal-role documentation updated
- DPF/UK Extension position documented
- current 0% Connect application fee framing aligned
- historical setup deposit path documented

**Important:** campaign attribution lawful basis was deliberately left open. That does not mean the whole Stripe compliance review is open.

## 2.14 Retention policy definition — CLOSED AS POLICY

Commit: `707fa9911070ceb7912b7cf68f25522fd0f6ed05`
Subject: `docs: define data retention policy`

Completed:
- purpose-specific retention schedule created
- 30-day SaaS export / purge window documented
- controller vs processor retention distinguished
- blanket “everything for six years” avoided
- provider residual caveats documented
- right-to-erasure exceptions documented

Some retention **enforcement jobs** remain open; the policy-definition project itself is closed.

## 2.15 Individual Client erasure runtime — CLOSED

Runtime commit: `01e167e32b2e5ddfc85b60333de82bb74491e823`
Subject: `feat: add client data erasure`

Docs commit: `aabf1782e1f74146be5f8053548d9ef31d7d1f14`
Subject: `docs: document client erasure controls`

Implemented:
- OWNER/MANAGER erasure instruction path
- Client profile hard-delete
- notes hard-delete
- historical Booking contact/profile PII anonymisation
- future/active/unresolved operational blockers
- stale reminder claim handling
- booking-linked local outbound email/SMS cleanup
- client avatar cleanup where validated
- private client-note Blob cleanup best-effort
- payment/Stripe/refund identifiers retained where needed for transaction integrity
- provider residual copies not overclaimed as instantly erased

## 2.16 Shop-wide public Blob cleanup P0 — CLOSED

Commit: `906abc11ef72f6b5da3933b51d2cf5d2737f9f4e`
Subject: `feat: add guarded shop blob cleanup`

Implemented:
- `ShopSettings.purgeStartedAt`
- writer/purge serialization
- coupled upload compensation where a writer loses the purge race
- write-time same-shop public-media ownership policy
- configured public Blob store host ownership check
- cross-shop protection
- collected public Blob cleanup
- mandatory paginated `shops/{shopId}/` prefix sweep after DB purge
- detached product/service upload orphan cleanup inside shop prefix
- account-delete provider cleanup isolated from Phase-1 DB success
- retention purge provider cleanup isolated post-commit
- additive migration deployed through normal production build path

Important caveat:

This closes the **current-runtime shop purge coverage**. It does **not** prove that every historical legacy namespace orphan (`clients/`, `barbers/`, `products/`) created before the current model has been reconciled.

That legacy reconciliation is a separate maintenance task.

## 2.17 Tenant marketing analytics hard-off P0 — CLOSED

Commit: `a82b6553f03b8a28a5d43ba2c5efc1047d89d7c2`
Subject: `fix: hard-off marketing analytics on tenant surfaces`

Implemented:
- live tenant storefront/booking routes do not load KERSIVO corporate GA4/Google Ads tags
- `CookieConsentMount` omitted when analytics disabled
- `InitDataTrackScript` omitted when analytics disabled
- booking confirm/cancel/reschedule explicitly analytics-off
- explicit `tenant` route family
- marketing ↔ tenant crossing forces full document reload
- prevents previously loaded marketing `window.gtag` / analytics JS realm from surviving into live tenant flows

Corporate marketing analytics remains separate and consent-based.

Do not reopen “tenant GA leakage” unless route/layout behaviour changes or a browser/network regression proves it.

## 2.18 Client Erasure / Retail Identity P1 — CLOSED

Commit: `49bde6aa8b81074c52ecec88b49922adc3805b93`
Subject: `fix: cover retail identity in client erasure`

Implemented:
- canonical retail mailbox identity via `trim().toLowerCase()`
- existing stored Client identity lock retained
- canonical retail identity lock added when needed
- matching `SHOP_ORDER_CONFIRMATION` local `EmailOutbound` rows selected by shop + purpose + canonical email
- no dangerous generic `bookingId: null` deletion
- idle QUEUED / FAILED / SENT matching retail confirmation rows hard-deleted locally
- genuine `__IN_FLIGHT__` retail confirmation temporarily blocks erasure
- matching `Order.customerEmail` anonymised
- same-shop different customer protected
- different-shop same email protected
- onboarding email purposes protected
- provider-held Resend copies not claimed erased

Validation:
- targeted tests: 52/52
- full suite locally: 402 files / 2626 tests
- typecheck: pass
- GitHub CI #220 attempt 2: success
- Vercel: success

## 2.19 Documentation Catch-up — CLOSED

Commit: `bf9ae379994ad60a4df032800256530c0f4f7b74`
Subject: `docs: align compliance records with deployed controls`
Parent: `49bde6aa8b81074c52ecec88b49922adc3805b93`

**Status:** CLOSED
**Runtime was already fixed.** This phase was documentation/tests only — not a new runtime redesign.

Completed changes:
- retention schedule aligned to deployed shop-wide public Blob cleanup
- ROPA aligned to deployed public Blob cleanup and retail identity erasure
- DPA Section 10 aligned to deployed deletion controls
- DPA Schedule 3 G aligned to deployed public media cleanup
- Cookie Policy explicitly documents tenant GA/Ads hard-off
- DPA version updated to `2026-09-24`
- Terms version intentionally remains `2026-09-23` (non-material factual DPA correction; no Terms bump / no re-acceptance behaviour)
- sitemap Cookie lastmod updated to `2026-09-24`
- legal regression tests updated to protect the new factual state
- scope-expansion test/sitemap date files aligned (`marketingSitemap`, business-identity cookie date, AiAssistantPanel version independence)

Explicit caveats preserved:
- public Blob cleanup is **best-effort** provider object deletion
- provider/CDN residuals may persist
- historical legacy namespace orphan reconciliation is **separate** (OPEN — MAINTENANCE)
- Resend/provider-held message copies are **not** claimed erased
- genuinely in-flight messaging can temporarily block Client erasure

Local validation before commit:
- targeted legal tests: **6 files / 46 tests PASS**
- typecheck: **PASS**
- full test suite: **402 files / 2627 tests PASS**
- `git diff --check`: clean

Post-push independent verification:
- GitHub `main`: `bf9ae379994ad60a4df032800256530c0f4f7b74`
- GitHub Actions CI #221 (Run ID `35994296081`): **SUCCESS**
  - Generate Prisma client: **SUCCESS**
  - Typecheck: **SUCCESS**
  - Tests: **SUCCESS**
  - Astro build: **SUCCESS**
- Vercel: **SUCCESS**

**Do not reopen “docs still claim Blob purge is pending” or “docs catch-up still active” unless new evidence shows documents have regressed or new runtime behaviour is undocumented.**

## 2.20 Phase 2B — Google Ads dormant-mode — CLOSED (runtime)

Commit: `1843c0fbc42328f57a3fdd74bf08acae33bfc513`
Subject: `fix: retire inactive Google Ads tracking`
Parent: `73cdda6326aebfd38167569ed7e77b0030a0f233`

**Status:** CLOSED for **Google Ads runtime / current Production processing** (dormant).

Independent verification:
- GitHub Actions CI #225 (Run ID `36012438008`) = **SUCCESS**
- Vercel deployment `BprqVenGdErd3hPX4NzSuCG43dGF` = **SUCCESS**
- Production browser verification: **PRODUCTION VERIFIED — GOOGLE ADS DORMANT / GA4 CONSENT-BASED**

Verified Production facts (24 September 2026):
- `CONSENT_VERSION = 3`
- Production consent UI categories: **Necessary** + **Analytics** only (no Advertising measurement / Personalised advertising)
- Production `PUBLIC_GOOGLE_ADS_ID` **ABSENT**
- Production `PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL` **ABSENT**
- GA4 ↔ Google Ads active links = **0**
- no Production AW-* runtime ID / AW config / Ads conversion target
- no Google Ads / DoubleClick network observed after Accept all
- no `_gcl_*` / `_gac*` / `_gcl_ls` created
- stale optional storage automatically retired on CookieConsent mount (invalid/old consent; Ads-absent effective clamp)
- GA4 remains consent-based (`G-6QEN5JL0L1`); analytics_storage denied before consent; GA4 loads after Analytics consent; withdrawal clears removable GA storage
- Google Analytics account “Google products & services” data sharing = **OFF**
- tenant marketing analytics hard-off remains **CLOSED** (`a82b655…`)

Programme status (do **not** mark entire GA4/Ads programme CLOSED):
- **GOOGLE ADS RUNTIME / CURRENT PROCESSING:** CLOSED — DORMANT
- **GA4 RUNTIME CONSENT IMPLEMENTATION:** VERIFIED
- **GA4 CONTRACT / PROCESSOR / DIRECT TRANSFER:** CLOSED — ADEQUACY-BASED (Phase 2D — 25 Sep 2026; see §3.2)
- **GA4 ACCOUNT CONTROLS:** CONFIGURED / VERIFIED — 25 SEP 2026 (retention provider propagation follow-up pending)
- **CAMPAIGN ATTRIBUTION (SERVER-SIDE CHECKOUT):** PRODUCTION VERIFIED / CLOSED — REMOVED / INACTIVE (Phase 3B — `6ef76ab…`)

Reactivation of Google Ads requires: re-audit role/transfer; reintroduce Ads consent purposes; bump `CONSENT_VERSION`; verify Ads account links/settings; update public policies. Do **not** claim historical Google-held Ads data was erased.

**Do not reopen Ads dormant-mode runtime** unless Production Ads IDs are reintroduced or a browser/network regression proves Ads tags load again.

---

# 3. REAL REMAINING PRE-LAUNCH / NEAR-LAUNCH WORK

This section intentionally excludes things already closed above.

## 3.1 Twilio SMS compliance — DEFERRED — PENDING SMS PROVIDER MIGRATION

**Previously next-active; deliberately deferred. Not CLOSED.**

Reason:
KERSIVO intends to replace Twilio with Amazon-based SMS delivery, so a full Twilio compliance/transfer audit is deliberately deferred until the SMS-provider migration work is finalised.

Current evidence / unresolved factual questions (still unresolved — do not treat as resolved):
- whether Twilio SMS reminders are actually enabled in Production
- current contractual / DPA position
- exact UK international-transfer mechanism (still recorded as `VERIFY`)
- whether a TRA / data-protection test would be required
- production enablement/configuration still needs a final factual check when Twilio work is reactivated

**Operational note:** If Twilio is still processing real production personal data at the point KERSIVO begins serving live customers at meaningful scale, its compliance position must be resolved even if migration has not yet completed.

Amazon / AWS SMS status: **PLANNED / FUTURE PROVIDER**
- Do **not** describe AWS End User Messaging, SNS, Pinpoint, or any other AWS SMS service as currently active unless future runtime evidence proves it.
- Do **not** perform an AWS compliance assessment in this Diary priority update.
- When the provider migration actually begins, the final SMS compliance phase should audit the provider that is genuinely selected and deployed.

## 3.2 GA4 contractual / processor / direct transfer — CLOSED — ADEQUACY-BASED (25 Sep 2026)

**Status:** **CLOSED** for GA4 contract / processor / **direct** KERSIVO → Google Ireland transfer on current verified facts.

Do **not** reopen as “OPEN / VERIFY” merely because a narrow retention-propagation follow-up remains.

### Verified conclusions (25 September 2026)

| Topic | Status |
| --- | --- |
| GA4 consent runtime | **VERIFIED** (Production; marketing site only; tenant hard-off CLOSED) |
| GA4 processor role | **VERIFIED** — Google = processor for Analytics-service data while products & services sharing **OFF**; KERSIVO = controller |
| GA4 contractual provider | **Google Ireland Limited** — **VERIFIED** (standard UK Analytics terms; Ads Data Processing Terms incorporated for Processor Services) |
| Direct KERSIVO → Google Ireland transfer | **UK adequacy** (Ireland / EEA) |
| TRA / data protection test | **NOT REQUIRED** for the adequacy-covered direct transfer — do **not** invent a completed TRA or create `tra-google-analytics.md` |
| Google LLC DPF / UK Extension | **ACTIVE**; **HR + Non-HR**; verified **25 Sep 2026**; next certification due **13 Sep 2027**; periodic recheck required. Treat as **onward-path** evidence — do **not** claim KERSIVO directly transfers to Google LLC under UK Extension, or that all Google processing is UK Extension-only |
| Other onward paths | Governed by Google processor terms / applicable SCCs where frameworks do not apply |

### Account controls — CONFIGURED / VERIFIED 25 Sep 2026

- Google products & services sharing = **OFF**
- GA4 ↔ Google Ads active links = **0**
- Google Signals = **OFF**
- Granular location / device data = **OFF**
- User-provided data collection = **OFF**
- Event data retention = **2 months**
- User data retention = **2 months**
- Reset user data retention on new activity = **OFF**

Configured and verified in GA4 Admin on **25 Sep 2026**. Provider-side retention propagation follow-up remains due after Google’s stated application window (~24 hours). Do **not** claim independent backend propagation verification yet. This is a **narrow follow-up**, not an unresolved contract/transfer assessment.

Evidence sheet: [vendor-evidence/google-analytics.md](./vendor-evidence/google-analytics.md).

Google Ads runtime / current Production processing remains **CLOSED — DORMANT** (Phase 2B / `1843c0f…`). Do **not** reopen Ads transfer work while Ads remains dormant.

Tenant leakage remains CLOSED. Do **not** reopen tenant analytics hard-off.

Campaign attribution server-side checkout path is **PRODUCTION VERIFIED / CLOSED — REMOVED / INACTIVE** (Phase 3B / `6ef76ab…`). GA4 consent-based campaign/source measurement remains under A11.

## 3.2a GA4 retention provider propagation — FOLLOW-UP PENDING

**Narrow follow-up only** (not a contract/transfer reopen):

Confirm after Google’s stated application window that Admin retention settings (**2 months** / **2 months**, reset **OFF**) have applied as expected. Record confirmation in Diary / vendor-evidence when done.

## 3.3 Campaign attribution — SERVER-SIDE CHECKOUT ATTRIBUTION: PRODUCTION VERIFIED / CLOSED — REMOVED / INACTIVE

**Date:** 25 September 2026
**Commit:** `6ef76ab56134151b12fa4865d2f5da6ce1aaa16f` — `fix: remove checkout campaign attribution`
**Status:** **PRODUCTION VERIFIED / CLOSED**

Decision: KERSIVO chose **minimisation** rather than maintaining separate individual checkout attribution processing while Google Ads is dormant. No separate lawful-basis conclusion is required for the removed path.

Verified current Production runtime (25 September 2026):
- LaunchWizard no longer sends campaign attribution
- active subscription checkout request contains no `gclid` / `gbraid` / `wbraid` / UTM / `ga_client_id` attribution payload
- Stripe metadata builders no longer add campaign identifiers
- webhook `attributionSummary` removed
- internal Resend fulfilment attribution removed
- dormant deposit attribution handling removed
- setup fees remain disabled
- no dedicated attribution cookie / localStorage / sessionStorage
- GA4 remains consent-based
- Google Ads remains **CLOSED — DORMANT**
- URL hygiene remains **P2 / NON-BLOCKING**

Evidence caveat:
- Production checkout request and deployed metadata builders verified; provider-side metadata was not directly inspected.

Remains (non-reopen):
- GA4 consent-based campaign/source analytics under **A11** (unchanged; do **not** reopen GA4 contract/transfer)
- Google Ads **CLOSED — DORMANT**
- No dedicated browser attribution storage (cookie / localStorage / sessionStorage / IndexedDB)
- URL parameters may remain in the page URL — **URL hygiene = P2 / non-blocking**
- Historical provider-side copies from earlier test/legacy flows may remain subject to provider/account retention; current runtime no longer creates new copies — **not** falsely claimed erased

Do **not** reopen as active checkout attribution without a new compliance decision.

## 3.4 Final legal/document consistency audit — COMPLETED — 25 SEP 2026

**Status:** **COMPLETED** (Phase 4A read-only sweep + Phase 4B docs-only consistency patch).

Final pass covered Terms / DPA / Privacy / Cookies / ROPA / retention schedule / subprocessor-transfer register for stale pending claims, overclaim of provider deletion, false provider roles, reopened closed items, and version/date consistency.

**Outcome:** no current material compliance blocker identified; **SEO / normal marketing work NOT BLOCKED**. Narrow non-blocking GA4 retention-propagation follow-up and deferred Twilio / maintenance backlog remain as recorded in §9 — do **not** reopen closed areas.

---

# 4. VALID BACKLOG — NOT THE SAME AS AN URGENT P0

## 4.1 Automated retention enforcement — OPEN — MAINTENANCE

Documented policy exists, but some automated cleanup/minimisation remains pending for:
- `Verification`
- `RateLimitEvent`
- `StripeWebhookEvent`
- `AccountLifecycleEvent`
- `RecommendationOpsAction`
- `SiteLaunchEvent`
- `SaasSubscription`
- `SetupDeposit`
- `LegalAcceptance`

This should be planned as lifecycle maintenance / retention enforcement.

Do not restart the retention-policy-definition work; that is already closed.

## 4.2 Historical legacy public Blob orphan reconciliation — OPEN — MAINTENANCE

Current shop purge is closed and guarded.

Separate possible historical issue:
- `clients/...`
- `barbers/...`
- `products/...`

may contain old orphaned objects created before current safeguards.

Any cleanup must be conservative because tenant ownership of legacy paths can be ambiguous.

Do not perform unsafe prefix-wide deletion in legacy namespaces.

## 4.3 Private Blob cleanup retry/reconciliation — OPEN — MAINTENANCE

Current private Blob deletion is best-effort.

Potential future hardening:
- durable retry
- reconciliation job
- operational visibility for failed deletes

Not equivalent to “private Blob cleanup is missing.”

## 4.4 First live Client-specific register row — FUTURE OPERATIONAL STEP

When the first real barbershop is onboarded, record the actual Client/controller relationship and enabled optional processors/features as needed.

This is not missing runtime functionality today.

---

# 5. PERIODIC RECHECKS — NOT UNFINISHED PROJECTS

Do not treat these as work that must be redone now.

Periodic checks include:
- Vercel UK Extension/DPF status
- Neon/Databricks UK Extension status
- Resend UK Extension status
- Sentry UK Extension status
- Stripe DPF/UK Extension status
- OpenAI Data Controls / material contract changes
- provider retention terms if materially changed

A periodic recheck becomes an active project only when:
- certification changes
- provider terms materially change
- KERSIVO changes provider
- data categories change
- processing region changes
- new feature materially expands processing

---

# 6. ITEMS THAT MUST NOT BE ACCIDENTALLY REOPENED

Unless new evidence exists, do not propose redoing:
- DPA from scratch
- ROPA from scratch
- Vercel TRA/transfer assessment
- Neon transfer assessment
- Resend transfer assessment
- OpenAI transfer assessment
- Sentry transfer assessment
- Slack TRA
- Google OAuth token-storage audit
- Stripe compliance review
- retention policy definition
- individual Client erasure
- shop-wide public Blob purge coverage
- tenant GA/Ads hard-off
- retail `SHOP_ORDER_CONFIRMATION` erasure coverage
- documentation catch-up for the three closed runtime phases above
- Google Ads dormant-mode runtime (Phase 2B) while Ads remains inactive

---

# 7. OPERATIONAL SAFETY RULES FOR FUTURE COMPLIANCE WORK

Preferred workflow:
1. Understand the claimed gap.
2. Check this diary.
3. Check git history/current runtime.
4. Read-only audit.
5. Decide whether the issue is CLOSED, docs stale, or genuinely OPEN.
6. Only then implement.
7. Run targeted tests.
8. Run full tests/typecheck.
9. Audit diff.
10. Stage explicit approved paths only.
11. Commit only after staged-diff approval.
12. Push only after pre-push remote verification.
13. Independently verify GitHub CI + Vercel.
14. Update this diary after the phase closes.

Never use:
- `git add .`
- `git add -A`
- `git add -u`
- force push
- manual production DB destructive changes
- manual migrations unless explicitly planned and verified
- speculative provider/legal claims

---

# 8. KNOWN UNRELATED UNTRACKED FILES — DO NOT TOUCH DURING COMPLIANCE PATCHES

Known unrelated artifacts from prior work include:
- `.merge_file_ijLHdV`
- `PHASE_4C2A3_REVIEW.md`
- `PHASE_4C2A4_REVIEW.md`
- `PHASE_4C2B_LIVE_REVIEW.md`
- `PHASE_6A1_2_REVIEW.md`
- `PHASE_6A2A_REVIEW.md`
- `PHASE_6A2B_REVIEW.md`
- `PHASE_6B1_1_REVIEW.md`
- `PHASE_6B1_2_REVIEW.md`
- `public/demo/script/`
- `public/images/Ilustracje/kkk.png`
- `scripts/recommendations/offlineV8AuditedReplay.ts`

If the worktree differs, inspect before acting. Do not invent additional filenames.

---

# 9. NEXT ACTION

**CURRENT COMPLIANCE PROGRAM STATUS: CORE PRE-SEO REVIEW COMPLETE**

**PRIMARY PRODUCT / GROWTH WORK MAY PROCEED: SEO / MARKETING**

Final compliance consistency sweep (Phase 4A/4B) completed **25 September 2026**. No current material compliance blocker was identified for normal SEO / marketing work on the existing marketing-site consent / GA4 stack.

**Phase 5B (25 Sep 2026):** targeted lawful-basis + A15 outreach documentation/controls implemented. SEO remains **NOT BLOCKED**. Cold electronic outreach is governed by the PECR corporate/individual/unknown screen, first-contact Privacy pointer, suppression/DNC, A15 retention, and LIAs before continuing to leads whose subscriber status is not safely established.

**NEXT FOLLOW-UP (narrow — NON-BLOCKING):** GA4 retention provider-propagation confirmation (after Google’s ~24h application window for the 25 Sep 2026 Admin retention settings). Do **not** reopen GA4 contract/transfer.

**OUTREACH TOOLING (narrow):** Notion / Gmail / Meta contracting-entity and transfer facts remain **FACTUAL VERIFICATION REQUIRED** — do not invent DPAs/SCCs; does not block SEO.

**DEFERRED BY DESIGN:** Twilio SMS compliance remains **DEFERRED — PENDING SMS PROVIDER MIGRATION** (unresolved factual questions remain; **not CLOSED**). Amazon / AWS SMS remains **PLANNED / FUTURE PROVIDER** (not currently active). If Twilio remains in use when meaningful live customer usage begins, provider compliance must be resolved or migration completed.

**MAINTENANCE:** keep remaining TTL / minimisation / legacy Blob / private Blob retry / periodic provider-recheck items as **OPEN — MAINTENANCE** (see list below) unless a concrete launch blocker is discovered.

Do **not**:
1. reopen Google Ads while Ads remains dormant
2. reopen already-closed tenant analytics hard-off work
3. reopen GA4 direct contract/transfer as OPEN/VERIFY (CLOSED — adequacy-based; Phase 2D)
4. reopen server-side checkout attribution as active processing (PRODUCTION VERIFIED / CLOSED — REMOVED / INACTIVE — Phase 3B / `6ef76ab…`)
5. change the substantive compliance/runtime baseline merely because a docs-only HEAD is newer — runtime substantive baseline remains `6ef76ab56134151b12fa4865d2f5da6ce1aaa16f` until a later independently verified substantive runtime/legal change; future Diary/docs commits do **not** replace that runtime baseline

**Compliance re-review triggers** (material processing changes — not ordinary informational SEO pages on the existing stack):
- new tracking vendor
- new lead form / new personal-data collection
- new ad pixel
- new cookies or browser storage
- new processor/provider
- new automated profiling
- new international transfer
- materially changed processing purpose

Then keep remaining TTL / legacy orphan / private Blob retry items as **OPEN — MAINTENANCE** unless a concrete launch blocker is discovered:
- Verification cleanup
- RateLimitEvent TTL
- StripeWebhookEvent TTL
- AccountLifecycleEvent TTL
- RecommendationOpsAction TTL
- SiteLaunchEvent retention enforcement
- SaasSubscription / SetupDeposit minimisation
- LegalAcceptance timed cleanup
- historical legacy public Blob orphan reconciliation
- private Blob retry/reconciliation

---

# 10. CHANGE LOG

## 25 September 2026 — Phase 5B targeted outreach + lawful-basis remediation (docs)

- Phase 5A identified residual A15 / cold-outreach compliance gap; **SEO remained NOT BLOCKED**
- Phase 5B: lawful-basis clarification for A1–A3, A5, A7–A10, A14; A15 rebuilt as real controller processing
- Created [lia-b2b-outreach.md](./lia-b2b-outreach.md) and [lia-operational-controller-processing.md](./lia-operational-controller-processing.md)
- Corporate-vs-individual PECR PRE-SEND screen, first-contact Privacy pointer, and suppression/DNC documented in `docs/gtm/channel-playbook-uk.md`
- A15 retention + historical Lead Master remediation in retention-schedule § I
- Public Privacy: dedicated B2B prospecting transparency (Last updated remains 25 September 2026)
- Transfer register: controller-side Notion / Gmail / Meta outreach tooling noted with **FACTUAL VERIFICATION REQUIRED** (core product providers not reopened)
- ROPA / retention / transfer-register current baseline metadata aligned to `6ef76ab56134151b12fa4865d2f5da6ce1aaa16f`
- **Twilio** remains **DEFERRED — PENDING SMS PROVIDER MIGRATION**
- **GA4** retention propagation remains **NON-BLOCKING FOLLOW-UP**
- TTL / Blob / periodic recheck backlog remains **OPEN — MAINTENANCE**
- Substantive compliance/runtime baseline **unchanged**: `6ef76ab56134151b12fa4865d2f5da6ce1aaa16f` (docs/legal/process patch does **not** replace it)
- Cold electronic outreach must pass the new PECR / transparency / suppression controls before contacting leads whose corporate/individual status is not safely established

## 25 September 2026 — Phase 4B final compliance closeout (docs)

- **FINAL COMPLIANCE CONSISTENCY SWEEP: COMPLETED — 25 SEP 2026**
- Conclusion: **SEO / normal marketing work NOT BLOCKED** by current compliance state
- Stale transfer-register Stripe “(A13 open)” wording corrected to A13 **REMOVED / INACTIVE** (historical provider-side copies may remain; not claimed erased)
- Transfer-register metadata: Related contract `/dpa` → `2026-09-24`; Last reviewed → `2026-09-25`
- Cookie Policy sitemap `lastmod` aligned to `2026-09-25`
- Non-blocking follow-up retained: GA4 retention provider-propagation confirmation
- Maintenance backlog retained (TTL / minimisation / legacy Blob / periodic rechecks)
- Twilio remains **DEFERRED — PENDING SMS PROVIDER MIGRATION**; AWS SMS remains future / not active
- Primary growth work may proceed: **SEO / MARKETING**
- Substantive compliance/runtime baseline unchanged: `6ef76ab56134151b12fa4865d2f5da6ce1aaa16f` (this docs-only closeout does **not** replace it)

## 25 September 2026 — Phase 3D advance verified substantive baseline (docs)

- New latest verified substantive compliance/runtime baseline = `6ef76ab56134151b12fa4865d2f5da6ce1aaa16f`
- Runtime commit: `fix: remove checkout campaign attribution` (parent `d0e2760…`)
- Phase 3B attribution removal recorded as **PRODUCTION VERIFIED / CLOSED** (25 Sep 2026)
- Verification path: targeted tests + typecheck + full suite + build + GitHub Actions Run `36130527392` SUCCESS + Vercel SUCCESS + Production verification
- Evidence caveat preserved: Production checkout request and deployed metadata builders verified; provider-side metadata was **not** directly inspected
- Historical Stripe / email attribution copies may remain; not claimed erased
- GA4 remains consent-based (contract/transfer not reopened); retention propagation remains narrow follow-up only
- Google Ads remains **CLOSED — DORMANT**
- Twilio remains **DEFERRED — PENDING SMS PROVIDER MIGRATION**
- Next substantive task: **FINAL COMPLIANCE CONSISTENCY SWEEP**
- This Diary/docs update does **not** itself become the substantive runtime baseline

## 25 September 2026 — Phase 3B server-side checkout attribution REMOVED

- **SERVER-SIDE CHECKOUT ATTRIBUTION: REMOVED / INACTIVE** (later **PRODUCTION VERIFIED / CLOSED** same day — see Phase 3D)
- Reason: minimisation rather than maintaining separate individual checkout attribution while Google Ads is dormant
- Removed future active processing: LaunchWizard attribution capture → subscription/deposit checkout APIs → Stripe metadata → webhook attributionSummary → Resend internal fulfilment attribution
- Fields out of checkout path: `gclid`, `gbraid`, `wbraid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `ga_client_id`
- No dedicated browser attribution storage
- GA4 consent-based campaign analytics remains under A11 (contract/transfer **not** reopened)
- Google Ads remains **CLOSED — DORMANT**
- URL hygiene remains **P2 / non-blocking**
- Historical provider residual copies **not** falsely claimed erased
- Privacy / Cookie Policy / ROPA A13 / retention §G / Diary updated
- Next substantive task: **FINAL COMPLIANCE CONSISTENCY SWEEP**
- At commit time, verified substantive baseline was still `1843c0f…` pending deploy/production verification (advanced to `6ef76ab…` in Phase 3D)

## 25 September 2026 — Phase 2D GA4 contract / transfer / account-control finalisation (docs)

- GA4 contractual provider recorded as **Google Ireland Limited**
- Direct KERSIVO → Google Ireland transfer = **UK adequacy**; TRA **NOT REQUIRED** for that covered transfer (no `tra-google-analytics.md` created)
- Google LLC UK Extension **ACTIVE** (HR + Non-HR), verified 25 Sep 2026; next certification due **13 Sep 2027**; periodic recheck required (onward-path framing)
- Account controls verified: products/services OFF; Ads links 0; Signals OFF; granular location/device OFF; user-provided data OFF; retention 2m/2m; reset OFF
- Retention provider propagation = **FOLLOW-UP PENDING** after Google’s application window
- Evidence sheet: `docs/compliance/vendor-evidence/google-analytics.md`
- ROPA A11 / transfer register row 8 / Privacy aligned
- Google Ads remains **CLOSED — DORMANT**
- Campaign attribution was then still **OPEN / LEGAL REVIEW** (later closed as REMOVED / INACTIVE in Phase 3B same day)
- Twilio remains **DEFERRED**
- **Substantive compliance/runtime baseline unchanged:** `1843c0fbc42328f57a3fdd74bf08acae33bfc513` (docs-only alignment must not replace it)
- Next substantive task at Phase 2D close: **Campaign attribution lawful basis** (superseded by Phase 3B)

## 24 September 2026 — Phase 2B Google Ads dormant-mode CLOSED (runtime) + docs alignment

- Runtime commit `1843c0fbc42328f57a3fdd74bf08acae33bfc513` — `fix: retire inactive Google Ads tracking`
- Parent `73cdda6326aebfd38167569ed7e77b0030a0f233`
- GitHub Actions CI #225 SUCCESS (Run ID `36012438008`)
- Vercel SUCCESS (`BprqVenGdErd3hPX4NzSuCG43dGF`)
- Production verified: Google Ads dormant / GA4 consent-based
- New latest verified substantive compliance/runtime baseline = `1843c0fbc42328f57a3fdd74bf08acae33bfc513`
- Google Ads runtime / current processing = **CLOSED — DORMANT**
- GA4 runtime consent implementation = **VERIFIED**
- GA4 contractual / international transfer = **OPEN — FINAL VERIFICATION REQUIRED** at Phase 2B close (later closed as adequacy-based in Phase 2D, 25 Sep 2026)
- Campaign attribution lawful basis remains **OPEN / LEGAL REVIEW**
- Twilio remains **DEFERRED**; AWS SMS remains **PLANNED / FUTURE PROVIDER**
- Cookie / Privacy / ROPA / transfer-register docs aligned in the Phase 2C documentation pass (this Diary update)
- Do **not** treat a later docs-only HEAD as replacing this substantive baseline

## 24 September 2026 — Next-task priority update (Twilio deferred)

- Twilio SMS compliance audit deliberately deferred because KERSIVO intends to migrate SMS delivery to Amazon
- Twilio status = **DEFERRED — PENDING SMS PROVIDER MIGRATION** (unresolved factual questions remain; **not CLOSED**)
- Amazon / AWS SMS remains **PLANNED / FUTURE PROVIDER** (not currently active; no AWS SMS compliance assessment in this step)
- Next active compliance task changed to **GA4 / Google Ads — Marketing-Site Privacy & Transfer Audit**
- Substantive compliance/runtime baseline unchanged: `bf9ae379994ad60a4df032800256530c0f4f7b74`
- Campaign attribution lawful-basis review, final consistency audit, and maintenance backlog remain OPEN
- No CLOSED provider/runtime phases reopened

## 24 September 2026 — Documentation Catch-up CLOSED

- **Documentation Catch-up CLOSED**
- Commit `bf9ae379994ad60a4df032800256530c0f4f7b74` — `docs: align compliance records with deployed controls`
- Parent `49bde6aa8b81074c52ecec88b49922adc3805b93`
- GitHub Actions CI #221 SUCCESS (Run ID `35994296081`)
- Vercel SUCCESS
- New latest verified substantive compliance/runtime baseline = `bf9ae379994ad60a4df032800256530c0f4f7b74`
- Next active compliance task = **Twilio SMS factual audit**
- DPA version `2026-09-24`; Terms remain `2026-09-23`
- Public Blob / retail erasure / tenant GA hard-off docs aligned without reopening closed runtime work
- Attribution, Twilio/GA transfer VERIFY, TTL/minimisation, and legacy orphan maintenance items remain OPEN

## 24 September 2026 — Diary created / Retail Identity baseline

- Verified production/main baseline `49bde6aa...` (Client Erasure / Retail Identity P1)
- GitHub CI #220 attempt 2 SUCCESS
- Vercel SUCCESS
- Marked **Client Erasure / Retail Identity P1 CLOSED**
- Reconstructed compliance history from repository commits
- Corrected prior over-broad backlog assessment:
  - Vercel, Neon, Resend, OpenAI, Sentry, Stripe, Google OAuth are not generic unfinished compliance projects
  - their completed assessments are explicitly recorded above
- Cursor read-only docs catch-up audit reviewed
- Active task then set to documentation catch-up (now CLOSED — see entry above)
- Real remaining pre-launch scope narrowed to Twilio, narrow GA/Ads verification, attribution legal-basis decision, and final consistency audit
- TTL/minimisation, legacy Blob reconciliation and private Blob retry retained as maintenance backlog

## 23 September 2026

- Retention policy documentation completed
- Individual Client erasure runtime implemented
- Individual Client erasure documentation completed
- Shop-wide public Blob cleanup P0 implemented
- Tenant analytics hard-off P0 implemented
- Retail identity/outbox erasure P1 implemented

## 21–22 September 2026

- Vercel/Neon/Resend/OpenAI/Sentry transfer/compliance reviews completed
- Blob storage separation and region alignment completed
- Slack runtime path removed
- Google OAuth credential persistence hardened
- Stripe checkout and compliance review completed

---

# 11. GOLDEN RULE

**A stale document is not proof that runtime work is still open.**

Before spending time on any compliance item:

> verify current code + current git history + this diary.

Before reopening any CLOSED item:
1. check this Diary
2. check current git history
3. check current runtime/code
4. require new evidence of regression or changed processing

If the diary says CLOSED and a document says PENDING, first assume **documentation drift** and prove otherwise before reopening implementation.
