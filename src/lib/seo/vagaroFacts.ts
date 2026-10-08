/**
 * Vagaro UK commercial source of truth.
 * Official Vagaro UK sources checked on 8 October 2026.
 *
 * Do not conflate the discounted price shown on the public pricing widget with
 * a guaranteed permanent price. No universal marketplace fee, payment
 * processing rate or VAT-on-subscription assumption may be silently invented.
 *
 * Calculator integration: use requireVerifiedVagaroFact() plus channel-aware
 * helpers below. A numeric output still requires clear pricing assumptions.
 */
export const VAGARO_FACTS_CHECKED_ISO = '2026-10-08';
export const VAGARO_FACTS_CHECKED_DATE = '8 October 2026';

export type VagaroSourceId = 'pricingUk' | 'ukHome' | 'ukParticipation' | 'fillMyBooks' | 'customerExport';
export type VagaroSource = { id: VagaroSourceId; label: string; url: string; supports: string };
export const VAGARO_SOURCES: readonly VagaroSource[] = [
  { id:'pricingUk', label:'Vagaro UK pricing', url:'https://www.vagaro.com/en-gb/pro/pricing', supports:'Displayed £20/month for one bookable calendar, £30 struck-through, included features, free trial and Marketplace headline' },
  { id:'ukHome', label:'Vagaro UK: plans and calendars', url:'https://www.vagaro.com/en-gb/pro', supports:'An additional £10 per calendar; published £80/month for seven or more calendars' },
  { id:'ukParticipation', label:'Vagaro UK Customer Participation Agreement, section 10(p)', url:'https://www.vagaro.com/en-gb/pro/vagaro-customer-participation-agreement', supports:'UK channel-based 20% first-appointment acquisition fee and applicable conditions, VAT wording, Fill My Books existing-client terms' },
  { id:'fillMyBooks', label:'Vagaro: Fill My Books', url:'https://www.vagaro.com/en-gb/pro/updates/fill-my-books', supports:'Optional 5% existing-client / 20% new-client promotional booking charges' },
  { id:'customerExport', label:'Vagaro Support: Export Your Customer List', url:'https://support.vagaro.com/hc/en-us/articles/360006371094-Export-Your-Customer-List', supports:'Business owner can export the customer list as an Excel or PDF file' },
];

export function getVagaroSource(id: VagaroSourceId): VagaroSource {
  const source = VAGARO_SOURCES.find((item) => item.id === id);
  if (!source) throw new Error(`Unknown Vagaro source: ${id}`);
  return source;
}

type FactBase = { sourceId: VagaroSourceId; checkedIso: string; unit: string; note?: string };
export type VagaroVerifiedFact = FactBase & { status:'verified'; value:number; pricingStatus:'displayed-discount' | 'published' | 'conditional' };
export type VagaroUnresolvedFact = FactBase & { status:'unresolved'; note:string };
export type VagaroFact = VagaroVerifiedFact | VagaroUnresolvedFact;

export const VAGARO_UK_COMMERCIAL_FACTS = {
  oneCalendarDisplayedMonthlyGbp: {
    status:'verified', value:20, pricingStatus:'displayed-discount', unit:'GBP/month, one bookable calendar', sourceId:'pricingUk', checkedIso:VAGARO_FACTS_CHECKED_ISO,
    note:'A crossed-out £30 appears alongside £20; duration/eligibility of the reduced price is not guaranteed.',
  },
  oneCalendarStruckThroughMonthlyGbp: {
    status:'verified', value:30, pricingStatus:'published', unit:'GBP/month, struck-through comparative price', sourceId:'pricingUk', checkedIso:VAGARO_FACTS_CHECKED_ISO,
    note:'Not an asserted live checkout price; shown struck-through on Vagaro UK pricing.',
  },
  additionalCalendarMonthlyGbp: {
    status:'verified', value:10, pricingStatus:'published', unit:'GBP/month per additional bookable calendar', sourceId:'ukHome', checkedIso:VAGARO_FACTS_CHECKED_ISO,
  },
  sevenOrMoreCalendarsDisplayedMonthlyGbp: {
    status:'verified', value:80, pricingStatus:'published', unit:'GBP/month for seven or more bookable calendars, per published UK FAQ', sourceId:'ukHome', checkedIso:VAGARO_FACTS_CHECKED_ISO,
  },
  freeTrialDays: {
    status:'verified', value:30, pricingStatus:'published', unit:'days', sourceId:'pricingUk', checkedIso:VAGARO_FACTS_CHECKED_ISO,
  },
  marketplaceNewClientFirstBookingPercent: {
    status:'verified', value:20, pricingStatus:'conditional', unit:'percent of qualifying new-client first Booking Amount, excluding any additional applicable VAT', sourceId:'ukParticipation', checkedIso:VAGARO_FACTS_CHECKED_ISO,
    note:'In the UK: Marketplace while listed; Partner Networks while listed; Own Channels only when Fill My Books enabled.',
  },
  fillMyBooksExistingClientPercent: {
    status:'verified', value:5, pricingStatus:'conditional', unit:'percent of qualifying Fill My Books / Daily Deals existing-client Booking Amount', sourceId:'ukParticipation', checkedIso:VAGARO_FACTS_CHECKED_ISO,
    note:'Do not apply to all returning bookings. Only programme-facilitated bookings as described in Section 10.',
  },
  monthlyMySiteAddOnGbp: {
    status:'verified', value:15, pricingStatus:'published', unit:'GBP/month for optional MySite website builder', sourceId:'pricingUk', checkedIso:VAGARO_FACTS_CHECKED_ISO,
    note:'UK pricing page lists it under add-ons, not the base subscription.',
  },
  vatOnSubscriptionPercent: {
    status:'unresolved', unit:'percent on subscription', sourceId:'pricingUk', checkedIso:VAGARO_FACTS_CHECKED_ISO,
    note:'The public UK pricing page does not clearly establish the final VAT treatment for every business. Do not automatically add or omit VAT.',
  },
  paymentProcessingFees: {
    status:'unresolved', unit:'GBP/transaction', sourceId:'pricingUk', checkedIso:VAGARO_FACTS_CHECKED_ISO,
    note:'Plan-specific UK acquiring rates must be separately verified. Never substitute Stripe rates.',
  },
  bookingWidgetAsSeparateAddOnPrice: {
    status:'unresolved', unit:'GBP/month', sourceId:'pricingUk', checkedIso:VAGARO_FACTS_CHECKED_ISO,
    note:'Booking widgets are listed as included. Do not invent an additional widget fee.',
  },
} as const satisfies Record<string,VagaroFact>;

export type VagaroFactKey = keyof typeof VAGARO_UK_COMMERCIAL_FACTS;
export function requireVerifiedVagaroFact<K extends VagaroFactKey>(key:K): Extract<(typeof VAGARO_UK_COMMERCIAL_FACTS)[K],{status:'verified'}> {
 const fact: VagaroFact = VAGARO_UK_COMMERCIAL_FACTS[key];
 if (fact.status !== 'verified') throw new Error(`Vagaro fact ${key} is unresolved — do not use it as a price.`);
 return fact as Extract<(typeof VAGARO_UK_COMMERCIAL_FACTS)[K],{status:'verified'}>;
}

export type VagaroAcquisitionChannel = 'marketplace'|'partner-network'|'own-channel'|'direct-other';
export type VagaroFeeContext = {
  channel: VagaroAcquisitionChannel;
  isNewClient: boolean;
  marketplaceListingActive: boolean;
  fillMyBooksEnabled: boolean;
  /** Only true when this booking was facilitated through Fill My Books/Daily Deals. */
  promotedBooking: boolean;
};

/**
 * UK customer-acquisition / promotion fees without VAT or payment-processing.
 * A zero means no documented fee for these flags, not "all Vagaro bookings free".
 * New-client rule governed by section 10(p) of the UK Participation Agreement.
 */
export function resolveVagaroUkAcquisitionPercent(context:VagaroFeeContext): number {
 const newRate = requireVerifiedVagaroFact('marketplaceNewClientFirstBookingPercent').value;
 const existingRate = requireVerifiedVagaroFact('fillMyBooksExistingClientPercent').value;
 if (!context.isNewClient) return context.promotedBooking && context.marketplaceListingActive ? existingRate : 0;
 if (context.channel==='marketplace' && context.marketplaceListingActive) return newRate;
 if (context.channel==='partner-network' && context.marketplaceListingActive) return newRate;
 if (context.channel==='own-channel' && context.fillMyBooksEnabled) return newRate;
 if (context.promotedBooking && context.fillMyBooksEnabled && context.marketplaceListingActive) return newRate;
 return 0;
}

/**
 * Public-price illustration only. The £20 discounted displayed first-calendar
 * rate is not contractually guaranteed; above seven uses the published £80 cap.
 * Excludes add-ons, payment fees and VAT because their applicability varies.
 */
export function estimateVagaroDisplayedSubscriptionGbp(bookableCalendars:number):number {
 if (!Number.isSafeInteger(bookableCalendars) || bookableCalendars < 1)
   throw new Error('bookableCalendars must be a positive integer');
 const base = requireVerifiedVagaroFact('oneCalendarDisplayedMonthlyGbp').value;
 const additional = requireVerifiedVagaroFact('additionalCalendarMonthlyGbp').value;
 const cap = requireVerifiedVagaroFact('sevenOrMoreCalendarsDisplayedMonthlyGbp').value;
 return Math.min(base + (bookableCalendars - 1) * additional,cap);
}
export const VAGARO_TRADEMARK_DISCLAIMER =
 'Vagaro is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Vagaro.';
export const VAGARO_COMPARISON_FOOTNOTE =
 'Vagaro data checked against official UK pricing and participation terms on 8 October 2026. The displayed £20 is not a guaranteed long-term rate; channel-dependent fees may apply. Check live terms.';
