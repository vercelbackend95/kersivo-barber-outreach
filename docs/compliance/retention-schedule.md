# KERSIVO — Retention Schedule (internal)

| Field | Value |
| --- | --- |
| Owner | Bartosz Jasinski, trading as KERSIVO |
| Status | Internal compliance record — **policy approved 2026-09-23** |
| Linked public docs | `/privacy`; `/dpa` |
| Linked ROPA | [ropa.md](./ropa.md) |
| Production baseline (docs commit parent) | `49bde6aa8b81074c52ecec88b49922adc3805b93` |

This schedule records **approved retention policy** and distinguishes it from **currently implemented enforcement**.

Do **not** treat a documented period as closed merely because it appears here. Where enforcement is pending, the Status column says so.

**Principles (UK GDPR storage limitation):**

- Personal data must not be kept longer than necessary for its purpose.
- Periods are purpose-specific KERSIVO policy choices (or Client instructions for processor CPD).
- A **six-year** period for selected billing/legal evidence is a **KERSIVO retention choice** designed to cover relevant accounting and contractual-evidence needs — **not** a claim that UK GDPR itself requires six years for all personal data, and **not** a blanket period for every category.
- The right to erasure is **not absolute**. Legal obligation and establishment, exercise or defence of legal claims can justify retaining **necessary** records; those exceptions do **not** justify retaining unrelated personal data.
- A legal hold / active dispute may suspend ordinary deletion for affected records.

---

## Status vocabulary

| Label | Meaning |
| --- | --- |
| **IMPLEMENTED** | Runtime currently enforces this behaviour |
| **POLICY APPROVED — ENFORCEMENT PENDING** | Internal policy chosen; automated cleanup/minimisation **not** yet coded |
| **POLICY APPROVED — FEATURE PENDING (P0)** | Product/feature target approved; **not** live |
| **OPEN / LEGAL REVIEW** | Must not invent a retention period until review completes |
| **PROVIDER VERIFICATION REQUIRED** | Local deletion does not prove provider residual erasure |

---

## A. Client Personal Data (KERSIVO as processor)

| Category | Approved policy | Currently implemented | Status |
| --- | --- | --- | --- |
| Active-shop CPD (Client, Booking, notes, retail orders, tenant outbox, etc.) | While the Client subscription/shop is active, retention follows the **Client/controller’s instructions** and legitimate operational need for the Services. KERSIVO must **not** independently impose a blanket deletion period on active Client booking/customer records. | Live tenant rows remain until cancel/account/shop purge paths below, or until an authorised Client-admin **individual Client erasure** instruction (below). Booking **cancel** is a status change, not erasure. | **IMPLEMENTED** (active retention = service use; individual erasure available — see next row) |
| Post-termination tenant graph | After SaaS termination: **30-day** CSV export window (`SAAS_EXPORT_RETENTION_DAYS`), then purge live shop/tenant production graph (bookings, orders, clients, outbox, shop settings cascade, etc.). | Cron `purgeShopsAfterRetentionEnds` + `purgeShopData`. Cancellation does **not** instant-delete. | **IMPLEMENTED** |
| Earlier purge via account deletion / documented instruction | An explicit account deletion (or other lawful Client instruction before the end of the 30-day window) may end live tenant retention earlier than the default window. | Sole-OWNER account DELETE runs `purgeShopData` when billing gate allows. Not a full “delete now” CPD instruction console beyond individual Client erasure and account-delete. | **IMPLEMENTED** for account-delete path; broader instruction tooling limited |
| Individual data-subject erasure (shop admin instruction) | Provide a Client-admin mechanism to erase or anonymise personal data where appropriate, while allowing necessary transactional/payment/legal records to be preserved in **minimised** form where retention is lawfully required. Active/unresolved operational records (e.g. future/active booking, pending payment, unresolved deposit refund) or genuinely in-flight customer messaging may temporarily prevent erasure until resolved. | **IMPLEMENTED.** OWNER/MANAGER (not BARBER) can instruct erasure in admin. Client profile and notes are hard-deleted; Client avatar (validated `clients/` public Blob) and private note images are cleaned best-effort. Historical Bookings may remain with contact/profile PII anonymised; payment/Stripe/refund identifiers needed for transaction integrity remain. Matching retail Orders retain transactional/payment rows with customer email anonymised where applicable. Local outbound messaging rows for affected bookings are removed. Matching local retail order-confirmation outbound email rows for the customer’s canonical retail identity are hard-deleted. Genuinely in-flight customer messaging may temporarily block erasure. Stale abandoned reminder claims do not block indefinitely. Future booking after erasure creates a clean Client profile. Does **not** hard-delete every historical transactional/payment row, and does **not** prove deletion of provider-held residual copies (including Resend, Stripe, Twilio, etc.). | **IMPLEMENTED** — do **not** claim every trace is physically destroyed instantly |

---

## B. User / auth account data (independent controller)

| Category | Approved policy | Currently implemented | Status |
| --- | --- | --- | --- |
| User / Account | Removed through account deletion, subject to separately retained controller records (billing, legal acceptance, audits). | `DELETE /api/admin/account` deletes User (cascades Session/Account/memberships) after gates; does not delete LegalAcceptance / SaasSubscription / SetupDeposit / lifecycle audits. | **IMPLEMENTED** (account delete); survivors intentional |
| Session | Existing configured session expiry (~30 days) and cascade on User deletion. | Better Auth `expiresIn` ~30 days; Cascade on User. | **IMPLEMENTED** |
| Verification | Expire and delete obsolete verification records rather than retaining indefinitely; cleanup must follow actual `expiresAt` fields. | Rows exist with `expiresAt`; **no** automated cleanup job found. | **POLICY APPROVED — ENFORCEMENT PENDING** |

---

## C. Billing / financial records (independent controller)

| Category | Approved policy | Currently implemented | Status |
| --- | --- | --- | --- |
| SaasSubscription / SetupDeposit (minimum billing/accounting evidence) | Retain only the minimum billing/accounting/transaction evidence needed. **Target:** **6 years** after the end of the relevant commercial relationship / accounting period, unless a longer period is required for a live dispute, enquiry or legal obligation. This is a KERSIVO purpose-specific choice — **not** a blanket GDPR six-year rule. | Rows **survive** shop purge by design. No automated 6-year delete/redact job. | **POLICY APPROVED — MINIMISATION / CLEANUP NOT YET IMPLEMENTED** |
| Unnecessary profile/onboarding fields on those rows | Must **not** automatically receive the same 6-year retention merely because they share the row. After the operational relationship and 30-day export period end, future implementation should **minimise/redact** unnecessary PII. | Full row fields currently retained. | **POLICY APPROVED — ENFORCEMENT PENDING** |
| Stripe Customer / Subscription / payment objects | Provider-controlled; local delete does **not** delete every Stripe object. | Cancel-at-period-end only; no `customers.del` on account/shop purge. | **IMPLEMENTED** (local behaviour); Stripe residual **PROVIDER CONTROLLED** |

---

## D. Legal acceptance

| Category | Approved policy | Currently implemented | Status |
| --- | --- | --- | --- |
| LegalAcceptance | **6 years** after termination/end of the relevant contractual relationship, or longer only where necessary for an active legal dispute/claim. Keep only evidence reasonably necessary to demonstrate acceptance. | Survives `purgeShopData`. No automated expiry. | **POLICY APPROVED — ENFORCEMENT PENDING** |

---

## E. Security / operational logs

Legal hold / active dispute may suspend ordinary deletion for affected records.

| Category | Approved policy | Currently implemented | Status |
| --- | --- | --- | --- |
| RateLimitEvent | Target **30 days**. | Rows accumulate; no TTL cleanup job. | **POLICY APPROVED — ENFORCEMENT PENDING** |
| StripeWebhookEvent | Target **12 months**, unless an unresolved incident/payment dispute requires longer. | Ledger survives; no TTL cleanup. | **POLICY APPROVED — ENFORCEMENT PENDING** |
| AccountLifecycleEvent | Target **12 months** after relevant account event/closure, except records reasonably required for a live security/legal dispute. | Survives user/shop deletion by design; no TTL. | **POLICY APPROVED — ENFORCEMENT PENDING** |
| RecommendationOpsAction | Target **12 months**. | No TTL cleanup. | **POLICY APPROVED — ENFORCEMENT PENDING** |
| SiteLaunchEvent | Target **6 years** as minimised evidence of launch/authorisation, unless review shows this event is duplicated by sufficient contractual evidence. | Survives shop purge (no FK cascade); no TTL. | **POLICY APPROVED — ENFORCEMENT PENDING** |
| Session IP/UA | Follow Session lifecycle (above). | Cascade with User / session expiry. | **IMPLEMENTED** |
| Sentry events | Provider baseline (~30 days Developer) + scrubbing; not deleted by shop purge. | Provider retention. | Provider baseline; backups **PROVIDER VERIFICATION REQUIRED** |

---

## F. Uploads / Blobs

Personal-data-containing blobs follow the lifecycle of the record or tenant they belong to. Provider/CDN residual copies may persist according to provider deletion mechanics (**PROVIDER VERIFICATION REQUIRED**).

| Category | Approved policy | Currently implemented | Status |
| --- | --- | --- | --- |
| Private Blob (`kersivo-private`) | Delete when corresponding data is erased/purged. | Best-effort `del` after shop purge / onboarding asset DELETE / **individual Client erasure** (client-note images). Failures logged. | **IMPLEMENTED (best-effort only)** |
| Public Blob (`barberdemo-uploads`) — Client avatar on individual erasure | Validated `clients/` avatar objects for the erased Client should be deleted with that erasure. | Best-effort delete of validated Client avatar URLs under the `clients/` public namespace during individual Client erasure. | **IMPLEMENTED (best-effort; Client-avatar scope only)** |
| Public Blob (`barberdemo-uploads`) — shop-wide / tenant cleanup on purge | Public media attributable to a tenant must not survive indefinitely as live orphaned objects after shop purge. | Shop purge deletes validated collected public Blob objects and performs a mandatory paginated sweep of the shop-owned `shops/{shopId}/` namespace. Cleanup is best-effort after DB purge/commit. Provider/CDN residual copies may persist temporarily (**PROVIDER VERIFICATION REQUIRED**). Does **not** guarantee removal of every historical legacy-namespace orphan created outside the current proven ownership model. | **IMPLEMENTED — BEST-EFFORT PROVIDER OBJECT CLEANUP** |

---

## G. Attribution

| Category | Policy | Status |
| --- | --- | --- |
| Server-side checkout attribution (`gclid` / `gbraid` / `wbraid` / UTM / `ga_client_id` → Stripe metadata / fulfilment email) | Future checkout attribution persistence: **REMOVED**. Current runtime no longer writes these fields to Stripe Checkout metadata or internal fulfilment email. No KERSIVO retention period is required for the removed write path. | **REMOVED / INACTIVE** — no longer written by current runtime |
| GA4 campaign/source measurement | Remains under existing GA4 Admin retention rules/settings (consent-based analytics; see Section H / vendor-evidence). | Covered by GA4 retention (A11) — not a separate checkout-attribution retention row |
| Historical provider-side copies (earlier test/legacy Stripe metadata or fulfilment emails) | Do **not** claim erased unless proven. Historical provider-side copies from earlier test/legacy flows may remain subject to provider/account retention; current runtime no longer creates new copies. | **PROVIDER CONTROLLED** / **VERIFY** — residuals not falsely claimed erased |

---

## H. Provider residual copies

Local Neon/shop purge or account deletion does **not** mean immediate physical deletion from provider systems. Treat residual retention separately:

| Provider | Residual note | Status |
| --- | --- | --- |
| Stripe | Customer/Subscription/payment history and metadata may remain under Stripe policy | **PROVIDER CONTROLLED** |
| Neon | Visible history window ≠ complete residual expiry | **PROVIDER VERIFICATION REQUIRED** (beyond confirmed visible history) |
| Resend | Message/delivery copies may remain | **PROVIDER VERIFICATION REQUIRED** |
| Twilio | Message logs may remain where SMS used | **PROVIDER VERIFICATION REQUIRED** |
| Sentry | Events/backups may remain | Baseline documented; backups **VERIFY** |
| Vercel | Request logs / platform residual | **PROVIDER VERIFICATION REQUIRED** |
| OpenAI | Abuse-monitoring / provider retention where Admin AI used | Documented in vendor evidence; **VERIFY** Data Controls periodically |
| Google | OAuth/IdP processing under Google; GA4 active under analytics consent (Admin event/user retention **2 months** / **2 months**, reset **OFF** — configured/verified in GA4 Admin **25 Sep 2026**; provider propagation follow-up pending after stated ~24h application window; distinct from browser `_ga` cookie TTL); Google Ads inactive / dormant | **PROVIDER VERIFICATION REQUIRED** for residuals. GA4 direct transfer: **UK adequacy — TRA NOT REQUIRED** ([vendor-evidence/google-analytics.md](./vendor-evidence/google-analytics.md)). Ads transfer reopen only if Ads reactivated |
| Vercel Blob CDN/cache | After `del`, residual may persist briefly | **PROVIDER VERIFICATION REQUIRED** |

---

## Implementation backlog (docs → runtime later)

1. ~~**P0** — Individual Client erasure/anonymisation instruction feature~~ — **IMPLEMENTED** (see Section A; provider residuals remain separate)
2. ~~**P0** — Shop-wide / tenant public Blob cleanup on purge~~ — **IMPLEMENTED — BEST-EFFORT** (see Section F; Client-avatar cleanup on individual erasure remains separate and implemented)
3. Historical legacy public-namespace orphan reconciliation (maintenance — distinct from current-runtime shop purge coverage; not an open P0 implementation gap)
4. TTL/cleanup jobs for RateLimitEvent, StripeWebhookEvent, AccountLifecycleEvent, RecommendationOpsAction, SiteLaunchEvent, Verification
5. Billing/LegalAcceptance minimisation and timed deletion after approved windows
6. Hardened private Blob delete retries

---

## Change log

| Date | Change |
| --- | --- |
| 2026-09-23 | Initial approved retention schedule (policy documentation only; no runtime enforcement changes). |
| 2026-09-23 | Individual Client erasure marked **IMPLEMENTED** (accurate anonymisation / blocker / Client-avatar + note Blob caveats). Shop-wide public Blob cleanup remains **ENFORCEMENT PENDING (P0)**. Attribution remains OPEN. |
| 2026-09-24 | Docs catch-up to deployed runtime (`49bde6aa…`): shop-wide public Blob purge marked **IMPLEMENTED — BEST-EFFORT** (validated collected deletes + `shops/{shopId}/` sweep; residual/legacy-orphan caveats). Individual erasure docs aligned for retail identity (Order email anonymisation + local retail confirmation outbox removal; Resend residual not claimed erased). Tenant analytics Cookie Policy clarification is separate public-page work. Attribution, provider residual VERIFY, and TTL/minimisation backlog remain OPEN. |
| 2026-09-25 | GA4 Admin retention configured/verified: event **2 months**, user **2 months**, reset on new activity **OFF** (25 Sep 2026). Provider-side propagation follow-up pending after Google’s stated application window. Google Ads remains dormant. |
| 2026-09-25 | **Phase 3B — server-side checkout attribution removed:** Section G updated — future Stripe metadata / fulfilment-email attribution persistence **REMOVED**; no OPEN retention requirement for the removed path. GA4 retention remains under existing GA4 rules. Historical provider residual copies not claimed erased. |
