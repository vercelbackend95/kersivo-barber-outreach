import { prisma } from '@/lib/db/client';
import {
  PUBLIC_FALLBACK_SHOP_SETTINGS,
  withPrismaQuotaFallback,
} from '@/lib/db/resilience';

/**
 * Real booking data for the landing "Inside the System" live booking widget.
 *
 * Mirrors the query in src/pages/book/index.astro so the embedded (preview-mode)
 * BookingFlow shows the shop's actual services, barbers and settings — availability
 * is genuine. Resilient to DB outages/quota: on failure returns empty services so
 * the landing row falls back to the static screenshot.
 */
export type LandingBookingService = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  category?: string | null;
  displayOrder?: number;
};

export type LandingBookingBarber = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  serviceIds: string[];
};

export type LandingBookingShopDetails = {
  timezone: string;
  cancellationWindowHours?: number | null;
  rescheduleWindowHours?: number | null;
};

export type LandingBookingData = {
  services: LandingBookingService[];
  barbers: LandingBookingBarber[];
  shopDetails: LandingBookingShopDetails;
  available: boolean;
};

export async function resolveLandingBookingData(): Promise<LandingBookingData> {
  return withPrismaQuotaFallback<LandingBookingData>(
    'lib/landing/landingBookingData',
    async () => {
      const [services, barbers, shopSettings] = await Promise.all([
        prisma.service.findMany({
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.barber.findMany({
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            barberServices: { select: { serviceId: true } },
          },
        }),
        prisma.shopSettings.findFirst({
          select: {
            timezone: true,
            cancellationWindowHours: true,
            rescheduleWindowHours: true,
          },
        }),
      ]);

      return {
        services: services.map((service) => ({
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          pricePence: service.pricePence,
          category: service.category,
          displayOrder: service.displayOrder,
        })),
        barbers: barbers.map((barber) => ({
          id: barber.id,
          name: barber.name,
          avatarUrl: barber.avatarUrl,
          serviceIds: barber.barberServices.map((link) => link.serviceId),
        })),
        shopDetails: shopSettings
          ? {
              timezone: shopSettings.timezone,
              cancellationWindowHours: shopSettings.cancellationWindowHours,
              rescheduleWindowHours: shopSettings.rescheduleWindowHours,
            }
          : {
              timezone: PUBLIC_FALLBACK_SHOP_SETTINGS.timezone,
              cancellationWindowHours: PUBLIC_FALLBACK_SHOP_SETTINGS.cancellationWindowHours,
              rescheduleWindowHours: PUBLIC_FALLBACK_SHOP_SETTINGS.rescheduleWindowHours,
            },
        available: services.length > 0 && barbers.length > 0,
      };
    },
    {
      services: [],
      barbers: [],
      shopDetails: {
        timezone: PUBLIC_FALLBACK_SHOP_SETTINGS.timezone,
        cancellationWindowHours: PUBLIC_FALLBACK_SHOP_SETTINGS.cancellationWindowHours,
        rescheduleWindowHours: PUBLIC_FALLBACK_SHOP_SETTINGS.rescheduleWindowHours,
      },
      available: false,
    },
  );
}
