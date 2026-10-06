import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  FRESHA_UK_VAT_PERCENT,
  formatGbp,
  formatPercent,
  requireVerifiedFreshaFact,
} from '@/lib/seo/freshaFacts';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export type FreshaAlternativeFaqItem = {
  question: string;
  answer: string;
};

export const FRESHA_ALTERNATIVE_PAGE_PATH = '/fresha-alternative';

export const FRESHA_ALTERNATIVE_TITLE = 'Fresha Alternative for UK Barbershops | KERSIVO';

export const FRESHA_ALTERNATIVE_DESCRIPTION =
  'Looking for a Fresha alternative in the UK? Compare KERSIVO and Fresha pricing, fees, branding, bookings and switching for independent barbershops.';

/** Visible "Last updated" date on the page; also used for sitemap lastmod and WebPage dateModified. */
export const FRESHA_ALTERNATIVE_LAST_UPDATED_ISO = '2026-10-06';
export const FRESHA_ALTERNATIVE_LAST_UPDATED_LABEL = '6 October 2026';

const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
const STARTER_PRICE = formatGbp(0);
const STARTER_MAX_BARBERS = 4;
const STARTER_DEPOSIT_PRICE = formatGbp(KERSIVO_BOOKING_DEPOSIT_GBP);
const independent = requireVerifiedFreshaFact('independentPlan');
const teamPlan = requireVerifiedFreshaFact('teamPlanPerMember');
const marketplaceFee = requireVerifiedFreshaFact('marketplaceNewClientFee');

/** Visible FAQ and FAQPage JSON-LD both render from this list — never add schema-only items. */
export const FRESHA_ALTERNATIVE_FAQ_ITEMS: FreshaAlternativeFaqItem[] = [
  {
    question: 'What is the best Fresha alternative for UK barbers?',
    answer:
      `It depends on how your shop wins clients. KERSIVO may be a strong Fresha alternative for independent UK barbershops that prioritise a direct client relationship: KERSIVO Starter (${STARTER_PRICE}/month, up to ${STARTER_MAX_BARBERS} barbers) gives you a hosted booking page where public bookings use a ${STARTER_DEPOSIT_PRICE} deposit or Pay in full, plus Clients Core and email reminders. Full KERSIVO adds your branded website and domain, editable payment controls, Advanced Clients, Reports, Retail pickup, SMS and the live Assistant. If Marketplace discovery is central to how you grow, Fresha’s model may suit you better.`,
  },
  {
    question: 'How does KERSIVO pricing compare with Fresha?',
    answer: `KERSIVO Starter is ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} active bookable barbers. Full KERSIVO is ${KERSIVO_PRICE}/month per location, with unlimited barbers within that location subject to reasonable fair use. Neither plan has a setup fee, and both take 0% KERSIVO commission on booking payments (plus 0% on Full retail sales). Fresha’s UK pricing is ${formatGbp(independent.amountGbp!)}/month on its Independent plan or ${formatGbp(teamPlan.amountGbp!)} per bookable team member per month on its Team plan, exclusive of ${FRESHA_UK_VAT_PERCENT}% VAT, plus a one-time ${formatPercent(marketplaceFee.percent!)} fee (minimum ${formatGbp(marketplaceFee.minimumGbp!)}) for brand-new Marketplace clients. Which costs less depends on your team size, add-ons and how many new clients come through the Marketplace. Card payment-processing fees apply on either platform when you take payments through it.`,
  },
  {
    question: 'Does KERSIVO charge commission on bookings?',
    answer:
      `No. KERSIVO takes 0% commission on booking payments on both KERSIVO Starter (${STARTER_PRICE}/month) and Full KERSIVO (${KERSIVO_PRICE}/month per location), and 0% on Full retail sales. Starter public bookings require a connected Stripe account and use a ${STARTER_DEPOSIT_PRICE} deposit or Pay in full; standard Stripe processing fees still apply.`,
  },
  {
    question: 'Does KERSIVO charge per barber?',
    answer: `No. KERSIVO Starter is ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} active bookable barbers at one location. Full KERSIVO is ${KERSIVO_PRICE}/month per physical location, with unlimited barbers within that location, subject to reasonable fair use.`,
  },
  {
    question: 'Can I move my clients from Fresha to KERSIVO?',
    answer:
      'Yes, where the data is available. Fresha lets you export your client list as Excel or CSV. We’ll help migrate the usable business data available from your current booking system, including supported CSV exports. Fresha states that client card details cannot be exported, and what can be moved depends on how complete the export is.',
  },
  {
    question: 'Can I keep Fresha running while KERSIVO is set up?',
    answer:
      'Yes. Keep Fresha live while your KERSIVO setup is prepared. You review a private preview first, and your public booking links (and, on Full, your domain routing) are only switched once you approve.',
  },
  {
    question: 'Do clients need to download an app?',
    answer:
      'No. Clients book in the browser without downloading a separate customer app: through a hosted KERSIVO booking page on Starter, or your own branded website on Full KERSIVO.',
  },
  {
    question: 'Does KERSIVO have a marketplace?',
    answer:
      'No. KERSIVO does not run a consumer marketplace. It is built around your own booking journey (and, on Full KERSIVO, your own website and domain), which suits shops whose clients already find them through Google, Instagram, referrals or walk-ins. If you rely on marketplace discovery for new clients, that is worth weighing up.',
  },
  {
    question: 'Can KERSIVO run on my barbershop’s own domain?',
    answer: `Yes, with Full KERSIVO. Full KERSIVO (${KERSIVO_PRICE}/month per location) includes one standard domain for your branded barbershop website and booking journey. KERSIVO Starter uses a hosted KERSIVO booking page, not your own domain.`,
  },
  {
    question: 'Can I see the booking experience before subscribing?',
    answer:
      'Yes. The live KERSIVO demo lets you explore the client booking journey, admin system and the Full KERSIVO retail pickup experience before you make a decision.',
  },
];

export function buildFreshaAlternativeFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}${FRESHA_ALTERNATIVE_PAGE_PATH}#faq`,
    mainEntity: FRESHA_ALTERNATIVE_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
