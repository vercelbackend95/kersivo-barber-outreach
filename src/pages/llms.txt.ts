import type { APIRoute } from 'astro';
import { PRICE_LIST_LLMS_SUMMARY } from '@/lib/seo/priceListTemplatePage';
import { RETAIL_PICKUP_LLMS_SUMMARY, RETAIL_PICKUP_PAGE_PATH } from '@/lib/seo/retailPickupPage';
import { KERSIVO_COMMISSION_CLAIM, NO_SETUP_FEE_SHORT, PRICE_VAT_DISCLAIMER, STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getInsightsShortAnswer } from '@/lib/insights/insightsShortAnswers';
import {
  EDITORIAL_STANDARDS_H1,
  EDITORIAL_STANDARDS_PATH,
  EDITORIAL_STANDARDS_SHORT_ANSWER,
} from '@/lib/insights/editorialStandards';
import { KERSIVO_NOT_FOR } from '@/lib/seo/inShortAnswer';
import { LLMS_FULL_TXT_PATH } from '@/lib/seo/llmsFullTxt';
import { FEES_REPORT_CSV_PATH } from '@/lib/seo/feesReport';
import { KERSIVO_ENTITY_DESCRIPTION } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { KERSIVO_LIVE_DEMO_HREF } from '@/lib/demo/heritage/links';
import { KAR_PAGE_PATH } from '@/lib/seo/adminReportsExperience';
import { BARBERSHOP_WEBSITE_DESIGN_LLMS_SUMMARY, BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH } from '@/lib/seo/barbershopWebsiteDesignPage';
import { FREE_PREVIEW_PAGE_PATH, isFreePreviewFlowEnabled } from '@/lib/freePreview/config';
import { KVB_PAGE_PATH } from '@/lib/seo/kersivoVsBooksyExperience';
import { PUBLISHED_CITY_PAGES, buildCityPageH1, getCityPagePath } from '@/lib/seo/cityPages';
import { INSIGHTS_INDEX_DESCRIPTION, INSIGHTS_INDEX_PATH, INSIGHTS_PUBLISHED_ARTICLES } from '@/lib/seo/insights';
import { INSIGHTS_CATEGORIES } from '@/lib/insights/categories';

/**
 * /llms.txt (llmstxt.org): a plain summary of KERSIVO with links to the pages that answer
 * buyer questions. Every claim comes from claimsPolicy / defaults, so it cannot drift from the site.
 * /free-preview is listed only while FREE_PREVIEW_FLOW_ENABLED is on (it 404s otherwise), like the sitemap.
 */
export function buildLlmsTxt(siteUrl: string, freePreview = isFreePreviewFlowEnabled()): string {
  const link = (path: string, label: string, note: string) => `- [${label}](${siteUrl}${path}): ${note}`;
  return [
    '# KERSIVO',
    '',
    `> ${KERSIVO_ENTITY_DESCRIPTION} Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location and includes a branded website on the shop's own domain with online booking. KERSIVO Starter is £0/month: a KERSIVO-hosted booking page for up to 4 barbers, where every public booking takes a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment through the shop's own Stripe account. ${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
    '',
    `Prices are per physical location, not per barber. ${NO_SETUP_FEE_SHORT} ${PRICE_VAT_DISCLAIMER} Clients book in the browser; there is no customer app and no marketplace listing.`,
    '',
    'Who KERSIVO is for: independent barbershops in the United Kingdom, from a single chair to a full team at one location, that want clients to book on the shop’s own website rather than through a marketplace.',
    '',
    `Who KERSIVO is not for: ${KERSIVO_NOT_FOR}`,
    '',
    '## Product',
    link(
      '/',
      'KERSIVO home',
      "what KERSIVO is and who it is for, how a client books on the shop's own website, the Full KERSIVO price with Starter as the £0 option, and eight questions to ask any UK barber booking system before signing up (marketplace fees, card fees, per-barber pricing, client list export, deposits, own domain, app downloads, contract length)",
    ),
    link('/pricing', 'Pricing', 'Full KERSIVO and Starter, what each includes, billing and cancellation'),
    ...(freePreview
      ? [
          link(
            FREE_PREVIEW_PAGE_PATH,
            'Free website preview',
            `a free private preview of the shop's own website and booking page, designed with its name, services, barbers and photos before it pays anything: no card, no sales call; launch on Full KERSIVO for £${SAAS_MONTHLY_GBP}/month per location only if it fits`,
          ),
        ]
      : []),
    link('/barbershop-websites', 'Barbershop websites', 'the branded website, domain and setup process in Full KERSIVO'),
    link(BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH, 'Barbershop website design', BARBERSHOP_WEBSITE_DESIGN_LLMS_SUMMARY),
    link('/barbershop-online-booking', 'Barbershop online booking guide', 'how clients book step by step, how free times are worked out, deposits and payments on Starter and Full, reminders, and a checklist for choosing a system'),
    link(RETAIL_PICKUP_PAGE_PATH, 'Retail pickup', RETAIL_PICKUP_LLMS_SUMMARY),
    link(
      '/starter',
      'KERSIVO Starter',
      `free barber booking system for UK shops: £0/month for up to 4 barbers, every public booking takes a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment through the shop's Stripe account (Stripe fees apply), and when Full is the better fit`,
    ),
    link(
      KAR_PAGE_PATH,
      'Admin & reports',
      'the owner dashboard in Full KERSIVO: bookings, barbers, clients with a reliability score, retail sales, and booking reports (bookings, utilisation, cancelled and no-show rates, average booking value, peak day and hour) compared with the previous period, with what each metric means',
    ),
    link(KERSIVO_LIVE_DEMO_HREF, 'Live demo', 'Heritage Grooming, a fictional demo barbershop running on KERSIVO'),
    link('/about', 'About KERSIVO', 'how setup, support and leaving work, plus logo files and facts for press'),
    '',
    '## Comparisons',
    link('/compare', 'Compare booking systems', '11 UK barber booking systems with sourced, dated prices'),
    link('/barber-software-cost-calculator', 'Cost calculator', 'monthly software and payment costs by team size'),
    link('/barber-booking-fees-uk', 'Booking software fees report', 'dated UK fees report: monthly cost by team size, marketplace new-client fees and card fees for 10 systems'),
    link(FEES_REPORT_CSV_PATH, 'Fees report data (CSV)', 'every figure from the fees report tables, one per row, free to reuse under CC BY 4.0 with a link to the report'),
    link('/booksy-vs-fresha', 'Booksy vs Fresha', 'neutral head-to-head for UK barbershops: cost by team size, commission and card fees'),
    link(KVB_PAGE_PATH, 'Booksy vs your own booking website', `a Booksy profile inside Booksy's app and marketplace, or the shop's own branded website and booking on its own domain for £${SAAS_MONTHLY_GBP}/month per location, with no per-barber fees`),
    link('/booksy-alternative', 'Booksy alternative', 'KERSIVO compared with Booksy'),
    link('/fresha-alternative', 'Fresha alternative', 'KERSIVO compared with Fresha'),
    link('/treatwell-alternative', 'Treatwell alternative', 'KERSIVO compared with Treatwell'),
    link('/nearcut-alternative', 'Nearcut alternative', 'KERSIVO compared with Nearcut'),
    link('/vagaro-alternative', 'Vagaro alternative', 'KERSIVO compared with Vagaro'),
    link('/timely-alternative', 'Timely alternative', 'KERSIVO compared with Timely'),
    link('/phorest-alternative', 'Phorest alternative', 'KERSIVO compared with Phorest'),
    link('/square-appointments-alternative', 'Square Appointments alternative', 'KERSIVO compared with Square Appointments'),
    link('/squire-alternative', 'Squire alternative', 'KERSIVO compared with Squire'),
    link('/setora-alternative', 'Setora alternative', 'KERSIVO compared with Setora'),
    '',
    '## Local guides',
    // One researched page per city: local fade prices, chair rent, business rates and a marketplace fee calculator.
    ...PUBLISHED_CITY_PAGES.map((city) =>
      link(
        getCityPagePath(city),
        buildCityPageH1(city),
        `${city.hubSummary} With local chair rent, business rates, a marketplace fee calculator set to the city's typical fade price, and sources checked on ${city.checkedDate}.`,
      ),
    ),
    '',
    '## Free tools',
    link('/free-tools', 'All free tools', 'every free KERSIVO calculator and template for UK barbershops on one page, grouped by pricing, no-shows, taking on a barber and booking software'),
    link(
      '/barber-price-calculator',
      'Barber price calculator',
      'free barber price calculator: what to charge for each service from rent, costs, take-home target, working hours and how busy the chair is, including card fees and VAT, plus a price rise check showing how many clients a rise can lose, with nothing stored',
    ),
    link(
      '/barbershop-cancellation-policy-template',
      'Cancellation policy template',
      'free UK barbershop cancellation policy template: notice period, deposit, no-show and lateness rules in website, short and one-line versions, with nothing stored',
    ),
    link(
      '/barbershop-price-list-template',
      'Price list template',
      PRICE_LIST_LLMS_SUMMARY,
    ),
    link(
      '/barbershop-no-show-calculator',
      'No-show cost calculator',
      'free barber no-show cost calculator: the yearly cost of missed appointments from your own numbers, and whether a deposit would pay for itself',
    ),
    link(
      '/chair-rent-vs-commission-calculator',
      'Chair rent vs commission calculator',
      "free chair rent vs commission calculator for UK barbershops: what one chair leaves the shop either way, including minimum wage top-ups, holiday pay, employer's National Insurance and pension, plus the break-even rent",
    ),
    '',
    '## Insights',
    link(INSIGHTS_INDEX_PATH, 'KERSIVO Insights', INSIGHTS_INDEX_DESCRIPTION),
    ...INSIGHTS_CATEGORIES.filter((category) => category.indexable)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((category) => link(category.path, `Insights: ${category.name}`, category.seoDescription)),
    // Answer-first: the article's question and short answer, so an assistant can quote it without fetching the page.
    ...INSIGHTS_PUBLISHED_ARTICLES.map((article) => {
      const shortAnswer = getInsightsShortAnswer(article.slug);
      return link(
        article.path,
        article.headline,
        shortAnswer ? `${shortAnswer.question} ${shortAnswer.answer}` : article.description,
      );
    }),
    link(
      EDITORIAL_STANDARDS_PATH,
      EDITORIAL_STANDARDS_H1,
      `${EDITORIAL_STANDARDS_SHORT_ANSWER.question} ${EDITORIAL_STANDARDS_SHORT_ANSWER.answer}`,
    ),
    '',
    '## Optional',
    link(LLMS_FULL_TXT_PATH, 'Full answers', 'the direct answers and FAQs from every product and comparison page above, word for word, in one file'),
    link('/terms', 'Terms', 'subscription terms'),
    link('/privacy', 'Privacy policy', 'how personal data is handled'),
    '',
  ].join('\n');
}

export const GET: APIRoute = () =>
  new Response(buildLlmsTxt(getPublicSiteUrl(), isFreePreviewFlowEnabled()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
