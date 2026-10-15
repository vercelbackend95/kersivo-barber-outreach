/**
 * Public information page for KERSIVO SEO Growth, the internal Google Ads API
 * research application. Used as the Application Homepage for Google OAuth
 * brand verification: must stay public, noindex/follow and out of the sitemap.
 */
export const SEO_GROWTH_PAGE_PATH = '/seo-growth';

export const SEO_GROWTH_PAGE_TITLE = 'KERSIVO SEO Growth | Internal SEO Research Tool';

export const SEO_GROWTH_PAGE_DESCRIPTION =
  'KERSIVO SEO Growth is an internal application being developed by KERSIVO to use the Google Ads API for keyword research and UK search demand analysis.';

export const SEO_GROWTH_PAGE_H1 = 'KERSIVO SEO Growth';

export const SEO_GROWTH_PAGE_SUBTITLE = 'Internal Search Research & Analytics Tool';

export const SEO_GROWTH_INTRO_PARAGRAPHS = [
  'KERSIVO SEO Growth is an internal research application being developed by KERSIVO, a UK-based booking and business management platform for independent barbershops.',
  'The application is being built to use the Google Ads API to research keyword demand, analyse search trends and identify opportunities to improve the relevance and usefulness of KERSIVO’s website. The Google Ads API integration is not yet active.',
] as const;

export const SEO_GROWTH_USAGE_INTRO =
  'Once active, KERSIVO SEO Growth will be used for KERSIVO’s own keyword research, including:';

export const SEO_GROWTH_USAGE_ITEMS = [
  'Keyword research and search volume analysis.',
  'Understanding search demand in the UK market.',
  'Identifying relevant content opportunities.',
  'Supporting internal SEO research and planning.',
] as const;

export const SEO_GROWTH_INTERNAL_USE_NOTE =
  'KERSIVO SEO Growth is being developed solely for KERSIVO’s internal use. It is not a public SEO tool and is not offered to KERSIVO customers or other businesses.';

export const SEO_GROWTH_PRIVACY_PARAGRAPHS = [
  'Access to the Google Ads API requires authorisation through Google OAuth. The application is intended to work with keyword planning data, such as keyword ideas and search volume estimates, for KERSIVO’s internal SEO research.',
  'Detailed privacy information for this application is being finalised. For information about how KERSIVO handles personal data across its services, and the terms that govern them, please read the documents below.',
] as const;

export const SEO_GROWTH_CONTACT = {
  organisation: 'KERSIVO',
  websiteUrl: 'https://kersivo.co.uk',
  websiteLabel: 'kersivo.co.uk',
  email: 'bartosz@kersivo.co.uk',
} as const;
