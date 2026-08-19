import { prisma } from '@/lib/db/client';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import {
  PUBLIC_FALLBACK_SHOP_SETTINGS,
  withPrismaQuotaFallback,
} from '@/lib/db/resilience';
import { getLandingDemoBookingFallback } from '@/lib/landing/landingDemoBookingFallback';
import { enrichLandingBarberAvatar } from '@/lib/landing/landingDemoAssets';
import type { Prisma } from '@prisma/client';

/**
 * Real booking data for the landing "Inside the System" live booking widget.
 *
 * Mirrors the query in src/pages/book/index.astro so the embedded (preview-mode)
 * BookingFlow shows the shop's actual services, barbers and settings when available.
 * Falls back to static demo fixtures when the DB is empty or unreachable so the
 * booking widget always renders.
 */
export type LandingBookingService = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  category?: string | null;
  displayOrder?: number;
  description?: string | null;
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

const LANDING_BOOKING_BARBER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  barberServices: { select: { serviceId: true } },
} satisfies Prisma.BarberSelect;

type LandingBookingBarberRow = Prisma.BarberGetPayload<{
  select: typeof LANDING_BOOKING_BARBER_SELECT;
}>;

function mapDbResult(
  services: Awaited<ReturnType<typeof prisma.service.findMany>>,
  barbers: LandingBookingBarberRow[],
  shopSettings: {
    timezone: string;
    cancellationWindowHours: number | null;
    rescheduleWindowHours: number | null;
  } | null,
): LandingBookingData {
  const mappedServices = services.map((service) => ({
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    pricePence: service.pricePence,
    category: service.category,
    displayOrder: service.displayOrder,
    description: service.description,
  }));
  const mappedBarbers = barbers.map((barber, index) => ({
    id: barber.id,
    name: barber.name,
    avatarUrl: enrichLandingBarberAvatar(barber.avatarUrl, index),
    serviceIds: barber.barberServices.map((link) => link.serviceId),
  }));

  if (mappedServices.length === 0 || mappedBarbers.length === 0) {
    return getLandingDemoBookingFallback();
  }

  return {
    services: mappedServices,
    barbers: mappedBarbers,
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
    available: true,
  };
}

export async function resolveLandingBookingData(): Promise<LandingBookingData> {
  return withPrismaQuotaFallback<LandingBookingData>(
    'lib/landing/landingBookingData',
    async () => {
      const [services, barbers, shopSettings] = await Promise.all([
        prisma.service.findMany({
          where: { isActive: true, shopId: DEMO_SHOP_ID },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.barber.findMany({
          where: { active: true, shopId: DEMO_SHOP_ID },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: LANDING_BOOKING_BARBER_SELECT,
        }),
        prisma.shopSettings.findUnique({
          where: { id: DEMO_SHOP_ID },
          select: {
            timezone: true,
            cancellationWindowHours: true,
            rescheduleWindowHours: true,
          },
        }),
      ]);

      return mapDbResult(services, barbers, shopSettings);
    },
    getLandingDemoBookingFallback(),
  );
}
