import type { InsightCardItem, ModelComparisonItem } from '@/lib/editorial/insightIcons';
import { requireVerifiedSetoraFact, SETORA_FACTS_CHECKED_DATE } from './setoraFacts';
import { SAAS_MONTHLY_GBP, KERSIVO_BOOKING_DEPOSIT_GBP } from './defaults';
const setora = requireVerifiedSetoraFact('canonicalMonthlyGbp').value;
export const SETORA_QUICK_ANSWER_KICKER = 'The short version';
export const SETORA_QUICK_ANSWER_TITLE = 'Setora vs KERSIVO: which works for a UK barbershop?';
export const SETORA_QUICK_ANSWER_LEAD = `Setora currently lists £${setora}/month per location on its official UK pricing page, with unlimited staff and no Setora booking commission. KERSIVO offers Starter at £0/month for up to four active bookable barbers and Full at £${SAAS_MONTHLY_GBP}/month per location, including a branded website and standard domain. Both are direct-booking platforms, not marketplaces.`;
export const SETORA_QUICK_ANSWER_DETAIL = `Setora includes a shop website, focused Booking Page, walk-in kiosk, waitlist and management apps. KERSIVO Full focuses on own-domain branding and retail pickup. Starter public bookings require a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit towards the service or full Stripe payment. Setora's barbershop page also lists £${setora} and says it currently adds no VAT. Stripe processing is separate. Facts checked ${SETORA_FACTS_CHECKED_DATE}.`;
export const SETORA_QUICK_ANSWER_FACTS = [
  {label:'Setora official pricing',value:`£${setora}/month per location`},
  {label:'KERSIVO Starter',value:'£0/month · up to 4 barbers'},
  {label:'Full KERSIVO',value:`£${SAAS_MONTHLY_GBP}/month per location`},
  {label:'Marketplace commission',value:'Neither platform operates a client marketplace'},
];
export const SETORA_WHY_INTRO = 'Setora and KERSIVO both prioritise direct bookings and the independent shop relationship. The practical questions are price, website/domain setup, day-to-day operations and what the customer pays.';
export const SETORA_WHY_THEMES: readonly InsightCardItem[] = [
  {icon:'seats',title:'A lower monthly entry point',body:`KERSIVO Starter costs £0/month for up to four bookable barbers. Full costs £${SAAS_MONTHLY_GBP}/month per location versus the current £${setora} official Setora rate. Compare the included tools rather than only the subscription.`},
  {icon:'storefront',title:'Where your website lives',body:'Setora provides a hosted Shop Website separate from its Booking Page, plus assisted custom-domain support. Full KERSIVO includes a branded website and standard domain, with retail pickup in the same site.'},
  {icon:'stack',title:'What a working shop needs',body:'Setora advertises a staffed walk-in kiosk, waitlist and mobile management apps. KERSIVO Full offers a retail pickup shop and advanced client tools. Neither product should be presented as universally better.'},
  {icon:'discovery',title:'The true price of online bookings',body:'Both advertise no platform commission on bookings. Setora quotes Stripe processing separately; KERSIVO uses Stripe too. Starter requires a £5 deposit towards the service or full online prepayment.'},
];
export const SETORA_FIT_PATHS: readonly [ModelComparisonItem,ModelComparisonItem] = [
  {label:'Setora',descriptor:'One published subscription tier for UK shops',icon:'network',summary:[{label:'Published monthly rate',value:`£${setora}/location (no VAT currently added)`},{label:'Staff',value:'Unlimited, no seat fees'}],heading:'Setora may suit you if…',points:['A waitlist, mobile staff app and walk-in kiosk are priorities','You want to keep an existing Stripe/counter payments workflow','You prefer its separate Shop Website and Booking Page setup','Your existing Setora setup works well and a move offers little benefit']},
  {label:'KERSIVO',descriptor:'Starter free plan or branded Full platform',icon:'direct',summary:[{label:'Monthly rate',value:`£0 Starter or £${SAAS_MONTHLY_GBP} Full`},{label:'Full website & domain',value:'Included standard domain'}],heading:'KERSIVO may suit you if…',points:['You want a no-subscription Starter option for up to four barbers','You want a full website on a standard own domain with a fixed per-location rate','You want Full retail pickup as part of the same website','You are comfortable with Starter requiring Stripe deposits or full payment']},
];
export const SETORA_FIT_CLOSING = 'Decide using your shop’s actual needs, confirmed pricing and the customer booking experience, not an artificial feature tally.';
export const SETORA_SWITCHING_REASSURANCE = 'Keep Setora live while you prepare and test KERSIVO.';
export const SETORA_SWITCHING_STEPS = [
  {title:'Keep Setora running',body:'Do not turn off existing online booking while configuring a replacement.'},
  {title:'Export the records you can',body:'Use Setora’s customer CSV export and review which booking, service and customer details are available.'},
  {title:'Verify compatible data',body:'KERSIVO can help assess supported CSV imports. Do not assume every field or future appointment transfers automatically.'},
  {title:'Configure KERSIVO',body:'Add staff, services and working hours; on Full prepare your own-domain website.'},
  {title:'Test booking journeys',body:'Check the client experience, Stripe payment configuration and future appointments before cutover.'},
  {title:'Switch public links',body:'Change your Google, Instagram and website booking links only when the replacement is ready.'},
];
export const SETORA_SWITCHING_LIMITS = [
  'Setora supports exporting customer details, but KERSIVO migration depends on the exact fields and formats you obtain.',
  'Keep a safe record of future appointments. No automatic Setora migration or zero-downtime switchover is promised.',
];
