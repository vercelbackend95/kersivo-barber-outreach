/**
 * Pure normaliser: canonical rows → SiteData. No I/O, so it is fully unit-tested
 * (getSiteData.ts does the loading). Every display string comes from ./format.
 */
import { normaliseUkPostcode } from '@/lib/shopData/schema';
import {
  WEEKDAYS,
  formatCalendarDate,
  formatDurationMinutes,
  formatMinutesAsTime,
  formatOpeningPeriods,
  formatPricePence,
  formatServicePrice,
  phoneHref,
} from './format';
import { buildSiteJsonLd } from './jsonLd';
import {
  SITE_DATA_CONTRACT_VERSION,
  type SiteAddress,
  type SiteData,
  type SiteOpeningDay,
  type SiteOpeningException,
  type SitePage,
  type SitePlan,
  type SiteProduct,
  type SiteService,
  type SiteServiceCategory,
  type SiteSocialLink,
  type SiteTeamMember,
} from './types';

export const UNCATEGORISED_SERVICES = 'Services';
export const BOOKING_CTA_LABEL = 'Book an appointment';

export type SiteDataSource = {
  shop: {
    id: string;
    name: string;
    townCity: string | null;
    logoUrl: string | null;
    timezone: string;
  };
  profile: {
    tagline: string | null;
    description: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    postcode: string | null;
    phone: string | null;
    email: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    tiktokUrl: string | null;
    otherSocialUrl: string | null;
    brandPrimaryColour: string | null;
    brandSecondaryColour: string | null;
  } | null;
  /** ShopOpeningHours rows. Missing or inactive days are closed. */
  hours: Array<{ dayOfWeek: number; active: boolean; startMinutes: number; endMinutes: number }>;
  exceptions: Array<{
    date: Date | string;
    closed: boolean;
    startMinutes: number | null;
    endMinutes: number | null;
    label: string | null;
  }>;
  /** In display order. */
  barbers: Array<{
    id: string;
    name: string;
    title: string | null;
    bio: string | null;
    avatarUrl: string | null;
    active: boolean;
    showOnWebsite: boolean;
    serviceIds: string[];
  }>;
  /** In display order. */
  services: Array<{
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    durationMinutes: number;
    pricePence: number;
    priceFrom: boolean;
    isActive: boolean;
    featured: boolean;
  }>;
  /** In display order. */
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    pricePence: number;
    inStock: boolean;
    active: boolean;
  }>;
  plan: SitePlan;
  features: { brandedSite: boolean; onlineBooking: boolean; retail: boolean };
  /** Absolute booking URL, or null when booking is not available. */
  bookingUrl: string | null;
  /** Verified own-domain origin, or null. */
  websiteUrl: string | null;
  /** Fallback canonical URL when there is no own domain (the hosted booking page). */
  fallbackCanonicalUrl: string;
  /** Origin of this app, for product pickup links. */
  appOrigin: string;
  now: Date;
};

function clean(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

function buildAddress(source: SiteDataSource): SiteAddress {
  const p = source.profile;
  const line1 = clean(p?.addressLine1);
  const line2 = clean(p?.addressLine2);
  const town = clean(source.shop.townCity);
  const postcode = p?.postcode ? (normaliseUkPostcode(p.postcode) ?? clean(p.postcode)) : null;
  const lines = [line1, line2, town, postcode].filter((v): v is string => Boolean(v));
  // A town on its own is not an address worth showing as one.
  const hasStreet = Boolean(line1 || postcode);
  return {
    line1,
    line2,
    town,
    postcode,
    country: 'GB',
    lines: hasStreet ? lines : [],
    formatted: hasStreet ? lines.join(', ') : null,
  };
}

function buildSocialLinks(source: SiteDataSource): SiteSocialLink[] {
  const p = source.profile;
  const links: SiteSocialLink[] = [];
  const add = (platform: SiteSocialLink['platform'], label: string, url: string | null | undefined) => {
    const u = clean(url);
    if (u) links.push({ platform, label, url: u });
  };
  add('instagram', 'Instagram', p?.instagramUrl);
  add('facebook', 'Facebook', p?.facebookUrl);
  add('tiktok', 'TikTok', p?.tiktokUrl);
  add('other', 'Website', p?.otherSocialUrl);
  return links;
}

function buildDays(source: SiteDataSource): SiteOpeningDay[] {
  const byDay = new Map(source.hours.map((h) => [h.dayOfWeek, h]));
  return WEEKDAYS.map((w) => {
    const row = byDay.get(w.dayOfWeek);
    const isOpen = Boolean(row?.active && row.endMinutes > row.startMinutes);
    const periods = isOpen && row
      ? [{ opens: formatMinutesAsTime(row.startMinutes), closes: formatMinutesAsTime(row.endMinutes) }]
      : [];
    return {
      dayOfWeek: w.dayOfWeek,
      dayName: w.dayName,
      shortName: w.shortName,
      isOpen,
      periods,
      display: formatOpeningPeriods(periods),
    };
  });
}

/** Today's calendar date in the shop's time zone, "YYYY-MM-DD". */
function todayIn(timezone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isoDate(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function buildExceptions(source: SiteDataSource): SiteOpeningException[] {
  const today = todayIn(source.shop.timezone, source.now);
  return source.exceptions
    .map((ex) => ({ ...ex, iso: isoDate(ex.date) }))
    .filter((ex) => ex.iso >= today)
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .flatMap((ex): SiteOpeningException[] => {
      const validTimes =
        ex.startMinutes !== null && ex.endMinutes !== null && ex.endMinutes > ex.startMinutes;
      if (!ex.closed && !validTimes) return []; // malformed special hours: skip rather than guess
      const periods = ex.closed
        ? []
        : [{ opens: formatMinutesAsTime(ex.startMinutes!), closes: formatMinutesAsTime(ex.endMinutes!) }];
      return [
        {
          date: ex.iso,
          dateDisplay: formatCalendarDate(ex.iso),
          closed: ex.closed,
          periods,
          label: clean(ex.label),
          display: formatOpeningPeriods(periods),
        },
      ];
    });
}

function buildServicesAndTeam(source: SiteDataSource) {
  const activeServices = source.services.filter((s) => s.isActive);
  const visibleTeam = source.barbers.filter((b) => b.active && b.showOnWebsite);
  const serviceIds = new Set(activeServices.map((s) => s.id));
  const teamIds = new Set(visibleTeam.map((b) => b.id));

  const team: SiteTeamMember[] = visibleTeam.map((b) => ({
    id: b.id,
    name: b.name,
    title: clean(b.title),
    bio: clean(b.bio),
    photoUrl: clean(b.avatarUrl),
    serviceIds: b.serviceIds.filter((id) => serviceIds.has(id)),
  }));

  const all: SiteService[] = activeServices.map((s) => ({
    id: s.id,
    name: s.name,
    category: clean(s.category) ?? UNCATEGORISED_SERVICES,
    description: clean(s.description),
    durationMinutes: s.durationMinutes,
    durationDisplay: formatDurationMinutes(s.durationMinutes),
    pricePence: s.pricePence,
    currency: 'GBP',
    priceFrom: s.priceFrom,
    priceDisplay: formatServicePrice(s.pricePence, s.priceFrom),
    teamMemberIds: visibleTeam.filter((b) => b.serviceIds.includes(s.id) && teamIds.has(b.id)).map((b) => b.id),
    featured: s.featured,
  }));

  const categories: SiteServiceCategory[] = [];
  const byName = new Map<string, SiteServiceCategory>();
  for (const service of all) {
    let category = byName.get(service.category);
    if (!category) {
      category = { name: service.category, services: [] };
      byName.set(service.category, category);
      categories.push(category);
    }
    category.services.push(service);
  }
  return { team, services: { all, categories } };
}

function buildProducts(source: SiteDataSource): SiteProduct[] {
  if (!source.features.retail) return [];
  return source.products
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: clean(p.description),
      imageUrl: clean(p.imageUrl),
      pricePence: p.pricePence,
      currency: 'GBP',
      priceDisplay: formatPricePence(p.pricePence),
      inStock: p.inStock,
      availabilityDisplay: p.inStock ? 'In stock' : 'Out of stock',
      url: `${source.appOrigin}/shop/${encodeURIComponent(source.shop.id)}/${encodeURIComponent(p.id)}`,
    }));
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function buildSiteData(source: SiteDataSource): SiteData {
  const address = buildAddress(source);
  const socialLinks = buildSocialLinks(source);
  const days = buildDays(source);
  const exceptions = buildExceptions(source);
  const { team, services } = buildServicesAndTeam(source);
  const products = buildProducts(source);
  const name = source.shop.name.trim();
  const town = address.town;
  const tagline = clean(source.profile?.tagline);
  const description = clean(source.profile?.description);
  const phone = clean(source.profile?.phone);
  const email = clean(source.profile?.email);

  const bookingAvailable = source.features.onlineBooking && Boolean(source.bookingUrl);
  const canonicalUrl = source.websiteUrl ?? source.fallbackCanonicalUrl;

  const location = {
    id: source.shop.id,
    name,
    address,
    phone,
    phoneHref: phoneHref(phone),
    email,
    timezone: source.shop.timezone,
  };

  const has = {
    description: Boolean(description || tagline),
    address: address.lines.length > 0,
    contact: Boolean(phone || email),
    socials: socialLinks.length > 0,
    openingHours: days.some((d) => d.isOpen),
    team: team.length > 0,
    services: services.all.length > 0,
    products: products.length > 0,
    booking: bookingAvailable,
  };

  const title = town ? `${name} | Barbershop in ${town}` : `${name} | Barbershop`;
  const seeMore =
    has.services && has.openingHours
      ? ' See services, prices and opening hours.'
      : has.services
        ? ' See services and prices.'
        : has.openingHours
          ? ' See opening hours.'
          : '';
  const seoDescription = truncate(
    tagline ?? description ?? `${name} is a barbershop${town ? ` in ${town}` : ''}.${seeMore}`,
    160,
  );

  const base: Omit<SiteData, 'seo'> & { seo: { canonicalUrl: string } } = {
    contractVersion: SITE_DATA_CONTRACT_VERSION,
    generatedAt: source.now.toISOString(),
    business: {
      id: source.shop.id,
      name,
      tagline,
      description,
      logoUrl: clean(source.shop.logoUrl),
      brand: {
        primaryColour: clean(source.profile?.brandPrimaryColour),
        secondaryColour: clean(source.profile?.brandSecondaryColour),
      },
      websiteUrl: source.websiteUrl,
      socialLinks,
    },
    location,
    locations: [location],
    openingHours: { days, exceptions },
    team,
    services,
    products,
    booking: {
      available: bookingAvailable,
      url: bookingAvailable ? source.bookingUrl : null,
      label: BOOKING_CTA_LABEL,
    },
    planFeatures: { plan: source.plan, ...source.features },
    has,
    seo: { canonicalUrl },
  };

  const root = canonicalUrl.replace(/\/$/, '');
  const pageDefs: Array<{ key: SitePage['key']; show: boolean; path: string; name: string; description: string }> = [
    { key: 'services', show: has.services, path: '/services', name: 'Services', description: `Services and prices at ${name}.` },
    { key: 'team', show: has.team, path: '/team', name: 'Team', description: `Meet the team at ${name}.` },
    {
      key: 'contact',
      show: has.address || has.contact || has.openingHours,
      path: '/contact',
      name: 'Contact',
      description: `Find ${name}${town ? ` in ${town}` : ''}: address, opening hours and contact details.`,
    },
    { key: 'shop', show: has.products, path: '/shop', name: 'Shop', description: `Products to order online and collect at ${name}.` },
  ];
  const pages: SitePage[] = pageDefs
    .filter((p) => p.show)
    .map((p) => {
      const url = `${root}${p.path}`;
      return {
        key: p.key,
        path: p.path,
        url,
        name: p.name,
        title: `${p.name} | ${name}`,
        description: p.description,
        jsonLd: buildSiteJsonLd(base, { key: p.key, name: p.name, url }),
      };
    });

  return {
    ...base,
    seo: {
      title,
      description: seoDescription,
      canonicalUrl,
      jsonLd: buildSiteJsonLd(base, { key: 'home' }),
      pages,
    },
  };
}
