/**
 * /insights/editorial-standards — how KERSIVO Insights is written and checked (GEO/AEO stage 5, E-E-A-T).
 * Every statement here describes what the published articles already do; see docs/seo/geo-aeo-5-changelog.md.
 * Article JSON-LD points at this page through `publishingPrinciples`.
 */
import { buildAbsoluteUrl } from '@/lib/seo/meta';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { KERSIVO_CONTACT_EMAIL } from '@/lib/seo/footerSocialLinks';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const EDITORIAL_STANDARDS_PATH = '/insights/editorial-standards';
export const EDITORIAL_STANDARDS_TITLE = 'Editorial Standards: How KERSIVO Insights Is Checked';
export const EDITORIAL_STANDARDS_DESCRIPTION =
  'How KERSIVO Insights articles are sourced, dated and corrected, how worked examples are labelled, and how KERSIVO’s own interest is made clear.';
export const EDITORIAL_STANDARDS_H1 = 'How KERSIVO Insights is written and checked';
export const EDITORIAL_STANDARDS_BREADCRUMB = 'Editorial standards';
export const EDITORIAL_STANDARDS_LAST_UPDATED_ISO = '2026-11-26';
export const EDITORIAL_STANDARDS_LAST_UPDATED_LABEL = '26 November 2026';

/** Answer-first block under the H1: the whole policy in one quotable paragraph. */
export const EDITORIAL_STANDARDS_SHORT_ANSWER = {
  question: 'How are KERSIVO Insights articles checked?',
  answer:
    'Every price, rate and rule in a KERSIVO Insights article links to the organisation that sets it. Worked examples say they are examples and show their inputs. Each article shows when it was published and when it was last revised, and is corrected when a reader shows it is wrong. KERSIVO makes booking software, and articles say so when they mention it.',
} as const;

export type EditorialStandardsSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

export const EDITORIAL_STANDARDS_SECTIONS: readonly EditorialStandardsSection[] = [
  {
    id: 'who-writes-it',
    title: 'Who writes KERSIVO Insights?',
    paragraphs: [
      'KERSIVO Insights is published by KERSIVO for people who own or run an independent barbershop in the UK. Articles carry the KERSIVO name rather than a personal byline, and KERSIVO is responsible for each one: what it says, the sources behind it and putting it right when it is wrong.',
    ],
  },
  {
    id: 'sources',
    title: 'Where do the facts come from?',
    paragraphs: [
      'Figures and rules come from the organisation that sets them: GOV.UK and HMRC for pay, tax and business rates, the Health and Safety Executive for workplace health, the ASA and CAP Code for advertising, and each platform’s own UK pricing and help pages for its fees.',
      'Every article ends with a References or Sources list that names and links each source, usually with the date it was checked. We do not invent figures, surveys, customer stories or quotes.',
    ],
  },
  {
    id: 'worked-examples',
    title: 'How are worked examples labelled?',
    paragraphs: [
      'When an article models a shop, such as a four-chair profit example or the cost of a no-show, it says that the shop is an example, sets out the inputs and shows the working. The result is an illustration of what changes when the inputs change, not a benchmark and not a real shop’s results.',
    ],
  },
  {
    id: 'dates',
    title: 'What do the dates on an article mean?',
    paragraphs: [
      'Each article shows the date it was published. When an article is revised after publication, an “Updated” date appears next to it and in the page’s structured data. Sources are rechecked when an article is revised.',
    ],
  },
  {
    id: 'kersivo-interest',
    title: 'How is KERSIVO’s own interest made clear?',
    paragraphs: [
      'KERSIVO sells booking software and websites to barbershops. Where an article touches bookings, payments or websites, it may end with a short, clearly separated note about how KERSIVO handles that. The article itself answers the question first and is written to be useful whether or not you use KERSIVO.',
      'Photographs are editorial. The shops and people in them are not presented as KERSIVO customers.',
    ],
  },
  {
    id: 'not-advice',
    title: 'Is this legal, tax or financial advice?',
    paragraphs: [
      'No. Articles on law, tax, employment and pay explain the general rules in the UK as they stood on the date checked. For a decision that depends on your own circumstances, check the current official guidance and speak to a qualified adviser.',
    ],
  },
  {
    id: 'corrections',
    title: 'How do I report a mistake?',
    paragraphs: [
      `Email ${KERSIVO_CONTACT_EMAIL} with the article and, if you have it, the source that shows the error. We check it against the source. If the article needs to change, we correct it and show the new “Updated” date.`,
    ],
  },
] as const;

export function buildEditorialStandardsJsonLd(): Record<string, unknown>[] {
  const siteUrl = getPublicSiteUrl();
  const url = buildAbsoluteUrl(EDITORIAL_STANDARDS_PATH);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: EDITORIAL_STANDARDS_H1,
      description: EDITORIAL_STANDARDS_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: EDITORIAL_STANDARDS_LAST_UPDATED_ISO,
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      publisher: { '@id': getKersivoOrganizationId(siteUrl) },
      about: { '@id': getKersivoOrganizationId(siteUrl) },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'KERSIVO', item: buildAbsoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Insights', item: buildAbsoluteUrl('/insights') },
        { '@type': 'ListItem', position: 3, name: EDITORIAL_STANDARDS_BREADCRUMB, item: url },
      ],
    },
  ];
}

/**
 * schema.org `citation` entries from the rendered References/Sources section of an article.
 * Only links with a real path count (a bare "GOV.UK" home link labelling a source is skipped).
 */
export function extractInsightsCitations(refsHtml: string): Array<{ '@type': 'CreativeWork'; name: string; url: string }> {
  const out: Array<{ '@type': 'CreativeWork'; name: string; url: string }> = [];
  const seen = new Set<string>();
  const blocks = refsHtml.split(/<(?:li|p)\b[^>]*>/i).slice(1);
  for (const block of blocks) {
    const title = block.match(/<em>([\s\S]*?)<\/em>/i)?.[1];
    for (const match of block.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = match[1].replace(/&amp;/g, '&');
      let parsed: URL;
      try {
        parsed = new URL(href);
      } catch {
        continue;
      }
      if (parsed.pathname === '/' || parsed.pathname === '') continue;
      const key = href.replace(/^http:/, 'https:').replace(/\/$/, '');
      if (seen.has(key)) continue;
      seen.add(key);
      const text = stripTags(match[2]);
      const looksLikeUrl = /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(text);
      const name = stripTags(looksLikeUrl && title ? title : text) || parsed.hostname;
      out.push({ '@type': 'CreativeWork', name, url: href });
    }
  }
  return out;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
