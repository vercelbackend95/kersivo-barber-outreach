/**
 * Booking proof: real availability from getAvailabilitySlots, then a dry-run createInstantBooking
 * (the whole create path in a transaction that is rolled back; see options.dryRun in booking/service.ts).
 * Probe checks: they run on the cron, on "Run checks now" and for PRELAUNCH runs, not on page load.
 */
import { Prisma } from '@prisma/client';
import { todayIsoInTimezone } from '@/lib/admin/shopPublicActivity';
import { ANY_BARBER_ID } from '@/lib/booking/constants';
import { BookingActionError, createInstantBooking, getAvailabilitySlots } from '@/lib/booking/service';
import { SlotUnavailableError } from '@/lib/booking/slotGuard';
import type { ShopHealthCheck, ShopHealthContext, ShopHealthOutcome } from '../types';

export const AVAILABILITY_DAYS = 14;
export const HEALTH_CHECK_CUSTOMER = { fullName: 'KERSIVO health check', email: 'health-check@kersivo.co.uk' } as const;

export const NO_SLOTS_MESSAGE =
  'No bookable slots in the next 14 days. Check barber availability rules and opening hours.';

export type ServiceAvailability = { serviceId: string; serviceName: string; firstDate: string | null; firstTime: string | null };

/** "2026-11-04" + n days, as an ISO date (calendar maths at UTC noon, so DST never shifts the day). */
export function addIsoDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatSlot(date: string, time: string): string {
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${label} ${time}`;
}

type Deps = {
  getAvailabilitySlots: typeof getAvailabilitySlots;
  createInstantBooking: typeof createInstantBooking;
};
const defaultDeps: Deps = { getAvailabilitySlots, createInstantBooking };

async function slotsFor(deps: Deps, serviceId: string, barberId: string, date: string): Promise<string[]> {
  const result = await deps.getAvailabilitySlots({ serviceId, barberId, date, ignorePublicActivityPause: true });
  return result?.slots ?? [];
}

/** First slot per active service (any barber) within 14 days. Memoised per run context. */
const availabilityMemo = new WeakMap<ShopHealthContext, Promise<ServiceAvailability[]>>();
export function loadServiceAvailability(ctx: ShopHealthContext, deps: Deps = defaultDeps): Promise<ServiceAvailability[]> {
  const cached = availabilityMemo.get(ctx);
  if (cached) return cached;
  const promise = (async () => {
    const today = todayIsoInTimezone(ctx.shop.timezone || 'Europe/London', ctx.now);
    const out: ServiceAvailability[] = [];
    for (const service of ctx.services) {
      let found: ServiceAvailability = { serviceId: service.id, serviceName: service.name, firstDate: null, firstTime: null };
      if (service.barberIds.length) {
        for (let day = 0; day < AVAILABILITY_DAYS; day += 1) {
          const date = addIsoDays(today, day);
          const slots = await slotsFor(deps, service.id, ANY_BARBER_ID, date);
          if (slots.length) {
            found = { ...found, firstDate: date, firstTime: slots[0] };
            break;
          }
        }
      }
      out.push(found);
    }
    return out;
  })();
  availabilityMemo.set(ctx, promise);
  promise.catch(() => availabilityMemo.delete(ctx));
  return promise;
}

export function createBookingAvailabilityCheck(deps: Deps = defaultDeps): ShopHealthCheck {
  return {
    id: 'booking.availability',
    area: 'booking',
    title: 'Bookable slots',
    severity: 'critical',
    kind: 'probe',
    appliesWhen: () => 'yes',
    async run(ctx): Promise<ShopHealthOutcome> {
      if (!ctx.services.length) {
        return { status: 'fail', message: NO_SLOTS_MESSAGE, fix: 'Add an active service first.' };
      }
      const availability = await loadServiceAvailability(ctx, deps);
      const withSlots = availability.filter((a) => a.firstDate);
      const without = availability.filter((a) => !a.firstDate).map((a) => a.serviceName);
      const evidence = {
        servicesWithSlots: withSlots.length,
        servicesWithoutSlots: without,
        firstSlot: withSlots[0] ? formatSlot(withSlots[0].firstDate!, withSlots[0].firstTime!) : null,
      };
      if (!withSlots.length) {
        return {
          status: 'fail',
          message: NO_SLOTS_MESSAGE,
          fix: 'Make sure each barber has availability rules inside the opening hours, and is linked to services.',
          evidence,
        };
      }
      if (without.length) {
        return {
          status: 'warn',
          message: `No slots in the next 14 days for: ${without.join(', ')}.`,
          fix: 'Link a barber with availability to each of these services, or deactivate them.',
          evidence,
        };
      }
      return {
        status: 'pass',
        message: `Every active service has slots in the next 14 days (first: ${evidence.firstSlot}).`,
        evidence,
      };
    },
  };
}

function isSerialisationConflict(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') ||
    error instanceof SlotUnavailableError
  );
}

export function createBookingDryRunCheck(deps: Deps = defaultDeps): ShopHealthCheck {
  return {
    id: 'booking.dry_run',
    area: 'booking',
    title: 'Test booking (dry run)',
    severity: 'critical',
    kind: 'probe',
    appliesWhen: () => 'yes',
    async run(ctx): Promise<ShopHealthOutcome> {
      const availability = await loadServiceAvailability(ctx, deps);
      const first = availability.find((a) => a.firstDate && a.firstTime);
      if (!first) {
        return {
          status: 'fail',
          message: NO_SLOTS_MESSAGE,
          fix: 'Fix the “Bookable slots” check first; the test booking needs a free slot.',
        };
      }
      const service = ctx.services.find((s) => s.id === first.serviceId)!;
      // A named barber, not "any": the same choice a customer makes on the booking page.
      let barberId: string | null = null;
      for (const candidate of service.barberIds) {
        if ((await slotsFor(deps, service.id, candidate, first.firstDate!)).includes(first.firstTime!)) {
          barberId = candidate;
          break;
        }
      }
      if (!barberId) {
        return {
          status: 'inconclusive',
          message: 'The free slot was taken by another booking while the check ran.',
          evidence: { slot: formatSlot(first.firstDate!, first.firstTime!) },
        };
      }
      const barberName = ctx.barbers.find((b) => b.id === barberId)?.name ?? 'barber';
      const slotLabel = formatSlot(first.firstDate!, first.firstTime!);
      const live = ctx.mode === 'LIVE';

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const result = await deps.createInstantBooking(
            {
              serviceId: service.id,
              barberId,
              date: first.firstDate!,
              time: first.firstTime!,
              fullName: HEALTH_CHECK_CUSTOMER.fullName,
              email: HEALTH_CHECK_CUSTOMER.email,
            },
            {
              dryRun: true,
              requiredShopId: ctx.shop.id,
              skipConfirmationEmail: true,
              ignorePublicActivityPause: true,
              // A live shop goes through the same gates as a public booking (entitlement under the shop
              // lock, payment readiness). A draft shop has no plan yet, so only the booking itself is proven.
              allowDepositCollection: live,
              requiredCapability: live ? 'PUBLIC_BOOKING' : undefined,
            },
          );
          return {
            status: 'pass',
            message: `Booking pipeline OK (slot ${slotLabel}, ${service.name} with ${barberName}).`,
            evidence: {
              slot: slotLabel,
              service: service.name,
              barber: barberName,
              wouldCreateStatus: String(result.wouldCreate.status),
              paymentRequired: result.wouldCreate.paymentRequired,
              attempts: attempt,
            },
          };
        } catch (error) {
          if (isSerialisationConflict(error)) {
            if (attempt === 1) continue;
            return {
              status: 'inconclusive',
              message: 'The test booking hit a conflict with another booking twice; try again shortly.',
              evidence: { slot: slotLabel, attempts: attempt },
            };
          }
          if (error instanceof BookingActionError) {
            return {
              status: 'fail',
              message: `A booking for ${service.name} with ${barberName} (${slotLabel}) would be refused: ${error.message}`,
              fix: 'Fix the reason above; customers see the same refusal.',
              evidence: { slot: slotLabel, status: error.statusCode, code: error.code ?? null },
            };
          }
          return {
            status: 'fail',
            message: `The test booking failed: ${error instanceof Error ? error.message : 'unknown error'}`,
            fix: 'Check the booking setup for this shop and the server logs.',
            evidence: { slot: slotLabel },
          };
        }
      }
      return { status: 'inconclusive', message: 'The test booking did not finish.' };
    },
  };
}

export const bookingAvailability = createBookingAvailabilityCheck();
export const bookingDryRun = createBookingDryRunCheck();
