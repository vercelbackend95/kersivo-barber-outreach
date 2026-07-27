import { prisma } from '../db/client';
import { ALL_WEEKDAYS } from '@/lib/booking/weekdays';

const DEFAULT_RULES = ALL_WEEKDAYS.map((dayOfWeek) => ({
  dayOfWeek,
  startMinutes: 9 * 60,
  endMinutes: 20 * 60
})) as readonly { dayOfWeek: number; startMinutes: number; endMinutes: number }[];

export async function ensureBarberHasAvailabilityRules(barberId: string) {
  const existingRulesCount = await prisma.availabilityRule.count({ where: { barberId } });
  if (existingRulesCount > 0) {
    return;
  }

  const templateBarber = await prisma.barber.findFirst({
    where: {
      id: { not: barberId },
      active: true,
      rules: { some: { active: true } }
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      rules: {
        where: { active: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
        select: {
          dayOfWeek: true,
          startMinutes: true,
          endMinutes: true,
          breakStartMin: true,
          breakEndMin: true,
          active: true
        }
      }
    }
  });

  const rulesToCreate = templateBarber && templateBarber.rules.length > 0
    ? templateBarber.rules
    : DEFAULT_RULES.map((rule) => ({ ...rule, breakStartMin: null, breakEndMin: null, active: true }));

  await prisma.availabilityRule.createMany({
    data: rulesToCreate.map((rule) => ({
      barberId,
      dayOfWeek: rule.dayOfWeek,
      startMinutes: rule.startMinutes,
      endMinutes: rule.endMinutes,
      breakStartMin: rule.breakStartMin,
      breakEndMin: rule.breakEndMin,
      active: rule.active
    }))
  });
}

export async function ensureBarberHasAllServices(barberId: string, shopId?: string) {
  const existingCount = await prisma.barberService.count({ where: { barberId } });
  if (existingCount > 0) {
    return;
  }

  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      ...(shopId ? { shopId } : {}),
    },
    select: { id: true },
  });
  if (services.length === 0) {
    return;
  }

  await prisma.barberService.createMany({
    data: services.map((service) => ({
      barberId,
      serviceId: service.id,
    })),
    skipDuplicates: true,
  });
}
