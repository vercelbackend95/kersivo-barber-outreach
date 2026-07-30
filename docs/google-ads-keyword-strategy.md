# Google Ads keyword strategy (Kersivo soft launch)

High-intent **B2B** Search only: UK barbershop **owners** looking for booking **software / system**, not consumers booking a haircut.

Buyer fit = KERSIVO hero: *Barbershop Booking System Built On Your Own Domain* + 0% commission.

**Do not turn on spend** until [F01 purchase measurement](../README.md#pre-ads-purchase-conversion-checklist-f01) is live (Purchase tag + Vercel env + GA4 import).

---

## Step 1 — Wizard “Tematy wyszukiwania” (now)

| Setting | Value |
|--------|--------|
| Language | **English** (remove Polish) |
| Location | **United Kingdom** — people **in** / located in the UK (not “interested in”) |
| Search topics | **Only Tier A below** (10 phrases) |

### Tier A — paste these only

```
barbershop booking software
barbershop booking system
barber shop booking software UK
barber booking system UK
online booking system for barbershops
barbershop appointment software
barbershop booking website
no commission barbershop booking
Fresha alternative for barbers
Booksy alternative for barbershops
```

### Never seed in the wizard (waste / consumer)

- `barber`, `barbershop`, `haircut`, `book a barber`, `barbers near me`, `fade`, `Turkish barber`
- bare `salon software` (too broad — beauty/spa)
- bare `Treatwell` without “alternative / for barbers”

### After the wizard

1. Finish account creation if needed.
2. **Pause** any AI / Smart campaign immediately — do not leave it Enabled with budget.
3. Complete F01 (Step 2) before any Enabled campaign with spend.

---

## Step 2 — F01 before spend (gate)

Follow README **Pre-Ads purchase conversion checklist (F01)** + [consent-tag-assistant-checklist.md](./consent-tag-assistant-checklist.md) Conversions section.

Minimum gate:

1. Ads: website **Purchase** conversion (Primary, Count = One, value from tag).
2. Vercel Production: `PUBLIC_GOOGLE_ADS_ID` + `PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL` → **redeploy**.
3. GA4: `saas_subscription_paid` key event; Ads ↔ GA4 linked.
4. Ads: **import** GA4 `saas_subscription_paid` as Purchase (covers analytics-only consent).
5. Forms (contact / demo) = **Secondary** only — never Primary.
6. Tag Assistant: one real `/setup/success` hit with consent.

---

## Step 3 — Rebuild Search (Manual CPC)

Do **not** rely on the wizard AI Max campaign for the £790 soft launch.

### Campaign settings

| Setting | Value |
|--------|--------|
| Type | Search |
| Bidding | **Manual CPC** (start ~£0.80–£1.50; or Maximize clicks with low CPC cap) |
| Daily budget | £15–25 |
| Networks | Search only (off Display partners unless you explicitly want them) |
| Location | United Kingdom — presence: **Presence** (people in or regularly in) |
| Language | English |
| Primary conversion | Purchase only |

### Tier A — Exact + Phrase (core ad group)

Use Tier A phrases as **Exact** `[phrase]` and selected **Phrase** `"phrase"`. Prefer Exact first on a small budget.

### Tier B — second ad group (small test, after Tier A is clean)

```
barbershop management software
barber shop diary software
barbershop SMS booking reminders
barbershop deposit booking system
booking system on my own domain barbershop
leave Fresha barbershop
switch from Booksy barbers
```

Match: Exact + limited Phrase. No Broad.

### Tier C — competitor brands (optional, separate ad group, ~£5/day cap)

Exact only, policy-safe ads (not “official” competitor):

```
[fresha barbershop]
[booksy for barbers]
[nearcut]
[setora barbershop]
```

Only if landing clearly states KERSIVO USP (own domain, 0% commission). Pause if CPC burns without conversions.

### Negatives (add before Enable)

**Consumer / local:** `near me`, `prices`, `cheap haircut`, `walk in`, `open now`, `jobs`, `apprentice`, `course`, `training`, `salary`  
**Wrong vertical:** `nail salon`, `spa`, `massage`, `dentist`, `tattoo`  
**DIY / free:** `free`, `excel`, `google calendar`, `template`  
**B2C intent:** `book appointment`, `find a barber` (unless query also has software/system)

### Ops cadence

Every **48–72 hours**: Campaigns → Insights / Search terms → add negatives; pause terms with spend and no path to pricing/checkout.

---

## Intent model (why this list)

```text
Consumer "book a barber near me"     → never bid (negate)
Owner "barbershop booking software" → Tier A (core)
Owner "Fresha alternative"          → Tier A (switch)
Owner feature / diary / SMS         → Tier B (later)
Competitor brand                    → Tier C (optional, capped)
```

Market context: UK shops compare marketplace tools (Booksy, Fresha, Treatwell) vs flat-rate / own-brand booking (Nearcut, Setora, Solovi-like, KERSIVO). Highest purchase intent = **software/system** and **alternative to marketplace**, not haircut discovery.
