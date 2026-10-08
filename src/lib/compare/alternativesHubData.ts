/**
 * Typed comparison registry for the /compare Alternatives Hub.
 *
 * Source URLs, verification dates and prices are imported from the existing
 * competitor facts modules — never copied. Every status other than
 * 'unverified' must cite a sourceId present in that platform's sources.
 * Absence of evidence is 'unverified', never 'no'.
 */
import { HUB_CRITERION_IDS, type HubCriterionId } from '@/lib/compare/alternativesHubCriteria';
import { DATA_EXPORT_RETENTION_CLAIM, SMS_INCLUDED_WITH_ALLOWANCE_CLAIM } from '@/lib/pricing/claimsPolicy';
import { BOOKSY_ADDITIONAL_USER_GBP, BOOKSY_BASE_PRICE_GBP, BOOKSY_FACTS_CHECKED_ISO, BOOKSY_SOURCES } from '@/lib/seo/booksyFacts';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { FRESHA_FACTS_CHECKED_ISO, FRESHA_SOURCES, formatGbp, requireVerifiedFreshaFact } from '@/lib/seo/freshaFacts';
import { NEARCUT_FACTS_CHECKED_ISO, NEARCUT_SOURCES, requireVerifiedNearcutFact } from '@/lib/seo/nearcutFacts';
import { PHOREST_FACTS_CHECKED_ISO, PHOREST_SOURCES } from '@/lib/seo/phorestFacts';
import { PRICING_PAGE_LAST_UPDATED_ISO, PRICING_PAGE_PATH } from '@/lib/seo/pricingPage';
import { SETORA_FACTS_CHECKED_ISO, SETORA_SOURCES, requireVerifiedSetoraFact } from '@/lib/seo/setoraFacts';
import { SQUARE_FACTS_CHECKED_ISO, SQUARE_SOURCES, squareBaseMonthlyPriceGbp } from '@/lib/seo/squareFacts';
import { SQUIRE_FACTS_CHECKED_ISO, SQUIRE_OFFICIAL_SOURCES } from '@/lib/seo/squireFacts';
import { TIMELY_FACTS_CHECKED_ISO, TIMELY_SOURCES } from '@/lib/seo/timelyFacts';
import { TREATWELL_FACTS_CHECKED_ISO, TREATWELL_SOURCES } from '@/lib/seo/treatwellFacts';
import { VAGARO_FACTS_CHECKED_ISO, VAGARO_SOURCES, requireVerifiedVagaroFact } from '@/lib/seo/vagaroFacts';

export type HubStatus = 'yes' | 'limited' | 'no' | 'unverified';

export const HUB_STATUS_LABELS: Record<HubStatus, string> = {
  yes: 'Yes',
  limited: 'Partial',
  no: 'No',
  unverified: 'Not verified',
};

export type HubAttribute = {
  status: HubStatus;
  /** Plain-English evidence summary shown on hover / to screen readers. */
  note: string;
  sourceId?: string;
};

export type HubSource = { id: string; label: string; url: string };

export type HubPlatformId =
  | 'kersivo'
  | 'booksy'
  | 'fresha'
  | 'nearcut'
  | 'treatwell'
  | 'timely'
  | 'phorest'
  | 'setora'
  | 'square'
  | 'squire'
  | 'vagaro';

export type HubPlatform = {
  id: HubPlatformId;
  name: string;
  href: string;
  ctaLabel: string;
  isFirstParty: boolean;
  tagline: string;
  description: string;
  /** Verified pricing or pricing-model summary; null when nothing verified can be shown. */
  pricingSummary: string | null;
  checkedIso: string;
  sources: readonly HubSource[];
  attributes: Record<HubCriterionId, HubAttribute>;
};

type SourceLike = { id?: string; label: string; url: string };

function toHubSources(list: readonly SourceLike[], fallbackIds: readonly string[] = []): HubSource[] {
  return list.map((s, i) => ({ id: s.id ?? fallbackIds[i] ?? `source-${i + 1}`, label: s.label, url: s.url }));
}

const yes = (note: string, sourceId: string): HubAttribute => ({ status: 'yes', note, sourceId });
const limited = (note: string, sourceId: string): HubAttribute => ({ status: 'limited', note, sourceId });
const no = (note: string, sourceId: string): HubAttribute => ({ status: 'no', note, sourceId });
const unverified = (note = 'Not established from the official sources we checked.'): HubAttribute => ({
  status: 'unverified',
  note,
});

/** Square sources have no ids in squareFacts; these are assigned by position. */
const SQUARE_SOURCE_IDS = [
  'pricing',
  'overview',
  'deposits',
  'cancellations',
  'customerExport',
  'fees',
  'barbershop',
  'bookingSite',
  'reports',
] as const;

const KERSIVO_SOURCES: readonly HubSource[] = [
  { id: 'pricing', label: 'KERSIVO pricing: Starter and Full KERSIVO', url: PRICING_PAGE_PATH },
  { id: 'starter', label: 'KERSIVO Starter', url: '/starter' },
];

const SAAS_PRICE = formatGbp(SAAS_MONTHLY_GBP);

export const KERSIVO_HUB_PLATFORM: HubPlatform = {
  id: 'kersivo',
  name: 'KERSIVO',
  href: PRICING_PAGE_PATH,
  ctaLabel: 'Explore KERSIVO',
  isFirstParty: true,
  tagline: 'Own your brand. Own your bookings.',
  description:
    'Booking, clients and your complete branded website in one platform built for independent UK barbershops.',
  pricingSummary: `Full KERSIVO ${SAAS_PRICE}/month per location. No VAT added.`,
  checkedIso: PRICING_PAGE_LAST_UPDATED_ISO,
  sources: KERSIVO_SOURCES,
  attributes: {
    zeroCommission: yes('0% KERSIVO commission. Standard Stripe processing fees apply separately.', 'pricing'),
    ownDomain: yes('Full KERSIVO includes your own branded website and one standard domain per location.', 'pricing'),
    clientDataExport: yes(`${DATA_EXPORT_RETENTION_CLAIM} This export is requested through support, not downloaded from a self-service dashboard.`, 'pricing'),
    builtForBarbers: yes('Built specifically for independent UK barbershops.', 'pricing'),
    biggerTeams: yes('Full KERSIVO supports more than 4 bookable barbers per location, subject to fair use.', 'pricing'),
    deposits: yes('£5 deposit or Pay in full; Full KERSIVO adds editable payment controls.', 'pricing'),
    retail: yes('Full KERSIVO includes a retail pickup shop for products paid online.', 'pricing'),
    migration: yes('Full KERSIVO includes migration assistance from your current booking system.', 'pricing'),
    brandedBooking: yes(
      'Bookings on your own branded barbershop website (with a subtle “Powered by KERSIVO” mark).',
      'pricing',
    ),
    smsReminders: yes(SMS_INCLUDED_WITH_ALLOWANCE_CLAIM, 'pricing'),
    ukSupport: yes('Built and priced in GBP for UK barbershops.', 'pricing'),
    affordable: yes(`${SAAS_PRICE}/month per location; KERSIVO is not VAT registered, so no VAT is added.`, 'pricing'),
  },
};

const freshaIndependent = requireVerifiedFreshaFact('independentPlan').amountGbp!;
const nearcutFree = requireVerifiedNearcutFact('freeForYouMonthlySubscription').amountGbp ?? 0;
const setoraMonthly = requireVerifiedSetoraFact('canonicalMonthlyGbp').value as number;
const vagaroDisplayed = requireVerifiedVagaroFact('oneCalendarDisplayedMonthlyGbp').value;
const squareFree = squareBaseMonthlyPriceGbp('free');
const squarePlus = squareBaseMonthlyPriceGbp('plus');
const squarePremium = squareBaseMonthlyPriceGbp('premium');

export const COMPETITOR_HUB_PLATFORMS: readonly HubPlatform[] = [
  {
    id: 'booksy',
    name: 'Booksy',
    href: '/booksy-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'Booking app with a large consumer marketplace.',
    description: 'Booking software combined with the Booksy Marketplace, customer app and optional Boost promotion.',
    pricingSummary: `From ${formatGbp(BOOKSY_BASE_PRICE_GBP)}/month + VAT, plus ${formatGbp(BOOKSY_ADDITIONAL_USER_GBP)} per additional user.`,
    checkedIso: BOOKSY_FACTS_CHECKED_ISO,
    sources: toHubSources(BOOKSY_SOURCES),
    attributes: {
      zeroCommission: limited('Standard Marketplace bookings are free; optional Boost charges a one-time new-client fee.', 'boost'),
      ownDomain: limited('Booking widget for an existing website; own-domain website not stated.', 'websiteWidget'),
      clientDataExport: limited('Client list is requested from Booksy Support; format and fields not stated.', 'clientList'),
      builtForBarbers: unverified(),
      biggerTeams: yes('Additional users can be added for a monthly fee per user.', 'pricingUk'),
      deposits: yes('Deposits and cancellation fees via Booksy Mobile Payments.', 'noShowProtection'),
      retail: yes('Add-ons can be offered during online booking.', 'onlineBooking'),
      migration: unverified(),
      brandedBooking: limited('Booksy Profile and widget; the journey sits within the Booksy platform.', 'onlineBooking'),
      smsReminders: limited('Appointment reminders are included; the SMS channel is not confirmed for reminders.', 'pricingUk'),
      ukSupport: yes('UK pricing and payment rates are published.', 'pricingUk'),
      affordable: yes(`Base subscription ${formatGbp(BOOKSY_BASE_PRICE_GBP)}/month before VAT.`, 'pricingUk'),
    },
  },
  {
    id: 'fresha',
    name: 'Fresha',
    href: '/fresha-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'Booking platform with a large consumer marketplace.',
    description: 'Salon and barber booking software with the Fresha Marketplace, Fresha Payments and paid add-ons.',
    pricingSummary: `From ${formatGbp(freshaIndependent)}/month + VAT for one team member.`,
    checkedIso: FRESHA_FACTS_CHECKED_ISO ?? '',
    sources: toHubSources(FRESHA_SOURCES),
    attributes: {
      zeroCommission: limited('Direct bookings are free; a new-client fee applies to eligible Marketplace bookings.', 'marketplaceFee'),
      ownDomain: limited('Smart website is a paid add-on; own-domain inclusion not stated.', 'pricingUk'),
      clientDataExport: yes('Documented client list export formats.', 'clientExport'),
      builtForBarbers: unverified(),
      biggerTeams: yes('Team plan priced per bookable team member.', 'pricingUk'),
      deposits: yes('Deposit and payment policies via Fresha Payments.', 'paymentPolicies'),
      retail: yes('Online product store with shipping or in-store pickup (requires Fresha Payments).', 'onlineStore'),
      migration: unverified(),
      brandedBooking: limited('Direct booking links; they require a listed Marketplace profile.', 'bookingLinks'),
      smsReminders: limited('Text notifications are documented; inclusion in the plan price was not assessed.', 'clientConnect'),
      ukSupport: yes('UK plan prices and payment rates are published.', 'pricingUk'),
      affordable: yes(`Independent plan ${formatGbp(freshaIndependent)}/month before VAT.`, 'pricingUk'),
    },
  },
  {
    id: 'nearcut',
    name: 'Nearcut',
    href: '/nearcut-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'Barber-focused online booking service.',
    description: 'Barber booking with a free plan funded by client booking charges, or a quoted subscription.',
    pricingSummary: `Free for You ${formatGbp(nearcutFree)}/month (client booking charge applies); Subscription by quote.`,
    checkedIso: NEARCUT_FACTS_CHECKED_ISO,
    sources: toHubSources(NEARCUT_SOURCES),
    attributes: {
      zeroCommission: limited('0% commission on service price, but Free for You adds a client-paid booking charge.', 'pricingUk'),
      ownDomain: limited('Personalised booking website; Subscription offers a custom website. Domain not stated.', 'pricingUk'),
      clientDataExport: unverified(),
      builtForBarbers: yes('A barber-focused online booking service.', 'pricingUk'),
      biggerTeams: limited('Staff schedules supported; Subscription priced by barber count on quote.', 'pricingUk'),
      deposits: yes('Optional online deposits and payments.', 'onlinePayments'),
      retail: limited('Product sales available as an optional booster.', 'pricingUk'),
      migration: unverified(),
      brandedBooking: yes('Personalised booking website included in its plans.', 'pricingUk'),
      smsReminders: yes('SMS reminders for online bookings on Free for You.', 'pricingUk'),
      ukSupport: yes('UK (en-GB) pricing is published.', 'pricingUk'),
      affordable: yes(`Free for You is ${formatGbp(nearcutFree)}/month; clients pay a booking charge.`, 'pricingUk'),
    },
  },
  {
    id: 'treatwell',
    name: 'Treatwell',
    href: '/treatwell-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'Hair and beauty marketplace with salon software.',
    description: 'Marketplace visibility plus Treatwell Connect software; commission applies to eligible new marketplace clients.',
    pricingSummary: 'Commission on eligible new marketplace clients; no universal monthly price published.',
    checkedIso: TREATWELL_FACTS_CHECKED_ISO,
    sources: toHubSources(TREATWELL_SOURCES),
    attributes: {
      zeroCommission: limited('0% on repeat and direct bookings; commission on eligible new marketplace clients.', 'pricingUk'),
      ownDomain: limited('Booking widgets for an existing website; own-domain website not stated.', 'salonSoftware'),
      clientDataExport: unverified(),
      builtForBarbers: limited('Hair and beauty software that includes men’s grooming.', 'salonSoftware'),
      biggerTeams: yes('Team management and staff calendars.', 'salonSoftware'),
      deposits: limited('Online prepayment is documented; deposits are not named explicitly.', 'paymentSolutions'),
      retail: yes('POS and product sales capabilities.', 'salonSoftware'),
      migration: unverified(),
      brandedBooking: limited('Widgets and a marketplace listing rather than a bespoke shop site.', 'salonSoftware'),
      smsReminders: limited('Reminders are documented; the SMS channel is not confirmed.', 'salonSoftware'),
      ukSupport: yes('UK pricing and payment terms are published.', 'pricingUk'),
      affordable: unverified('No universal monthly subscription price is published.'),
    },
  },
  {
    id: 'timely',
    name: 'Timely',
    href: '/timely-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'Salon, beauty and wellness software.',
    description: 'Feature-rich appointment software billed per staff member, with TimelyPay payments.',
    pricingSummary: 'Billed per staff member; UK GBP price not published.',
    checkedIso: TIMELY_FACTS_CHECKED_ISO,
    sources: toHubSources(TIMELY_SOURCES),
    attributes: {
      zeroCommission: yes('Timely states no new-client fees; card processing is charged separately.', 'pricing'),
      ownDomain: limited('Mini website available; website scope and domain terms not confirmed.', 'pricing'),
      clientDataExport: limited('Data export is requested via Timely support.', 'exports'),
      builtForBarbers: limited('Designed for salon, beauty and wellness businesses.', 'plans'),
      biggerTeams: yes('Staff-seat subscription model with team tools.', 'plans'),
      deposits: yes('TimelyPay supports deposits in supported markets.', 'pricing'),
      retail: yes('Stock-level management is advertised.', 'pricing'),
      migration: unverified(),
      brandedBooking: limited('Branded booking options alongside a mini website.', 'pricing'),
      smsReminders: limited('Messaging availability varies by plan; SMS overage rates apply.', 'plans'),
      ukSupport: limited('UK TimelyPay rates are published; UK GBP plan prices are not.', 'ukPayments'),
      affordable: unverified('Public prices are in USD; a UK GBP price is not published.'),
    },
  },
  {
    id: 'phorest',
    name: 'Phorest',
    href: '/phorest-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'Established salon management platform.',
    description: 'Salon software with CRM, marketing, POS and retail, sold through personalised quotes.',
    pricingSummary: 'Personalised quote; no universal UK monthly price published.',
    checkedIso: PHOREST_FACTS_CHECKED_ISO,
    sources: toHubSources(PHOREST_SOURCES),
    attributes: {
      zeroCommission: unverified('Booking commission is not stated; payment fees vary by commercial terms.'),
      ownDomain: limited('Website booking supported; website and domain arrangements are confirmed in the quote.', 'booking'),
      clientDataExport: limited('Client export methods documented, with exclusions and an export-charge caveat.', 'dataExport'),
      builtForBarbers: limited('A salon platform that also serves barbershops.', 'features'),
      biggerTeams: yes('Unlimited staff on its plans.', 'pricing'),
      deposits: yes('Custom deposit amounts and booking rules.', 'booking'),
      retail: yes('POS, stock and retail tools.', 'features'),
      migration: unverified(),
      brandedBooking: limited('Branded booking app on higher plans.', 'pricing'),
      smsReminders: limited('SMS reminders charged at published per-message rates.', 'pricing'),
      ukSupport: yes('UK (/gb/) pricing and features pages.', 'pricing'),
      affordable: unverified('Pricing is by personalised quote.'),
    },
  },
  {
    id: 'setora',
    name: 'Setora',
    href: '/setora-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'UK booking software for shops and salons.',
    description: 'One published subscription per location with unlimited staff and direct booking.',
    pricingSummary: `${formatGbp(setoraMonthly)}/month per location, unlimited staff.`,
    checkedIso: SETORA_FACTS_CHECKED_ISO,
    sources: toHubSources(SETORA_SOURCES),
    attributes: {
      zeroCommission: yes('0% booking commission and no added customer booking charge; Stripe fees separate.', 'pricing'),
      ownDomain: limited('Assisted custom domains; whether the domain itself is included is not established.', 'websites'),
      clientDataExport: yes('Customer CSV export.', 'help'),
      builtForBarbers: limited('Barbershop-specific tools within software for shops and salons.', 'barbers'),
      biggerTeams: yes('Unlimited staff with no per-staff fees.', 'pricing'),
      deposits: yes('Optional deposits and online payments via Stripe.', 'help'),
      retail: unverified(),
      migration: limited('Supported CSV/Excel imports with mapping review.', 'help'),
      brandedBooking: yes('Shop Website and Booking Page for your shop.', 'websites'),
      smsReminders: limited('Automated reminders; SMS credits are charged separately.', 'pricing'),
      ukSupport: yes('UK pricing on setora.co.uk.', 'pricing'),
      affordable: no(`${formatGbp(setoraMonthly)}/month per location, above the £40 threshold.`, 'pricing'),
    },
  },
  {
    id: 'square',
    name: 'Square Appointments',
    href: '/square-appointments-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'Appointments within the Square payments ecosystem.',
    description: 'Scheduling with Square payments, point of sale and hardware, from a free single-location plan.',
    pricingSummary: `Free ${formatGbp(squareFree)}; Plus ${formatGbp(squarePlus)} and Premium ${formatGbp(squarePremium)} per location/month.`,
    checkedIso: SQUARE_FACTS_CHECKED_ISO,
    sources: toHubSources(SQUARE_SOURCES, SQUARE_SOURCE_IDS),
    attributes: {
      zeroCommission: unverified('A booking commission is not stated; card processing fees apply.'),
      ownDomain: limited('Free Square Online website option; own-domain inclusion not stated.', 'bookingSite'),
      clientDataExport: yes('Customer Directory CSV export.', 'customerExport'),
      builtForBarbers: limited('General business platform with a dedicated barbershop solution.', 'barbershop'),
      biggerTeams: yes('Unlimited staff calendars on all plans.', 'pricing'),
      deposits: yes('Fixed or percentage deposits on all plans.', 'deposits'),
      retail: yes('Square point of sale for product sales.', 'overview'),
      migration: unverified(),
      brandedBooking: limited('Customisable Square booking site.', 'bookingSite'),
      smsReminders: yes('Automated email and text reminders on the Free plan.', 'overview'),
      ukSupport: yes('UK pricing and fee schedule published.', 'pricing'),
      affordable: yes(`Free plan ${formatGbp(squareFree)}/month for a single location.`, 'pricing'),
    },
  },
  {
    id: 'squire',
    name: 'SQUIRE',
    href: '/squire-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'Barbershop management platform.',
    description: 'Barbershop booking, payments and POS; UK GBP pricing is not publicly verified.',
    pricingSummary: null,
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
    sources: toHubSources(SQUIRE_OFFICIAL_SOURCES),
    attributes: {
      zeroCommission: unverified('Platform or booking fees for UK shops are not established; do not assume zero.'),
      ownDomain: limited('Optional branded landing page add-on on higher plans; domain not stated.', 'pricing'),
      clientDataExport: limited('Client transfer listed on the Pro plan; export format not stated.', 'pricing'),
      builtForBarbers: yes('Built for barbers and barbershops.', 'pricing'),
      biggerTeams: yes('Multiple barber accounts and multi-location plans.', 'pricing'),
      deposits: limited('Online payments, pre-payments and no-show protection; deposits not named explicitly.', 'payments'),
      retail: yes('In-shop POS, with inventory on higher plans.', 'pricing'),
      migration: unverified(),
      brandedBooking: limited('Branded app and landing page on higher plans or as add-ons.', 'pricing'),
      smsReminders: yes('Automated email and SMS reminders listed in plan features.', 'pricing'),
      ukSupport: yes('UK service entity and live UK barbershop listings.', 'ukEntity'),
      affordable: unverified('Public prices are in USD; a UK GBP price is not verified.'),
    },
  },
  {
    id: 'vagaro',
    name: 'Vagaro',
    href: '/vagaro-alternative',
    ctaLabel: 'View comparison',
    isFirstParty: false,
    tagline: 'Beauty, wellness and fitness booking platform.',
    description: 'Booking software priced per bookable calendar, with marketplace and promotional booking programmes.',
    pricingSummary: `${formatGbp(vagaroDisplayed)}/month displayed for one calendar (discounted; VAT unresolved).`,
    checkedIso: VAGARO_FACTS_CHECKED_ISO,
    sources: toHubSources(VAGARO_SOURCES),
    attributes: {
      zeroCommission: limited('Acquisition fee on qualifying new clients from marketplace channels; optional Fill My Books fees.', 'ukParticipation'),
      ownDomain: limited('MySite website builder is a paid add-on; domain not stated.', 'ukPlansHelp'),
      clientDataExport: yes('Customer list export as Excel or PDF.', 'customerExport'),
      builtForBarbers: limited('A broad beauty, wellness and fitness platform.', 'ukHome'),
      biggerTeams: yes('Additional bookable calendars; published price for seven or more.', 'ukHome'),
      deposits: unverified(),
      retail: yes('Inventory and retail features are included.', 'ukPlansHelp'),
      migration: unverified(),
      brandedBooking: limited('Booking widgets for your own website.', 'pricingUk'),
      smsReminders: limited('Automated reminders; SMS terms vary.', 'ukPlansHelp'),
      ukSupport: yes('UK pricing and card rates are published.', 'pricingUk'),
      affordable: limited(`${formatGbp(vagaroDisplayed)}/month is a displayed discount price; VAT basis unresolved.`, 'pricingUk'),
    },
  },
];

/** KERSIVO first, then competitors in default registry order. */
export const HUB_PLATFORMS: readonly HubPlatform[] = [KERSIVO_HUB_PLATFORM, ...COMPETITOR_HUB_PLATFORMS];

/** Number of cards visible before "Show all systems" is used. */
export const HUB_INITIAL_VISIBLE_CARDS = 6;

export function getHubPlatform(id: HubPlatformId): HubPlatform {
  const platform = HUB_PLATFORMS.find((p) => p.id === id);
  if (!platform) throw new Error(`Unknown hub platform: ${id}`);
  return platform;
}

/** Scoring inputs in registry order (KERSIVO first). */
export function buildHubScoreInputs(): {
  id: HubPlatformId;
  name: string;
  isFirstParty: boolean;
  order: number;
  statuses: Record<HubCriterionId, HubStatus>;
}[] {
  const matrix = buildHubStatusMatrix();
  return HUB_PLATFORMS.map((p, order) => ({
    id: p.id,
    name: p.name,
    isFirstParty: p.isFirstParty,
    order,
    statuses: matrix[p.id],
  }));
}

/** Compact status map for the client script (serialised into the page). */
export function buildHubStatusMatrix(): Record<string, Record<HubCriterionId, HubStatus>> {
  return Object.fromEntries(
    HUB_PLATFORMS.map((p) => [
      p.id,
      Object.fromEntries(HUB_CRITERION_IDS.map((c) => [c, p.attributes[c].status])) as Record<HubCriterionId, HubStatus>,
    ]),
  );
}
