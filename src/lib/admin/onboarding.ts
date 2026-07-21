import type { APIContext } from 'astro';
import type { AdminAccess } from './auth';
import { requireAdminPermission } from './auth';
import { prisma } from '@/lib/db/client';
import { minutesToTimeString, timeStringToMinutes } from './timeStrings';

export { minutesToTimeString, timeStringToMinutes } from './timeStrings';

export const ONBOARDING_STEP_WELCOME = 0;
export const ONBOARDING_STEP_SHOP = 1;
export const ONBOARDING_STEP_BARBERS = 2;
export const ONBOARDING_STEP_SERVICES = 3;
export const ONBOARDING_STEP_HOURS = 4;
export const ONBOARDING_STEP_REVIEW = 5;

export type OnboardingWeeklyRule = {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
};

export const DEFAULT_ONBOARDING_HOURS: OnboardingWeeklyRule[] = [
  { dayOfWeek: 0, active: false, startTime: '09:00', endTime: '18:00' }, // Sunday
  { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 2, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 3, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 4, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 5, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 6, active: true, startTime: '09:00', endTime: '16:00' }, // Saturday
];

export async function requireOnboardingAccess(
  context: APIContext,
): Promise<AdminAccess | Response> {
  const access = await requireAdminPermission(context, 'onboarding.manage');
  if (access instanceof Response) return access;

  if (access.via !== 'session' || !access.userId) {
    return new Response(
      JSON.stringify({ error: 'Onboarding is only available for signed-in private workspaces.' }),
      { status: 403 },
    );
  }

  return access;
}

export async function advanceOnboardingStep(shopId: string, nextStep: number) {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { onboardingCurrentStep: true },
  });
  if (!shop) return;

  const step = Math.max(shop.onboardingCurrentStep, Math.min(5, Math.max(0, nextStep)));
  if (step === shop.onboardingCurrentStep) return;

  await prisma.shopSettings.update({
    where: { id: shopId },
    data: { onboardingCurrentStep: step },
  });
}

export async function markOnboardingCompleted(shopId: string) {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { onboardingCompleted: true },
  });
  if (!shop || shop.onboardingCompleted) return;

  await prisma.shopSettings.update({
    where: { id: shopId },
    data: {
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      onboardingCurrentStep: ONBOARDING_STEP_REVIEW,
    },
  });
}

/** True when shop/team/services/hours meet the finish-setup requirements. */
export async function shopMeetsOnboardingCompletionRequirements(shopId: string) {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { name: true },
  });
  if (!shop?.name.trim()) return false;

  const [barberCount, serviceCount, firstBarber] = await Promise.all([
    prisma.barber.count({ where: { shopId, active: true } }),
    prisma.service.count({ where: { shopId, isActive: true } }),
    prisma.barber.findFirst({
      where: { shopId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        rules: {
          where: { active: true },
          select: { dayOfWeek: true, startMinutes: true, endMinutes: true },
        },
      },
    }),
  ]);

  if (barberCount < 1 || serviceCount < 1) return false;
  if (!firstBarber || firstBarber.rules.length === 0) return false;
  return firstBarber.rules.every((rule) => rule.startMinutes < rule.endMinutes);
}

export async function healOnboardingCompletedIfEligible(shopId: string) {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { onboardingCompleted: true, onboardingCurrentStep: true },
  });
  if (!shop || shop.onboardingCompleted) return;
  if (shop.onboardingCurrentStep < ONBOARDING_STEP_REVIEW) return;
  if (!(await shopMeetsOnboardingCompletionRequirements(shopId))) return;
  await markOnboardingCompleted(shopId);
}

export async function serializeBarberRules(barberId: string): Promise<OnboardingWeeklyRule[]> {
  const rules = await prisma.availabilityRule.findMany({
    where: { barberId },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
    select: { dayOfWeek: true, active: true, startMinutes: true, endMinutes: true },
  });

  const byDay = new Map(rules.map((rule) => [rule.dayOfWeek, rule]));
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const rule = byDay.get(dayOfWeek);
    if (!rule) {
      return DEFAULT_ONBOARDING_HOURS[dayOfWeek]!;
    }
    return {
      dayOfWeek,
      active: rule.active,
      startTime: minutesToTimeString(rule.startMinutes),
      endTime: minutesToTimeString(rule.endMinutes),
    };
  });
}

export async function replaceBarberAvailabilityRules(
  barberId: string,
  rules: OnboardingWeeklyRule[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { barberId } });
    const activeRules = rules.filter((rule) => rule.active);
    if (activeRules.length === 0) return;

    await tx.availabilityRule.createMany({
      data: activeRules.map((rule) => ({
        barberId,
        dayOfWeek: rule.dayOfWeek,
        active: true,
        startMinutes: timeStringToMinutes(rule.startTime),
        endMinutes: timeStringToMinutes(rule.endTime),
        breakStartMin: null,
        breakEndMin: null,
      })),
    });
  });
}

export async function linkAllServicesToAllBarbers(shopId: string) {
  const [barbers, services] = await Promise.all([
    prisma.barber.findMany({ where: { shopId, active: true }, select: { id: true } }),
    prisma.service.findMany({ where: { shopId, isActive: true }, select: { id: true } }),
  ]);

  if (barbers.length === 0 || services.length === 0) return;

  await prisma.barberService.createMany({
    data: barbers.flatMap((barber) =>
      services.map((service) => ({
        barberId: barber.id,
        serviceId: service.id,
      })),
    ),
    skipDuplicates: true,
  });
}

export async function loadOnboardingState(shopId: string, access: AdminAccess) {
  await healOnboardingCompletedIfEligible(shopId);

  const shop = await prisma.shopSettings.findUniqueOrThrow({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      townCity: true,
      logoUrl: true,
      onboardingCompleted: true,
      onboardingCurrentStep: true,
      onboardingCompletedAt: true,
    },
  });

  const [barbers, services] = await Promise.all([
    prisma.barber.findMany({
      where: { shopId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        active: true,
        sortOrder: true,
      },
    }),
    prisma.service.findMany({
      where: { shopId, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        pricePence: true,
        durationMinutes: true,
        isActive: true,
        displayOrder: true,
        category: true,
      },
    }),
  ]);

  const firstBarber = barbers[0];
  const hours = firstBarber
    ? await serializeBarberRules(firstBarber.id)
    : DEFAULT_ONBOARDING_HOURS;

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      townCity: shop.townCity,
      logoUrl: shop.logoUrl,
    },
    onboardingCompleted: shop.onboardingCompleted,
    onboardingCurrentStep: shop.onboardingCurrentStep,
    onboardingCompletedAt: shop.onboardingCompletedAt?.toISOString() ?? null,
    barbers: barbers.map((barber) => ({
      id: barber.id,
      name: barber.name,
      avatarUrl: barber.avatarUrl,
      isActive: barber.active,
      sortOrder: barber.sortOrder,
    })),
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      pricePence: service.pricePence,
      durationMinutes: service.durationMinutes,
      isActive: service.isActive,
      displayOrder: service.displayOrder,
      category: service.category,
    })),
    hours,
    user: access.userId
      ? {
          id: access.userId,
          name: access.userName,
          email: access.userEmail,
          image: access.userImage,
        }
      : null,
  };
}
