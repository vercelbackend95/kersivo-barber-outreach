import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS,
  FRESHA_FACTS_CHECKED_DATE,
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

export const FRESHA_ALTERNATIVE_TITLE = 'Fresha Alternative UK: Keep Your Clients & Brand | KERSIVO';

export const FRESHA_ALTERNATIVE_DESCRIPTION =
  'Looking for a Fresha alternative? KERSIVO gives UK barbershops their own booking website, flat pricing and 0% KERSIVO commission (Stripe fees apply).';

/** Visible "Last updated" date on the page; also used for sitemap lastmod and WebPage dateModified. */
export const FRESHA_ALTERNATIVE_LAST_UPDATED_ISO = '2026-11-14';
export const FRESHA_ALTERNATIVE_LAST_UPDATED_LABEL = '14 November 2026';

const KERSIVO_PRICE = formatGbp(SAAS_MONTHLY_GBP);
const STARTER_PRICE = formatGbp(0);
const STARTER_MAX_BARBERS = 4;
const STARTER_DEPOSIT_PRICE = formatGbp(KERSIVO_BOOKING_DEPOSIT_GBP);
const independent = requireVerifiedFreshaFact('independentPlan');
const teamPlan = requireVerifiedFreshaFact('teamPlanPerMember');
const marketplaceFee = requireVerifiedFreshaFact('marketplaceNewClientFee');
const directLinks = requireVerifiedFreshaFact('directBookingLinks');
const smartWebsite = requireVerifiedFreshaFact('smartWebsiteAddOn');

const MARKETPLACE_FEE = `a one-time ${formatPercent(marketplaceFee.percent!)} fee (minimum ${formatGbp(marketplaceFee.minimumGbp!)}, plus VAT)`;

/** Visible FAQ and FAQPage JSON-LD both render from this list — never add schema-only items. */
export const FRESHA_ALTERNATIVE_FAQ_ITEMS: FreshaAlternativeFaqItem[] = [
  {
    question: 'What is the best Fresha alternative for UK barbers?',
    answer:
      `It depends on how your shop wins clients. KERSIVO may be a strong Fresha alternative for independent UK barbershops that want a direct client relationship: KERSIVO Starter (${STARTER_PRICE}/month, up to ${STARTER_MAX_BARBERS} barbers) gives you a hosted booking page where public bookings use a ${STARTER_DEPOSIT_PRICE} deposit or Pay in full, plus Clients Core and email reminders. Full KERSIVO (${KERSIVO_PRICE}/month per location) adds your branded website and domain, editable payment controls, Advanced Clients, Reports, Retail pickup, SMS reminders within a monthly allowance and the KERSIVO Assistant, an AI helper for guidance on using KERSIVO and running your shop. If Marketplace discovery is central to how you grow, Fresha’s model may suit you better.`,
  },
  {
    question: 'Why do barbers switch from Fresha?',
    answer:
      `The usual reasons are cost and control. Fresha’s Team plan is charged per bookable team member, so the subscription rises as chairs fill, and ${MARKETPLACE_FEE} applies to brand-new clients who first find you on the Fresha Marketplace. Other owners want the booking journey on their own website and domain, under their own brand. KERSIVO is built around that model; it does not run a marketplace, so shops that depend on marketplace discovery may prefer to stay.`,
  },
  {
    question: 'Does Fresha charge commission?',
    answer: `Not on every booking. Fresha’s UK pricing page, checked on ${FRESHA_FACTS_CHECKED_DATE}, shows a ${formatGbp(directLinks.amountGbp!)} fee for bookings through your direct Fresha links and ${MARKETPLACE_FEE} for brand-new clients who first discover you on the Fresha Marketplace. Returning clients do not trigger it. Fresha tracks each client’s source, so a client who first viewed your Marketplace profile and later booked through your website or social media still counts as a Marketplace new client. KERSIVO takes 0% commission on booking payments; Stripe processing fees still apply.`,
  },
  {
    question: 'How does KERSIVO pricing compare with Fresha?',
    answer: `KERSIVO Starter is ${STARTER_PRICE}/month for up to ${STARTER_MAX_BARBERS} active bookable barbers. Full KERSIVO is ${KERSIVO_PRICE}/month per location, with unlimited barbers within that location subject to reasonable fair use, so it is not charged per barber. Neither plan has a setup fee, and both take 0% KERSIVO commission on booking payments (plus 0% on Full retail sales). Fresha’s UK pricing is ${formatGbp(independent.amountGbp!)}/month on its Independent plan or ${formatGbp(teamPlan.amountGbp!)} per bookable team member per month on its Team plan, exclusive of ${FRESHA_UK_VAT_PERCENT}% VAT, plus Marketplace new-client fees. Which costs less depends on your team size, add-ons and how many new clients come through the Marketplace. Card payment-processing fees apply on either platform when you take payments through it.`,
  },
  {
    question: 'Is Fresha no longer free?',
    answer: `Fresha’s UK pricing page, checked on ${FRESHA_FACTS_CHECKED_DATE}, lists paid subscription plans: ${formatGbp(independent.amountGbp!)}/month on the Independent plan for one bookable team member, or ${formatGbp(teamPlan.amountGbp!)} per bookable team member per month on the Team plan, both exclusive of ${FRESHA_UK_VAT_PERCENT}% VAT, with custom Enterprise rates above ${FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS} team members. Check Fresha directly for any offer that applies to your business.`,
  },
  {
    question: 'Does KERSIVO charge commission on bookings?',
    answer:
      `No. KERSIVO takes 0% commission on booking payments on both KERSIVO Starter (${STARTER_PRICE}/month) and Full KERSIVO (${KERSIVO_PRICE}/month per location), and 0% on Full retail sales. Starter public bookings require a connected Stripe account and use a ${STARTER_DEPOSIT_PRICE} deposit or Pay in full; standard Stripe processing fees still apply.`,
  },
  {
    question: 'Can KERSIVO give my barbershop its own booking website?',
    answer: `Yes, with Full KERSIVO. Full KERSIVO (${KERSIVO_PRICE}/month per location) includes a branded barbershop website on your own domain, with services, barbers, deposits and online booking built in. KERSIVO Starter uses a hosted KERSIVO booking page, not your own domain. Fresha offers booking links and sells its Smart Website as an add-on at ${formatGbp(smartWebsite.amountGbp!)}/month, plus VAT.`,
  },
  {
    question: 'Can I move my clients from Fresha to KERSIVO?',
    answer:
      'Yes, where the data is available. Fresha lets you export your client list as Excel or CSV. We’ll help migrate the usable business data available from your current booking system, including supported CSV exports. Fresha states that client card details cannot be exported, and what can be moved depends on how complete the export is.',
  },
  {
    question: 'Can I keep Fresha running while KERSIVO is set up?',
    answer:
      'Yes. Keep Fresha live while your KERSIVO setup is prepared; it is typically ready in a few days once we receive all required information. You review a private preview first, and your public booking links (and, on Full, your domain routing) are only switched once you approve.',
  },
  {
    question: 'Who is Fresha a better fit for than KERSIVO?',
    answer:
      'Fresha may suit you better if the Fresha Marketplace is an important source of brand-new clients, if you want to be part of a wide beauty and wellness booking ecosystem, or if you rely on Fresha add-ons such as Client Loyalty. KERSIVO does not run a consumer marketplace; it suits shops whose clients already find them through Google, Instagram, referrals or walk-ins.',
  },
  {
    question: 'Do clients need to download an app?',
    answer:
      'No. Clients book in the browser without downloading a separate customer app: through a hosted KERSIVO booking page on Starter, or your own branded website on Full KERSIVO.',
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
