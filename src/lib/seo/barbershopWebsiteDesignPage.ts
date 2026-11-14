import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { buildBreadcrumbListJsonLd, BARBERSHOP_WEBSITE_DESIGN_BREADCRUMBS } from '@/lib/seo/breadcrumbs';
import { WD_FAQS, WD_HERO_TITLE_LINES } from '@/lib/seo/barbershopWebsiteDesignContent';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH = '/barbershop-website-design';

/** Design intent (layout, branding, mobile UX); "do I need a website" intent lives on /barbershop-websites. */
export const BARBERSHOP_WEBSITE_DESIGN_PAGE_TITLE =
  'Barbershop Website Design: Layout, Branding & UX | KERSIVO';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_DESCRIPTION =
  'Barbershop website design for UK shops: the layout, branding, photography and mobile UX that make a site look professional and turn visitors into bookings.';

export const BARBERSHOP_WEBSITE_DESIGN_PAGE_H1 = WD_HERO_TITLE_LINES.join(' ');

/** Published design guide, with reciprocal pillar links and canonical WebPage schema. */
export const BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE = true;

export function buildBarbershopWebsiteDesignJsonLd(): Record<string, unknown> {
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
    inLanguage: 'en-GB',
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    breadcrumb: buildBreadcrumbListJsonLd(BARBERSHOP_WEBSITE_DESIGN_BREADCRUMBS, { siteUrl, withContext: false }),
  };
}

/** FAQPage that mirrors the visible FAQ on the page, word for word. */
export function buildBarbershopWebsiteDesignFaqJsonLd(): Record<string, unknown> {
  const pageUrl = `${getPublicSiteUrl()}${BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: WD_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}
