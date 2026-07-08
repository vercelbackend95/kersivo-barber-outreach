import { demoBarbersResponse } from '@/lib/admin/demoFixtures/barbers';
import { demoServicesResponse } from '@/lib/admin/demoFixtures/services';
import { PUBLIC_FALLBACK_SHOP_SETTINGS } from '@/lib/db/resilience';
import type { LandingBookingData } from '@/lib/landing/landingBookingData';

/**
 * Static demo booking data for landing widgets when the DB is empty or unreachable.
 * Shapes match LandingBookingData so LandingBookingWidget always has something to render.
 */
export function getLandingDemoBookingFallback(): LandingBookingData {
  return {
    services: demoServicesResponse.services.map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      pricePence: service.pricePence,
      category: service.category,
      displayOrder: service.displayOrder,
    })),
    barbers: demoBarbersResponse.barbers.map((barber) => ({
      id: barber.id,
      name: barber.name,
      avatarUrl: barber.avatarUrl,
      serviceIds: barber.serviceIds,
    })),
    shopDetails: {
      timezone: PUBLIC_FALLBACK_SHOP_SETTINGS.timezone,
      cancellationWindowHours: PUBLIC_FALLBACK_SHOP_SETTINGS.cancellationWindowHours,
      rescheduleWindowHours: PUBLIC_FALLBACK_SHOP_SETTINGS.rescheduleWindowHours,
    },
    available: true,
  };
}
