/** Notes prefix written on public marketing-demo bookings created via unauthenticated `/book`. */
export const PUBLIC_DEMO_BOOKING_NOTES_PREFIX = '[PUBLIC_DEMO]';

/** Notes prefix for owner test bookings from `/admin/test-book`. */
export const OWNER_TEST_BOOKING_NOTES_PREFIX = '[TEST]';

export function isSandboxBookingNotes(notes: string | null | undefined): boolean {
  const value = (notes ?? '').trimStart();
  return (
    value.startsWith(PUBLIC_DEMO_BOOKING_NOTES_PREFIX) ||
    value.startsWith(OWNER_TEST_BOOKING_NOTES_PREFIX)
  );
}

/** Prisma filter: exclude sandbox/demo bookings from revenue & KPI reports. */
export const excludeSandboxBookingsWhere = {
  NOT: {
    OR: [
      { notes: { startsWith: PUBLIC_DEMO_BOOKING_NOTES_PREFIX } },
      { notes: { startsWith: OWNER_TEST_BOOKING_NOTES_PREFIX } },
    ],
  },
} as const;
