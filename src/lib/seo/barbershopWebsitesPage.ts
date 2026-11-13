import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { buildBreadcrumbListJsonLd, BARBERSHOP_WEBSITES_BREADCRUMBS } from '@/lib/seo/breadcrumbs';
import { STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';

export const BARBERSHOP_WEBSITES_PAGE_PATH = '/barbershop-websites';

/**
 * Keyword split for the websites cluster:
 * - this page owns "barbershop website" (why own one, what it includes, how clients book, online presence);
 * - /barbershop-website-design owns "design" queries (branding, layout, photography, mobile design);
 * - /barbershop-online-booking owns booking-system queries.
 */
/**
 * Commercial intent first: searchers for "barbershop website" want one, so the snippet leads with the
 * offer (own domain, booking built in, the price) and stays under ~60 / ~160 characters so Google
 * shows it whole.
 */
export const BARBERSHOP_WEBSITES_PAGE_TITLE =
  `Barbershop Website UK with Online Booking – £${SAAS_MONTHLY_GBP}/mo | KERSIVO`;

export const BARBERSHOP_WEBSITES_PAGE_DESCRIPTION =
  `A barbershop website on your own domain with online booking, deposits and reminders built in. £${SAAS_MONTHLY_GBP}/month per location, no setup fee. Approve it before launch.`;

/** Name of the service entity in JSON-LD and the visible topic of the page. */
export const BARBERSHOP_WEBSITES_SERVICE_NAME = 'Barbershop website with online booking';

export const BARBERSHOP_WEBSITES_PAGE_H1 = 'A barbershop website clients can find, trust and book from';

/** H1 of the previous design, kept at /design-preview/barbershop-websites-v1. */
export const BARBERSHOP_WEBSITES_V1_H1 = 'Barbershop Websites with Online Booking';

/** Published as the canonical pillar of the UK barbershop websites cluster. */
export const BARBERSHOP_WEBSITES_PAGE_INDEXABLE = true;

export type BarbershopWebsitesFaq = {
  id: string;
  question: string;
  answer: string[];
};

/** Visible FAQ on /barbershop-websites. */
export function getBarbershopWebsitesFaqs(freePreview: boolean): BarbershopWebsitesFaq[] {
  return [
    {
      id: 'need',
      question: 'Do I need a website if my barbershop is already on a booking app or Instagram?',
      answer: [
        'A booking-app profile or an Instagram page can bring you clients, but neither is yours. The platform sets the address, the layout and what else appears around your shop, and features vary between providers.',
        'Your own barbershop website gives clients one address with your name on it. You can put it on Google, in your Instagram bio, on your shopfront and in every message you send. Plenty of shops keep their social profiles and point them at their website.',
      ],
    },
    {
      id: 'include',
      question: 'What should a barbershop website include?',
      answer: [
        'At minimum: your services with prices, your barbers, opening hours, address and contact details, real photos of your shop and work, and a clear way to book on every page.',
        'It should also load well on a phone and live on your own domain, so the address clients remember is your shop’s name.',
      ],
    },
    {
      id: 'booking',
      question: 'How do clients book appointments from a barbershop website?',
      answer: [
        'With Full KERSIVO, clients pick a service, a barber and a time on your website, enter their details and get an email confirmation and reminders. SMS reminders are included within a monthly allowance.',
        `You choose how they pay: Pay at shop with nothing upfront, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit capped at the service price, or full payment online. Deposit and full-payment modes need your shop’s connected Stripe account. ${STRIPE_FEES_NOTE}`,
      ],
    },
    {
      id: 'domain',
      question: 'Can I use my existing domain?',
      answer: [
        'Yes. Your domain remains yours, and you do not need to transfer it to KERSIVO. We help connect it to the website while you continue renewing it with your existing registrar.',
        'If you do not have a domain, one standard domain is included. Premium or unusually expensive names are not included as standard.',
      ],
    },
    {
      id: 'ownership',
      question: 'Do I own my website?',
      answer: [
        'Your business name, brand, photos, content and domain stay yours. You can export eligible business data under our terms.',
        'The website runs on the KERSIVO platform: its software, templates, source code and hosting are not transferred to you. Standard websites include a subtle “Powered by KERSIVO” mark.',
      ],
    },
    {
      id: 'cost',
      question: 'How much does a barbershop website cost with KERSIVO?',
      answer: freePreview
        ? [
            `Full KERSIVO costs £${SAAS_MONTHLY_GBP}/month per physical location, not per barber, with no separate standard setup fee. You don't pay anything for your preview. If you decide to launch, your first £${SAAS_MONTHLY_GBP} payment is taken when you subscribe, then monthly on the same day.`,
            `KERSIVO takes 0% commission on bookings and retail. ${STRIPE_FEES_NOTE}`,
          ]
        : [
            `Full KERSIVO costs £${SAAS_MONTHLY_GBP}/month per physical location, not per barber, with no separate standard setup fee. Your first payment is taken when you subscribe; monthly billing continues while we prepare your website.`,
            `KERSIVO takes 0% commission on bookings and retail. ${STRIPE_FEES_NOTE}`,
          ],
    },
    {
      id: 'timing',
      question: 'How long does it take to get my website live?',
      answer: [
        'Setup typically takes a few days once we receive the information needed. You will approve a private website preview before launch. This is an estimate, not a guaranteed date.',
        'We can help move eligible information exported from your existing booking provider. Some history may not transfer, and domain access or data migration can take longer. Where possible, your current bookings can continue while we prepare the site.',
      ],
    },
    {
      id: 'cancel',
      question: 'Can I cancel at any time?',
      answer: [
        'Yes. There is no minimum term or notice period. Full stays active until the end of your current paid billing period, with no pro-rata refund for unused time.',
        'Your branded website and Full-only features end when Full ends. You may be able to move to Starter before then if your shop meets its requirements. That change is not automatic.',
      ],
    },
    {
      id: 'starter',
      question: 'Is there a free option without a website?',
      answer: [
        'KERSIVO Starter is a £0/month KERSIVO-hosted booking page within its published limits; it is not the Full branded website and does not include your own domain.',
        `Starter requires a payment-ready Stripe Connect Standard account before customers can book online. ${STRIPE_FEES_NOTE}`,
      ],
    },
  ];
}

function pageUrlFor(siteUrl: string): string {
  return `${siteUrl}${BARBERSHOP_WEBSITES_PAGE_PATH}`;
}

/** WebPage linked into KERSIVO's WebSite/Organization entities, pointing at the service and the FAQ blocks. */
export function buildBarbershopWebsitesJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = pageUrlFor(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BARBERSHOP_WEBSITES_PAGE_TITLE,
    headline: BARBERSHOP_WEBSITES_PAGE_H1,
    description: BARBERSHOP_WEBSITES_PAGE_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    about: { '@id': `${pageUrl}#service` },
    mainEntity: { '@id': `${pageUrl}#service` },
    hasPart: { '@id': `${pageUrl}#faq` },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: `${siteUrl}/images/barbershop-websites/site-hero-1100.webp`,
    },
    breadcrumb: buildBreadcrumbListJsonLd(BARBERSHOP_WEBSITES_BREADCRUMBS, { siteUrl, withContext: false }),
  };
}

/**
 * The service this page sells, with the real Full KERSIVO price as its Offer (per location, monthly).
 * No ratings, reviews or customer numbers are published.
 */
export function buildBarbershopWebsitesServiceJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = pageUrlFor(siteUrl);
  const organizationId = getKersivoOrganizationId(siteUrl);
  const uk = { '@type': 'Country', name: 'United Kingdom', identifier: 'GB' };
  const price = SAAS_MONTHLY_GBP.toFixed(2);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: BARBERSHOP_WEBSITES_SERVICE_NAME,
    serviceType: 'Barbershop website',
    url: pageUrl,
    description:
      'A branded website for an independent barbershop on its own domain, with services and prices, barbers, opening hours, and online booking with payment control and reminders, set up by KERSIVO.',
    provider: { '@id': organizationId },
    areaServed: uk,
    audience: { '@type': 'BusinessAudience', audienceType: 'Independent barbershops' },
    offers: {
      '@type': 'Offer',
      name: 'Full KERSIVO',
      url: `${siteUrl}/pricing`,
      price,
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      eligibleRegion: uk,
      seller: { '@id': organizationId },
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price,
        priceCurrency: 'GBP',
        billingDuration: 'P1M',
        unitText: 'per location per month',
      },
    },
  };
}

/** FAQPage built from the FAQ rendered on the page, so the markup always matches the visible answers. */
export function buildBarbershopWebsitesFaqJsonLd(freePreview: boolean): Record<string, unknown> {
  const pageUrl = pageUrlFor(getPublicSiteUrl());
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    url: pageUrl,
    inLanguage: 'en-GB',
    mainEntity: getBarbershopWebsitesFaqs(freePreview).map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer.join(' ') },
    })),
  };
}
