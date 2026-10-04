/**
 * Database smoke check for the booking-slug allocation advisory lock.
 *
 *   SMOKE_DATABASE_URL=postgresql://... npx tsx scripts/smoke-booking-slug-advisory-lock.ts
 *
 * Requires an explicit SMOKE_DATABASE_URL (never falls back to DATABASE_URL) so it cannot be
 * pointed at production by accident. Writes no data: it acquires the transaction-scoped lock,
 * confirms it is held, rolls back, then confirms it was released.
 */
import { PrismaClient } from '@prisma/client';
import {
  BOOKING_SLUG_ADVISORY_LOCK_KEY,
  bookingSlugAllocationLockSql,
} from '../src/lib/booking/bookingSlug';

const ROLLBACK = Symbol('rollback');

async function main() {
  const url = process.env.SMOKE_DATABASE_URL?.trim();
  if (!url) {
    console.error('Set SMOKE_DATABASE_URL to a local/dev Postgres database to run this smoke check.');
    process.exit(2);
  }

  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    try {
      await db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ locked: number }>>(bookingSlugAllocationLockSql());
        if (rows.length !== 1 || rows[0]!.locked !== 1) {
          throw new Error(`Unexpected advisory lock result: ${JSON.stringify(rows)}`);
        }
        const held = await tx.$queryRaw<Array<{ held: number }>>`
          SELECT count(*)::int AS held
          FROM pg_locks
          WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND granted
        `;
        if ((held[0]?.held ?? 0) < 1) throw new Error('Advisory lock was not held inside the transaction.');
        console.log('Advisory xact lock acquired inside the transaction.');
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }

    const released = await db.$transaction(
      (tx) => tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${BOOKING_SLUG_ADVISORY_LOCK_KEY}::bigint) AS acquired
      `,
    );
    if (released[0]?.acquired !== true) throw new Error('Advisory lock was not released after rollback.');
    console.log('Advisory xact lock released at transaction end. No data was written.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
