import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  availabilityRule: {
    count: vi.fn(),
    createMany: vi.fn()
  },
  barber: {
    findFirst: vi.fn()
  },
  barberService: {
    count: vi.fn(),
    createMany: vi.fn()
  },
  service: {
    findMany: vi.fn()
  }
};

vi.mock('../db/client', () => ({
  prisma: prismaMock
}));

import { ensureBarberHasAllServices, ensureBarberHasAvailabilityRules } from './defaultAvailability';

describe('ensureBarberHasAvailabilityRules', () => {
  beforeEach(() => {
    prismaMock.availabilityRule.count.mockReset();
    prismaMock.availabilityRule.createMany.mockReset();
    prismaMock.barber.findFirst.mockReset();
  });

  it('queries template rules with the AvailabilityRule active field and copies them to the new barber', async () => {
    prismaMock.availabilityRule.count.mockResolvedValue(0);
    prismaMock.barber.findFirst.mockResolvedValue({
      rules: [
        {
          dayOfWeek: 1,
          startMinutes: 540,
          endMinutes: 1020,
          breakStartMin: 720,
          breakEndMin: 780,
          active: true
        }
      ]
    });
    prismaMock.availabilityRule.createMany.mockResolvedValue({ count: 1 });

    await ensureBarberHasAvailabilityRules('barber-new');

    expect(prismaMock.barber.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { not: 'barber-new' },
        active: true,
        rules: { some: { active: true } }
      },
      select: {
        rules: expect.objectContaining({
          where: { active: true }
        })
      }
    }));
    expect(prismaMock.availabilityRule.createMany).toHaveBeenCalledWith({
      data: [
        {
          barberId: 'barber-new',
          dayOfWeek: 1,
          startMinutes: 540,
          endMinutes: 1020,
          breakStartMin: 720,
          breakEndMin: 780,
          active: true
        }
      ]
    });
  });
});

describe('ensureBarberHasAllServices', () => {
  beforeEach(() => {
    prismaMock.barberService.count.mockReset();
    prismaMock.barberService.createMany.mockReset();
    prismaMock.service.findMany.mockReset();
  });

  it('keeps the service query on the Service isActive Prisma field', async () => {
    prismaMock.barberService.count.mockResolvedValue(0);
    prismaMock.service.findMany.mockResolvedValue([{ id: 'svc-1' }]);
    prismaMock.barberService.createMany.mockResolvedValue({ count: 1 });

    await ensureBarberHasAllServices('barber-new');

    expect(prismaMock.service.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true }
    });
    expect(prismaMock.barberService.createMany).toHaveBeenCalledWith({
      data: [{ barberId: 'barber-new', serviceId: 'svc-1' }],
      skipDuplicates: true
    });
  });
});
