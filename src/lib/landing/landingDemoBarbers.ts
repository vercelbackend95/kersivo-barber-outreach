import { prisma } from '@/lib/db/client';
import { withPrismaResilienceFallback } from '@/lib/db/resilience';
import type { LandingBarber } from '@/lib/landing/liveTimelineData';

/**
 * Real active barbers for the landing "Inside the System" live timeline widget.
 *
 * Fetched server-side (build/SSR) so the embedded admin timeline shows the shop's
 * actual barbers and avatars. Resilient to DB outages/quota — falls back to an
 * empty list, in which case the widget uses its built-in demo barbers.
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
      return barbers.map((barber) => ({
        id: barber.id,
        name: barber.name,
        avatarUrl: barber.avatarUrl,
      }));
    },
    [],
  );
}
