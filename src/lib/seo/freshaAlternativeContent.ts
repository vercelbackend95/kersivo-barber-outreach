import type { InsightCardItem, ModelComparisonItem } from '@/lib/editorial/insightIcons';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
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
const INDEPENDENT_PRICE = formatGbp(independent.amountGbp!);
const TEAM_PRICE = formatGbp(teamPlan.amountGbp!);
const MARKETPLACE_PERCENT = formatPercent(marketplaceFee.percent!);
const MARKETPLACE_MINIMUM = formatGbp(marketplaceFee.minimumGbp!);
const VAT = `${FRESHA_UK_VAT_PERCENT}% VAT`;

export const FRESHA_QUICK_ANSWER_KICKER = 'The short version';

export const FRESHA_QUICK_ANSWER_TITLE = 'A Fresha alternative built around your own brand.';

export const FRESHA_QUICK_ANSWER_LEAD = `KERSIVO is a Fresha alternative for independent UK barbershops that want a more direct booking relationship. KERSIVO Starter is ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} barbers, with a hosted page where clients pay a £5 deposit or pay in full. Full KERSIVO is ${KERSIVO_PRICE}/month per location, adding your website, domain and payment control. KERSIVO commission is 0%; Stripe processing fees apply.`;

export const FRESHA_QUICK_ANSWER_DETAIL = `Fresha follows a different model: business software priced per bookable team member (${INDEPENDENT_PRICE} a month for one person, or ${TEAM_PRICE} per team member on its Team plan, plus VAT), alongside the Fresha Marketplace, which charges a one-time fee for brand-new clients it introduces.`;

export const FRESHA_QUICK_ANSWER = `${FRESHA_QUICK_ANSWER_LEAD} ${FRESHA_QUICK_ANSWER_DETAIL}`;

export const FRESHA_QUICK_ANSWER_FACTS: readonly { label: string; value: string }[] = [
  { label: 'KERSIVO Starter', value: `${STARTER_PRICE}/month, up to ${STARTER_MAX_BARBERS} barbers` },
  { label: 'Full KERSIVO', value: `${KERSIVO_PRICE}/month per location` },
  { label: 'KERSIVO commission', value: '0% on booking payments' },
  { label: 'Fresha', value: 'Priced per bookable team member' },
];

export type FreshaContentTheme = {
  title: string;
  body: string;
};

export const FRESHA_WHY_INTRO =
  'Fresha is a widely used booking platform. When independent barbers compare it with an own-brand system, the same four structural questions tend to come up.';

export const FRESHA_WHY_THEMES: readonly InsightCardItem[] = [
  {
    icon: 'seats',
    title: 'Pricing that scales with the team',
    body: `Fresha’s Team plan is charged per bookable team member — ${TEAM_PRICE} a month each, plus VAT — so the subscription rises as more chairs take bookings. KERSIVO Starter is ${STARTER_PRICE} for up to ${STARTER_MAX_BARBERS} barbers; Full KERSIVO is ${KERSIVO_PRICE} a month per location, with unlimited barbers subject to fair use.`,
  },
  {
    icon: 'storefront',
    title: 'A booking journey centred on your own brand',
    body: 'Fresha booking links open your Fresha booking page without showing other businesses. Some owners prefer the whole journey — website, domain and booking flow — to carry their own barbershop’s name. That is the model KERSIVO is built around.',
  },
  {
    icon: 'discovery',
    title: 'Where marketplace discovery fits',
    body: 'The Fresha Marketplace is a genuine discovery channel for businesses that want new clients, and Fresha charges its one-time fee only for brand-new clients who first find you there. KERSIVO has no consumer marketplace, so the useful question is how much of your new business actually comes from one.',
  },
  {
    icon: 'stack',
    title: 'What the plan includes',
    body: `Fresha offers optional paid add-ons, including its Smart Website. KERSIVO Starter covers hosted booking for ${STARTER_PRICE}; Full KERSIVO includes the branded website, domain and retail pickup.`,
  },
];

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
  'Starter public bookings: £5 deposit or Pay in full through a connected Stripe account',
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
      'You want Starter bookings secured by a £5 deposit or full payment, with Full unlocking Pay at shop and wider payment control — all with 0% KERSIVO commission',
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
    body: 'Services, barbers and opening hours are prepared in KERSIVO, plus your branded barbershop website on Full KERSIVO.',
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
