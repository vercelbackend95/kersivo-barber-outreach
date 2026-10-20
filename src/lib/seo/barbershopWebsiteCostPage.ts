import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_PATH } from '@/lib/seo/barbershopOnlineBookingPage';
import { BARBERSHOP_WEBSITES_PAGE_PATH } from '@/lib/seo/barbershopWebsitesPage';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const BARBERSHOP_WEBSITE_COST_PAGE_PATH = '/barbershop-website-cost-uk';

export const BARBERSHOP_WEBSITE_COST_PAGE_TITLE =
  'Barbershop Website Cost UK: Prices & Fees | KERSIVO';

export const BARBERSHOP_WEBSITE_COST_PAGE_DESCRIPTION =
  'Compare UK barbershop website setup costs, ongoing fees, booking software and ownership. See what Full KERSIVO includes for £39/month.';

export const BARBERSHOP_WEBSITE_COST_PAGE_H1 =
  'How Much Does a Barbershop Website Cost in the UK?';

export const BARBERSHOP_WEBSITE_COST_OG_TITLE = 'Barbershop Website Cost in the UK | KERSIVO';

export const BARBERSHOP_WEBSITE_COST_OG_DESCRIPTION =
  'One-off builds, monthly services, booking costs and what you keep if you leave. A practical price guide for independent UK barbershops.';

/**
 * Incomplete until owner launch approval. Keep out of the index and marketing sitemap.
 */
export const BARBERSHOP_WEBSITE_COST_PAGE_INDEXABLE = false;

/** Visible breadcrumb label for the current page. */
export const BARBERSHOP_WEBSITE_COST_BREADCRUMB_CURRENT = 'Website cost';

/** Parent crumb (navigable) — matches cluster ownership. */
export const BARBERSHOP_WEBSITE_COST_BREADCRUMB_PARENT = 'Barbershop websites';

export const BARBERSHOP_WEBSITE_COST_PRICES_CHECKED_LABEL = '19 October 2026';

/** Hypothetical Section 03 inputs — not named-supplier quotes. */
export const HYPOTHETICAL_BUILD_GBP = 300;
export const HYPOTHETICAL_HOSTING_MONTHLY_GBP = 10;
export const HYPOTHETICAL_DOMAIN_YEARLY_GBP = 20;
export const BOOKING_SENSITIVITY_MONTHLY_GBP = [10, 20, 30, 40] as const;

export function websiteOnlyTotalGbp(months: 12 | 36): number {
  const years = months === 12 ? 1 : 3;
  return (
    HYPOTHETICAL_BUILD_GBP +
    HYPOTHETICAL_HOSTING_MONTHLY_GBP * months +
    HYPOTHETICAL_DOMAIN_YEARLY_GBP * years
  );
}

export function websitePlusBookingTotalGbp(
  months: 12 | 36,
  bookingMonthlyGbp: (typeof BOOKING_SENSITIVITY_MONTHLY_GBP)[number],
): number {
  return websiteOnlyTotalGbp(months) + bookingMonthlyGbp * months;
}

export function fullKersivoTotalGbp(months: 12 | 36): number {
  return SAAS_MONTHLY_GBP * months;
}

export const COST_SCENARIO_A_12 = websiteOnlyTotalGbp(12);
export const COST_SCENARIO_A_36 = websiteOnlyTotalGbp(36);
export const COST_SCENARIO_B_12_LOW = websitePlusBookingTotalGbp(12, 10);
export const COST_SCENARIO_B_12_HIGH = websitePlusBookingTotalGbp(12, 40);
export const COST_SCENARIO_B_36_LOW = websitePlusBookingTotalGbp(36, 10);
export const COST_SCENARIO_B_36_HIGH = websitePlusBookingTotalGbp(36, 40);
export const COST_SCENARIO_C_12 = fullKersivoTotalGbp(12);
export const COST_SCENARIO_C_36 = fullKersivoTotalGbp(36);

export const COST_MODELS_SECTION_ID = 'cost-options';

export const COST_MODELS_EYEBROW = 'KERSIVO / WHAT YOU GET';

export const COST_MODELS_LEDE =
  'Different website options solve different problems. Compare the real scope before you compare the number.';

export const COST_MODELS_INSIGHT_EYEBROW = 'KERSIVO INSIGHT';

export const COST_MODELS_INSIGHT_TITLE = 'What should a four-chair barbershop check?';

export const COST_MODELS_INSIGHT_BODY =
  'For a four-chair shop, check that clients can choose their barber and an available time — and whether confirmations and the shop diary cost extra.';

export const COST_MODELS_INSIGHT_CTA_LABEL = 'See how online booking works';

export const COST_MODELS_INSIGHT_CTA_HREF = BARBERSHOP_ONLINE_BOOKING_PAGE_PATH;

export const COST_MODELS_INSIGHT_IMAGE_SRC =
  '/images/barbershop-website-cost/section-03/four-chair-barbershop.webp';

export const COST_MODELS_IMAGE_WIDTH = 1448;
export const COST_MODELS_IMAGE_HEIGHT = 1086;

export type CostScopeCard = {
  id: string;
  index: string;
  title: string;
  points: readonly [string, string, string];
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
};

export const COST_SCOPE_CARDS: readonly CostScopeCard[] = [
  {
    id: 'building',
    index: '01',
    title: 'Building the site',
    points: [
      'Design and build your website',
      'Structure your services and content',
      'Make it work across devices',
    ],
    imageSrc: '/images/barbershop-website-cost/section-03/building-the-site.webp',
    imageWidth: COST_MODELS_IMAGE_WIDTH,
    imageHeight: COST_MODELS_IMAGE_HEIGHT,
  },
  {
    id: 'running',
    index: '02',
    title: 'Running the site',
    points: [
      'Hosting, security and updates',
      'Keeping your website reliable',
      'Ongoing maintenance and support',
    ],
    imageSrc: '/images/barbershop-website-cost/section-03/running-the-site.webp',
    imageWidth: COST_MODELS_IMAGE_WIDTH,
    imageHeight: COST_MODELS_IMAGE_HEIGHT,
  },
  {
    id: 'bookings',
    index: '03',
    title: 'Taking bookings & payments',
    points: [
      'Online appointment availability',
      'Deposits and payment processing',
      'Reminders and booking confirmations',
    ],
    imageSrc: '/images/barbershop-website-cost/section-03/taking-bookings-payments.webp',
    imageWidth: COST_MODELS_IMAGE_WIDTH,
    imageHeight: COST_MODELS_IMAGE_HEIGHT,
  },
  {
    id: 'control',
    index: '04',
    title: 'Control when leaving',
    points: [
      'Domain and content ownership',
      'Customer data and export options',
      'Cancellation and transfer terms',
    ],
    imageSrc: '/images/barbershop-website-cost/section-03/control-when-leaving.webp',
    imageWidth: COST_MODELS_IMAGE_WIDTH,
    imageHeight: COST_MODELS_IMAGE_HEIGHT,
  },
] as const;

export type CostBuyingModel = {
  id: string;
  index: string;
  model: string;
  bestSuitedTo: string;
  /** Retained for research/FAQ context; not rendered in the Section 03 UI. */
  mainQuestion: string;
  emphasized?: boolean;
  badge?: string;
  icon: 'diy' | 'project' | 'managed' | 'integrated';
};

export const COST_BUYING_MODELS: readonly CostBuyingModel[] = [
  {
    id: 'diy',
    index: '01',
    model: 'DIY builder',
    bestSuitedTo:
      'Owners who want a low-cost, hands-on option and are happy to build and maintain the site themselves.',
    mainQuestion: 'Time cost, domain/hosting, booking add-ons and support',
    icon: 'diy',
  },
  {
    id: 'one-off',
    index: '02',
    model: 'One-off project',
    bestSuitedTo:
      'Shops commissioning a professional website with a defined project scope and upfront build cost.',
    mainQuestion: 'What files/source are delivered; hosting, changes and booking outside project',
    icon: 'project',
  },
  {
    id: 'managed',
    index: '03',
    model: 'Managed website',
    bestSuitedTo:
      'Owners who want a supplier to handle hosting, maintenance and agreed website updates.',
    mainQuestion: 'Setup, term, monthly maintenance scope and external booking subscription',
    icon: 'managed',
  },
  {
    id: 'integrated',
    index: '04',
    model: 'Integrated platform',
    bestSuitedTo:
      'Barbershops wanting a branded website, online bookings and everyday management tools together.',
    mainQuestion: 'Ongoing SaaS fee, platform dependence, domain/data transfer and exact included tools',
    emphasized: true,
    badge: 'WEBSITE + BOOKINGS',
    icon: 'integrated',
  },
] as const;

export type CostFaqItem = {
  id: string;
  question: string;
  answer: string[];
};

export const COST_PAGE_FAQS: readonly CostFaqItem[] = [
  {
    id: 'how-much',
    question: 'How much does a barbershop website cost in the UK?',
    answer: [
      'There is no single UK price. Published offers range from one-off one-page projects (for example Jones Digital’s £199 Starter) to managed sites with a setup fee and monthly care (for example FadeFoundry’s limited founding offer) and integrated website-plus-booking subscriptions such as Full KERSIVO at £39/month per location.',
      'Always check what is included — hosting, domain, bookings and ongoing changes — before comparing numbers. Supplier prices can change.',
    ],
  },
  {
    id: 'one-off-vs-monthly',
    question: 'Is a one-off website cheaper than a monthly website?',
    answer: [
      'It depends on how long you keep the site, what you pay for hosting and care afterwards, and whether online booking is included or bought separately.',
      'The illustrative 12- and 36-month examples on this page use fictional inputs to show the arithmetic — they are not supplier quotes or a savings guarantee.',
    ],
  },
  {
    id: 'separate-booking',
    question: 'Do I need separate booking software for my barbershop website?',
    answer: [
      'Some simple sites only link out to a booking provider you already pay for. Managed website offers often connect buttons to Nearcut, Booksy, Fresha or similar, while the booking subscription stays separate.',
      'Integrated platforms such as Full KERSIVO include the booking flow in the same monthly subscription. Redirect, embedded third-party booking and owned integrated booking are different products.',
    ],
  },
  {
    id: 'several-barbers',
    question: 'What should a barbershop with several barbers look for?',
    answer: [
      'Ask whether customers can choose a specific barber, see individual availability, book a clear service and time, and whether the shop gets a usable diary for day-to-day management.',
      'Not every shop needs the same feature set — treat this as an evaluation checklist, not a requirement that every four-chair shop must buy the same software.',
    ],
  },
  {
    id: 'ownership-cancel',
    question: 'Who owns the domain, website and client data if I cancel?',
    answer: [
      'Rights depend on the supplier. With Full KERSIVO your brand, content and domain rights stay with the shop; KERSIVO does not transfer the platform source code, and normal site hosting ends when the paid term ends.',
      'You may request one free CSV export of available business data within the Commercial Offer’s 60-day inactive retention window, subject to identity checks and technical limits.',
    ],
  },
  {
    id: 'setup-commission',
    question: 'Does Full KERSIVO charge a setup fee or booking commission?',
    answer: [
      `Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per physical location with no separate standard setup fee and 0% KERSIVO commission on bookings and retail.`,
      'Standard Stripe card-processing fees still apply. One standard domain arrangement is included; premium domains and other exceptions are agreed separately. SMS reminders are subject to a monthly allowance — not unlimited.',
    ],
  },
  {
    id: 'go-live-billing',
    question: 'How long does a KERSIVO website take to go live, and when does billing start?',
    answer: [
      'We normally aim to prepare the website roughly 1–2 weeks after receiving all required information. That depends on assets, migration and approval — it is not a guaranteed launch date.',
      `The £${SAAS_MONTHLY_GBP} subscription starts when you pay / purchase, not when the site goes live. You can cancel under the published subscription terms.`,
    ],
  },
] as const;

export const COST_CHECKLIST_QUESTIONS = [
  'Is this a one-off project, a monthly service or a combination?',
  'Is online booking included or is it just a link to another booking platform?',
  'What will I pay for the site, booking software, domain and care after 12 and 36 months?',
  'Who controls the domain, content and source code?',
  'What card-processing, booking or marketplace fees are separate?',
  'Which changes can I make myself, and what costs extra?',
  'If I cancel, can I move the domain and export the data I need?',
] as const;

export function buildBarbershopWebsiteCostWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBERSHOP_WEBSITE_COST_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BARBERSHOP_WEBSITE_COST_PAGE_TITLE,
    description: BARBERSHOP_WEBSITE_COST_PAGE_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
  };
}

export function buildBarbershopWebsiteCostBreadcrumbJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBERSHOP_WEBSITE_COST_PAGE_PATH}`;
  const parentUrl = `${siteUrl}${BARBERSHOP_WEBSITES_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: BARBERSHOP_WEBSITE_COST_BREADCRUMB_PARENT,
        item: parentUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: BARBERSHOP_WEBSITE_COST_BREADCRUMB_CURRENT,
        item: pageUrl,
      },
    ],
  };
}

/** WebPage + BreadcrumbList only — no FAQPage, Product, Review or AggregateRating. */
export function buildBarbershopWebsiteCostJsonLd(): Record<string, unknown>[] {
  return [buildBarbershopWebsiteCostWebPageJsonLd(), buildBarbershopWebsiteCostBreadcrumbJsonLd()];
}
