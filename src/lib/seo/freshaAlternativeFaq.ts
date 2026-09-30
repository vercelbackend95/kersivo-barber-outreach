import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
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
  'Compare KERSIVO and Fresha pricing, fees, branding, bookings and switching — a Fresha alternative built for independent UK barbershops.';

/** Visible "Last updated" date on the page; also used for sitemap lastmod and WebPage dateModified. */
export const FRESHA_ALTERNATIVE_LAST_UPDATED_ISO = '2026-09-30';
export const FRESHA_ALTERNATIVE_LAST_UPDATED_LABEL = '30 September 2026';

const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
const independent = requireVerifiedFreshaFact('independentPlan');
const teamPlan = requireVerifiedFreshaFact('teamPlanPerMember');
const marketplaceFee = requireVerifiedFreshaFact('marketplaceNewClientFee');

/** Visible FAQ and FAQPage JSON-LD both render from this list — never add schema-only items. */
export const FRESHA_ALTERNATIVE_FAQ_ITEMS: FreshaAlternativeFaqItem[] = [
  {
    question: 'What is the best Fresha alternative for UK barbers?',
    answer:
      'It depends on how your shop wins clients. KERSIVO may be a strong Fresha alternative for independent UK barbershops that prioritise their own brand, their own domain and a direct client relationship: it combines a branded barbershop website with online booking, optional deposits, client management and retail pickup. If Marketplace discovery is central to how you grow, Fresha’s model may suit you better.',
  },
  {
    question: 'How does KERSIVO pricing compare with Fresha?',
    answer: `KERSIVO is ${KERSIVO_PRICE}/month per location, with no setup fee, unlimited barbers within that location subject to reasonable fair use, and 0% KERSIVO commission on bookings and retail sales. Fresha’s UK pricing is ${formatGbp(independent.amountGbp!)}/month on its Independent plan or ${formatGbp(teamPlan.amountGbp!)} per bookable team member per month on its Team plan, exclusive of ${FRESHA_UK_VAT_PERCENT}% VAT, plus a one-time ${formatPercent(marketplaceFee.percent!)} fee (minimum ${formatGbp(marketplaceFee.minimumGbp!)}) for brand-new Marketplace clients. Which costs less depends on your team size, add-ons and how many new clients come through the Marketplace. Card payment-processing fees apply on either platform when you take payments through it.`,
  },
  {
    question: 'Does KERSIVO charge commission on bookings?',
    answer:
      'KERSIVO takes 0% commission on bookings and retail sales. The platform is built around a simple monthly subscription for one barbershop location. Standard Stripe processing fees still apply where payments are processed.',
  },
  {
    question: 'Does KERSIVO charge per barber?',
    answer: `No. KERSIVO is ${KERSIVO_PRICE}/month per physical location, with unlimited barbers within that location, subject to reasonable fair use.`,
  },
  {
    question: 'Can I move my clients from Fresha to KERSIVO?',
    answer:
      'Yes, where the data is available. Fresha lets you export your client list as Excel or CSV. We’ll help migrate the usable business data available from your current booking system, including supported CSV exports. Fresha states that client card details cannot be exported, and what can be moved depends on how complete the export is.',
  },
  {
    question: 'Can I keep Fresha running while KERSIVO is set up?',
    answer:
      'Yes. Keep Fresha live while your KERSIVO setup is prepared. You review a private preview first, and your public booking links and domain routing are only switched once you approve.',
  },
  {
    question: 'Do clients need to download an app?',
    answer:
      'No. Clients can book through your own branded website and booking journey without downloading a separate customer app.',
  },
  {
    question: 'Does KERSIVO have a marketplace?',
    answer:
      'No. KERSIVO does not run a consumer marketplace. It is built around your own website, domain and booking journey, which suits shops whose clients already find them through Google, Instagram, referrals or walk-ins. If you rely on marketplace discovery for new clients, that is worth weighing up.',
  },
  {
    question: 'Can KERSIVO run on my barbershop’s own domain?',
    answer: `Yes. The ${KERSIVO_PRICE} monthly plan includes one standard domain for your branded barbershop website and booking journey.`,
  },
  {
    question: 'Can I see the booking experience before subscribing?',
    answer:
      'Yes. The live KERSIVO demo lets you explore the client booking journey, admin system and retail pickup experience before you make a decision.',
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
