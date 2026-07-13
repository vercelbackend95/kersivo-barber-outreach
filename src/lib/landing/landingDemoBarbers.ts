import { DEMO_DAY_BARBERS } from '@/lib/admin/demoFixtures/daySchedule';
import type { LandingBarber } from '@/lib/landing/liveTimelineData';

const DEMO_BARBERS: LandingBarber[] = DEMO_DAY_BARBERS.map((barber) => ({
  id: barber.id,
  name: barber.name,
  avatarUrl: barber.avatarUrl,
}));

/**
 * Fixture barbers for the landing "Inside the System" live timeline.
 * Static only — no Neon/Prisma — so the widget stays free and matches /admin-demo.
 */
export async function resolveLandingDemoBarbers(): Promise<LandingBarber[]> {
  return DEMO_BARBERS;
}
