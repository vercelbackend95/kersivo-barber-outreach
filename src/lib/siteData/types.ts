/**
 * KERSIVO site data contract — the ONE object a shop website template consumes.
 * Human documentation: docs/site-data-contract.md (keep the two in sync; bump
 * SITE_DATA_CONTRACT_VERSION on any breaking change).
 *
 * Rules for consumers:
 * - Render a section only when its `has.*` flag is true. Never render placeholders.
 * - Use the `*Display` strings as-is. Never format money, times or durations yourself.
 * - Embed `seo.jsonLd` unchanged in one <script type="application/ld+json">.
 */

export const SITE_DATA_CONTRACT_VERSION = 1 as const;

export type SitePlan = 'starter' | 'full' | 'preview';

export type SiteData = {
  contractVersion: typeof SITE_DATA_CONTRACT_VERSION;
  /** ISO timestamp of when this object was built. */
  generatedAt: string;
  business: SiteBusiness;
  /** The location this site is for. Today every shop has exactly one. */
  location: SiteLocation;
  /** All locations of the business (always length 1 today; designs should still loop). */
  locations: SiteLocation[];
  openingHours: SiteOpeningHours;
  /** Active team members shown on the website, in display order. */
  team: SiteTeamMember[];
  services: SiteServices;
  /** Active retail-pickup products, in display order. Empty when retail is not included or not ready. */
  products: SiteProduct[];
  booking: SiteBooking;
  seo: SiteSeo;
  planFeatures: SitePlanFeatures;
  /** Section guards. A section renders only when its flag is true. */
  has: SiteSectionFlags;
};

export type SiteBusiness = {
  id: string;
  name: string;
  tagline: string | null;
  /** Plain text; may contain line breaks. */
  description: string | null;
  logoUrl: string | null;
  brand: { primaryColour: string | null; secondaryColour: string | null };
  /** The shop's own website origin when KERSIVO has verified it live (e.g. "https://sharpcuts.co.uk"). */
  websiteUrl: string | null;
  socialLinks: SiteSocialLink[];
};

export type SiteSocialLink = {
  platform: 'instagram' | 'facebook' | 'tiktok' | 'other';
  /** Visible label, e.g. "Instagram". */
  label: string;
  url: string;
};

export type SiteAddress = {
  line1: string | null;
  line2: string | null;
  town: string | null;
  /** Normalised UK postcode, e.g. "M1 1AE". */
  postcode: string | null;
  country: 'GB';
  /** Non-empty lines in display order (line1, line2, town, postcode). */
  lines: string[];
  /** One-line version, comma separated. Null when there is no address at all. */
  formatted: string | null;
};

export type SiteLocation = {
  /** Stable id. Today equals business.id. */
  id: string;
  name: string;
  address: SiteAddress;
  phone: string | null;
  /** tel: href for `phone`, spaces removed. */
  phoneHref: string | null;
  email: string | null;
  timezone: string;
};

export type SiteOpeningPeriod = {
  /** "HH:mm", 24-hour. */
  opens: string;
  /** "HH:mm", 24-hour, always after opens. */
  closes: string;
};

export type SiteOpeningDay = {
  /** 1 = Monday … 7 = Sunday. */
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** "Monday" */
  dayName: string;
  /** "Mon" */
  shortName: string;
  isOpen: boolean;
  /** Empty when closed. One period today; designs should support several. */
  periods: SiteOpeningPeriod[];
  /** "09:00–18:00", "09:00–12:00, 13:00–18:00" or "Closed". */
  display: string;
};

export type SiteOpeningException = {
  /** "YYYY-MM-DD" */
  date: string;
  /** "Thursday 25 December" */
  dateDisplay: string;
  closed: boolean;
  periods: SiteOpeningPeriod[];
  label: string | null;
  /** "Closed" or "10:00–14:00" */
  display: string;
};

export type SiteOpeningHours = {
  /** Always seven entries, Monday first. All closed when the shop has not set hours. */
  days: SiteOpeningDay[];
  /** Upcoming date-specific changes (today onwards), soonest first. */
  exceptions: SiteOpeningException[];
};

export type SiteTeamMember = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  /** Ids of services in `services.all` this person performs. */
  serviceIds: string[];
};

export type SiteService = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  durationMinutes: number;
  /** "45 min", "1 hr", "1 hr 15 min" */
  durationDisplay: string;
  pricePence: number;
  currency: 'GBP';
  priceFrom: boolean;
  /** "£25", "£25.50", "From £25" */
  priceDisplay: string;
  /** Ids of team members in `team` who perform it. */
  teamMemberIds: string[];
  featured: boolean;
};

export type SiteServiceCategory = {
  name: string;
  services: SiteService[];
};

export type SiteServices = {
  /** Active services grouped by category, categories and services in display order. */
  categories: SiteServiceCategory[];
  /** The same services, flat, in display order. */
  all: SiteService[];
};

export type SiteProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pricePence: number;
  currency: 'GBP';
  /** "£12", "£12.50" */
  priceDisplay: string;
  inStock: boolean;
  /** "In stock" | "Out of stock" */
  availabilityDisplay: string;
  /** Link to the product's pickup page. */
  url: string;
};

export type SiteBooking = {
  /** True when new online bookings are accepted right now. */
  available: boolean;
  /** Absolute booking URL. Null when booking is unavailable. */
  url: string | null;
  /** CTA label to use on buttons. */
  label: string;
};

export type SiteSeo = {
  title: string;
  description: string;
  /** Absolute URL of the business website's home page (own domain, else the booking page). */
  canonicalUrl: string;
  /** schema.org JSON-LD `@graph` for the home page, built from this object. Embed unchanged. */
  jsonLd: Record<string, unknown>;
  /**
   * Standard sub-pages, only for sections that have data. Each carries its own JSON-LD
   * (with BreadcrumbList). A design that shows everything on one page ignores this.
   */
  pages: SitePage[];
};

export type SitePage = {
  key: 'services' | 'team' | 'contact' | 'shop';
  /** Path on the shop website, e.g. "/services". */
  path: string;
  /** Absolute URL. */
  url: string;
  /** Visible page name and breadcrumb label, e.g. "Services". */
  name: string;
  title: string;
  description: string;
  jsonLd: Record<string, unknown>;
};

export type SitePlanFeatures = {
  plan: SitePlan;
  /** Branded website included (Full KERSIVO). */
  brandedSite: boolean;
  /** Online booking accepting new bookings. */
  onlineBooking: boolean;
  /** Retail pickup included AND ready to sell. Controls `products`. */
  retail: boolean;
};

export type SiteSectionFlags = {
  description: boolean;
  address: boolean;
  contact: boolean;
  socials: boolean;
  openingHours: boolean;
  team: boolean;
  services: boolean;
  products: boolean;
  booking: boolean;
};
