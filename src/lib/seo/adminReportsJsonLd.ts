import {
  buildKersivoSoftwareApplicationNode,
} from '@/lib/seo/barberDemoJsonLd';
import { buildBreadcrumbListJsonLd } from '@/lib/seo/breadcrumbs';
import {
  getKersivoOrganizationId,
  getKersivoWebsiteId,
} from '@/lib/seo/kersivoEntityJsonLd';
import {
  KAR_ANSWER,
  KAR_BREADCRUMB_NAME,
  KAR_DESCRIPTION,
  KAR_FAQS,
  KAR_LAST_UPDATED_ISO,
  KAR_METRICS,
  KAR_METRICS_TITLE,
  KAR_PAGE_PATH,
  KAR_PUBLISHED_ISO,
  KAR_TITLE,
} from '@/lib/seo/adminReportsExperience';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

/**
 * /barbershop-reports JSON-LD, one @graph:
 * - WebPage (about the KERSIVO software node, with the visible "In short" answer as its abstract);
 * - the shared SoftwareApplication node (#software), so the page joins the product entity;
 * - FAQPage mirroring the visible FAQ word for word;
 * - DefinedTermSet for the metric glossary, so each metric's definition is machine-readable.
 * Never add ratings or reviews: KERSIVO has none published.
 */
export function buildAdminReportsJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${KAR_PAGE_PATH}`;
  const software = buildKersivoSoftwareApplicationNode(siteUrl);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: KAR_TITLE,
        description: KAR_DESCRIPTION,
        abstract: KAR_ANSWER,
        inLanguage: 'en-GB',
        datePublished: KAR_PUBLISHED_ISO,
        dateModified: KAR_LAST_UPDATED_ISO,
        isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
        publisher: { '@id': getKersivoOrganizationId(siteUrl) },
        about: { '@id': software['@id'] },
        mainEntity: { '@id': software['@id'] },
        hasPart: [{ '@id': `${pageUrl}#faq` }, { '@id': `${pageUrl}#metrics` }],
        breadcrumb: buildBreadcrumbListJsonLd([{ name: KAR_BREADCRUMB_NAME, path: KAR_PAGE_PATH }], {
          siteUrl,
          withContext: false,
        }),
      },
      software,
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: KAR_FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
      {
        '@type': 'DefinedTermSet',
        '@id': `${pageUrl}#metrics`,
        name: KAR_METRICS_TITLE,
        inLanguage: 'en-GB',
        hasDefinedTerm: KAR_METRICS.map((metric) => ({
          '@type': 'DefinedTerm',
          '@id': `${pageUrl}#metric-${metric.id}`,
          name: metric.name,
          description: metric.definition,
          inDefinedTermSet: { '@id': `${pageUrl}#metrics` },
        })),
      },
    ],
  };
}
