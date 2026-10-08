/**
 * Source-backed SQUIRE comparison facts for the UK /squire-alternative landing page.
 * Keep US-dollar prices labelled as public USD list prices. Do not infer UK GBP pricing.
 * SQUIRE has an operating UK presence, independently of GBP pricing availability.
 */
export const SQUIRE_FACTS_CHECKED_DATE = '8 October 2026';
export const SQUIRE_FACTS_CHECKED_ISO = '2026-10-08';

export const SQUIRE_OFFICIAL_SOURCES = [
  {id:'pricing', label:'SQUIRE official pricing', url:'https://www.getsquire.com/pricing', supports:'Public USD subscription tiers, plan features and add-on prices'},
  {id:'payments', label:'SQUIRE payments overview', url:'https://getsquire.com/features/payments', supports:'Online and in-shop payment options, POS, Auto Payout and Rent Collect'},
  {id:'ukShop', label:'SQUIRE: Envy Barbers, Covent Garden', url:'https://getsquire.com/discover/barbershop/envy-barbers-covent-garden-covent-garden', supports:'Example of a live publicly listed UK barbershop on SQUIRE'},
  {id:'ukEntity', label:'SQUIRE data processing agreement', url:'https://getsquire.com/data-processing-agreement', supports:'Squire Europe Limited as a UK service provider'},
  {id:'tapToPay', label:'SQUIRE Tap to Pay availability',url:'https://getsquire.com/using-squire/tap-to-pay',supports:'UK Android Tap to Pay availability and platform-specific restrictions'},
] as const;

export const SQUIRE_US_LIST_PLANS = [
  {id:'independent', label:'INDEPENDENT', usdMonthly:30, audience:'Individual barbers', notes:['Online booking, scheduling and no-show protection','Automated email and SMS reminders']},
  {id:'pro',label:'PRO',usdMonthly:50,audience:'Single-location shops',notes:['Multiple barber accounts','Google and Instagram booking, waitlist and client transfer']},
  {id:'executive',label:'EXECUTIVE',usdMonthly:150,audience:'High-growth shops · per shop',notes:['Commission and rent collection','Email/SMS marketing and optional branded landing page ($25/month)']},
  {id:'titan',label:'TITAN',usdMonthly:250,audience:'Multi-location brands · per shop',notes:['Multi-location tools and branded app','Gift cards, loyalty, inventory tracking and client chat']},
] as const;

export const SQUIRE_COMPARISON_FOOTNOTE =
  'SQUIRE features and publicly listed USD subscription prices were checked against its official website on 8 October 2026. UK barbershops use SQUIRE, but a complete UK-specific GBP price list, local transaction charges and plan eligibility were not verified. Some functions are tier-specific or paid add-ons. Confirm terms directly with SQUIRE.';

export type SquireCompareSectionId='bookings'|'payments'|'brand'|'retail'|'clients'|'reports';
export type SquireCompareSection={
  id:SquireCompareSectionId;
  title:string; subtitle:string;
  squireLead:string; squirePoints:readonly string[];
  kersivoLead:string; kersivoPoints:readonly string[];
};
export const SQUIRE_COMPARE_SECTIONS:readonly SquireCompareSection[]=[
  {id:'bookings',title:'Bookings',subtitle:'The diary, booking journey and reminders.',
   squireLead:'Online bookings and barbershop scheduling with reminders, no-show tools and a waitlist on relevant plans.',
   squirePoints:['Bookings and appointment scheduling','Automated email/SMS reminders','No-show protection and group appointments','Google and Instagram bookings on Pro'],
   kersivoLead:'Practical booking operations, with an optional own-domain experience on Full.',
   kersivoPoints:['Unlimited bookings on Starter and Full','Starter: hosted page for up to four active bookable barbers','Email reminders on both plans; SMS on Full under its allowance','Full: booking journey on your barbershop website']},
  {id:'payments',title:'Payments & Deposits',subtitle:'How appointments and in-shop payments work.',
   squireLead:'Integrated in-person and online payments, plus staff payout workflows on applicable plans.',
   squirePoints:['Online payments and pre-payments','In-shop register/POS and contactless payments','Auto Payout and Rent Collect for qualifying shops','Processing rates and any client-facing charges need UK confirmation'],
   kersivoLead:'Stripe-powered online booking payments with 0% KERSIVO platform commission.',
   kersivoPoints:['Starter: public bookings require £5 online payment or Pay in full','Full: owner-controlled Pay at shop, £5 deposit or Pay in full','Standard Stripe processing fees apply','KERSIVO does not offer SQUIRE-style register or automatic barber payouts']},
  {id:'brand',title:'Brand & Domain',subtitle:'What clients see when they book.',
   squireLead:'Hosted booking discovery and branded experiences, with features depending on plan.',
   squirePoints:['Public SQUIRE-hosted shop booking pages','Google and Instagram booking on Pro','Branded landing pages offered as an Executive add-on','Branded apps are advertised on eligible plans'],
   kersivoLead:'Full KERSIVO places the complete website and booking flow on your own shop domain.',
   kersivoPoints:['Full: branded website and standard domain included','Your brand, services, team and booking steps in one experience','Starter: KERSIVO-hosted booking page with shop name and logo','No consumer marketplace required for direct booking']},
  {id:'retail',title:'Retail & POS',subtitle:'Online products versus physical retail operations.',
   squireLead:'Broad in-shop POS capabilities plus inventory tools on higher tiers.',
   squirePoints:['In-shop register for walk-ins and checkout','Card and contactless payment support','Inventory tracking and purchase orders on Titan','Integrated staff payment workflows'],
   kersivoLead:'A Full-only branded online retail pickup experience.',
   kersivoPoints:['Products available to order from your own website on Full','Shop pickup orders managed in KERSIVO','No KERSIVO commission on Full retail payments','Not a replacement for a physical POS or inventory procurement suite']},
  {id:'clients',title:'Clients & Communication',subtitle:'Retention, reminders and customer relationships.',
   squireLead:'Client management with reminders, marketing and loyalty capabilities varying by plan.',
   squirePoints:['Booking confirmations and reminders','Unlimited email/SMS marketing with Engage on Executive','Loyalty programme and client chat on Titan','Customer-facing SQUIRE booking experience'],
   kersivoLead:'Client records connected to your own booking journey.',
   kersivoPoints:['Clients Core on Starter, advanced client information on Full','Email appointment reminders on both plans','SMS reminders on Full, subject to allowance','Bookings on your own domain with Full']},
  {id:'reports',title:'Reports & Team',subtitle:'The operational tools behind the diary.',
   squireLead:'Wider business management with staff and multi-location tools on eligible plans.',
   squirePoints:['Earnings and reporting insights','Commission and rent collection on Executive','Inventory and multi-location functionality on Titan','Advanced POS and payout workflow'],
   kersivoLead:'Focused management for independent UK barbershops.',
   kersivoPoints:['Bookings, services, team and limited clients on Starter','Full reports, advanced clients and retail orders','Full includes larger teams subject to fair use','£39/month per location, not per barber']},
];
