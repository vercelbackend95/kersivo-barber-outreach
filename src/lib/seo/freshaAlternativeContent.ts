import type { ModelComparisonItem } from '@/lib/editorial/insightIcons';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  FRESHA_BOOKABLE_TEAM_MEMBER_DEFINITION,
  FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS,
  FRESHA_FACTS_CHECKED_DATE,
  FRESHA_UK_VAT_PERCENT,
  type FreshaSourceId,
  estimateFreshaMarketplaceNewClientFee,
  estimateFreshaMonthlySubscription,
  formatGbp,
  formatPercent,
  requireVerifiedFreshaFact,
} from '@/lib/seo/freshaFacts';

/**
 * Visible copy for the /fresha-alternative content sections.
 * Every Fresha figure is interpolated from verified facts in freshaFacts.ts.
 */

const independent = requireVerifiedFreshaFact('independentPlan');
const teamPlan = requireVerifiedFreshaFact('teamPlanPerMember');
const marketplaceFee = requireVerifiedFreshaFact('marketplaceNewClientFee');
const onlinePayments = requireVerifiedFreshaFact('onlinePayments');
const inPersonPayments = requireVerifiedFreshaFact('inPersonPayments');
const tapToPay = requireVerifiedFreshaFact('tapToPayAuthorisation');
const smartWebsite = requireVerifiedFreshaFact('smartWebsiteAddOn');
const clientLoyalty = requireVerifiedFreshaFact('clientLoyaltyAddOn');

const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
const STARTER_PRICE = formatGbp(0);
const STARTER_MAX_BARBERS = 4;
const STARTER_DEPOSIT_PRICE = formatGbp(KERSIVO_BOOKING_DEPOSIT_GBP);
const INDEPENDENT_PRICE = formatGbp(independent.amountGbp!);
const TEAM_PRICE = formatGbp(teamPlan.amountGbp!);
const MARKETPLACE_PERCENT = formatPercent(marketplaceFee.percent!);
const MARKETPLACE_MINIMUM = formatGbp(marketplaceFee.minimumGbp!);
const VAT = `${FRESHA_UK_VAT_PERCENT}% VAT`;

/** The four acts the page is told in. Ids match the section ids on the page. */
export type FreshaJourneyAct = { id: string; numeral: string; label: string };

export const FRESHA_JOURNEY_ACTS: readonly FreshaJourneyAct[] = [
  { id: 'why-switch', numeral: 'I', label: 'Why barbers switch' },
  { id: 'costs', numeral: 'II', label: 'The real bill' },
  { id: 'life-on-kersivo', numeral: 'III', label: 'Life on KERSIVO' },
  { id: 'switching', numeral: 'IV', label: 'The switch' },
];

export const FRESHA_HERO_EYEBROW = 'Fresha alternative for UK barbershops';

export const FRESHA_HERO_TITLE_LINES = [
  'The Fresha alternative',
  'for barbershops that want',
  'to own the booking',
] as const;

export const FRESHA_HERO_LEAD = `You built the chairs, the regulars and the name over the door. KERSIVO puts that name on the booking too: your own website and domain with Full KERSIVO at ${KERSIVO_PRICE}/month per location, however many barbers take bookings. Or start on Starter for ${STARTER_PRICE}/month.`;

export const FRESHA_HERO_FACTS: readonly string[] = [
  `Starter ${STARTER_PRICE}/month`,
  `Full ${KERSIVO_PRICE}/month per location`,
  '0% KERSIVO commission (Stripe fees apply)',
  'No setup fee',
];

export const FRESHA_VERDICT_KICKER = 'The 30-second answer';

export const FRESHA_VERDICT_TITLE = 'Should you switch from Fresha to KERSIVO?';

export const FRESHA_VERDICT_LEAD = `Switch to KERSIVO if your clients already find you through Google, Instagram, word of mouth or walk-ins, and you want them booking on your own barbershop’s page instead of inside a marketplace. Stay with Fresha if its Marketplace brings you a steady stream of brand-new clients you would not reach any other way. KERSIVO Starter is ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} barbers. Full KERSIVO is ${KERSIVO_PRICE}/month per location and adds your own website and domain. KERSIVO takes 0% commission on booking payments; Stripe processing fees still apply.`;

export const FRESHA_VERDICT_DETAIL = `Fresha follows a different model: business software priced per bookable team member (${INDEPENDENT_PRICE} a month for one person, or ${TEAM_PRICE} per team member on its Team plan, plus VAT), alongside the Fresha Marketplace, which charges a one-time fee for brand-new clients it introduces.`;

export const FRESHA_VERDICT = `${FRESHA_VERDICT_LEAD} ${FRESHA_VERDICT_DETAIL}`;

export const FRESHA_VERDICT_FACTS: readonly { label: string; value: string }[] = [
  { label: 'KERSIVO Starter', value: `${STARTER_PRICE}/month, up to ${STARTER_MAX_BARBERS} barbers` },
  { label: 'Full KERSIVO', value: `${KERSIVO_PRICE}/month per location` },
  { label: 'KERSIVO commission', value: '0% on booking payments, Stripe fees apply' },
  { label: 'Fresha', value: 'Per bookable team member, plus Marketplace fees' },
];

export const FRESHA_VERDICT_FIT: readonly { label: string; tone: 'kersivo' | 'fresha'; points: readonly string[] }[] = [
  {
    label: 'KERSIVO is the better fit for',
    tone: 'kersivo',
    points: [
      'Established independent shops with a local name and regulars',
      'Growing teams, where per-barber pricing adds up as chairs fill',
      'Owners who want their own website and domain (Full KERSIVO)',
      `Shops that want a ${STARTER_DEPOSIT_PRICE} deposit or full payment behind public bookings`,
    ],
  },
  {
    label: 'Fresha is the better fit for',
    tone: 'fresha',
    points: [
      'New shops that rely on marketplace discovery for first-time clients',
      'Businesses that want one wide beauty and wellness ecosystem',
      'Owners who want Fresha’s optional add-ons, such as Client Loyalty',
    ],
  },
];

export type FreshaReasonVisual = 'receipt' | 'team' | 'clients' | 'website' | 'brand';

export type FreshaReason = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  kersivo: string;
  visual: FreshaReasonVisual;
  link?: { href: string; label: string };
};

export const FRESHA_REASONS_INTRO =
  'Fresha is a widely used booking platform, and plenty of shops do well on it. When a barber starts looking for a Fresha alternative, it is usually for one of these five reasons.';

export const FRESHA_REASONS: readonly FreshaReason[] = [
  {
    id: 'new-client-fees',
    kicker: 'Commission',
    title: 'The new-client fee can land on clients you would have won anyway',
    body: `Fresha charges a one-time ${MARKETPLACE_PERCENT} fee (minimum ${MARKETPLACE_MINIMUM}, plus VAT) on a brand-new client who first finds you on its Marketplace. Fresha tracks each client’s source, so someone who first viewed your Marketplace profile and later booked through your Instagram link still counts as a Marketplace client.`,
    kersivo:
      'KERSIVO has no marketplace and takes 0% KERSIVO commission on booking payments. Stripe processing fees still apply.',
    visual: 'receipt',
  },
  {
    id: 'per-barber-pricing',
    kicker: 'Fees',
    title: 'The subscription grows every time you add a chair',
    body: `Fresha’s Team plan is ${TEAM_PRICE} per bookable team member a month, plus VAT. Hire a barber, take on an apprentice or open a Saturday chair, and the bill moves with them.`,
    kersivo: `Full KERSIVO is ${KERSIVO_PRICE}/month per location with unlimited barbers within that location, subject to reasonable fair use. Starter is ${STARTER_PRICE} for up to ${STARTER_MAX_BARBERS} barbers.`,
    visual: 'team',
  },
  {
    id: 'client-control',
    kicker: 'Client control',
    title: 'Your regulars should book with you, not beside the shop down the road',
    body: 'A marketplace is built to compare businesses, so a client browsing it for a cut also sees other shops. Fresha’s own booking links open your page without showing others, but the Marketplace is where comparison happens.',
    kersivo:
      'Clients book in your own journey and land in your own client records: Clients Core on Starter, full history and internal notes with Advanced Clients on Full.',
    visual: 'clients',
  },
  {
    id: 'own-website',
    kicker: 'Your own website',
    title: 'A booking website that is actually yours',
    body: `Fresha gives you booking links and a Book Now button, and sells its Smart Website as an add-on at ${formatGbp(smartWebsite.amountGbp!)} a month, plus VAT.`,
    kersivo:
      'Full KERSIVO includes a branded barbershop website on your own domain, with services, barbers, deposits and booking built in.',
    visual: 'website',
    link: { href: '/barbershop-websites', label: 'See KERSIVO barbershop websites' },
  },
  {
    id: 'branding',
    kicker: 'Branding',
    title: 'Your brand from the Instagram bio to the reminder email',
    body: 'Clients choose a barber, not a platform. The more of the journey that carries your name, logo and voice, the more booking feels like walking into your shop.',
    kersivo:
      'KERSIVO keeps your logo, services and shop identity throughout the booking journey, with email reminders on both plans and SMS reminders within a monthly allowance on Full.',
    visual: 'brand',
    link: { href: '/barbershop-online-booking', label: 'How KERSIVO online booking works' },
  },
];

export type FreshaOutcome = {
  title: string;
  body: string;
  image?: { src: string; alt: string };
};

export const FRESHA_OUTCOMES_INTRO =
  'Picture the same Saturday, run on your own system. The diary is just as full. What changes is whose name the client sees, who keeps the relationship and what the month costs you.';

export const FRESHA_OUTCOMES: readonly FreshaOutcome[] = [
  {
    title: 'Every booking starts on your name',
    body: 'Your Instagram bio, Google profile and QR code all point at your own booking page. On Full KERSIVO that page lives on your own domain.',
    image: { src: '/images/switch/barber-at-work-960.webp', alt: 'A barber finishing a client’s cut' },
  },
  {
    title: 'New clients become your clients',
    body: 'A first-timer who finds you on Google books with you and lands in your client list, with no marketplace in between.',
    image: { src: '/images/switch/skin-fade-720.webp', alt: 'Close-up of a fresh skin fade' },
  },
  {
    title: 'One price, however busy the chairs get',
    body: `Full KERSIVO is ${KERSIVO_PRICE}/month per location with unlimited barbers within that location, subject to fair use. A new barber does not add a line to the bill.`,
  },
  {
    title: 'Deposits that make no-shows think twice',
    body: `Starter public bookings take a ${STARTER_DEPOSIT_PRICE} deposit or full payment. Full lets you choose Pay at shop, a ${STARTER_DEPOSIT_PRICE} deposit or full payment.`,
  },
];

export type FreshaContentTheme = {
  title: string;
  body: string;
};

export type FreshaCostItem = {
  kicker: string;
  figure: string;
  unit: string;
  notes: readonly string[];
  sourceIds: readonly FreshaSourceId[];
};

export const FRESHA_COSTS_INTRO = `Fresha’s costs come from several places, not one headline number. The subscription is the fixed monthly cost; Marketplace, payment-processing and add-on costs depend on how each shop uses Fresha. Checked against Fresha’s UK pricing page and Help Centre on ${FRESHA_FACTS_CHECKED_DATE}. Fresha lists UK rates exclusive of ${VAT}.`;

export const FRESHA_COST_ITEMS: readonly FreshaCostItem[] = [
  {
    kicker: 'Subscription',
    figure: TEAM_PRICE,
    unit: 'per bookable team member / month',
    notes: [
      `Team plan. The Independent plan for one-person businesses is ${INDEPENDENT_PRICE} a month.`,
      `Fresha defines a bookable team member as ${FRESHA_BOOKABLE_TEAM_MEMBER_DEFINITION}.`,
      `Custom Enterprise rates apply above ${FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS} team members.`,
    ],
    sourceIds: ['pricingUk'],
  },
  {
    kicker: 'Direct booking',
    figure: 'Free',
    unit: 'booking links, Facebook and Instagram bookings',
    notes: [
      'Clients who book through your own Fresha booking links don’t incur a new-client fee unless they first found you on the Marketplace.',
      'Fresha requires your Marketplace profile to be listed to activate booking links.',
    ],
    sourceIds: ['pricingUk', 'bookingLinks', 'marketplaceFee'],
  },
  {
    kicker: 'Marketplace new clients',
    figure: MARKETPLACE_PERCENT,
    unit: `one-time, minimum ${MARKETPLACE_MINIMUM} per client`,
    notes: [
      'Charged once for a brand-new client who first discovers you on the Fresha Marketplace.',
      'No fee for returning clients.',
    ],
    sourceIds: ['pricingUk', 'marketplaceFee'],
  },
  {
    kicker: 'Payment processing',
    figure: `${formatPercent(onlinePayments.percent!)} + ${formatGbp(onlinePayments.amountGbp!)}`,
    unit: 'per online transaction',
    notes: [
      `In person: ${formatPercent(inPersonPayments.percent!)} + ${formatGbp(inPersonPayments.amountGbp!)} per transaction, plus ${formatGbp(tapToPay.amountGbp!)} per Tap to Pay authorisation.`,
      'Fresha Payments is optional, but Fresha’s deposits, no-show protection and online product store run through it.',
    ],
    sourceIds: ['pricingUk', 'paymentsOverview', 'onlineStore'],
  },
  {
    kicker: 'Optional add-ons',
    figure: formatGbp(smartWebsite.amountGbp!),
    unit: 'per month for Fresha’s Smart Website',
    notes: [
      `Client Loyalty is ${formatGbp(clientLoyalty.amountGbp!)} per location a month.`,
      'Fresha lists further paid add-ons on its pricing page.',
    ],
    sourceIds: ['pricingUk'],
  },
];

export type FreshaWorkedExample = {
  label: string;
  plan: string;
  freshaExVat: string;
  freshaIncVat: string;
  kersivo: string;
};

export const FRESHA_WORKED_EXAMPLE_TEAM_SIZES = [1, 3, 5] as const;

export const FRESHA_WORKED_EXAMPLES: readonly FreshaWorkedExample[] =
  FRESHA_WORKED_EXAMPLE_TEAM_SIZES.map((size) => {
    const estimate = estimateFreshaMonthlySubscription(size);
    return {
      label: size === 1 ? 'Solo barber' : `${size} bookable barbers`,
      plan:
        estimate.plan === 'Independent'
          ? 'Independent'
          : `Team: ${size} × ${TEAM_PRICE}`,
      freshaExVat: formatGbp(estimate.exVatGbp),
      freshaIncVat: formatGbp(estimate.incVatGbp),
      kersivo: size <= STARTER_MAX_BARBERS ? `${STARTER_PRICE} Starter or ${KERSIVO_PRICE} Full` : `${KERSIVO_PRICE} Full`,
    };
  });

export const FRESHA_WORKED_EXAMPLES_NOTE = `Subscription cost only — not a total cost of ownership. Potential additional costs depend on each shop: for Fresha, Marketplace new-client fees, payment processing and optional add-ons; for KERSIVO, Stripe payment-processing fees. KERSIVO is not currently VAT registered, so no VAT is added.`;

export const KERSIVO_MODEL_POINTS: readonly string[] = [
  `KERSIVO Starter: ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} active bookable barbers, with a hosted booking page`,
  `Starter public bookings: ${STARTER_DEPOSIT_PRICE} deposit or Pay in full through a connected Stripe account`,
  `Full KERSIVO: ${KERSIVO_PRICE}/month per physical location`,
  'Full: editable payment controls including Pay at shop, plus unlimited barbers within one location subject to reasonable fair use',
  'No setup fee on either plan',
  '0% KERSIVO commission on booking payments',
  '0% KERSIVO commission on Full retail sales',
  'Stripe payment-processing fees still apply',
];

const EXAMPLE_HIGHER_SERVICE_GBP = 25;
const EXAMPLE_LOWER_SERVICE_GBP = 15;

export const FRESHA_MARKETPLACE_FEE_POINTS: readonly string[] = [
  `It is a one-time fee of ${MARKETPLACE_PERCENT} of the value of a brand-new client’s first appointment, with a ${MARKETPLACE_MINIMUM} minimum per client.`,
  'It applies to clients who first discover your business on the Fresha Marketplace and go on to book online.',
  'Returning clients never trigger it, and neither do clients who are already in your client list, including imported clients.',
  'Fresha tracks each client’s source. If a client first views your Marketplace profile and later books through your website or social media, Fresha still treats them as a Marketplace new client.',
  'Fresha applies a maximum cap to the fee for higher-value services.',
];

export const FRESHA_MARKETPLACE_FEE_EXAMPLE = `For example, on a ${formatGbp(EXAMPLE_HIGHER_SERVICE_GBP)} first haircut the fee would be ${formatGbp(estimateFreshaMarketplaceNewClientFee(EXAMPLE_HIGHER_SERVICE_GBP))}. On a ${formatGbp(EXAMPLE_LOWER_SERVICE_GBP)} service, the ${MARKETPLACE_MINIMUM} minimum applies.`;

export const FRESHA_FIT_PATHS: readonly [ModelComparisonItem, ModelComparisonItem] = [
  {
    label: 'Fresha',
    descriptor: 'Marketplace-led model',
    icon: 'network',
    summary: [
      { label: 'Pricing', value: 'Per bookable team member' },
      { label: 'Discovery', value: 'Fresha Marketplace' },
    ],
    heading: 'Fresha may suit your shop if…',
    points: [
      'Marketplace discovery is an important source of new clients for you',
      'You value being part of a wider beauty and wellness booking ecosystem',
      'You are comfortable with pricing per bookable team member and one-time Marketplace fees',
      'You want Fresha’s range of optional paid add-ons, such as Client Loyalty',
    ],
  },
  {
    label: 'KERSIVO',
    descriptor: 'Own-brand booking model',
    icon: 'direct',
    summary: [
      { label: 'Pricing', value: `${STARTER_PRICE} Starter or ${KERSIVO_PRICE}/month per location on Full` },
      { label: 'Discovery', value: 'Your own website and channels' },
    ],
    heading: 'KERSIVO may suit your shop if…',
    points: [
      'You want a direct booking journey under your own brand, with your own website and domain on Full KERSIVO',
      'Your clients already find you through Google, Instagram, referrals or walk-ins',
      `You prefer ${STARTER_PRICE} for up to ${STARTER_MAX_BARBERS} barbers on Starter, or a flat ${KERSIVO_PRICE}/month per location on Full, however many barbers take bookings`,
      `You want Starter bookings secured by a ${STARTER_DEPOSIT_PRICE} deposit or full payment, with Full unlocking Pay at shop and wider payment control — all with 0% KERSIVO commission`,
    ],
  },
];

export const FRESHA_FIT_CLOSING =
  'Neither model is right for every barbershop. The real question is where you want new clients to come from, and where you want the booking journey to live.';

export const FRESHA_SWITCHING_REASSURANCE = 'Keep Fresha live while your KERSIVO setup is prepared.';

export const FRESHA_SWITCHING_STEPS: readonly FreshaContentTheme[] = [
  {
    title: 'Keep Fresha live',
    body: 'Your current bookings keep running on Fresha. Nothing changes for your clients while the new setup is prepared.',
  },
  {
    title: 'Export what Fresha makes available',
    body: 'Fresha lets you export your client list as Excel or CSV, and reports as PDF, CSV or XLSX.',
  },
  {
    title: 'We review and map compatible data',
    body: 'We’ll help migrate the usable business data available from your current booking system, including supported CSV exports.',
  },
  {
    title: 'We prepare your setup',
    body: 'Services, barbers and opening hours are prepared in KERSIVO, plus your branded barbershop website on Full KERSIVO. Setup is typically ready in a few days once we receive all required information.',
  },
  {
    title: 'You review a private preview',
    body: 'Check the website, booking journey and admin before anything goes public.',
  },
  {
    title: 'Switch when you approve',
    body: 'Only once you approve are your public booking links (and, on Full, your domain routing) switched to KERSIVO.',
  },
];

export const FRESHA_SWITCHING_LIMITS: readonly string[] = [
  'Fresha states that client card details are encrypted and cannot be exported or transferred, so clients would need to add card details again.',
  'Only data that Fresha includes in its exports can be moved, and the result depends on how complete that export is.',
];

export const FRESHA_SWITCHING_TITLE = 'Switching from Fresha to KERSIVO without a gap in the diary';

/** Verified rates handed to the in-page estimator script. Subscription and Marketplace fees only. */
export const FRESHA_ESTIMATOR_CONFIG = {
  independentGbp: independent.amountGbp!,
  teamPerMemberGbp: teamPlan.amountGbp!,
  vatPercent: FRESHA_UK_VAT_PERCENT,
  marketplacePercent: marketplaceFee.percent!,
  marketplaceMinimumGbp: marketplaceFee.minimumGbp!,
  kersivoFullGbp: SAAS_MONTHLY_GBP,
  starterMaxBarbers: STARTER_MAX_BARBERS,
  maxBarbers: 12,
  defaults: { barbers: 4, newClients: 4, firstVisitGbp: 25 },
} as const;

export const FRESHA_ESTIMATOR_NOTE = `An estimate of Fresha’s subscription and one-time Marketplace new-client fees, using Fresha’s published UK rates plus ${VAT}, before any fee cap. It leaves out payment processing on both sides (Fresha Payments rates or Stripe fees) and optional add-ons.`;
