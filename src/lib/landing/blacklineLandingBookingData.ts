import type { BookingFlowPresentation } from '@/components/booking/bookingPresentation';
import { DEMO_BARBERS, toDemoBookingBarber } from '@/lib/demo/barbers';
import { BLACKLINE_BOOKING_PRESENTATION } from '@/lib/demo/booking';
import { DEMO_SERVICE_CATEGORY_ORDER, DEMO_SERVICES } from '@/lib/demo/services';

/**
 * Static BLACKLINE catalogue for homepage / Booksy Alternative booking embeds.
 * Canonical source: DEMO_SERVICES / DEMO_BARBERS — no Prisma, no HTTP.
 */
export type BlacklineLandingBookingService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  pricePence: number;
  category: string;
  displayOrder: number;
  featured: boolean;
};

export type BlacklineLandingBookingBarber = ReturnType<typeof toDemoBookingBarber>;

export type BlacklineLandingBookingData = {
  services: readonly BlacklineLandingBookingService[];
  barbers: readonly BlacklineLandingBookingBarber[];
  shopDetails: { timezone: string };
  categoryOrder: readonly string[];
  presentation: BookingFlowPresentation;
};

/** Preview inherits BLACKLINE price/brand presentation; full-demo session copy stays inert in previewMode. */
export const BLACKLINE_LANDING_BOOKING_PRESENTATION: BookingFlowPresentation = {
  ...BLACKLINE_BOOKING_PRESENTATION,
};

export const BLACKLINE_LANDING_BOOKING_DATA: BlacklineLandingBookingData = {
  services: DEMO_SERVICES.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    pricePence: service.pricePence,
    category: service.category,
    displayOrder: service.displayOrder,
    featured: service.featured,
  })),
  barbers: DEMO_BARBERS.map(toDemoBookingBarber),
  shopDetails: { timezone: 'Europe/London' },
  categoryOrder: DEMO_SERVICE_CATEGORY_ORDER,
  presentation: BLACKLINE_LANDING_BOOKING_PRESENTATION,
};
