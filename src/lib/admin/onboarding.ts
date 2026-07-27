import type { APIContext } from 'astro';
import type { AdminAccess } from './auth';
import { requireAdminPermission } from './auth';
import { prisma } from '@/lib/db/client';
import { minutesToTimeString, timeStringToMinutes } from './timeStrings';
import {
  DEFAULT_ONBOARDING_HOURS,
  serializeShopOpeningHours,
  type OnboardingWeeklyRule,
} from '@/lib/admin/shopOpeningHours';
import { ALL_WEEKDAYS } from '@/lib/booking/weekdays';

export { minutesToTimeString, timeStringToMinutes } from './timeStrings';
export { DEFAULT_ONBOARDING_HOURS, type OnboardingWeeklyRule } from '@/lib/admin/shopOpeningHours';

export const ONBOARDING_STEP_WELCOME = 0;
export const ONBOARDING_STEP_SHOP = 1;
export const ONBOARDING_STEP_SHOP_HOURS = 2;
export const ONBOARDING_STEP_BARBERS = 3;
export const ONBOARDING_STEP_SERVICES = 4;
export const ONBOARDING_STEP_HOURS = 5;
export const ONBOARDING_STEP_REVIEW = 6;

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

  const step = Math.max(shop.onboardingCurrentStep, Math.min(6, Math.max(0, nextStep)));
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

  const [barberCount, serviceCount, shopOpenDays, firstBarber] = await Promise.all([
    prisma.barber.count({ where: { shopId, active: true } }),
    prisma.service.count({ where: { shopId, isActive: true } }),
    prisma.shopOpeningHours.count({ where: { shopId, active: true } }),
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
  if (shopOpenDays < 1) return false;
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
  const defaultsByDay = new Map(DEFAULT_ONBOARDING_HOURS.map((row) => [row.dayOfWeek, row]));
  return ALL_WEEKDAYS.map((dayOfWeek) => {
    const rule = byDay.get(dayOfWeek);
    if (!rule) {
      return { ...defaultsByDay.get(dayOfWeek)! };
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

  const [barbers, services, shopHours] = await Promise.all([
    prisma.barber.findMany({
      where: { shopId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        active: true,
        sortOrder: true,
        intendedRole: true,
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
    serializeShopOpeningHours(shopId),
  ]);

  const firstBarber = barbers[0];
  let hours = shopHours;
  if (firstBarber) {
    const storedRuleCount = await prisma.availabilityRule.count({
      where: { barberId: firstBarber.id },
    });
    // Prefill client bookable hours from shop hours until barber rules are saved.
    hours = storedRuleCount > 0 ? await serializeBarberRules(firstBarber.id) : shopHours;
  }

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
      intendedRole: barber.intendedRole === 'MANAGER' ? 'MANAGER' : 'BARBER',
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
    shopHours,
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
