/**
 * What the marketing pages draw when they show Heritage Grooming in miniature (browser frames,
 * phone screens, booking tickets). Everything comes from the live demo site so the drawings match
 * what a visitor finds when they open it. Client-safe, no imports beyond the demo data.
 */
import {
  HERITAGE_ASSET_BASE,
  HERITAGE_BARBERS,
  HERITAGE_HOME_SERVICE_SITE_IDS,
  HERITAGE_SERVICES,
  HERITAGE_SHOP_NAME,
  type HeritageBarber,
  type HeritageService,
} from './data';

export { HERITAGE_SHOP_NAME };

/**
 * Domain shown in the drawn address bars. Fictional, like the shop; the demo itself lives at
 * kersivo.co.uk/demo/heritage-grooming.
 */
export const HERITAGE_MOCK_DOMAIN = 'heritagegrooming.co.uk';

/** The site's own hero line, split where the site sets the second half in italics. */
export const HERITAGE_MOCK_TITLE = { lead: 'A barbershop that', em: 'takes its time.' } as const;
export const HERITAGE_MOCK_LEDE =
  'Haircuts, beard work and hot-towel shaves, by appointment. One long room of walnut, brass and black leather chairs.';
export const HERITAGE_MOCK_ADDRESS = 'Chapel Street, Old Town';
export const HERITAGE_MOCK_EYEBROW = `${HERITAGE_MOCK_ADDRESS} · By appointment`;
export const HERITAGE_MOCK_OPEN = 'Tuesday to Saturday';
/** Main nav labels on the site, in order. */
export const HERITAGE_MOCK_NAV = ['The shop', 'Services', 'Products', 'The barbers', 'The work'] as const;
export const HERITAGE_MOCK_BOOK_LABEL = 'Book a chair';

export const HERITAGE_FICTIONAL_NOTE = `${HERITAGE_SHOP_NAME} is a fictional demonstration shop.`;

/** Brand seal (round crest). 128px is plenty for a drawn nav. */
export const HERITAGE_SEAL = { src: `${HERITAGE_ASSET_BASE}/seal-128.webp`, width: 128, height: 128 } as const;

export type HeritageMockPhoto = { src: string; width: number; height: number; alt: string };

export const HERITAGE_MOCK_PHOTOS = {
  /** Portrait: one black leather chair in front of a brass mirror. */
  chair: {
    src: `${HERITAGE_ASSET_BASE}/chair-960.webp`,
    width: 960,
    height: 1192,
    alt: 'A black leather barber chair in front of a brass-framed mirror at Heritage Grooming',
  },
  /** Landscape: the row of chairs, the site's hero photo. */
  chairs: {
    src: `${HERITAGE_ASSET_BASE}/chairs-960.webp`,
    width: 960,
    height: 536,
    alt: 'A row of black leather barber chairs facing brass mirrors on a walnut wall',
  },
  room: {
    src: `${HERITAGE_ASSET_BASE}/room-1600.webp`,
    width: 1600,
    height: 893,
    alt: 'The long walnut-panelled room at Heritage Grooming',
  },
  shelf: {
    src: `${HERITAGE_ASSET_BASE}/shelf-960.webp`,
    width: 960,
    height: 960,
    alt: 'The retail shelf of pomades, beard oils and shaving kit at Heritage Grooming',
  },
  tools: {
    src: `${HERITAGE_ASSET_BASE}/tools-960.webp`,
    width: 960,
    height: 644,
    alt: 'Scissors, combs and an open razor laid out on the counter',
  },
  atWork: {
    src: `${HERITAGE_ASSET_BASE}/work-arthur-mirror-960.webp`,
    width: 960,
    height: 1286,
    alt: 'Arthur Penn cutting a client’s hair at Heritage Grooming',
  },
  fade: {
    src: `${HERITAGE_ASSET_BASE}/work-arthur-fade-960.webp`,
    width: 960,
    height: 1286,
    alt: 'A fresh fade at Heritage Grooming',
  },
  beard: {
    src: `${HERITAGE_ASSET_BASE}/work-rafi-beard-960.webp`,
    width: 960,
    height: 717,
    alt: 'Rafi Mendes shaping a beard at Heritage Grooming',
  },
  lineup: {
    src: `${HERITAGE_ASSET_BASE}/work-lineup-mirror-960.webp`,
    width: 960,
    height: 717,
    alt: 'A line-up finished with the open razor, seen in the mirror',
  },
} as const satisfies Record<string, HeritageMockPhoto>;

export type HeritageMockBarber = {
  id: string;
  siteId: string;
  name: string;
  first: string;
  role: string;
  /** 500×670 portrait crop. */
  portrait: string;
  /** 960×1286 portrait. */
  portraitLarge: string;
};

/** The photo each barber is shown with on the team page. */
const PORTRAIT_BY_BARBER: Readonly<Record<string, string>> = {
  arthur: 'work-arthur-fade',
  kit: 'work-kit-scissors',
  rafi: 'work-rafi-neckline',
  owen: 'work-owen-razor',
};

function toMockBarber(barber: HeritageBarber): HeritageMockBarber {
  const photo = PORTRAIT_BY_BARBER[barber.siteId] ?? 'work-arthur-fade';
  return {
    id: barber.id,
    siteId: barber.siteId,
    name: barber.name,
    first: barber.first,
    role: barber.role,
    portrait: `${HERITAGE_ASSET_BASE}/${photo}-500.webp`,
    portraitLarge: `${HERITAGE_ASSET_BASE}/${photo}-960.webp`,
  };
}

export const HERITAGE_MOCK_BARBERS: readonly HeritageMockBarber[] = HERITAGE_BARBERS.map(toMockBarber);

/** The six services on the site's home page, in its order. */
export const HERITAGE_MOCK_SERVICES: readonly HeritageService[] = HERITAGE_HOME_SERVICE_SITE_IDS.map((siteId) => {
  const service = HERITAGE_SERVICES.find((row) => row.siteId === siteId);
  if (!service) throw new Error(`Heritage home service missing: ${siteId}`);
  return service;
});

/** Whole pounds, as the site prints them. */
export function formatHeritagePrice(service: Pick<HeritageService, 'price'>): string {
  return `£${service.price}`;
}

/**
 * Logo lockup (seal + wordmark) on a transparent 3:1 canvas, for drawn navs on dark backgrounds.
 * Rendered by scripts/generate-heritage-lockup.mjs.
 */
export const HERITAGE_LOCKUP = {
  src: '/images/heritage/heritage-lockup.webp',
  width: 648,
  height: 216,
  alt: HERITAGE_SHOP_NAME,
} as const;
