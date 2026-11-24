/**
 * Registry and SEO builders for city landing pages at /barbershop-websites/{slug}.
 * Add a city only by adding its own research file (see docs/seo/city-pages-playbook.md) and listing it
 * in PUBLISHED_CITY_PAGES; the route, sitemap, hub links and JSON-LD all follow this list.
 */
import { getBooksySource } from '@/lib/seo/booksyFacts';
import { getFreshaSource } from '@/lib/seo/freshaFacts';
import { getTreatwellSource } from '@/lib/seo/treatwellFacts';
import { BOOKSY_FACTS_CHECKED_ISO } from '@/lib/seo/booksyFacts';
import { FRESHA_FACTS_CHECKED_ISO } from '@/lib/seo/freshaFacts';
import { TREATWELL_FACTS_CHECKED_ISO } from '@/lib/seo/treatwellFacts';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  BARBERSHOP_WEBSITES_BREADCRUMBS,
  buildBreadcrumbListJsonLd,
  type BreadcrumbTrailItem,
} from '@/lib/seo/breadcrumbs';
import { buildKersivoSoftwareApplicationJsonLd } from '@/lib/seo/barberDemoJsonLd';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { BIRMINGHAM_CITY_PAGE } from './birmingham';
import { BOURNEMOUTH_CITY_PAGE } from './bournemouth';
import { LONDON_CITY_PAGE } from './london';
import type { CityFaq, CityPage, CitySource } from './types';

export type { CityPage, CityFaq, CitySource } from './types';

export const CITY_PAGES_BASE_PATH = '/barbershop-websites';

/** Published cities, in the order the hub lists them. */
export const PUBLISHED_CITY_PAGES: readonly CityPage[] = [LONDON_CITY_PAGE, BIRMINGHAM_CITY_PAGE, BOURNEMOUTH_CITY_PAGE];

/** "St Albans" → "st-albans", "Newcastle upon Tyne" → "newcastle-upon-tyne". */
export function toCitySlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getCityPagePath(city: Pick<CityPage, 'slug'>): string {
  return `${CITY_PAGES_BASE_PATH}/${city.slug}`;
}

export function getCityPage(slug: string | undefined): CityPage | undefined {
  if (!slug) return undefined;
  return PUBLISHED_CITY_PAGES.find((city) => city.slug === slug.toLowerCase());
}

export const CITY_TITLE_MAX_LENGTH = 60;

/** Full form first; the shorter form only when a long city name would push it past 60 characters. */
export function buildCityPageTitle(name: string): string {
  const full = `Barbershop Website Design ${name} | £${SAAS_MONTHLY_GBP}/mo | KERSIVO`;
  if (full.length <= CITY_TITLE_MAX_LENGTH) return full;
  return `Barbershop Websites ${name} | £${SAAS_MONTHLY_GBP}/mo | KERSIVO`;
}

export const CITY_DESCRIPTION_MAX_LENGTH = 160;

/**
 * Full form first. Longer city names drop "flat", then "Custom ", so the description stays within
 * 160 characters (e.g. "Bournemouth" would be 161 with the full form; "Birmingham" fits at 160).
 */
export function buildCityPageDescription(name: string): string {
  const offer = `Own domain, online booking, deposits and a retail pickup shop for £${SAAS_MONTHLY_GBP}/month`;
  const candidates = [
    `Custom barbershop website design for ${name} shops. ${offer} flat — 0% KERSIVO commission.`,
    `Custom barbershop website design for ${name} shops. ${offer} — 0% KERSIVO commission.`,
    `Barbershop website design for ${name} shops. ${offer} — 0% KERSIVO commission.`,
  ];
  return candidates.find((text) => text.length <= CITY_DESCRIPTION_MAX_LENGTH) ?? candidates[candidates.length - 1];
}

export function buildCityPageH1(city: CityPage): string {
  return `${city.h1Lead} ${city.h1Mark}`;
}

/** Home › Barbershop Websites › {City}; drives both the visible trail and BreadcrumbList. */
export function getCityBreadcrumbs(city: CityPage): readonly BreadcrumbTrailItem[] {
  return [...BARBERSHOP_WEBSITES_BREADCRUMBS, { name: city.name, path: getCityPagePath(city) }];
}

export function getCityFaqs(city: CityPage): readonly CityFaq[] {
  return city.faqs;
}

/** The city's own sources plus the official competitor pages behind the calculator and FAQ. */
export function getCityPageSources(city: CityPage): readonly CitySource[] {
  const booksyBoost = getBooksySource('boost');
  const booksyClients = getBooksySource('clientList');
  const booksyPricing = getBooksySource('pricingUk');
  const freshaPricing = getFreshaSource('pricingUk');
  const freshaClients = getFreshaSource('clientExport');
  const treatwellPricing = getTreatwellSource('pricingUk');
  const competitor: CitySource[] = [
    { id: 'booksyPricing', label: booksyPricing.label, url: booksyPricing.url, supports: 'Booksy subscription and additional user prices', checkedIso: BOOKSY_FACTS_CHECKED_ISO },
    { id: 'booksyBoost', label: booksyBoost.label, url: booksyBoost.url, supports: 'the Boost one-time new-client fee and its minimum', checkedIso: BOOKSY_FACTS_CHECKED_ISO },
    { id: 'booksyClients', label: booksyClients.label, url: booksyClients.url, supports: 'requesting a client list from Booksy Support', checkedIso: BOOKSY_FACTS_CHECKED_ISO },
    { id: 'freshaPricing', label: freshaPricing.label, url: freshaPricing.url, supports: 'Fresha plan prices and the Marketplace new-client fee', checkedIso: FRESHA_FACTS_CHECKED_ISO ?? city.checkedIso },
    { id: 'freshaClients', label: freshaClients.label, url: freshaClients.url, supports: 'exporting a Fresha client list', checkedIso: FRESHA_FACTS_CHECKED_ISO ?? city.checkedIso },
    { id: 'treatwellPricing', label: treatwellPricing.label, url: treatwellPricing.url, supports: 'Treatwell’s commission on eligible new marketplace clients', checkedIso: TREATWELL_FACTS_CHECKED_ISO },
  ];
  return [...city.sources, ...competitor];
}

function pageUrl(city: CityPage, siteUrl = getPublicSiteUrl()): string {
  return `${siteUrl}${getCityPagePath(city)}`;
}

export function buildCityWebPageJsonLd(city: CityPage): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(city, siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: buildCityPageTitle(city.name),
    headline: buildCityPageH1(city),
    description: buildCityPageDescription(city.name),
    inLanguage: 'en-GB',
    dateModified: city.checkedIso,
    isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
    publisher: { '@id': getKersivoOrganizationId(siteUrl) },
    about: { '@id': `${siteUrl}/#software` },
    hasPart: { '@id': `${url}#faq` },
    breadcrumb: { '@id': `${url}#breadcrumb` },
    spatialCoverage: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'Country', name: 'United Kingdom' } },
  };
}

/**
 * The shared KERSIVO SoftwareApplication block (Starter £0.00 and Full KERSIVO £39.00 offers, no ratings)
 * with `url` set to the city page, so the page's software block points at the page it is on.
 * The @id stays the shared #software node that WebPage.about references.
 */
export function buildCitySoftwareApplicationJsonLd(city: CityPage): Record<string, unknown> {
  return { ...buildKersivoSoftwareApplicationJsonLd(), url: pageUrl(city) };
}

export function buildCityBreadcrumbJsonLd(city: CityPage): Record<string, unknown> {
  return buildBreadcrumbListJsonLd(getCityBreadcrumbs(city));
}

/** FAQPage built from the FAQ the page renders, word for word. */
export function buildCityFaqJsonLd(city: CityPage): Record<string, unknown> {
  const url = pageUrl(city);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url,
    inLanguage: 'en-GB',
    mainEntity: getCityFaqs(city).map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer.join(' ') },
    })),
  };
}
