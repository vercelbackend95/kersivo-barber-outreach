# What a No-Show Really Costs a Barbershop — and When a Deposit Makes Sense
*General information for UK barbershop owners, not legal advice. Sources reviewed 19 October 2026. The legal classification of a dated haircut booking under the 2013 distance-contract cancellation exception remains unresolved here; this draft needs specialist consumer-law review before publication.*
An empty chair at 3pm on a Tuesday and one at 10.30am on a Saturday can produce very different losses. Another customer might fill one slot while the other stays empty. The haircut price alone cannot tell you what the business has actually lost.
That is where the deposit decision starts: the contribution genuinely lost, what might be recovered, and whether asking every customer for money upfront creates more friction than it solves.

## What comes back after a no-show
The appointment price is a starting point, not the loss. Ask four questions:

**Can someone take the slot?** A walk-in or waiting-list customer may replace the original booking. Refill rates depend on your shop, time of day and how much notice you have — not a universal assumption about Saturdays.

**Does the client rebook?** A later visit only recovers lost contribution if it fills otherwise unused capacity. Rebooking into an already-full diary can displace another paying customer.

**Which costs disappear?** Products not used and fees on payments not processed can be avoided. Rent, rates and fixed wages are generally still due; genuinely variable staff commissions require separate treatment.

**What can you actually keep?** A collected deposit is not necessarily a *lawfully retained* deposit. Refund rights, fairness and payment-processing charges can all change the result.

## A worked example
Every figure here is an **illustrative assumption** to show the method, not data about UK barbershops. We have not verified a representative UK barbershop no-show-rate dataset, so use your own diary.

**Assumptions:**
- a £25 cut, with £1.00 of products per cut;
- a **hypothetical** card fee of 1.5% + 20p per transaction, rounded individually to the nearest penny; this is not a quoted Stripe rate;
- **with a deposit:** £5 paid online at booking, then a £20 balance paid by card in the shop. Two card fees total £0.28 + £0.50 = £0.78;
- **without a deposit:** £25 paid by card in the shop, one payment costing £0.58;
- **in this first arithmetic model only**, the £5 deposit is retained on a no-show. That is an assumption, **not a recommendation or legal conclusion**;
- if the slot is refilled, a walk-in pays £25 in one card payment (£0.58 fee). This model initially assumes the original deposit is also retained, even when the slot is refilled;
- no later rebooking and no change to fixed wages. The business, rather than a chair renter, is assumed to receive these payments.
First, what each outcome leaves the shop, in **contribution** (money in, minus products and card fees):

<table><thead><tr>
<th scope="col">Outcome</th>
<th scope="col">With £5 deposit</th>
<th scope="col">Without deposit</th>
</tr></thead><tbody>
<tr>
<td>Client turns up</td>
<td>£25 − £1.00 − £0.78 = £23.22</td>
<td>£25 − £1.00 − £0.58 = £23.42</td>
</tr>
<tr>
<td>No-show, slot stays empty</td>
<td>£5 − £0.28 = £4.72</td>
<td>£0</td>
</tr>
<tr>
<td>No-show, walk-in fills the slot</td>
<td>£4.72 + (£25 − £1.00 − £0.58) = £28.14</td>
<td>£23.42</td>
</tr>
</tbody></table>

The loss from a no-show is the client-turns-up figure minus whichever no-show outcome happens, weighted by how likely each is:

<table><thead><tr>
<th scope="col"></th>
<th scope="col">Saturday 10:30, £5 deposit</th>
<th scope="col">Tuesday 15:00, no deposit</th>
<th scope="col">Tuesday 15:00, £5 deposit</th>
</tr></thead><tbody>
<tr>
<td>Chance the slot is refilled (assumed)</td>
<td>60%</td>
<td>10%</td>
<td>10%</td>
</tr>
<tr>
<td>Loss if the slot stays empty</td>
<td>£23.22 − £4.72 = £18.50</td>
<td>£23.42</td>
<td>£18.50</td>
</tr>
<tr>
<td>Loss if a walk-in fills it</td>
<td>£23.22 − £28.14 = −£4.92 (a gain)</td>
<td>£0</td>
<td>−£4.92</td>
</tr>
<tr>
<td><strong>Expected contribution lost</strong></td>
<td>40% × £18.50 + 60% × −£4.92 ≈ <strong>£4.45</strong></td>
<td>90% × £23.42 ≈ <strong>£21.08</strong></td>
<td>90% × £18.50 + 10% × −£4.92 ≈ <strong>£16.16</strong></td>
</tr>
</tbody></table>

These figures are **expected changes in contribution per missed original appointment** under the stated assumptions, not industry averages or a prediction of the shop's overall profit. With genuinely unchanged fixed costs, the contribution difference affects operating profit by the same amount. Variable wages, commissions and payment arrangements could change it.

Three details can materially change the decision:
- **Split card payments.** The illustrative deposit and balance cost £0.78 in fees, versus £0.58 for one card payment: an additional **20p on every completed deposit booking**.
- **Replacement-payment method.** A refill booking that also splits its payment incurs 20p more in fees. In this model, that changes the £4.45 Saturday expected loss to **£4.57**, and the £16.16 Tuesday expected loss to **£16.18**.
- **What happens if a slot is filled.** Keeping the original £5 after a replacement client pays in full creates a mathematical gain in the table, but might not be fair or legally recoverable. If the £5 is refunded whenever the slot is refilled, while the original £0.28 processing fee remains a cost, expected losses become **£7.45 Saturday** and **£16.66 Tuesday**. This alternative is an accounting sensitivity test, not a ruling on refund rights.

The point is to test your own refill and refund assumptions, rather than assume every empty chair costs £25.

## The 100-booking test: is a deposit worth the payment friction?

Imagine **100 bookings** for the same £25 cut: 95 customers attend and five do not. All five missed slots remain empty. Assume the business may lawfully keep the £5 deposits, no refunds are due and introducing deposits does not change booking demand — all are **hypothetical conditions**, not measured results.

The five missed bookings produce **5 × £4.72 = £23.60** in retained deposits after original processing fees. For 95 attended bookings, split payments cost **95 × £0.20 = £19.00** more than single payments. The net improvement is **£4.60 across 100 bookings**, before refunds, additional admin time or customers deterred by checkout friction.

Losing just one otherwise-attended £25 cut to that extra step could cost around **£23.42 in contribution** in this model, more than the whole £4.60 benefit. This does **not** prove deposits deter customers. It shows why the right metric is *completed bookings and contribution*, not merely the number of deposits collected.

## Who carries the loss
How the chair is run decides who loses.
- **Owner-operator or employed team:** the shop carries the loss above.
- **Self-employed renter on fixed chair rent:** the renter loses the cut; the shop's rent arrives either way.
- **Commission or percentage arrangement:** the loss is shared roughly in line with the split.
Who contracts with the customer — and who is responsible for the cancellation policy and refunds — depends on the actual business arrangement, not just who receives the payment. Agree responsibilities with chair renters in writing.

## Is £5 a "small" deposit?
Taking a deposit and being entitled to retain it are different questions.
Under the Consumer Rights Act 2015, an unfair term isn't binding on the client (section 62), and written terms must be plain and intelligible (section 68). Terms that may be unfair include requiring a client who cancels or doesn't turn up to pay a "disproportionately high sum" (Schedule 2, paragraphs 4 to 6).
The Competition and Markets Authority's guidance (CMA37, updated 22 July 2026) says keeping a prepayment is more likely to be fair where it reflects your "unavoidable net costs or the net loss of profit" (para 6.62). It treats a genuine deposit, made clear at the earliest opportunity and kept only in "clear and narrow" circumstances, as acceptable, and adds that such a deposit "will not normally be more than a small percentage of the price".
So be honest about the numbers. £5 is **20%** of a £25 cut, **41.7%** of a £12 service and **8.3%** of a £60 service. Neither the law nor the CMA gives a safe percentage. What matters is whether the term and any retained amount are fair in the circumstances, including genuine net loss and reasonable steps to refill the slot. Even a charge below a modelled loss is not automatically lawful.
Circumstances matter as much as the amount. A last-minute no-show may support a stronger loss-based argument than a cancellation with enough notice to refill the slot. Neither automatically entitles the shop to keep every prepayment. If *you* cancel, refund in full. The CMA also warns against being compensated twice for the same loss (CMA37, footnote 258), so don't keep a deposit and charge a separate no-show fee for the same appointment.

## The unresolved 14-day cancellation question

**Legal hold: do not treat the following as a settled answer for online haircut bookings.**

The Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 can give consumers a statutory cancellation period for certain distance and off-premises service contracts. Regulation 28(1)(h) excludes specified-date services *related to leisure activities*. We have **not verified authoritative UK guidance or a binding decision classifying a booked haircut as included or excluded**. Making an appointment online through an organised distance-booking system may meet the definition of a distance contract; a visit booked in person is generally different. An isolated telephone appointment request needs separate consideration.

**If the statutory cancellation right applies**, a service contract usually has a period ending 14 days after it was made, subject to the specific rules for services begun at the consumer's express request within that period. A deposit may have to be refunded if the service has not been supplied. Where required cancellation-right information was not given, the period may extend **up to 12 months beyond the ordinary deadline**. None of this establishes that every online barber booking has a 14-day right.

This draft has **not been approved by a consumer-law specialist**. Seek tailored advice before publishing a strict non-refundable online-booking policy, including the applicable cancellation classification and pre-contract information.

**Separate price-transparency rule:** a deposit credited towards the service price is not an extra booking fee. A compulsory fee added on top must be included in the total price shown where the Digital Markets, Competition and Consumers Act 2024 requires it (section 230).

## The case against a deposit
A deposit adds an extra payment step that could put off some customers; other customers may value a reserved slot. We have not verified representative UK evidence quantifying either effect for barbershops.
If no-shows cluster in a few slots or among a few clients, a targeted rule, such as deposits for new clients or weekday afternoons, may protect more money with less friction. If no-shows are rare and usually refilled, you may not need a deposit at all.

## Before you set a policy
- **Measure.** Review two or three months of bookings: no-shows, cancellations, refills, rebookings, refunds and completed bookings.
- **Separate the cases.** No-show, late cancellation, early cancellation and the shop cancelling each deserve a different answer.
- **Explain it before payment,** including refund circumstances, any compulsory booking fee and what happens if the shop cancels; repeat it in the confirmation.
- **Refund in full when you cancel,** and promptly.
- **Avoid double recovery:** don't charge a fee on top of a retained deposit for the same loss.
- **Check the 14-day question** for online bookings, and take specialist advice if deposits matter to your income.
- **Agree in writing** with chair renters who contracts with the customer and handles payments and refunds.
- **Card on file?** Don't assume saved payment details authorise an after-the-event no-show charge; check consent and payment-provider rules.

## Where KERSIVO fits

KERSIVO supports a **fixed £5 deposit**, not a shop-defined deposit value. On [KERSIVO Starter](https://kersivo.co.uk/starter) (£0/month), public bookings for services above £5 require customers to choose a £5 deposit or full payment; a £5 service is paid in full. A connected, payment-ready Stripe account is required before public Starter bookings can go live. Standard Stripe processing fees apply. [Full KERSIVO](https://kersivo.co.uk/pricing) is £39/month per location and offers broader booking-payment controls.

**KERSIVO provides payment tools, not legal approval of a cancellation clause.** The shop still needs fair and clear terms, appropriate refunds and a decision about whether £5 is proportionate for its services.

## The decision
Start with your diary, not a template. If your real losses are small and fall on busy days, reminders and a waiting list may be enough. If losses are material and concentrated in specific slots, a modest deposit might be worth testing, subject to applicable refund rights and fair terms. Track how many appointments are actually completed, count refunds and processing fees, show your terms before payment and obtain specialist advice before relying on a strict online no-refund clause.
---

## References (reviewed 19 October 2026)
1. Consumer Rights Act 2015, ss. 62, 63, 68 — [https://www.legislation.gov.uk/ukpga/2015/15/section/62](https://www.legislation.gov.uk/ukpga/2015/15/section/62) · /section/63 · /section/68
2. Consumer Rights Act 2015, Sch. 2 Pt 1 paras 4–6 — [https://www.legislation.gov.uk/ukpga/2015/15/schedule/2/part/1](https://www.legislation.gov.uk/ukpga/2015/15/schedule/2/part/1)
3. CMA, Unfair contract terms guidance (CMA37), updated 22 July 2026, paras 6.59–6.67 and fn 258 — [https://www.gov.uk/government/publications/unfair-contract-terms-cma37](https://www.gov.uk/government/publications/unfair-contract-terms-cma37)
4. Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 (SI 2013/3134), regs 5, 13, 27, 28, 29, 30, 31, 34, 36 and Sch. 2 — [https://www.legislation.gov.uk/uksi/2013/3134/regulation/28](https://www.legislation.gov.uk/uksi/2013/3134/regulation/28) (and /regulation/5, /13, /27, /29, /30, /31, /34, /36, /schedule/2)
5. Citizens Advice, "Cancelling a service you've arranged" — [https://www.citizensadvice.org.uk/consumer/changed-your-mind/cancelling-a-service-youve-arranged/](https://www.citizensadvice.org.uk/consumer/changed-your-mind/cancelling-a-service-youve-arranged/)
6. Digital Markets, Competition and Consumers Act 2024, s. 230 — [https://www.legislation.gov.uk/ukpga/2024/13/section/230](https://www.legislation.gov.uk/ukpga/2024/13/section/230)
7. KERSIVO Starter and pricing pages (last updated 6 October 2026) — [https://kersivo.co.uk/starter](https://kersivo.co.uk/starter) · [https://kersivo.co.uk/pricing](https://kersivo.co.uk/pricing)