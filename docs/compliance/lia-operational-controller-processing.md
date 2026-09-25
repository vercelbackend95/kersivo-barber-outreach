# Legitimate Interests Assessment — KERSIVO operational controller processing

| Field | Value |
| --- | --- |
| Owner | Bartosz Jasinski, trading as KERSIVO |
| Status | Internal compliance record |
| Created | 2026-09-25 |
| Scope | Purpose-specific LI limbs for ROPA A1, A2, A3 (corporate-contact), A5 (corporate acceptance/evidence), A7, A8 (non-statutory evidence), A9, A10, A14 (corporate-user auth) |
| Related public notice | `/privacy` |

This document is **not** a single vague blanket LIA. Each section is a mini three-part test for a distinct legitimate-interest purpose already present in KERSIVO’s controller processing.

**Rule:** Art 6(1)(b) contract applies only where the individual is personally a contracting party (or requested pre-contract steps). It is **not** used automatically for employees/staff/representatives of a corporate customer.

Cold B2B prospecting is covered separately in [lia-b2b-outreach.md](./lia-b2b-outreach.md) (ROPA A15).

---

## Shared safeguards (all sections below)

- Role-based access; tenant scoping where relevant
- HTTPS / session controls / env-managed secrets as applicable
- Minimisation and purpose limitation
- Retention periods in [retention-schedule.md](./retention-schedule.md) (policy vs enforcement distinguished)
- Privacy notice at `/privacy`
- Rights handling via `hello@kersivo.co.uk`

---

## A1 — Administering authorised users of a corporate business customer

### Purpose / legitimate interest
Secure and effective administration of the KERSIVO service for the customer organisation and its authorised users (owners/managers/invited staff who are not personally the contracting party).

### Necessity
Account records (name, email, role/membership) are needed to grant access, assign roles and operate the admin product for the organisation. Less intrusive alternative (no named user accounts) would prevent multi-user shop administration.

### Reasonable expectations / impact / nature of data
Business users of a barbershop SaaS reasonably expect account administration. Data is ordinary identity/contact/role data. Impact is low if limited to service administration.

### Safeguards
RBAC; authenticated admin; account deletion paths; no use of staff account data for unrelated marketing.

### Balancing conclusion
**LI available** for corporate-customer authorised-user administration. Where the account holder is personally the contracting individual / sole-trader customer, **Art 6(1)(b)** applies instead for that individual’s account administration.

---

## A2 — Authentication / session and security / abuse protection

### A2a — Session / authentication for authorised personnel of a business entity

**Purpose / LI:** provide proportionate authenticated access to authorised business users.

**Necessity:** sessions/tokens are required to keep users signed in securely.

**Expectations / impact:** ordinary for SaaS admin products; low impact.

**Conclusion:** **LI available** for corporate authorised users. **Art 6(1)(b)** where the individual is personally the contracting party and authentication is necessary to provide their requested account.

### A2b — Security / abuse / verification protection

**Purpose / LI:** protect accounts and services from abuse (verification tokens, related session security controls overlapping A9).

**Necessity:** without verification and session security, account takeover / abuse risk rises.

**Expectations / impact:** users reasonably expect security processing; IP/UA where collected is limited operational data.

**Conclusion:** **LI available**.

---

## A3 — Corporate customer billing / admin contacts

### Purpose / legitimate interest
Process contact and administrative information about representatives of a **corporate** customer as needed to operate billing administration, fulfilment notices and related subscription lifecycle tasks.

### Necessity
KERSIVO must communicate billing/fulfilment status to a human contact for the organisation. Processing only a company number without a contact would prevent practical administration.

### Expectations / impact / nature of data
Billing contacts of a SaaS customer reasonably expect billing administration emails and records. Ordinary business contact + payment status identifiers (no full PAN/CVC on KERSIVO).

### Safeguards
Hosted Checkout; metadata minimisation; retention/minimisation policy (enforcement backlog remains maintenance).

### Balancing conclusion
**LI available** for corporate-representative billing/admin contacts. **Art 6(1)(b)** where the individual is personally the contracting party. **Art 6(1)(c)** only for fields/records a specific UK obligation actually requires — not as a blanket six-year claim.

---

## A5 — Corporate representative Terms acceptance / evidence

### Purpose / legitimate interest
Record that an authorised representative accepted Terms (DPA incorporated by reference) on behalf of a corporate customer, and retain proportionate acceptance evidence for contract administration and claims defence.

### Necessity
Without an identifiable acceptance record, KERSIVO cannot evidence the contractual package applicable to the organisation.

### Expectations / impact / nature of data
Authorised checkout acceptors reasonably expect acceptance logging (email, IP/UA, terms version, session linkage). Ordinary evidence fields.

### Balancing conclusion
**LI available** for corporate-representative acceptance evidence. **Art 6(1)(b)** where the accepting individual is personally the contracting party. **Art 6(1)(c)** only if a specific obligation requires a particular record.

---

## A7 — Operational communications with business-customer staff / representatives

### Purpose / legitimate interest
Send necessary operational email (onboarding, launch, account notices) to staff/representatives of an existing business customer. **Not** cold prospecting (see A15).

### Necessity
Service delivery and account administration require contacting named operational contacts.

### Expectations / impact
Existing customers’ operational contacts reasonably expect service emails. Low impact if limited to operational content.

### Balancing conclusion
**LI available** for corporate staff/representatives. **Art 6(1)(b)** where communications are necessary to perform/administer a contract with the individual.

---

## A8 — Non-statutory business / claims evidence records

### Purpose / legitimate interest
Retain proportionate billing/contractual evidence needed for business administration and establishment, exercise or defence of legal claims where **not** strictly mandated by a specific statute for that field.

### Necessity
Some evidence is needed beyond the narrow set of fields a statute expressly requires; retaining everything for six years is **not** necessary — retention is purpose-specific (see retention schedule).

### Expectations / impact
Business customers reasonably expect KERSIVO to keep limited financial/contract evidence. Over-retention risk is managed by minimisation policy (enforcement pending = maintenance).

### Balancing conclusion
**LI available** for proportionate non-statutory evidence. **Art 6(1)(c)** only where a specific applicable UK law requires the record. **Art 6(1)(b)** where genuinely necessary to administer a contract with the individual. Six-year targets remain **KERSIVO policy choices**, not a blanket UK GDPR rule.

---

## A9 — Security / fraud / abuse prevention

### Purpose / legitimate interest
Protect KERSIVO, users, customers and services from abuse, fraud, unauthorised access and security incidents (e.g. rate-limit IP events, scrubbed ops telemetry).

### Necessity
Rate limiting, security logs and incident investigation are proportionate means to protect the service. Less intrusive “no logging” would undermine abuse prevention.

### Expectations / impact / nature of data
Users/visitors reasonably expect anti-abuse measures. Data is primarily technical (IP, route/status, scrubbed error context). Not used for marketing.

### Safeguards
Scrubbing; short target TTL for RateLimitEvent (enforcement pending = maintenance); Sentry scrubbing controls.

### Balancing conclusion
**LI available.** (DUAA “recognised legitimate interest” is not relied on for ordinary product security unless a listed condition actually applies.)

---

## A10 — Operational audit / lifecycle accountability

### Purpose / legitimate interest
Maintain proportionate audit trails for operational integrity, lifecycle accountability, investigation, authorisation evidence, and webhook/ops troubleshooting.

### Necessity
Without limited audit events, KERSIVO cannot investigate incidents, prove launch/authorisation steps, or troubleshoot billing webhooks.

### Expectations / impact / nature of data
Business users reasonably expect operational logging. Payloads should remain purpose-limited; retention targets are purpose-specific (enforcement pending = maintenance).

### Balancing conclusion
**LI available.** Contract may **additionally** apply to a specific item only where strictly necessary to perform a contract with the individual — not as a blanket row basis.

---

## A14 — Google Sign-In for corporate authorised users

### Purpose / legitimate interest
Provide proportionate and secure authentication/account access to authorised business users of a corporate customer who choose “Continue with Google”.

### Necessity
Optional Google Sign-In is an authentication method requested by the user; storing Google subject id / email / name / picture URL as supplied is needed to create/link the KERSIVO account. Durable OAuth tokens are **not** retained (CLOSED).

### Expectations / impact
Users who click Google Sign-In expect identity data to be used for login. Google remains independent controller for Google Account processing under Google’s terms.

### Balancing conclusion
**LI available** for staff/manager/representative users of a corporate customer. **Art 6(1)(b)** where the Google Sign-In user is personally the contracting individual and authentication is necessary to provide their requested account access.

---

## Change log

| Date | Change |
| --- | --- |
| 2026-09-25 | Initial operational-controller LIA (Phase 5B). |
