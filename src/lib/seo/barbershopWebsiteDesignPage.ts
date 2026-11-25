import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { buildBreadcrumbListJsonLd, BARBERSHOP_WEBSITE_DESIGN_BREADCRUMBS } from '@/lib/seo/breadcrumbs';
import {
  WD_AUDIT_ITEMS,
  WD_CHAPTERS,
  WD_FAQS,
  WD_HERO_TITLE_LINES,
  WD_SHORT_ANSWER,
} from '@/lib/seo/barbershopWebsiteDesignContent';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH = '/barbershop-website-design';

/** Design intent (layout, branding, mobile UX); "do I need a website" intent lives on /barbershop-websites. */
export const BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE =
  'Barbershop Website Design UK | Custom Sites £39/mo';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION =
  'Custom barbershop website design for UK shops. Online booking, deposits, retail pickup shop and your own domain for £39/month. See a free preview first.';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_H1 = WD_HERO_TITLE_LINES.join(' ');

/** Published design guide, with reciprocal pillar links and canonical WebPage schema. */
export const BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE = true;

/** One line for /llms.txt: what this guide answers, in the order the page answers it. */
export const BARBERSHOP_WEBSITE_DESIGN_LLMS_SUMMARY =
  'design guide for UK barbershop websites: the first-glance test (what a client decides before they scroll), mobile UX for one-handed booking (thumb zone, tap targets, hierarchy), branding, photography and a 10-point self-check, with the real Heritage Grooming demo as the worked example';

const SERVICE_NAME = 'Barbershop website design';

/** Image shown as the page's main picture: the real Heritage Grooming demo home page on a laptop. */
const PRIMARY_IMAGE_PATH = '/images/home-v2/heritage-stage-desktop-top.webp';

/**
 * The guide as a WebPage: its short answer is speakable, its chapters are parts with their own anchors,
 * and its main entity is the self-check, published as an ItemList of design checks.
 */
export function buildBarbershopWebsiteDesignJsonLd(dateModified?: string): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE,
    headline: BARBERSHOP_WEBSITE_DESIGN_PAGE_H1,
    description: BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION,
    abstract: WD_SHORT_ANSWER.answer,
    inLanguage: 'en-GB',
    ...(dateModified ? { dateModified } : {}),
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    about: [
      { '@type': 'Thing', name: 'Barbershop website design' },
      { '@type': 'Thing', name: 'Mobile user experience' },
      { '@type': 'Thing', name: 'Visual hierarchy' },
      { '@type': 'Thing', name: 'Brand identity' },
      { '@type': 'Thing', name: 'Business photography' },
    ],
    audience: { '@type': 'BusinessAudience', audienceType: 'Independent barbershop owners in the United Kingdom' },
    primaryImageOfPage: { '@type': 'ImageObject', url: `${siteUrl}${PRIMARY_IMAGE_PATH}`, width: 1600, height: 1000 },
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#wd-answer-heading', '[data-speakable]'] },
    hasPart: WD_CHAPTERS.map((chapter) => ({
      '@type': 'WebPageElement',
      name: chapter.label,
      url: `${pageUrl}#${chapter.id}`,
    })),
    mainEntity: {
      '@type': 'ItemList',
      '@id': `${pageUrl}#self-check`,
      name: 'Barbershop website design checklist',
      numberOfItems: WD_AUDIT_ITEMS.length,
      itemListElement: WD_AUDIT_ITEMS.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.text })),
    },
    mentions: { '@id': `${pageUrl}#service` },
    breadcrumb: buildBreadcrumbListJsonLd(BARBERSHOP_WEBSITE_DESIGN_BREADCRUMBS, { siteUrl, withContext: false }),
  };
}

/** The service the guide closes on: Full KERSIVO's website design, with its real monthly price per location. */
export function buildBarbershopWebsiteDesignServiceJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}`;
  const organizationId = getKersivoOrganizationId(siteUrl);
  const uk = { '@type': 'Country', name: 'United Kingdom', identifier: 'GB' };
  const price = SAAS_MONTHLY_GBP.toFixed(2);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: SERVICE_NAME,
    serviceType: 'Website design for barbershops',
    url: pageUrl,
    description:
      'A barbershop website designed around the shop’s own name, logo, colours, photos and barbers, mobile-first, with online booking built into the design, on the shop’s own domain. Part of Full KERSIVO.',
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

/** FAQPage that mirrors the visible FAQ on the page, word for word. */
export function buildBarbershopWebsiteDesignFaqJsonLd(): Record<string, unknown> {
  const pageUrl = `${getPublicSiteUrl()}${BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    url: pageUrl,
    inLanguage: 'en-GB',
    mainEntity: WD_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}
