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

/**
 * Intent split (audit P2-1, founder decision 26 Nov 2026): this page owns "barbershop website design" in
 * the UK as a design guide that also sells KERSIVO's design (it earns the best CTR on the site); the
 * "what should a barbershop website include, with booking" intent lives on /barbershop-websites, and the
 * "barbershop website design {city}" intent on the city pages, which link here for the national term.
 *
 * Title and description lead with the free preview while FREE_PREVIEW_FLOW_ENABLED is on (the page's
 * primary CTA); without the flow they fall back to the price-led pair, so the snippet never promises a
 * preview the page does not offer.
 */
export const BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE = `Barbershop Website Design UK: Free Preview, Then £${SAAS_MONTHLY_GBP}/mo`;

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION = `See your barbershop website designed before you pay: your name, photos, barbers and prices, with booking built in. Free preview, no card. Then £${SAAS_MONTHLY_GBP}/month.`;

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE_NO_PREVIEW = `Barbershop Website Design UK | Custom Sites £${SAAS_MONTHLY_GBP}/mo`;

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION_NO_PREVIEW = `Barbershop website design around your name, photos and barbers, with booking built in. Your own domain, £${SAAS_MONTHLY_GBP}/month per location, no setup fee.`;

export function getBarbershopWebsiteDesignSeo(freePreview: boolean): { title: string; description: string } {
  return freePreview
    ? { title: BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE, description: BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION }
    : { title: BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE_NO_PREVIEW, description: BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION_NO_PREVIEW };
}

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_H1 = WD_HERO_TITLE_LINES.join(' ');

/** Published design guide and design-service page, with reciprocal pillar links and canonical WebPage schema. */
export const BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE = true;

/** One line for /llms.txt: what the page answers, in the order it answers it, then the service it sells. */
export const BARBERSHOP_WEBSITE_DESIGN_LLMS_SUMMARY =
  `barbershop website design for UK shops: the first-glance test (what a client decides before they scroll), mobile UX for one-handed booking (thumb zone, tap targets, hierarchy), branding, photography and a 10-point self-check, with the real Heritage Grooming demo as the worked example, then how Full KERSIVO designs the website around the shop with booking built in (£${SAAS_MONTHLY_GBP}/month per location, no setup fee)`;

const SERVICE_NAME = 'Barbershop website design';

/** Image shown as the page's main picture: the real Heritage Grooming demo home page on a laptop. */
const PRIMARY_IMAGE_PATH = '/images/home-v2/heritage-stage-desktop-top.webp';

/**
 * The guide as a WebPage: its short answer is speakable, its chapters are parts with their own anchors,
 * and its main entity is the self-check, published as an ItemList of design checks. Name and description
 * follow the same free-preview flag as the page's <title> and meta description.
 */
export function buildBarbershopWebsiteDesignJsonLd(dateModified?: string, freePreview = true): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}`;
  const seo = getBarbershopWebsiteDesignSeo(freePreview);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: seo.title,
    headline: BARBERSHOP_WEBSITE_DESIGN_PAGE_H1,
    description: seo.description,
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
