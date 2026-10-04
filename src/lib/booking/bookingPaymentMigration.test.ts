import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION = resolve(
  __dirname,
  '../../../prisma/migrations/20261004140000_booking_payment_model/migration.sql',
);
const sql = readFileSync(MIGRATION, 'utf8');
const normalized = sql.replace(/\s+/g, ' ');

function updateStatements(): string[] {
  return normalized.split(';').filter((s) => /\bUPDATE "/.test(s));
}

describe('booking payment model migration', () => {
  it('is additive: new enums, enum value and columns only; nothing dropped or renamed', () => {
    expect(normalized).toContain(`CREATE TYPE "BookingPaymentMode" AS ENUM ('NONE', 'DEPOSIT', 'FULL')`);
    expect(normalized).toContain(`CREATE TYPE "BookingPaymentType" AS ENUM ('NONE', 'DEPOSIT', 'FULL')`);
    expect(normalized).toContain(`ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED'`);
    expect(normalized).toContain(
      `ALTER TABLE "ShopSettings" ADD COLUMN "bookingPaymentMode" "BookingPaymentMode" NOT NULL DEFAULT 'NONE'`,
    );
    expect(normalized).toContain(`ADD COLUMN "refundedAmountPence" INTEGER NOT NULL DEFAULT 0`);
    expect(sql).not.toMatch(/\bDROP\b|\bRENAME\b|\bDELETE\b|\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/"depositsEnabled"\s*=\s*(true|false)\s*,|SET\s+"depositsEnabled"/i);
  });

  it('U: shops with depositsEnabled = true become DEPOSIT; others keep the NONE default', () => {
    expect(normalized).toContain(
      `UPDATE "ShopSettings" SET "bookingPaymentMode" = 'DEPOSIT' WHERE "depositsEnabled" = true;`,
    );
  });

  it('V: existing deposit bookings get a truthful DEPOSIT snapshot with 0% fee', () => {
    expect(normalized).toContain(
      `UPDATE "Booking" SET "bookingPaymentType" = 'DEPOSIT', "paymentAmountPence" = "depositAmountPence", "kersivoPlatformFeePence" = 0, "kersivoPlatformFeeBps" = 0 WHERE "paymentRequired" = true AND "depositAmountPence" IS NOT NULL;`,
    );
  });

  it('V: refundedAmountPence is backfilled only from confirmed ledger refunds', () => {
    expect(normalized).toContain(
      `UPDATE "Booking" AS b SET "refundedAmountPence" = r."amountPence" FROM "BookingDepositRefund" AS r WHERE r."bookingId" = b."id" AND r."status" = 'REFUNDED' AND b."paymentStatus" = 'REFUNDED';`,
    );
  });

  it('W: no backfill ever sets FULL or uses PARTIALLY_REFUNDED', () => {
    const updates = updateStatements();
    expect(updates.length).toBe(3);
    for (const stmt of updates) {
      expect(stmt).not.toMatch(/'FULL'/);
      expect(stmt).not.toMatch(/PARTIALLY_REFUNDED/);
    }
  });
});
