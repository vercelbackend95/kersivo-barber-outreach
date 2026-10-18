# Walk-Ins or Appointments? What the Queue Is Telling a Barbershop Owner
Every barbershop owner has had to decide this, usually without putting it into words. Do you keep the door open for anyone who walks in, take bookings only, or try to do both? Each choice has its loyal supporters. The walk-in shop says appointments are for salons and that the queue is part of the culture. The appointment-only shop says walk-ins mean chaos and lost Saturdays. Both are describing something real. What neither usually describes is the mechanism underneath, which explains why the question doesn't have one answer.
The mechanism is the queue, and queues behave in ways that catch out experienced business owners.
#### A busy shop's waiting time doesn't grow steadily
Picture a two-chair shop running walk-ins only. Clients arrive at random, as walk-ins do, and a cut takes 20 minutes on average, sometimes 12, sometimes 35. How long does a typical client wait before they sit down?
A standard queueing model gives an answer that most people find surprising. The model assumes two barbers who are always available, clients arriving at random (a Poisson process) at a steady rate through the day, cut times that vary at random around the 20-minute average (exponentially distributed), nobody leaving because the queue looks long or giving up partway, and no limit on how many can wait. Real shops break most of these: demand peaks at lunch and on Saturdays, barbers take breaks, and people do walk away. So treat the figures as an illustration of how waiting behaves, not as a forecast for your shop:
<table header-row="true">
<tr>
<td>How busy the barbers are (share of time cutting)</td>
<td>Average wait in the queue before the chair (2 chairs, 20-min cuts)</td>
</tr>
<tr>
<td>50%</td>
<td>about 7 minutes</td>
</tr>
<tr>
<td>70%</td>
<td>about 19 minutes</td>
</tr>
<tr>
<td>80%</td>
<td>about 36 minutes</td>
</tr>
<tr>
<td>90%</td>
<td>about 85 minutes</td>
</tr>
</table>
Going from 80% busy to 90% busy, only ten percentage points, more than doubles the average wait. That's the nonlinear part. As a shop gets close to full capacity, waiting time grows faster and faster. And these are averages. On the day three people walk in together at 11:00, the person at the back waits much longer.
This explains the tension between the two camps. Walk-in shops do well when they have spare capacity: a short, sociable wait that feels like part of the experience. Once they get busy enough to be really profitable, the waits stretch past what many clients will put up with. Some walk out, and some don't come back. Appointment-only shops reduce that by controlling arrivals, though clients can still wait when cuts overrun or people arrive late, and a fully booked diary still has no-shows and gaps. The cost is that they turn away the client who decides on a haircut at lunchtime and wants one now.
#### What the queue costs you, in money
When a walk-in client sees four people waiting and leaves, what the shop loses depends on what happens next. If they come back later that day or week, it may lose nothing. If they go elsewhere, it loses that cut's **contribution**, meaning the price minus product, card fees and any per-cut pay such as commission, rather than the whole price; a fixed wage is paid either way. If that person would have become a regular, it may also lose future visits. The cost doesn't appear anywhere in the accounts. The till records the people who stayed, not the ones who left.
Appointment-only shops have a hidden cost of their own: the empty slot. A booking made for 10:00 that doesn't show up is lost capacity you can't recover. (Policies on deposits and no-shows are a separate subject.) Ten minutes left between a short cut and the next booking is lost too, unless something can fill it.
So the real question isn't "walk-ins or appointments?" It's: **which hidden loss is bigger in my shop: people who leave the queue, or gaps in the diary?**
#### Three models, and when each one fits
**Walk-ins only.** This tends to fit shops with high footfall, short standard services, and enough barbers to keep the queue manageable at peak times: think transport hubs, high streets and student areas. It works best when the owner deliberately keeps utilisation below the point where waits get out of hand, for example by adding a barber on Saturdays rather than letting the queue grow.
**Appointments only.** This tends to fit shops where services are long or vary a lot in length (skin fades, beard work, colour, kids' cuts mixed with adults'), barbers with their own followings, and clients who value certainty more than speed. It works best when the diary is managed tightly: realistic slot lengths, reminders, and a clear policy on lateness.
**Hybrid.** This is a common model and the hardest to run well. The usual version keeps one chair, or certain hours, open for walk-ins and books the rest. It fails when the line between them is unclear, so walk-ins sit watching a "free" barber who is actually waiting for a booked client. Clients will accept a lot as long as they can see the rule: "Chair 1 is walk-ins; chairs 2 and 3 are booked" or "Walk-ins welcome before 2pm on weekdays".
#### How to decide using your own numbers
You don't need a queueing model to make the decision. You need two weeks of honest counts:
1. **Walk-aways:** every time someone comes in, sees the wait and leaves, make a mark on a sheet by the till.
2. **Gaps:** at closing, count the booked-diary minutes that went unused (no-shows, gaps between short cuts, late cancellations).
3. **Peak waits:** on your three busiest days, note the longest wait.
Then compare. If walk-aways are frequent and gaps are rare, you have more demand than capacity at peak. Bookings, or a booked block at peak times, may turn more of that demand into cuts. If gaps are frequent and walk-aways are rare, the diary may be too rigid. Opening some time to walk-ins, especially mid-week, may help fill it, if there's footfall to fill it with.
#### The counterargument: walk-ins are the brand
Some owners will push back on all of this. For many barbershops, the walk-in culture is the product: the conversation, the queue on the bench, the Saturday atmosphere. Turning it into a booking system would make the shop just like everyone else, and the regulars would notice.
That's a fair point, and nothing in the queue model argues against it. What the model says is that a walk-in shop protects that culture by managing how busy it gets, not by ignoring it. A sociable 15-minute wait is part of the experience. A 90-minute wait drives away the people the culture depends on. A walk-in shop that wants to last needs some way of keeping the queue in check, whether that's an extra barber at peak, a "come back at 3" habit, or simply the owner telling people honestly how long it will be.
There's a counterpoint for appointment-only shops too. Some clients, especially new ones, like being able to book without phoning, and dislike turning up to find a queue. But "booking only" can come across as unwelcoming to someone standing at the door with a free half-hour. Even a strict booking shop gains from saying clearly on the door and online how a walk-in can get a slot.
#### The short version
- Waiting time grows faster and faster as the shop gets busier. At high utilisation, a small rise in demand can mean much longer waits.
- Walk-aways and empty slots are both hidden losses. Count them for two weeks.
- Walk-ins suit high footfall and short, similar services. Appointments suit long or varied services and barbers with their own clients.
- A hybrid works only when the rule is visible to everyone in the shop.
- Whatever you choose, tell people at the door and online how to get a cut today.
#### References
1. Method note (reproducible): figures are the mean wait in the queue, *Wq*, for an M/M/2 queue, using the standard Erlang C formula. With c = 2 barbers, utilisation ρ, offered load a = cρ and mean service time S = 20 minutes:
	C(c, a) = \[aᶜ / c!\] / (1 − ρ) ÷ \{ Σₖ₌₀\^(c−1) aᵏ / k! + \[aᶜ / c!\] / (1 − ρ) \}, and Wq = C(c, a) × S ÷ (c(1 − ρ)).
	Results: ρ = 0.5 → 6.7 min; 0.7 → 19.2; 0.8 → 35.6; 0.9 → 85.3 (rounded in the table to 7, 19, 36 and 85). See any standard queueing text, for example Gross, Shortle, Thompson and Harris, *Fundamentals of Queueing Theory*, on the M/M/c queue. The figures illustrate how waiting time behaves as utilisation rises and don't describe any real shop. No external data is used.
