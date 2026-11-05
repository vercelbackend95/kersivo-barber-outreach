/**
 * schema.org JSON-LD for a shop website, generated from SiteData only (never hand-written).
 *
 * One `@graph` per page with stable `@id`s anchored on the site's canonical URL:
 *   {canonical}#website, {canonical}#barbershop, {canonical}#services, {productUrl}#product,
 *   {pageUrl}#breadcrumb.
 * No Review / AggregateRating: KERSIVO has no verified review data.
 */
import { WEEKDAYS, pricePenceToDecimal, formatPricePence } from './format';
import type { SiteData, SiteOpeningDay, SiteProduct, SiteService } from './types';

export type SitePageKey = 'home' | 'services' | 'team' | 'contact' | 'shop';

type JsonLdNode = Record<string, unknown>;

function withoutEmpty(node: JsonLdNode): JsonLdNode {
  const out: JsonLdNode = {};
  for (const [key, value] of Object.entries(node)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

function siteRoot(canonicalUrl: string): string {
  return canonicalUrl.replace(/#.*$/, '');
}

export function barberShopId(canonicalUrl: string): string {
  return `${siteRoot(canonicalUrl)}#barbershop`;
}

function openingHoursSpecification(days: SiteOpeningDay[]): JsonLdNode[] {
  const specs: JsonLdNode[] = [];
  for (const day of days) {
    if (!day.isOpen) continue; // closed days are omitted
    const schemaDay = WEEKDAYS[day.dayOfWeek - 1].schemaDay;
    for (const period of day.periods) {
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: schemaDay,
        opens: period.opens,
        closes: period.closes,
      });
    }
  }
  return specs;
}

function specialOpeningHours(site: SiteData): JsonLdNode[] {
  return site.openingHours.exceptions.flatMap((ex) => {
    // Google: a closed day is opens = closes = "00:00" with validFrom/validThrough on that date.
    const periods = ex.closed ? [{ opens: '00:00', closes: '00:00' }] : ex.periods;
    return periods.map((p) => ({
      '@type': 'OpeningHoursSpecification',
      validFrom: ex.date,
      validThrough: ex.date,
      opens: p.opens,
      closes: p.closes,
    }));
  });
}

/** "£15–£45", or "£25" when every service costs the same. Null with no priced services. */
export function derivePriceRange(services: SiteService[]): string | null {
  const prices = services.map((s) => s.pricePence).filter((p) => p > 0);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPricePence(min) : `${formatPricePence(min)}–${formatPricePence(max)}`;
}

function serviceOffer(service: SiteService, sellerId: string): JsonLdNode {
  const price = pricePenceToDecimal(service.pricePence);
  return withoutEmpty({
    '@type': 'Offer',
    itemOffered: withoutEmpty({
      '@type': 'Service',
      name: service.name,
      description: service.description,
      category: service.category,
    }),
    ...(service.priceFrom
      ? {
          priceSpecification: {
            '@type': 'PriceSpecification',
            minPrice: price,
            priceCurrency: 'GBP',
          },
        }
      : { price, priceCurrency: 'GBP' }),
    seller: { '@id': sellerId },
  });
}

function offerCatalog(site: SiteData, sellerId: string): JsonLdNode | null {
  if (!site.has.services) return null;
  const root = siteRoot(site.seo.canonicalUrl);
  return {
    '@type': 'OfferCatalog',
    '@id': `${root}#services`,
    name: 'Services',
    itemListElement: site.services.categories.map((category) => ({
      '@type': 'OfferCatalog',
      name: category.name,
      itemListElement: category.services.map((s) => serviceOffer(s, sellerId)),
    })),
  };
}

function productNode(product: SiteProduct, sellerId: string): JsonLdNode | null {
  if (!(product.pricePence > 0)) return null; // Offer only when a price is set
  return withoutEmpty({
    '@type': 'Product',
    '@id': `${product.url}#product`,
    name: product.name,
    description: product.description,
    image: product.imageUrl,
    url: product.url,
    offers: {
      '@type': 'Offer',
      price: pricePenceToDecimal(product.pricePence),
      priceCurrency: 'GBP',
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: product.url,
      seller: { '@id': sellerId },
    },
  });
}

function barberShopNode(site: SiteData, options: { includeCatalog: boolean }): JsonLdNode {
  const root = siteRoot(site.seo.canonicalUrl);
  const id = barberShopId(root);
  const address = site.location.address;
  const hasAddress = address.lines.length > 0;
  return withoutEmpty({
    '@type': 'HairSalon',
    '@id': id,
    name: site.business.name,
    url: root,
    description: site.business.description ?? site.business.tagline,
    telephone: site.location.phone,
    email: site.location.email,
    image: site.business.logoUrl,
    logo: site.business.logoUrl,
    address: hasAddress
      ? withoutEmpty({
          '@type': 'PostalAddress',
          streetAddress: [address.line1, address.line2].filter(Boolean).join(', ') || null,
          addressLocality: address.town,
          postalCode: address.postcode,
          addressCountry: 'GB',
        })
      : null,
    openingHoursSpecification: openingHoursSpecification(site.openingHours.days),
    specialOpeningHoursSpecification: specialOpeningHours(site),
    priceRange: derivePriceRange(site.services.all),
    sameAs: site.business.socialLinks.map((l) => l.url),
    potentialAction:
      site.booking.available && site.booking.url
        ? {
            '@type': 'ReserveAction',
            target: { '@type': 'EntryPoint', urlTemplate: site.booking.url },
            name: site.booking.label,
          }
        : null,
    hasOfferCatalog: options.includeCatalog ? offerCatalog(site, id) : null,
  });
}

function websiteNode(site: SiteData): JsonLdNode {
  const root = siteRoot(site.seo.canonicalUrl);
  return {
    '@type': 'WebSite',
    '@id': `${root}#website`,
    url: root,
    name: site.business.name,
    inLanguage: 'en-GB',
    publisher: { '@id': barberShopId(root) },
  };
}

function breadcrumbNode(site: SiteData, page: { name: string; url: string }): JsonLdNode {
  const root = siteRoot(site.seo.canonicalUrl);
  return {
    '@type': 'BreadcrumbList',
    '@id': `${page.url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: root },
      { '@type': 'ListItem', position: 2, name: page.name, item: page.url },
    ],
  };
}

/**
 * The JSON-LD document for one page. `site.seo` must already carry `canonicalUrl`.
 * - home: WebSite + HairSalon (with service catalogue) + products
 * - services: HairSalon (with catalogue) + breadcrumb
 * - team / contact: HairSalon (no catalogue) + breadcrumb
 * - shop: HairSalon + products + breadcrumb
 */
export function buildSiteJsonLd(
  site: Omit<SiteData, 'seo'> & { seo: Pick<SiteData['seo'], 'canonicalUrl'> },
  page: { key: SitePageKey; name?: string; url?: string } = { key: 'home' },
): Record<string, unknown> {
  const full = site as SiteData;
  const shopId = barberShopId(full.seo.canonicalUrl);
  const includeCatalog = page.key === 'home' || page.key === 'services';
  const graph: JsonLdNode[] = [websiteNode(full), barberShopNode(full, { includeCatalog })];
  if (page.key === 'home' || page.key === 'shop') {
    for (const product of full.products) {
      const node = productNode(product, shopId);
      if (node) graph.push(node);
    }
  }
  if (page.key !== 'home' && page.name && page.url) {
    graph.push(breadcrumbNode(full, { name: page.name, url: page.url }));
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
