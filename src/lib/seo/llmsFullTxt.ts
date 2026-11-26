/**
 * /llms-full.txt (GEO/AEO stage 6): the answers and FAQs from KERSIVO's product and comparison
 * pages in one plain-text file, so an AI assistant can read them in a single request.
 *
 * Nothing here is written for this file. Every paragraph is the same constant the page renders
 * (direct answer, "In short" block, visible FAQ and its FAQPage JSON-LD), so the file cannot say
 * anything the pages do not. Pages whose FAQ depends on the free-preview flag read the same flag.
 */
import { KERSIVO_COMMISSION_CLAIM, STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { KERSIVO_ENTITY_DESCRIPTION } from '@/lib/seo/kersivoEntityJsonLd';
import { buildInShortAnswer } from '@/lib/seo/inShortAnswer';
import { getStaticPageLastModified } from '@/lib/seo/pageDates';
import { getHomepageFaqItems, ONLINE_BOOKING_FAQ_ITEMS } from '@/lib/seo/barbershopBookingFaq';
import { HOME_CHECKLIST_ANSWER } from '@/lib/seo/homeBookingChecklist';
import { PRICING_PAGE_PATH, PRICING_QUICK_ANSWER, getPricingFaqItems } from '@/lib/seo/pricingPage';
import { STARTER_FAQ_ITEMS, STARTER_PAGE_PATH } from '@/lib/seo/starterPage';
import { BARBERSHOP_WEBSITES_PAGE_DESCRIPTION, BARBERSHOP_WEBSITES_PAGE_PATH, getBarbershopWebsitesFaqs } from '@/lib/seo/barbershopWebsitesPage';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION, BARBERSHOP_ONLINE_BOOKING_PAGE_PATH } from '@/lib/seo/barbershopOnlineBookingPage';
import { KAR_ANSWER, KAR_FAQS, KAR_PAGE_PATH } from '@/lib/seo/adminReportsExperience';
import { RETAIL_PICKUP_FAQ_ITEMS, RETAIL_PICKUP_HERO, RETAIL_PICKUP_PAGE_PATH } from '@/lib/seo/retailPickupPage';
import { ABOUT_ENTITY_DEFINITION, ABOUT_PAGE_PATH } from '@/lib/seo/aboutPage';
import { ALTERNATIVES_HUB_DIRECT_ANSWER, ALTERNATIVES_HUB_FAQ_ITEMS, ALTERNATIVES_HUB_PAGE_PATH } from '@/lib/seo/alternativesHubSeo';
import { FEES_REPORT_DIRECT_ANSWER, FEES_REPORT_FAQ_ITEMS, FEES_REPORT_PAGE_PATH } from '@/lib/seo/feesReport';
import { BARBER_COST_CALCULATOR_FAQ_ITEMS } from '@/lib/seo/barberCostCalculatorFaq';
import { BARBER_COST_CALCULATOR_PAGE_PATH } from '@/lib/seo/barberCostCalculatorPage';
import { BOOKSY_VS_FRESHA_PAGE_PATH, BVF_DIRECT_ANSWER, BVF_FAQ_ITEMS } from '@/lib/seo/booksyVsFresha';
import { KVB_HERO, KVB_PAGE_PATH } from '@/lib/seo/kersivoVsBooksyExperience';
import { BOOKSY_ALTERNATIVE_FAQ_ITEMS, BOOKSY_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/booksyAlternativeFaq';
import { FRESHA_ALTERNATIVE_FAQ_ITEMS, FRESHA_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/freshaAlternativeFaq';
import { TREATWELL_ALTERNATIVE_FAQ_ITEMS, TREATWELL_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/treatwellAlternativeFaq';
import { NEARCUT_ALTERNATIVE_FAQ_ITEMS, NEARCUT_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/nearcutAlternativeFaq';
import { VAGARO_ALTERNATIVE_FAQ_ITEMS, VAGARO_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/vagaroAlternativeFaq';
import { TIMELY_ALTERNATIVE_FAQ_ITEMS, TIMELY_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/timelyAlternativeFaq';
import { PHOREST_ALTERNATIVE_FAQ_ITEMS, PHOREST_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/phorestAlternativeFaq';
import { SQUARE_ALTERNATIVE_FAQ_ITEMS, SQUARE_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/squareAlternativeFaq';
import { SQUIRE_ALTERNATIVE_FAQ_ITEMS, SQUIRE_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/squireAlternativeFaq';
import { SETORA_ALTERNATIVE_FAQ_ITEMS, SETORA_ALTERNATIVE_PAGE_PATH } from '@/lib/seo/setoraAlternativeFaq';

export const LLMS_FULL_TXT_PATH = '/llms-full.txt';

export type LlmsFullFaq = { question: string; answer: string };

export type LlmsFullPage = {
  path: string;
  name: string;
  /** Paragraphs shown on the page as its direct answer ("In short", quick answer, lead). */
  answer: readonly string[];
  faqs: readonly LlmsFullFaq[];
};

export type LlmsFullSection = { heading: string; pages: readonly LlmsFullPage[] };

const toFaqs = (items: readonly { question: string; answer: string | readonly string[] }[]): LlmsFullFaq[] =>
  items.map((item) => ({
    question: item.question,
    answer: typeof item.answer === 'string' ? item.answer : item.answer.join(' '),
  }));

function inShort(competitor?: string): string[] {
  const answer = buildInShortAnswer(competitor);
  return [answer.summary, `${answer.notForLabel}: ${answer.notFor}`];
}

const ALTERNATIVES: readonly { path: string; competitor: string; faqs: readonly { question: string; answer: string }[] }[] = [
  { path: BOOKSY_ALTERNATIVE_PAGE_PATH, competitor: 'Booksy', faqs: BOOKSY_ALTERNATIVE_FAQ_ITEMS },
  { path: FRESHA_ALTERNATIVE_PAGE_PATH, competitor: 'Fresha', faqs: FRESHA_ALTERNATIVE_FAQ_ITEMS },
  { path: TREATWELL_ALTERNATIVE_PAGE_PATH, competitor: 'Treatwell', faqs: TREATWELL_ALTERNATIVE_FAQ_ITEMS },
  { path: NEARCUT_ALTERNATIVE_PAGE_PATH, competitor: 'Nearcut', faqs: NEARCUT_ALTERNATIVE_FAQ_ITEMS },
  { path: VAGARO_ALTERNATIVE_PAGE_PATH, competitor: 'Vagaro', faqs: VAGARO_ALTERNATIVE_FAQ_ITEMS },
  { path: TIMELY_ALTERNATIVE_PAGE_PATH, competitor: 'Timely', faqs: TIMELY_ALTERNATIVE_FAQ_ITEMS },
  { path: PHOREST_ALTERNATIVE_PAGE_PATH, competitor: 'Phorest', faqs: PHOREST_ALTERNATIVE_FAQ_ITEMS },
  { path: SQUARE_ALTERNATIVE_PAGE_PATH, competitor: 'Square Appointments', faqs: SQUARE_ALTERNATIVE_FAQ_ITEMS },
  { path: SQUIRE_ALTERNATIVE_PAGE_PATH, competitor: 'Squire', faqs: SQUIRE_ALTERNATIVE_FAQ_ITEMS },
  { path: SETORA_ALTERNATIVE_PAGE_PATH, competitor: 'Setora', faqs: SETORA_ALTERNATIVE_FAQ_ITEMS },
];

export function getLlmsFullSections(freePreview: boolean): LlmsFullSection[] {
  return [
    {
      heading: 'Product',
      pages: [
        { path: '/', name: 'KERSIVO homepage', answer: [HOME_CHECKLIST_ANSWER], faqs: toFaqs(getHomepageFaqItems(freePreview)) },
        { path: PRICING_PAGE_PATH, name: 'Pricing', answer: [PRICING_QUICK_ANSWER], faqs: toFaqs(getPricingFaqItems(freePreview)) },
        { path: STARTER_PAGE_PATH, name: 'KERSIVO Starter', answer: [], faqs: toFaqs(STARTER_FAQ_ITEMS) },
        {
          path: BARBERSHOP_WEBSITES_PAGE_PATH,
          name: 'Barbershop websites',
          answer: [BARBERSHOP_WEBSITES_PAGE_DESCRIPTION],
          faqs: toFaqs(getBarbershopWebsitesFaqs(freePreview)),
        },
        {
          path: BARBERSHOP_ONLINE_BOOKING_PAGE_PATH,
          name: 'Barbershop online booking guide',
          answer: [BARBERSHOP_ONLINE_BOOKING_PAGE_DESCRIPTION],
          faqs: toFaqs(ONLINE_BOOKING_FAQ_ITEMS),
        },
        { path: KAR_PAGE_PATH, name: 'Admin & reports', answer: [KAR_ANSWER], faqs: toFaqs(KAR_FAQS) },
        { path: RETAIL_PICKUP_PAGE_PATH, name: 'Retail pickup', answer: [RETAIL_PICKUP_HERO.lead], faqs: toFaqs(RETAIL_PICKUP_FAQ_ITEMS) },
        { path: ABOUT_PAGE_PATH, name: 'About KERSIVO', answer: [ABOUT_ENTITY_DEFINITION], faqs: [] },
      ],
    },
    {
      heading: 'Comparisons',
      pages: [
        {
          path: ALTERNATIVES_HUB_PAGE_PATH,
          name: 'Compare UK barber booking systems',
          answer: [ALTERNATIVES_HUB_DIRECT_ANSWER, ...inShort()],
          faqs: toFaqs(ALTERNATIVES_HUB_FAQ_ITEMS),
        },
        { path: FEES_REPORT_PAGE_PATH, name: 'Booking software fees report', answer: [FEES_REPORT_DIRECT_ANSWER], faqs: toFaqs(FEES_REPORT_FAQ_ITEMS) },
        { path: BARBER_COST_CALCULATOR_PAGE_PATH, name: 'Barber software cost calculator', answer: [], faqs: toFaqs(BARBER_COST_CALCULATOR_FAQ_ITEMS) },
        { path: BOOKSY_VS_FRESHA_PAGE_PATH, name: 'Booksy vs Fresha', answer: [BVF_DIRECT_ANSWER], faqs: toFaqs(BVF_FAQ_ITEMS) },
        { path: KVB_PAGE_PATH, name: 'Booksy vs your own booking website', answer: [KVB_HERO.lead], faqs: [] },
        ...ALTERNATIVES.map((alt) => ({
          path: alt.path,
          name: `${alt.competitor} alternative`,
          answer: inShort(alt.competitor),
          faqs: toFaqs(alt.faqs),
        })),
      ],
    },
  ];
}

export function buildLlmsFullTxt(siteUrl: string, freePreview: boolean): string {
  const lines: string[] = [
    '# KERSIVO: answers from the product and comparison pages',
    '',
    `> ${KERSIVO_ENTITY_DESCRIPTION} Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location; KERSIVO Starter is £0/month for up to 4 bookable barbers. ${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
    '',
    `This file repeats, word for word, the direct answers and FAQs shown on each page below, so they can be read in one request. Each page is the source and carries the date it was last updated. The shorter index is ${siteUrl}/llms.txt.`,
  ];
  for (const section of getLlmsFullSections(freePreview)) {
    lines.push('', `## ${section.heading}`);
    for (const page of section.pages) {
      lines.push('', `### ${page.name}`, '', `URL: ${siteUrl}${page.path}`, `Last updated: ${getStaticPageLastModified(page.path)}`);
      for (const paragraph of page.answer) lines.push('', paragraph);
      for (const faq of page.faqs) lines.push('', `Q: ${faq.question}`, `A: ${faq.answer}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
