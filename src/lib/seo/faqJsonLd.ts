import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

/**
 * Legacy FAQPage builder. The orphaned default FAQ set was removed because every
 * live page passes its own `faqs` into Faq4 and builds page-specific JSON-LD.
 */
export function buildFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faq`,
    mainEntity: [],
  };
}
