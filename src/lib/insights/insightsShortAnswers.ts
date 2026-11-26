/**
 * Answer-first summaries for Insights articles (GEO/AEO, docs/seo/GEO-AEO-PLAN.md, stage 1).
 *
 * Each article opens with the question an owner would type into Google or ask an AI assistant,
 * followed by a 40–80 word answer that can be quoted on its own. The answer only restates what
 * the article already says: no new figures, claims or advice. If an article changes, update its
 * answer here in the same commit.
 *
 * The same answer is used as Article `abstract` in JSON-LD and as the article note in /llms.txt.
 */

export const INSIGHTS_SHORT_ANSWER_LABEL = 'Short answer';

export const INSIGHTS_SHORT_ANSWER_MIN_WORDS = 40;
export const INSIGHTS_SHORT_ANSWER_MAX_WORDS = 80;

export type InsightsShortAnswer = {
  /** The owner's question, in plain words. Rendered as the block's heading. */
  question: string;
  /** Self-contained answer: first sentence answers the question directly. */
  answer: string;
};

export const INSIGHTS_SHORT_ANSWERS: Readonly<Record<string, InsightsShortAnswer>> = {
  'apprentice-barber-funding-costs-2026': {
    question: 'Is taking on an apprentice barber worth it for a small shop in England?',
    answer:
      'It can be, but only if someone in the shop has time to teach. In 2026 the training is paid for and an eligible young apprentice can bring up to £3,000 in payments, yet the real cost is senior chair time spent supervising. Work out that cost, confirm which payments you qualify for with a training provider offering the Barbering Professional standard, and only then advertise.',
  },
  'barber-commission-pay-minimum-wage-uk': {
    question: 'Do employed barbers on commission still have to get the minimum wage?',
    answer:
      'Yes. Commission does not take an employed barber outside the minimum wage rules. In every pay reference period, qualifying pay (base plus the commission and bonus belonging to that period, not tips) divided by qualifying hours must reach the rate for the barber’s age and status: £12.71 an hour for those aged 21 and over from 1 April 2026. Check it monthly and top up any shortfall.',
  },
  'barber-dermatitis-skin-care-hse': {
    question: 'How can barbers protect their hands from dermatitis?',
    answer:
      'Contact dermatitis builds slowly from wet work, cleaning and disinfecting tools and some products, so prevention is a daily habit. Make it easy to dry hands properly, keep moisturiser at every station and wear gloves when cleaning and disinfecting tools. Ask each barber privately about sore, cracked or itchy skin and act at the first yes. Employers should cover skin in their risk assessment.',
  },
  'barbershop-business-rates-2026-england': {
    question: 'Why did some barbershop business rates bills rise in 2026 when the multiplier fell?',
    answer:
      'Because many shops also lost the 40% retail, hospitality and leisure relief. In a hypothetical England shop with a £30,000 rateable value, the multiplier fell from 49.9p to 38.2p plus a 1p supplement, yet the amount payable rose from £8,982 to £11,760 before supporting small business relief. Compare your total bill with last year’s, not the multipliers, and query anything that does not fit.',
  },
  'barbershop-card-payment-fees-uk': {
    question: 'How much do card payment fees really cost a barbershop?',
    answer:
      'More than the headline rate suggests, because most card fees add a fixed charge to each payment. At a published rate of 1.5% plus 20p, a £40 service pays 2% but a £12 kids’ cut pays 3.17%. Work out your real blended rate from a full month’s statement, check your cheapest services and count visits split into more than one card payment before changing prices or provider.',
  },
  'barbershop-christmas-opening-hours-planning': {
    question: 'Should a barbershop open extra hours in December?',
    answer:
      'Only for the hours that pay. For each extra hour, divide its extra cost by the contribution from one genuinely additional cut to find the break-even number of cuts, then ask whether the hour brings new cuts or only moves bookings clients would have made anyway. Check contracts and bank holiday entitlements first, and rebook clients at the chair so December pays into January.',
  },
  'barbershop-client-retention-second-visit': {
    question: 'How can a barbershop get more first-time clients to come back?',
    answer:
      'Measure it first. Take a month of first-time clients whose usual return window has closed and count how many came back. If that number is low, start with the simplest change: ask every client before they leave when they would like to come back, then count again in two months. Growth from returning clients is usually cheaper and steadier than buying new ones every month.',
  },
  'barbershop-gift-vouchers-uk': {
    question: 'What should a UK barbershop know before selling gift vouchers?',
    answer:
      'A voucher is a haircut you owe later, not just cash today. There is no legal minimum expiry, but the government encourages at least two years, so print the expiry date and terms clearly. If the shop is VAT-registered, a voucher usable only on its standard-rated services is likely single-purpose, with VAT due when it is sold. Keep a register of every voucher sold and redeemed.',
  },
  'barbershop-loyalty-scheme-uk': {
    question: 'Is a “tenth cut free” loyalty scheme worth it for a barbershop?',
    answer:
      'Only if it changes what clients do. Buy nine, get the tenth free is a 10% discount on that client’s visits, and when a regular would have come back anyway, each free cut costs about the full price. Record how often regulars visit before you start, then compare after six months. If frequency has not risen past break-even, the scheme is a discount, not a loyalty tool.',
  },
  'barbershop-no-show-cost-when-deposit-makes-sense': {
    question: 'When does it make sense for a barbershop to take a deposit?',
    answer:
      'When no-shows cause a real loss. A missed slot costs the price minus what comes back, such as a walk-in filling it, so losses are usually biggest in quiet slots. If losses are small and fall on busy days, reminders and a waiting list may be enough. If they are large, take a proportionate deposit for those bookings, explain it before booking and respect statutory cancellation rights.',
  },
  'barbershop-walk-ins-vs-appointments': {
    question: 'Should a barbershop take walk-ins or appointments, especially at peak hours?',
    answer:
      'It depends on footfall and services. Walk-ins suit high footfall and short, similar services; appointments suit long or varied services and barbers with their own clients. Waiting time grows faster as a shop gets busier, so at peak hours a small rise in demand can mean much longer waits. A hybrid works only when the rule is visible to everyone, at the door and online.',
  },
  'busy-barbershop-low-profit-chair-hour': {
    question: 'Why is a busy barbershop not making more money?',
    answer:
      'Because a full diary measures time, not money. Services leave very different contribution per chair-hour, and unsold minutes between bookings add up. Work out contribution per chair-hour for every service, keep the ones that pay their way, move low earners into hours that would otherwise be empty, and reprice or re-time the services that take your best hours for the least money.',
  },
  'do-barbers-need-a-website-uk': {
    question: 'Do barbers need a website if they already have Instagram and Google?',
    answer:
      'Not always. If Google Maps and word of mouth fill the diary, a website may not be needed. If clients cannot find prices, cannot book out of hours or do not know the cancellation terms, a simple page solves a real problem. Start small, because a one-page site or a booking page often does the whole job, and judge it by bookings, not visitor numbers.',
  },
  'get-more-barbershop-clients-locally-uk': {
    question: 'How can a barbershop get more clients locally?',
    answer:
      'Judge every channel by what a returning client costs, not a first visit. Start with referrals and lapsed clients, keeping messages within PECR with an opt-out every time. Then tidy your Google profile, check your council’s leafleting zones before handing out flyers, and test partnerships with neighbouring businesses whose customers already pass your door, measuring each one.',
  },
  'google-business-profile-booking-link-barbershop': {
    question: 'Where does the booking button on a barbershop’s Google profile send clients?',
    answer:
      'Not always where the owner expects, because booking providers can supply the links Google shows. Check your own profile, decide which system you want new clients to meet, make it the preferred link and remove links that send clients elsewhere without your agreement. Measure completed bookings yourself, and check the profile again in three months in case someone else changes it.',
  },
  'google-reviews-barbershop-uk-rules': {
    question: 'How can a UK barbershop get more Google reviews without breaking the rules?',
    answer:
      'Ask every client the same way after the appointment and offer nothing in return: Google bans incentives for reviews even when they are disclosed. Do not screen for happy clients, set staff review targets or let staff and family review the shop. UK consumer law sets the minimum and Google’s policy is stricter, so asking everyone honestly builds the most credible record.',
  },
  'how-much-do-barbershop-owners-make-uk': {
    question: 'How much does a barbershop owner make in the UK?',
    answer:
      'There is no single figure: staff pay, rent and costs decide it more than sales do. In an illustrative model of two four-chair England shops with the same £180,000 yearly sales, the profit gap is £41,405. The model uses invented businesses, not a survey. To judge your own shop, track net sales per chair-hour, true staff cost per paid hour and all-in premises costs.',
  },
  'how-to-price-haircut-uk-barber': {
    question: 'How should a UK barber price a haircut?',
    answer:
      'Set a floor from your own costs and a ceiling from the local market. Work out your average cost per booked hour and per minute, check each service against it using its real length, then compare three or four genuine local alternatives and choose where you sit. Test any rise on one service first, and show prices clearly, including any mandatory booking fee.',
  },
  'making-tax-digital-barbers': {
    question: 'When do barbers have to join Making Tax Digital for Income Tax?',
    answer:
      'From 6 April 2027 if qualifying income is more than £30,000. Qualifying income is gross income from self-employment and property before expenses, not take-home pay, so a chair renter with £22,000 profit can still have to join. Check your Self Assessment figures, reconcile booking reports with payments and choose compatible tax software from HMRC’s finder well before your first quarterly deadline.',
  },
  'unfair-dismissal-six-months-barbershop-employers': {
    question: 'How does the 2027 unfair dismissal change affect barbershops that employ staff?',
    answer:
      'From 1 January 2027 the qualifying period for unfair dismissal protection falls from two years to six months, wherever the effective date of termination is on or after that date. List each employee’s start date, make probation terms clear, record performance conversations, and take employment-law advice before ending anyone’s employment rather than after notice is given.',
  },
};

export function getInsightsShortAnswer(slug: string): InsightsShortAnswer | undefined {
  return INSIGHTS_SHORT_ANSWERS[slug];
}

/**
 * Where the short answer goes in the rendered article HTML: after the H1, the hero figure and any
 * all-italic notes that follow it (legal or "illustrative model" disclaimers), before the first body
 * paragraph. Returns -1 when the article has no H1.
 */
export function findInsightsShortAnswerSlot(html: string): number {
  const h1End = html.indexOf('</h1>');
  if (h1End < 0) return -1;
  let at = h1End + '</h1>'.length;
  const leading = /^\s*(?:<figure\b[\s\S]*?<\/figure>|<p>\s*<em>(?:(?!<\/p>)[\s\S])*<\/em>\s*<\/p>)/;
  for (let match = html.slice(at).match(leading); match; match = html.slice(at).match(leading)) {
    at += match[0].length;
  }
  return at;
}
