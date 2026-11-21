import type { BookingFlowPresentation } from '@/components/booking/bookingPresentation';
import {
  HERITAGE_BARBERS,
  HERITAGE_SERVICE_CATEGORIES,
  HERITAGE_SERVICES,
  HERITAGE_SHOP_NAME,
} from '@/lib/demo/heritage/data';
import { HERITAGE_DEMO_SITE_HREF } from '@/lib/demo/heritage/links';

/**
 * Static Heritage Grooming catalogue for the homepage / alternative-page booking embeds.
 * Canonical source: the Heritage site's own price list and barbers — no Prisma, no HTTP.
 * Client-safe (loaded in the browser by DeferredWidget).
 */
export type LandingBookingService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  pricePence: number;
  category: string;
  displayOrder: number;
  featured: boolean;
};

export type LandingBookingBarber = {
  id: string;
  name: string;
  serviceIds: string[];
  avatarUrl: string;
};

export type LandingBookingData = {
  services: readonly LandingBookingService[];
  barbers: readonly LandingBookingBarber[];
  shopDetails: { timezone: string };
  categoryOrder: readonly string[];
  presentation: BookingFlowPresentation;
};

export const HERITAGE_LANDING_BOOKING_PRESENTATION: BookingFlowPresentation = {
  eyebrow: HERITAGE_SHOP_NAME,
  title: 'Book a chair',
  sandboxNote: `This is a fictional ${HERITAGE_SHOP_NAME} booking. No appointment is created and no payment is taken.`,
  confirmEyebrow: 'Demo complete',
  confirmHeading: "You're all set",
  confirmBody: 'Demo only — no appointment or email was created.',
  confirmCtas: [{ label: `Back to ${HERITAGE_SHOP_NAME}`, href: HERITAGE_DEMO_SITE_HREF, primary: false }],
  demoReferencePrefix: 'HG',
  skipCompletionAnalytics: true,
  wholePoundPrices: true,
};

const SERVICE_IDS = HERITAGE_SERVICES.map((service) => service.id);

export const HERITAGE_LANDING_BOOKING_DATA: LandingBookingData = {
  services: HERITAGE_SERVICES.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.desc,
    durationMinutes: service.mins,
    pricePence: service.pricePence,
    category: service.category,
    displayOrder: service.displayOrder,
    featured: service.featured,
  })),
  barbers: HERITAGE_BARBERS.map((barber) => ({
    id: barber.id,
    name: barber.name,
    serviceIds: [...SERVICE_IDS],
    avatarUrl: barber.avatarSrc,
  })),
  shopDetails: { timezone: 'Europe/London' },
  categoryOrder: HERITAGE_SERVICE_CATEGORIES.map((category) => category.name),
  presentation: HERITAGE_LANDING_BOOKING_PRESENTATION,
};
