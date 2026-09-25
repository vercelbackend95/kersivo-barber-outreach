# Legitimate Interests Assessment — KERSIVO B2B outreach

| Field | Value |
| --- | --- |
| Owner | Bartosz Jasinski, trading as KERSIVO |
| Status | Internal compliance record |
| Created | 2026-09-25 |
| Scope | Prospect research and direct outreach to relevant UK barbershop business contacts |
| Related ROPA | A15 |
| Related public notice | `/privacy` — B2B prospecting section |
| Related ops control | `docs/gtm/channel-playbook-uk.md` PRE-SEND gate |

This LIA documents the three-part legitimate-interests test for **personal data** used in KERSIVO B2B prospecting. It does **not**:

- override PECR electronic-mail marketing rules
- authorise messaging every barbershop contact
- invent Notion property names, provider DPAs, or transfer mechanisms

**Company-only / non-personal business-entity research** stored beside personal data does not require an invented UK GDPR lawful basis merely because it resides in the same tool.

---

## Processing covered

- Identifying relevant independent UK barbers / barbershops from public business sources
- Qualifying whether KERSIVO may be relevant
- Administering direct outreach (email / Instagram DM where used)
- Managing follow-ups and replies
- Maintaining suppression / do-not-contact records

Canonical lead administration is external (**Notion Lead Master**). Email/replies use **Gmail / Google**. Direct messages may use **Instagram / Meta**. The product Postgres database is **not** the canonical lead store.

---

## PURPOSE TEST

**Legitimate interest:** KERSIVO’s commercial interest in contacting relevant UK barbershop businesses about a B2B software product that is designed for that market, and in administering outreach, replies and suppression so that contact remains proportionate and objections are honoured.

This interest is:

- real and specific (UK barbershop SaaS sales / qualification)
- not a pretext for unrelated consumer marketing
- consistent with normal B2B commercial practice for business software

---

## NECESSITY TEST

Processing personal business-contact data is necessary because:

- KERSIVO must identify a reachable business contact to start a relevant conversation
- public business sources commonly expose a named owner, manager or public handle
- storing category-level research + outreach status is needed to avoid duplicate/spammy contact and to honour opt-outs

**Less intrusive alternatives considered:**

| Alternative | Why not sufficient alone |
| --- | --- |
| Inbound-only marketing | Does not replace targeted outreach for early-stage GTM |
| Anonymous company-only notes with no personal contact | Cannot complete electronic outreach to a person |
| Purchased mass consumer lists | Rejected — higher risk, poor relevance, not used |
| Behavioural profiling / tracking for prospecting | Not used for A15 |
| Sensitive-data targeting | Not used |

Processing is limited to **business-context** categories (shop identity, location, public contacts/handles, booking-platform observations, outreach status). No special-category targeting.

---

## BALANCING TEST

### Reasonable expectations

Business owners and publicly listed shop contacts for UK barbershops can reasonably expect relevant B2B product outreach from a UK barber software provider, especially where contact details are published for business contact. Expectations are weaker for:

- personal consumer mailboxes / personal social accounts
- sole traders and other **individual subscribers** under PECR
- contacts whose corporate/individual status is **unknown**

### Nature of the data

Business-context contact and research data. Not special-category data. Not children’s data. Not purchased consumer lists.

### Likely impact

Low–moderate: an unsolicited B2B message may be mildly intrusive. Harm is reduced by low-volume personalised outreach, clear identity, Privacy pointer, easy opt-out, and no further marketing after objection.

### Safeguards (mandatory)

1. **PECR corporate / individual / unknown screen** before electronic direct marketing (`docs/gtm/channel-playbook-uk.md`)
2. **INDIVIDUAL / UNKNOWN:** do not send unsolicited electronic marketing unless valid consent or soft opt-in exists
3. **First-contact Privacy pointer + opt-out** when personal data obtained from public/third-party sources is used to communicate
4. **Suppression / DNC** on objection; screen future outreach
5. **Retention limits** for researched / cycled / suppression data (retention schedule § I)
6. **No mass-messaging** of historical leads merely to “cure” transparency
7. Review this LIA if channels, targeting, volume or data categories materially expand

---

## PECR interaction (not overridden by LI)

Legitimate interests under UK GDPR **never** authorises PECR-prohibited electronic mail marketing.

| Subscriber classification | Electronic direct marketing |
| --- | --- |
| **CORPORATE** | May proceed subject to UK GDPR (where personal data is involved), transparency, sender identity and opt-out |
| **INDIVIDUAL** | Do **not** send without valid consent or applicable soft opt-in |
| **UNKNOWN** | Treat as **INDIVIDUAL** |

Soft opt-in does **not** apply to cold prospects who have not bought or negotiated with KERSIVO.

---

## CONCLUSION (conditional)

**Art 6(1)(f) legitimate interests is available** for personal data used in KERSIVO B2B prospect research and outreach **only where**:

1. this balancing test is met for the specific contact and channel; **and**
2. separate PECR rules for the intended electronic message are satisfied (or PECR electronic-mail rules do not apply because the destination is a verified corporate subscriber).

This LIA does **not** conclude that all cold outreach is lawful.

**Review trigger:** material change to outreach channels, targeting, volume, tooling, or PECR/UK GDPR guidance.

---

## Change log

| Date | Change |
| --- | --- |
| 2026-09-25 | Initial B2B outreach LIA (Phase 5B). |
