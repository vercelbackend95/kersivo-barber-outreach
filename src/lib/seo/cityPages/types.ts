/**
 * Data model for city landing pages at /barbershop-websites/{slug}.
 *
 * A city page is published only when its own research file exists (see docs/seo/city-pages-playbook.md):
 * local price bands, chair rent, the nation's business-rates rules, neighbourhood context, a city FAQ
 * and dated sources. Everything shown on the page comes from that file or from the shared
 * claims/competitor fact modules, so a new city cannot ship as a name-swapped template.
 */

export type UkNation = 'England' | 'Scotland' | 'Wales' | 'Northern Ireland';

export type CitySource = {
  id: string;
  /** Publisher and page title as shown in the sources list. */
  label: string;
  url: string;
  /** What this source supports on the page. */
  supports: string;
  /** Date we read the page (ISO). */
  checkedIso: string;
  /** The page's own published/updated date when it shows one (human-readable). */
  pageDate?: string;
};

/** A price or cost band, e.g. "Skin fade, independent shop: £20–£42". */
export type CityBand = {
  label: string;
  value: string;
  /** Short qualifier shown under the value, e.g. "typical £26.50". */
  detail?: string;
  sourceId: string;
};

/** A part of the city with how a shop there would set KERSIVO up. Advice, not statistics. */
export type CityArea = {
  id: string;
  name: string;
  /** Real districts/neighbourhoods in this part of the city. */
  places: readonly string[];
  /** What the trade looks like here, in plain words. */
  pattern: string;
  /** What we would set up on the website and booking for a shop here. */
  setup: readonly string[];
};

/** A running-cost or rules note (business rates, tax, card fees). */
export type CityCostNote = {
  id: string;
  title: string;
  /** Headline figure, e.g. "38.2p". */
  figure: string;
  figureLabel: string;
  body: readonly string[];
  sourceIds: readonly string[];
};

export type CityFaq = {
  id: string;
  question: string;
  answer: readonly string[];
};

/** The Google Maps → own website walk-through, set in a real district of the city. */
export type CityJourney = {
  district: string;
  /** Street or landmark the search is made from (district level only; no house numbers). */
  near: string;
  query: string;
  /** Fictional demo shop shown in the walk-through; labelled as fictional on the page. */
  shopName: string;
  shopDomain: string;
  service: string;
  /** Price shown for the walk-through service when it is not the plain skin fade (fictional demo price). Defaults to the calculator price. */
  servicePrice?: number;
  slot: string;
  /** Retail product added for pickup. */
  product: string;
  productPrice: number;
  /** Other products on the illustrated retail shelf (fictional prices). */
  shelf: readonly { name: string; price: number }[];
};

export type CityCalculatorDefaults = {
  price: number;
  /** Why this default, shown next to the price input. */
  priceNote: string;
  priceSourceId: string;
  barbers: number;
  marketplaceClientsPerWeek: number;
  noShowsPerWeek: number;
};

export type CityPage = {
  slug: string;
  name: string;
  nation: UkNation;
  /** Date this city's research was checked (ISO) and how it is shown. */
  checkedIso: string;
  checkedDate: string;
  /** H1 split so the last part can carry the red mark. */
  h1Lead: string;
  h1Mark: string;
  heroLead: string;
  /** One-sentence, city-specific summary shown on the /barbershop-websites hub card (no shared wording). */
  hubSummary: string;
  /**
   * Search title, written for this city (audit P2-4): "Barbershop Website Design {City}" first, then a
   * hook from this city's research and the flat price. At most 60 characters.
   */
  seoTitle: string;
  /**
   * Meta description, written for this city: one pain point from its own research (every figure must
   * appear in the page copy), the flat price, then "0% KERSIVO commission (Stripe fees apply)."
   * At most 155 characters.
   */
  seoDescription: string;
  /** High-intent queries this page targets (documentation; also checked in tests against the copy). */
  targetQueries: readonly string[];
  calculator: CityCalculatorDefaults;
  prices: readonly CityBand[];
  chairRent: readonly CityBand[];
  marketIntro: readonly string[];
  areas: readonly CityArea[];
  costs: readonly CityCostNote[];
  journey: CityJourney;
  faqs: readonly CityFaq[];
  sources: readonly CitySource[];
};
