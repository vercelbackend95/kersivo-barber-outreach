import { demoBarbersResponse } from '@/lib/admin/demoFixtures/barbers';
import { prisma } from '@/lib/db/client';
import { withPrismaResilienceFallback } from '@/lib/db/resilience';
import { enrichLandingBarberAvatar } from '@/lib/landing/landingDemoAssets';
import type { LandingBarber } from '@/lib/landing/liveTimelineData';

const DEMO_BARBERS: LandingBarber[] = demoBarbersResponse.barbers.map((barber) => ({
  id: barber.id,
  name: barber.name,
  avatarUrl: barber.avatarUrl,
}));

/**
 * Real active barbers for the landing "Inside the System" live timeline widget.
 *
 * Fetched server-side (build/SSR) so the embedded admin timeline shows the shop's
 * actual barbers and avatars. Resilient to DB outages/quota — falls back to demo
 * fixture barbers so the timeline always shows recognisable names and photos.
 */
export async function resolveLandingDemoBarbers(): Promise<LandingBarber[]> {
  return withPrismaResilienceFallback<LandingBarber[]>(
    'lib/landing/landingDemoBarbers',
    async () => {
      const barbers = await prisma.barber.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: 6,
        select: { id: true, name: true, avatarUrl: true },
      });
      if (barbers.length === 0) {
        return DEMO_BARBERS;
      }
      return barbers.map((barber, index) => ({
        id: barber.id,
        name: barber.name,
        avatarUrl: enrichLandingBarberAvatar(barber.avatarUrl, index),
      }));
    },
    DEMO_BARBERS,
  );
}
