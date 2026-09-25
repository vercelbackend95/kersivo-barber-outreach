# Kersivo Channel Rebuild Playbook (UK)

## Objective
Replace high-volume cold WhatsApp with a focused pipeline:
- account-based outbound,
- local partnership referrals,
- proof-led inbound content.

## 0) PRE-SEND compliance gate (mandatory for electronic direct marketing)

Before any **unsolicited electronic marketing** (email, Instagram/private social DM, SMS, or similar store-and-forward messaging), classify the destination:

| Class | Examples | Rule |
| --- | --- | --- |
| **CORPORATE** | Verified Ltd / company / LLP; communication endpoint reasonably attributable to that corporate subscriber (e.g. official company-domain mailbox or official corporate business messaging account) | Cold B2B electronic marketing **may** proceed subject to UK GDPR where personal data is involved, transparency, clear sender identity (**Bartosz / KERSIVO**), Privacy pointer, and opt-out |
| **INDIVIDUAL** | Sole trader; ordinary partnership where applicable; personal consumer mailbox/account; personal barber social account where corporate subscriber status cannot be established | Do **NOT** send unsolicited electronic marketing unless **valid consent** or applicable **soft opt-in** exists (soft opt-in does **not** cover cold prospects) |
| **UNKNOWN** | Insufficient evidence | Treat as **INDIVIDUAL** |

**Do not assume** a barbershop is corporate merely because it has a trading name.
**Do not assume** a personal Gmail/Instagram account becomes corporate merely because its owner also operates an Ltd company.
If unsure -> **UNKNOWN** -> treat as **INDIVIDUAL** -> do not send cold electronic marketing.

Companies House (or equivalent) may be used for subscriber-type verification where relevant.

### First-contact privacy (personal data from public / third-party sources)

Provide KERSIVO privacy information within a reasonable period and **no later than one month** after obtaining the personal data; and where KERSIVO communicates first, **at the latest in that first communication**.

Keep the message body short and human. Use a layered pointer:

**Email footer/pointer:**

```text
Privacy: https://kersivo.co.uk/privacy
If you'd rather not hear from KERSIVO again, just reply "no thanks".
```

**Instagram / private social DM:**

```text
Privacy: kersivo.co.uk/privacy - just say "no thanks" if you'd rather not hear from us again.
```

Sender identity remains clear: **Bartosz / KERSIVO**.

### Suppression / do-not-contact

If a prospect objects, opts out, says "no thanks", asks not to be contacted, or equivalent:

1. Stop direct marketing **promptly**
2. Do **not** send further follow-ups
3. Record a **minimal** suppression status (contact identifier, channel, status, date, minimal business reference for dedupe)
4. Screen future outreach against suppression

Do **not** keep the full marketing/research profile merely because they opted out.
Do **not** erase the minimal suppression record if that would create a foreseeable re-contact risk.
Suppression data must **not** be reused for marketing.

See also: `docs/compliance/lia-b2b-outreach.md`, ROPA A15, retention-schedule Section I.

### Historical Lead Master records

- Future outreach planned -> classify subscriber type before next electronic message; include Privacy + opt-out; no INDIVIDUAL/UNKNOWN without valid PECR route
- Fully cycled / no future outreach -> do **not** mass-message old leads merely to cure transparency; apply retention/minimisation
- Previously objected -> minimum suppression only; no further marketing

---

## 1) Account-based outbound (primary)

### Target list design
- 40-60 accounts per city wave.
- Only shops matching primary ICP from `icp-segment-uk-barbers.md`.
- Priority signals:
  - 3-8 chairs,
  - visible booking-app dependency,
  - active social posting and growth intent.
- Every electronic send must pass **Section 0 PRE-SEND compliance gate**.

### Touch pattern (7 touches, 21 days)
Only for destinations that pass the PRE-SEND gate (CORPORATE, or INDIVIDUAL with valid PECR route).

1. Day 1: personalized opener with pain hypothesis + Privacy pointer + opt-out (email / allowed DM channel).
2. Day 3: short voice note or Loom with one metric angle (non-electronic-mail channels still respect objections).
3. Day 5: follow-up with case-study teaser (same shop size) + opt-out reminder if electronic.
4. Day 8: phone call attempt during low-traffic hours.
5. Day 11: short ROI check message and one qualifier question.
6. Day 15: "close the loop" message with clear opt-out.
7. Day 21: final reactivation with new proof point (still subject to suppression screen).

### Message constraints
- Keep first message under 45 words (body); Privacy/opt-out pointer may sit below.
- Mention one concrete pain only (margin leak or empty slots).
- Never send links in first touch unless asked - **except** the Privacy URL pointer required by Section 0.
- Use proof snippet from `proof-stack-case-studies.md` by segment.

### Sample first message
"Quick one - we help UK barbershops with 3-8 chairs recover lost slot value and reduce booking fee drag. If I show a 5-minute scorecard using your own numbers, worth a look?"

*(Then the Privacy / opt-out pointer from Section 0.)*

## 2) Local partnerships (secondary)

### Partner profiles
- Barber educators and trainers.
- Local barber photographers/content creators.
- Product distributors serving independent shops.

### Partnership offer
- Co-branded operations audit for partner audience.
- Revenue share or fixed referral fee per closed sprint.
- Quarterly partner workshop with case-study review.

### Output cadence
- 2 partner intros per city per month.
- 1 joint mini-event or webinar per quarter.

## 3) Proof-led inbound (supporting)

### Content engine
- Publish one case-study page per validated client outcome.
- Publish one "operator brief" per month (no-show, utilization, migration risk).
- Add location-layer pages only after proof assets are live.

### On-site conversion upgrades
- Add segment selector to contact flow (shop size/chairs/current stack).
- Show proof cards above demo CTA with KPI deltas and named owners.
- Add clear migration sprint timeline and risk controls.

## Funnel ownership and SLAs
- New lead response SLA: <=30 minutes in working hours.
- Qualified lead booking SLA: same day.
- No-show recovery: one reschedule attempt within 24 hours.
- Weekly pipeline review: stage velocity, objections, channel efficiency.

## Channel KPIs (6-week dashboard)
- `responseRateByChannel`
- `qualifiedCallRate`
- `showUpRate`
- `proposalRate`
- `closeRate`
- `daysToClose`
- `proofReferencedWinRate`

## Stop-doing list
- No generic mass WhatsApp blasts.
- No "all-in-one" opening pitch.
- No demos before qualification.
- No outbound without segment-specific proof artifact.
- No cold electronic marketing to INDIVIDUAL / UNKNOWN without a valid PECR route.
- No further marketing after objection / "no thanks".
- No mass-messaging historical leads merely to "fix" privacy transparency.
