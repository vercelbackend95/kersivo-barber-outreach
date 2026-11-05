import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BookingActionError } from '@/lib/booking/service';
import { healthyContext } from '../fixtures';
import { runCheck } from '../run';
import {
  HEALTH_CHECK_CUSTOMER,
  NO_SLOTS_MESSAGE,
  addIsoDays,
  createBookingAvailabilityCheck,
  createBookingDryRunCheck,
} from './bookingProbe';

const SLOT_DATE = '2026-11-06';

function deps(slotsByKey: Record<string, string[]> = {}, create = vi.fn()) {
  return {
    getAvailabilitySlots: vi.fn(async ({ serviceId, barberId, date }: { serviceId: string; barberId: string; date: string }) => ({
      slots: slotsByKey[`${serviceId}|${barberId}|${date}`] ?? [],
    })) as never,
    createInstantBooking: create as never,
  };
}

const wouldCreate = { status: 'BOOKED', paymentRequired: false };

describe('addIsoDays', () => {
  it('crosses month ends and the clock change', () => {
    expect(addIsoDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addIsoDays('2026-10-24', 7)).toBe('2026-10-31');
  });
});

describe('booking.availability', () => {
  it('fails with the operator message when no service has a slot in 14 days', async () => {
    const d = deps();
    const r = await runCheck(createBookingAvailabilityCheck(d), healthyContext());
    expect(r).toMatchObject({ status: 'fail', severity: 'critical', message: NO_SLOTS_MESSAGE });
    expect((d.getAvailabilitySlots as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(14);
  });

  it('passes when every service has a slot, and warns per service with none', async () => {
    const ctx = healthyContext({
      services: [
        { id: 'svc_1', name: 'Skin fade', pricePence: 2500, durationMinutes: 30, barberIds: ['barber_1'] },
        { id: 'svc_2', name: 'Hot towel shave', pricePence: 2000, durationMinutes: 30, barberIds: ['barber_1'] },
      ],
    });
    const r = await runCheck(createBookingAvailabilityCheck(deps({ [`svc_1|any-barber|${SLOT_DATE}`]: ['10:00'] })), ctx);
    expect(r.status).toBe('warn');
    expect(r.message).toBe('No slots in the next 14 days for: Hot towel shave.');
  });
});

describe('booking.dry_run', () => {
  const slots = { [`svc_1|any-barber|${SLOT_DATE}`]: ['10:00', '10:30'], [`svc_1|barber_1|${SLOT_DATE}`]: ['10:00'] };

  it('dry-runs the first slot with the health-check customer and passes', async () => {
    const create = vi.fn().mockResolvedValue({ dryRun: true, wouldCreate });
    const r = await runCheck(createBookingDryRunCheck(deps(slots, create)), healthyContext());
    expect(r.status).toBe('pass');
    expect(r.message).toBe('Booking pipeline OK (slot Fri 6 Nov 10:00, Skin fade with Alex).');
    expect(create).toHaveBeenCalledWith(
      { serviceId: 'svc_1', barberId: 'barber_1', date: SLOT_DATE, time: '10:00', ...HEALTH_CHECK_CUSTOMER },
      expect.objectContaining({ dryRun: true, requiredShopId: 'shop_1', requiredCapability: 'PUBLIC_BOOKING', allowDepositCollection: true }),
    );
    // No phone is ever sent.
    expect(create.mock.calls[0][0]).not.toHaveProperty('phone');
  });

  it('a PRELAUNCH run skips the plan gate and payments (draft shops have no plan yet)', async () => {
    const create = vi.fn().mockResolvedValue({ dryRun: true, wouldCreate });
    await runCheck(createBookingDryRunCheck(deps(slots, create)), healthyContext({ mode: 'PRELAUNCH' }));
    expect(create.mock.calls[0][1]).toMatchObject({ dryRun: true, allowDepositCollection: false, requiredCapability: undefined });
  });

  it('fails with the availability message when there is no slot', async () => {
    const create = vi.fn();
    const r = await runCheck(createBookingDryRunCheck(deps({}, create)), healthyContext());
    expect(r).toMatchObject({ status: 'fail', message: NO_SLOTS_MESSAGE });
    expect(create).not.toHaveBeenCalled();
  });

  it('retries a serialisation conflict (P2034) once, then reports inconclusive', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'x' });
    const create = vi.fn().mockRejectedValue(conflict);
    const r = await runCheck(createBookingDryRunCheck(deps(slots, create)), healthyContext());
    expect(create).toHaveBeenCalledTimes(2);
    expect(r.status).toBe('inconclusive');

    const recovers = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce({ dryRun: true, wouldCreate });
    expect((await runCheck(createBookingDryRunCheck(deps(slots, recovers)), healthyContext())).status).toBe('pass');
  });

  it('fails with the refusal a customer would see', async () => {
    const create = vi.fn().mockRejectedValue(new BookingActionError('New bookings are not available for this shop.', 403));
    const r = await runCheck(createBookingDryRunCheck(deps(slots, create)), healthyContext());
    expect(r.status).toBe('fail');
    expect(r.message).toContain('would be refused: New bookings are not available for this shop.');
  });
});
