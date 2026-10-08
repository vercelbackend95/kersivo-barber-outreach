/**
 * Setora UK commercial source of truth. Checked 8 October 2026.
 * Setora's canonical /pricing and homepage currently say £59/location/month.
 * The barbershop page now also shows £59 and says no VAT is currently added.
 */
export const SETORA_FACTS_CHECKED_ISO = '2026-10-08';
export const SETORA_FACTS_CHECKED_DATE = '8 October 2026';
export type SetoraSourceId = 'pricing' | 'homepage' | 'barbers' | 'features' | 'websites' | 'help';
export type SetoraSource = { id: SetoraSourceId; label: string; url: string; supports: string };
export const SETORA_SOURCES: readonly SetoraSource[] = [
  { id:'pricing', label:'Setora official UK pricing', url:'https://www.setora.co.uk/pricing', supports:'£59 monthly rate per location, unlimited staff, VAT basis, trial, SMS, Stripe and billing' },
  { id:'homepage', label:'Setora main website', url:'https://www.setora.co.uk/', supports:'£59 monthly subscription, core functionality and direct-booking positioning' },
  { id:'barbers', label:'Setora barber booking software', url:'https://www.setora.co.uk/barbershop-booking-software', supports:'Barbershop-specific tools, mobile apps, £59 price, current VAT statement and no standard setup fee' },
  { id:'features', label:'Setora product features', url:'https://www.setora.co.uk/features', supports:'Booking page, calendar, reminders, walk-in kiosk, reports and customer exports' },
  { id:'websites', label:'Setora Help Centre: Shop Website', url:'https://www.setora.co.uk/help/websites/shop-website', supports:'Separate Shop Website and Booking Page, default Setora-hosted address and assisted custom domains' },
  { id:'help', label:'Setora Help Centre', url:'https://www.setora.co.uk/help', supports:'Payments, migration, data export, daily operations and setup guides' },
];

export function getSetoraSource(id: SetoraSourceId): SetoraSource {
  const source = SETORA_SOURCES.find(item => item.id === id);
  if (!source) throw new Error(`Unknown Setora source: ${id}`);
  return source;
}

type SetoraFactBase = { sourceId: SetoraSourceId; checkedIso: string };
export type SetoraVerifiedFact = SetoraFactBase & { status:'verified'; value: number | boolean; unit: string; note?: string };
export type SetoraUnresolvedFact = SetoraFactBase & { status:'unresolved'; note: string };
export type SetoraFact = SetoraVerifiedFact | SetoraUnresolvedFact;
const checkedIso = SETORA_FACTS_CHECKED_ISO;

/** Base published UK figures: extras and applicable VAT are separate. */
export const SETORA_UK_COMMERCIAL_FACTS = {
  canonicalMonthlyGbp: { status:'verified', value:59, unit:'GBP per location per month before VAT where applicable', sourceId:'pricing', checkedIso },
  barberLandingMonthlyGbp: { status:'verified', value:59, unit:'GBP per location per month', sourceId:'barbers', checkedIso },
  vatCurrentlyAdded: { status:'verified', value:false, unit:'VAT currently added to UK subscription', sourceId:'barbers', checkedIso },
  trialDays: { status:'verified', value:14, unit:'days, no payment card needed', sourceId:'pricing', checkedIso },
  additionalStaffSubscriptionGbp: { status:'verified', value:0, unit:'GBP per additional staff member', sourceId:'pricing', checkedIso },
  platformBookingCommissionPercent: { status:'verified', value:0, unit:'percent of service price', sourceId:'pricing', checkedIso },
  addedCustomerBookingChargeGbp: { status:'verified', value:0, unit:'GBP separate Setora booking fee', sourceId:'barbers', checkedIso },
  platformSetupFeeGbp: { status:'verified', value:0, unit:'GBP standard setup fee advertised for barber shops', sourceId:'barbers', checkedIso },
  smsCredits: { status:'verified', value:true, unit:'charged separately if used', sourceId:'pricing', checkedIso },
  stripeProcessing: { status:'verified', value:true, unit:'separately at applicable Stripe rates', sourceId:'pricing', checkedIso },
  ownDomainIncluded: { status:'unresolved', sourceId:'websites', checkedIso, note:'Setora offers assisted custom domains, but whether the domain purchase itself is included in the £59 subscription is not established.' },
  unlimitedStaff: { status:'verified', value:true, unit:'no per-staff seat fees per location', sourceId:'pricing', checkedIso },
} as const satisfies Record<string, SetoraFact>;

export type SetoraCommercialFactKey = keyof typeof SETORA_UK_COMMERCIAL_FACTS;
export function requireVerifiedSetoraFact<K extends SetoraCommercialFactKey>(key: K): Extract<(typeof SETORA_UK_COMMERCIAL_FACTS)[K], { status: 'verified' }> {
  const fact: SetoraFact = SETORA_UK_COMMERCIAL_FACTS[key];
  if (fact.status !== 'verified') throw new Error(`Setora fact "${key}" is ${fact.status}; do not use as a guaranteed current price.`);
  return fact as Extract<(typeof SETORA_UK_COMMERCIAL_FACTS)[K], { status: 'verified' }>;
}
export const SETORA_COMPARISON_FOOTNOTE = 'Comparison uses official Setora UK sources checked 8 October 2026. Both official Setora pages show £59; its barbershop page says no VAT is currently added. Fees, features and VAT treatment may change. KERSIVO and Setora are independent businesses.';

export const SETORA_COMPARE_SECTIONS = [
  { id:'bookings', title:'Online Bookings & Diary', subtitle:'Both offer direct booking — compare the everyday workflow.', setoraLead:'Shared diary and online Booking Pages for shops and salons.', setoraPoints:['Customer self-service Booking Page with staff and service selection','Day, lanes, three-day and week diary views','Walk-in kiosk and waitlist tools','Mobile management apps for iOS and Android'], kersivoLead:'Direct bookings, with Starter and Full capabilities separated.', kersivoPoints:['Hosted booking page with up to four barbers on Starter','Full branded website and booking flow','Bookings, Team, Services and Clients Core on Starter','Full Reports and Advanced Clients'] },
  { id:'payments', title:'Price, Deposits & VAT', subtitle:'Published subscription rates and how a booking is paid.', setoraLead:'One published subscription tier, no platform booking commission.', setoraPoints:['Official pricing: £59/month per location; no VAT currently added according to Setora','Unlimited staff with no extra seat subscription','No Setora commission or separate customer booking charge','Optional deposits and online payments via Stripe, processing billed separately'], kersivoLead:'Choose free booking basics or a £39/month full platform.', kersivoPoints:['Starter: £0/month, up to four active bookable barbers','Starter public bookings require £5 deposit towards service or full Stripe payment','Full: £39/month per location and no per-staff subscription charges, subject to fair use','0% KERSIVO booking commission; Stripe processing fees apply'] },
  { id:'brand', title:'Websites & Domains', subtitle:'Both provide branded presentation but take different approaches.', setoraLead:'Public Shop Website and a separate focused Booking Page.', setoraPoints:['Setora-hosted website and Booking Page are separate surfaces','Default website URL is on setora.co.uk','Custom domain available with Setora assistance','Do not assume domain registration is included'], kersivoLead:'Full includes own standard domain, website and booking experience.', kersivoPoints:['Starter: KERSIVO-hosted public booking page','Full: branded barbershop website on a standard own domain included','Direct booking with no consumer marketplace','Full website also includes retail pickup pages'] },
  { id:'growth', title:'Retail & Growth', subtitle:'Check what your shop actually needs beyond a calendar.', setoraLead:'Retention and operational tools built into one platform.', setoraPoints:['Google review requests and retention reporting','Waitlist, no-show Booking Protection and automated reminders','Staff-operated walk-in kiosk and mobile management apps','Compare exact retail functionality before assuming parity'], kersivoLead:'Full includes retail pickup and advanced client tools.', kersivoPoints:['Retail pickup shop on Full, including product and order management','Advanced Clients and Reports included with Full','Flexible payment modes including Pay at shop on Full','Email reminders on Starter, SMS reminders with Full'] },
  { id:'switch', title:'Data & Switching', subtitle:'Exports and migration deserve a practical check.', setoraLead:'Setora provides export and import workflows.', setoraPoints:['Customer CSV export and available reports','Supported CSV/Excel imports with mapping review','No consumer marketplace; direct customer links','A live account can be kept running during a transition'], kersivoLead:'Review real data before committing to a change.', kersivoPoints:['Import support depends on usable fields and supported CSV data','Do not promise direct automatic Setora-to-KERSIVO migration','Keep Setora running while testing a KERSIVO preview','Switch public booking links only after checking future appointments'] },
] as const;

export type SetoraCompareSectionId = typeof SETORA_COMPARE_SECTIONS[number]['id'];
export const SETORA_TRADEMARK_DISCLAIMER = 'Setora is a trade mark of Setora Technology Ltd. KERSIVO is not affiliated with or endorsed by Setora. All third-party information is based on published sources and may change.';
