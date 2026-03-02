import { prisma } from '../db/client';

const DEFAULT_RULES = [
  { dayOfWeek: 1, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 2, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 3, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 4, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 5, startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { dayOfWeek: 6, startMinutes: 10 * 60, endMinutes: 16 * 60 }
] as const;

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
    orderBy: { createdAt: 'asc' },
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
