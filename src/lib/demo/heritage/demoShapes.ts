/**
 * Heritage Grooming data in the shapes the marketing-page drawings were built on (they used to draw
 * the retired CUTSTATE demo from `@/lib/demo/barbers`, `services`, `gallery` and `site`). Marketing
 * components import from here so every drawing shows the live demo shop. Client-safe.
 */
import type { DemoBarber } from '@/lib/demo/barbers';
import type { DemoGalleryArea, DemoGalleryImage } from '@/lib/demo/gallery';
import type { DemoProduct } from '@/lib/demo/products';
import type { DemoService } from '@/lib/demo/services';
import {
  HERITAGE_ASSET_BASE,
  HERITAGE_HOME_SERVICE_SITE_IDS,
  HERITAGE_PRODUCTS,
  HERITAGE_SERVICE_CATEGORIES,
  HERITAGE_SERVICES,
  HERITAGE_SHOP_NAME,
} from './data';
import { HERITAGE_DEMO_BOOK_HREF } from './links';
import { HERITAGE_MOCK_ADDRESS, HERITAGE_MOCK_BARBERS } from './mock';

export const HERITAGE_DEMO_SHOP_NAME = HERITAGE_SHOP_NAME;
export const HERITAGE_DEMO_LOCATION = HERITAGE_MOCK_ADDRESS;
export const HERITAGE_DEMO_TAGLINE = 'A barbershop that takes its time.';
/** Opening hours as the site prints them (house.js). */
export const HERITAGE_DEMO_HOURS = [
  { days: 'Tuesday–Friday', hours: '09:00–19:00' },
  { days: 'Saturday', hours: '09:00–17:00' },
  { days: 'Sunday–Monday', hours: 'Closed' },
] as const;
/** Every service is booked on the site's services page (it has no per-service URL). */
export const HERITAGE_DEMO_DEFAULT_SERVICE_SLUG = 'skin-fade';

export function heritageBookingHref(_slug?: string): string {
  return HERITAGE_DEMO_BOOK_HREF;
}

/** URL-friendly slug for a service, from the site's own id. */
export const HERITAGE_DEMO_SERVICES: readonly DemoService[] = HERITAGE_SERVICES.map((service) => ({
  id: service.id,
  slug: service.siteId,
  name: service.name,
  durationMinutes: service.mins,
  pricePence: service.pricePence,
  description: service.desc,
  popular: service.featured,
  featured: service.featured,
  category: service.category,
  displayOrder: service.displayOrder,
}));

/** The site's home-page six, in its order. */
export const HERITAGE_DEMO_FEATURED_SERVICE_IDS: readonly string[] = HERITAGE_HOME_SERVICE_SITE_IDS.map(
  (siteId) => `hg-svc-${siteId}`,
);

export function getHeritageFeaturedServices(
  ids: readonly string[] = HERITAGE_DEMO_FEATURED_SERVICE_IDS,
): DemoService[] {
  return ids.flatMap((id) => {
    const service = HERITAGE_DEMO_SERVICES.find((item) => item.id === id);
    return service ? [service] : [];
  });
}

const ALL_SERVICE_IDS = HERITAGE_DEMO_SERVICES.map((service) => service.id);

export const HERITAGE_DEMO_BARBERS: readonly DemoBarber[] = HERITAGE_MOCK_BARBERS.map((barber) => ({
  id: barber.id,
  slug: barber.siteId,
  name: barber.name,
  specialisation: barber.role,
  selectionCopy: barber.role,
  serviceIds: [...ALL_SERVICE_IDS],
  image: {
    src: barber.portraitLarge,
    width: 960,
    height: 1286,
    alt: `${barber.name} at work at Heritage Grooming, a fictional KERSIVO demonstration shop.`,
  },
  objectPosition: '50% 30%',
  rosterObjectPosition: '50% 30%',
}));

/** Square 160×160 face crop of a barber (scripts/generate-heritage-barber-thumbs.mjs), for avatars. */
export const HERITAGE_BARBER_THUMB_SIZE = 160;

export function heritageBarberThumb(slug: string): string {
  const known = HERITAGE_MOCK_BARBERS.some((barber) => barber.siteId === slug);
  return `/images/heritage/barbers/${known ? slug : HERITAGE_MOCK_BARBERS[0]!.siteId}-160.webp`;
}

function galleryImage(
  id: DemoGalleryArea,
  file: string,
  width: number,
  height: number,
  alt: string,
  sequence: number,
  role: DemoGalleryImage['role'],
): DemoGalleryImage {
  return {
    id,
    src: `${HERITAGE_ASSET_BASE}/${file}`,
    width,
    height,
    alt,
    caption: alt,
    role,
    sequence,
    objectPosition: { desktop: '50% 40%', mobile: '50% 40%' },
  } as DemoGalleryImage;
}

/** The same six gallery slots the drawings used, filled from the Heritage "The work" page. */
export const HERITAGE_DEMO_GALLERY: readonly DemoGalleryImage[] = [
  galleryImage('fade', 'work-arthur-fade-960.webp', 960, 1286, 'A fresh fade by Arthur Penn', 1, 'portrait'),
  galleryImage('hairline', 'work-lineup-mirror-960.webp', 960, 717, 'A line-up finished with the open razor', 2, 'landscape'),
  galleryImage('barber-at-work', 'work-arthur-mirror-960.webp', 960, 1286, 'Arthur Penn at work', 3, 'portrait'),
  galleryImage('beard', 'work-rafi-beard-960.webp', 960, 717, 'Beard shaping by Rafi Mendes', 4, 'landscape'),
  galleryImage('scissor-cut', 'work-kit-scissors-960.webp', 960, 1286, 'A scissor cut by Kit Harlow', 5, 'portrait'),
  galleryImage('interior-detail', 'chairs-960.webp', 960, 536, 'The row of chairs at Heritage Grooming', 6, 'wide'),
];

export function resolveHeritageServiceSlug(raw: string | null | undefined): DemoService | undefined {
  const slug = raw?.trim().toLowerCase();
  if (!slug) return undefined;
  return HERITAGE_DEMO_SERVICES.find((service) => service.slug === slug);
}

/** The Heritage shelf in the retail shape the drawings use. */
export const HERITAGE_DEMO_PRODUCTS: readonly DemoProduct[] = HERITAGE_PRODUCTS.map((product) => ({
  id: product.id,
  slug: product.siteId,
  name: product.name,
  description: product.description,
  pricePence: product.pricePence,
  featured: product.featured,
  category: product.category,
  sortOrder: product.sortOrder,
  active: true,
  image: {
    src: product.imageSrc,
    width: 800,
    height: 800,
    alt: `${product.name}, from the Heritage Grooming shelf`,
    sizes: '(max-width: 639px) 92vw, 360px',
  },
}));

/** Heritage service categories in the shape the booking drawings use (key = the service's category). */
export const HERITAGE_DEMO_SERVICE_CATEGORIES = HERITAGE_SERVICE_CATEGORIES.map((category) => ({
  key: category.name,
  slug: category.siteId,
  label: category.name,
  shortLabel: category.name.toUpperCase(),
  description: category.name,
}));
