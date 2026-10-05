/**
 * Static Fresha competitor facts for the /fresha-alternative page.
 * Single source of truth for Fresha facts — components must not hardcode Fresha claims.
 *
 * Never scrape at runtime. Never copy Fresha figures from third-party articles, never
 * convert non-GBP figures and never infer UK prices: automated Fresha page loads can
 * return a different region/currency (a crawler fetch of /en-GB/pricing returned USD).
 * UK values below were read from a UK browser rendering of the official pricing page,
 * which showed GBP and "Rates are exclusive of 20.0% sales tax."
 */

/** Human-readable date the facts below were checked against official Fresha sources. */
export const FRESHA_FACTS_CHECKED_DATE: string | null = '30 September 2026';
export const FRESHA_FACTS_CHECKED_ISO: string | null = '2026-09-30';

export type FreshaSourceId =
  | 'pricingUk'
  | 'marketplaceFee'
  | 'bookingLinks'
  | 'clientExport'
  | 'reportExport'
  | 'clientConnect'
  | 'onlineStore'
  | 'paymentPolicies'
  | 'paymentsOverview';

export type CompetitorFactSource = {
  id: FreshaSourceId;
  label: string;
  /** What this source supports on the page, shown next to the link. */
  supports: string;
  url: string;
};

/** Official Fresha sources backing published facts. */
export const FRESHA_SOURCES: readonly CompetitorFactSource[] = [
  {
    id: 'pricingUk',
    label: 'Fresha pricing (UK)',
    supports: 'UK plan prices, VAT, Marketplace fee, payment rates and add-ons',
    url: 'https://www.fresha.com/en-GB/pricing',
  },
  {
    id: 'marketplaceFee',
    label: 'Fresha Help Centre: Marketplace new client fees',
    supports: 'who counts as a Marketplace new client, returning clients and the fee cap',
    url: 'https://www.fresha.com/help-center/knowledge-base/billing-and-fees/101357-marketplace-new-client-fees',
  },
  {
    id: 'bookingLinks',
    label: 'Fresha Help Centre: Add a book button to your website',
    supports: 'direct booking links and website Book Now buttons',
    url: 'https://www.fresha.com/help-center/knowledge-base/online-presence/434-add-a-book-button-to-your-website',
  },
  {
    id: 'clientExport',
    label: 'Fresha Help Centre: Export your client list',
    supports: 'client list export formats',
    url: 'https://www.fresha.com/help-center/knowledge-base/clients/58-export-your-client-list',
  },
  {
    id: 'reportExport',
    label: 'Fresha Help Centre: Export reports',
    supports: 'report export formats',
    url: 'https://www.fresha.com/help-center/knowledge-base/reports/191-export-reports',
  },
  {
    id: 'clientConnect',
    label: 'Fresha Help Centre: How clients send you messages (Client Connect)',
    supports: 'two-way client messaging',
    url: 'https://www.fresha.com/help-center/knowledge-base/messaging/102352-how-clients-send-you-messages',
  },
  {
    id: 'onlineStore',
    label: 'Fresha Help Centre: Create and manage an online product store',
    supports: 'the online product store and its Fresha Payments requirement',
    url: 'https://www.fresha.com/help-center/knowledge-base/inventory/163-create-and-manage-an-online-product-store',
  },
  {
    id: 'paymentPolicies',
    label: 'Fresha Help Centre: Set up payment policies',
    supports: 'deposits, capture-card, late-cancellation and no-show policies',
    url: 'https://www.fresha.com/help-center/knowledge-base/payments/101660-set-up-payment-policies',
  },
  {
    id: 'paymentsOverview',
    label: 'Fresha Help Centre: Fresha Payments overview',
    supports: 'what Fresha Payments covers',
    url: 'https://www.fresha.com/help-center/knowledge-base/payments/199-fresha-payments-overview',
  },
];

export function getFreshaSource(id: FreshaSourceId): CompetitorFactSource {
  const source = FRESHA_SOURCES.find((entry) => entry.id === id);
  if (!source) throw new Error(`Unknown Fresha source: ${id}`);
  return source;
}

/** Fresha's UK pricing page states rates exclude this VAT rate. */
export const FRESHA_UK_VAT_PERCENT = 20;

/** Fresha pricing tooltip definition of a billable team member. */
export const FRESHA_BOOKABLE_TEAM_MEMBER_DEFINITION =
  'a team member with a calendar column that can take bookings';

/** Fresha lists Enterprise custom rates for businesses above this team size. */
export const FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS = 20;

export type UnresolvedCommercialFact = {
  status: 'unresolved';
  note: string;
};

export type VerifiedCommercialFact = {
  status: 'verified';
  /** Fixed GBP amount (subscription, per-transaction fixed fee, add-on price). */
  amountGbp?: number;
  /** Percentage rate, e.g. 20 for 20%. */
  percent?: number;
  /** Minimum GBP charge applied alongside `percent`. */
  minimumGbp?: number;
  vat: 'inclusive' | 'exclusive' | 'not-applicable';
  /** What the value is charged per, e.g. "month", "bookable team member per month". */
  per: string;
  sourceId: FreshaSourceId;
  checkedIso: string;
};

export type CommercialFact = UnresolvedCommercialFact | VerifiedCommercialFact;

const CHECKED = '2026-09-30';

/** Fresha UK commercial terms. Only `verified` entries may be rendered. */
export const FRESHA_UK_COMMERCIAL_FACTS = {
  independentPlan: {
    status: 'verified',
    amountGbp: 14.95,
    vat: 'exclusive',
    per: 'month (one bookable team member)',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  teamPlanPerMember: {
    status: 'verified',
    amountGbp: 9.95,
    vat: 'exclusive',
    per: 'bookable team member per month',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  directBookingLinks: {
    status: 'verified',
    amountGbp: 0,
    vat: 'not-applicable',
    per: 'booking',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  marketplaceNewClientFee: {
    status: 'verified',
    percent: 20,
    minimumGbp: 4,
    vat: 'exclusive',
    per: 'brand-new Marketplace client (one-time)',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  marketplaceReturningClients: {
    status: 'verified',
    amountGbp: 0,
    vat: 'not-applicable',
    per: 'returning client',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  onlinePayments: {
    status: 'verified',
    percent: 1.4,
    amountGbp: 0.25,
    vat: 'exclusive',
    per: 'transaction',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  inPersonPayments: {
    status: 'verified',
    percent: 1.19,
    amountGbp: 0.2,
    vat: 'exclusive',
    per: 'transaction',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  tapToPayAuthorisation: {
    status: 'verified',
    amountGbp: 0.07,
    vat: 'exclusive',
    per: 'Tap to Pay authorisation',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  smartWebsiteAddOn: {
    status: 'verified',
    amountGbp: 12.95,
    vat: 'exclusive',
    per: 'month',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  clientLoyaltyAddOn: {
    status: 'verified',
    amountGbp: 49.95,
    vat: 'exclusive',
    per: 'location per month',
    sourceId: 'pricingUk',
    checkedIso: CHECKED,
  },
  marketplaceFeeMaximumCap: {
    status: 'unresolved',
    note: 'Help Centre confirms a cap exists for higher-value services; the amount is not shown on the UK pricing page.',
  },
  cardCaptureFee: {
    status: 'unresolved',
    note: 'Help Centre confirms a fixed per-appointment fee for capture-card confirmations; the UK amount was not verified.',
  },
} as const satisfies Record<string, CommercialFact>;

export type FreshaCommercialFactKey = keyof typeof FRESHA_UK_COMMERCIAL_FACTS;

export function isVerifiedCommercialFact(fact: CommercialFact): fact is VerifiedCommercialFact {
  return fact.status === 'verified';
}

/** Throws at build time if a component tries to render an unresolved Fresha value. */
export function requireVerifiedFreshaFact(key: FreshaCommercialFactKey): VerifiedCommercialFact {
  const fact: CommercialFact = FRESHA_UK_COMMERCIAL_FACTS[key];
  if (!isVerifiedCommercialFact(fact)) {
    throw new Error(`Fresha fact "${key}" is unresolved and must not be rendered.`);
  }
  return fact;
}

function roundPence(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatGbp(value: number): string {
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2)}%`;
}

export function addFreshaUkVat(amountGbp: number): number {
  return roundPence(amountGbp * (1 + FRESHA_UK_VAT_PERCENT / 100));
}

export type FreshaSubscriptionEstimate = {
  bookableTeamMembers: number;
  plan: 'Independent' | 'Team';
  exVatGbp: number;
  incVatGbp: number;
};

/**
 * Monthly Fresha subscription only (no add-ons, fees or processing).
 * Uses the Independent plan for one person, as Fresha positions it for one-person businesses.
 */
export function estimateFreshaMonthlySubscription(
  bookableTeamMembers: number,
): FreshaSubscriptionEstimate {
  if (!Number.isInteger(bookableTeamMembers) || bookableTeamMembers < 1) {
    throw new Error('bookableTeamMembers must be a positive integer');
  }
  if (bookableTeamMembers > FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS) {
    throw new Error('Fresha lists custom Enterprise rates above 20 team members');
  }

  const independent = requireVerifiedFreshaFact('independentPlan');
  const team = requireVerifiedFreshaFact('teamPlanPerMember');
  const isSolo = bookableTeamMembers === 1;
  const exVatGbp = roundPence(
    isSolo ? independent.amountGbp! : team.amountGbp! * bookableTeamMembers,
  );

  return {
    bookableTeamMembers,
    plan: isSolo ? 'Independent' : 'Team',
    exVatGbp,
    incVatGbp: addFreshaUkVat(exVatGbp),
  };
}

/** One-time Marketplace new-client fee on a first appointment value, before any cap. */
export function estimateFreshaMarketplaceNewClientFee(firstAppointmentGbp: number): number {
  const fee = requireVerifiedFreshaFact('marketplaceNewClientFee');
  return roundPence(Math.max((firstAppointmentGbp * fee.percent!) / 100, fee.minimumGbp!));
}

export const FRESHA_TRADEMARK_DISCLAIMER =
  'Fresha is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Fresha.';

export const FRESHA_COMPARISON_FOOTNOTE = `Fresha feature descriptions are based on Fresha’s public website and Help Centre, checked on ${FRESHA_FACTS_CHECKED_DATE}. Features and pricing can change, so check Fresha directly for the latest details.`;

export type FreshaCompareSectionId =
  | 'bookings'
  | 'payments'
  | 'brand'
  | 'retail'
  | 'clients'
  | 'reports';

export type FreshaCompareSection = {
  id: FreshaCompareSectionId;
  title: string;
  subtitle: string;
  freshaLead: string;
  freshaPoints: readonly string[];
  /** Official sources backing the Fresha lead and points in this section. */
  freshaSourceIds: readonly FreshaSourceId[];
  kersivoLead: string;
  kersivoPoints: readonly string[];
};

export const FRESHA_COMPARE_SECTIONS: readonly FreshaCompareSection[] = [
  {
    id: 'bookings',
    title: 'Bookings',
    subtitle: 'Compare the client booking journey and day-to-day scheduling.',
    freshaLead: 'Online booking through Fresha booking links, social channels and the Fresha Marketplace.',
    freshaPoints: [
      'Direct booking links, a website Book Now button and Fresha Marketplace',
      'Calendar, appointment scheduling and waitlists',
      'Deposits, upfront payments and no-show policies',
      'Automated booking notifications and reminders',
    ],
    freshaSourceIds: ['pricingUk', 'bookingLinks', 'paymentPolicies'],
    kersivoLead: 'A branded booking journey built around your own barbershop.',
    kersivoPoints: [
      'Hosted booking page on Starter; branded booking website on your own domain with Full',
      'Services, barbers and availability inside your own flow',
      'Deposits and payment steps built into the booking journey',
      'Bookings managed from one owner dashboard',
    ],
  },
  {
    id: 'payments',
    title: 'Payments & Deposits',
    subtitle: 'How each platform protects bookings and handles payment steps.',
    freshaLead: 'Payments, deposits and no-show protection through Fresha Payments.',
    freshaPoints: [
      'Fresha Payments supports deposits and upfront payments',
      'Capture-card policies with late-cancellation and no-show fees',
      'Online and in-person payment options',
      'Payment activity connected to Fresha reporting',
    ],
    freshaSourceIds: ['paymentsOverview', 'paymentPolicies', 'pricingUk'],
    kersivoLead: 'Payment protection inside your own branded booking journey.',
    kersivoPoints: [
      'Optional booking deposits for online appointments',
      'Deposit status visible in the KERSIVO admin',
      'Client payment steps stay connected to your booking flow',
      '0% KERSIVO commission on booking payments, on Starter and Full',
    ],
  },
  {
    id: 'brand',
    title: 'Brand & Domain',
    subtitle: 'Where the client journey lives and whose brand stays in front.',
    freshaLead: 'Fresha combines direct booking links with its Marketplace.',
    freshaPoints: [
      'Booking links can be shared on your website, social media and QR codes',
      'Booking links open your Fresha booking page without showing other businesses',
      'Marketplace listing helps new clients discover your business',
      'Fresha booking links require your Marketplace profile to be listed',
    ],
    freshaSourceIds: ['bookingLinks', 'marketplaceFee'],
    kersivoLead: 'Your booking journey stays under your own shop identity.',
    kersivoPoints: [
      'Full KERSIVO: your own branded website on your own domain',
      'Starter: a hosted KERSIVO booking page with your services and team',
      'Your logo, services and shop identity throughout the journey',
      'No marketplace dependency required to take bookings',
      'A direct client relationship built around your business',
    ],
  },
  {
    id: 'retail',
    title: 'Retail & Upsells',
    subtitle: 'How products and post-booking sales fit into the customer journey.',
    freshaLead: 'Retail, inventory and online product sales inside Fresha.',
    freshaPoints: [
      'Online product store with shipping, in-store pickup or both',
      'Inventory updates and order tracking in the Fresha workspace',
      'Point of sale and retail inventory tools',
      'The online product store requires Fresha Payments to be enabled',
    ],
    freshaSourceIds: ['onlineStore', 'pricingUk'],
    kersivoLead: 'Retail pickup built into your own barbershop website with Full KERSIVO.',
    kersivoPoints: [
      'Retail is included in Full KERSIVO, not Starter',
      'Products sold from your own branded website',
      'Pickup orders managed from the KERSIVO admin',
      'Product recommendations can appear after a booking',
      '0% KERSIVO commission on Full retail sales',
    ],
  },
  {
    id: 'clients',
    title: 'Clients & Communication',
    subtitle: 'CRM, reminders and the relationship after the appointment.',
    freshaLead: 'Client management and messaging inside the Fresha platform.',
    freshaPoints: [
      'Client management and consultation forms',
      'Automated email, text message and WhatsApp notifications',
      'Client Connect two-way messaging with clients who have booked',
      'Client Loyalty available as a paid add-on',
    ],
    freshaSourceIds: ['pricingUk', 'clientConnect'],
    kersivoLead: 'Client records connected directly to your own booking operation.',
    kersivoPoints: [
      'Clients Core on Starter: contact details, recent visits and upcoming bookings',
      'Advanced Clients on Full: full history, internal notes and operational context',
      'Email reminders on both plans; SMS reminders on Full, subject to allowance',
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Admin',
    subtitle: 'The owner view behind bookings, clients, team and performance.',
    freshaLead: 'Reporting and team tools across the Fresha workspace.',
    freshaPoints: [
      'Reports exportable as PDF, CSV or XLSX',
      'Team member profiles and shift scheduling',
      'Business mobile app for running the workspace',
      'Insights reporting available as a paid add-on',
    ],
    freshaSourceIds: ['reportExport', 'pricingUk'],
    kersivoLead: 'A focused owner dashboard built specifically for independent barbershops.',
    kersivoPoints: [
      'Bookings, team, clients and services on both plans',
      'Reports, products and orders with Full KERSIVO',
      'Daily operational view from one dashboard',
      'Built around the workflow of an independent barbershop',
    ],
  },
];
