import { randomInt } from 'node:crypto';
import { Prisma, ShopQrPlacement } from '@prisma/client';
import { prisma } from '../db/client';

/** Crockford-style alphabet without ambiguous 0/O/1/I/L — safe to print and read aloud. */
export const QR_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
/** 31^12 ≈ 7.9e17 combinations (~59 bits); collisions are negligible, UNIQUE remains final. */
export const QR_CODE_LENGTH = 12;
export const QR_CODE_PATTERN = new RegExp(`^[${QR_CODE_ALPHABET}]{${QR_CODE_LENGTH}}$`);
export const SHOP_QR_PLACEMENTS: readonly ShopQrPlacement[] = [
  ShopQrPlacement.WINDOW,
  ShopQrPlacement.REBOOK,
];
const MAX_ENSURE_ATTEMPTS = 3;

/** Cryptographically random, non-semantic code (not derived from shop id, name or sequence). */
export function generateOpaqueQrCode(): string {
  let code = '';
  for (let index = 0; index < QR_CODE_LENGTH; index += 1) {
    code += QR_CODE_ALPHABET[randomInt(QR_CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalises a scanned /q/{code} segment; returns null for anything outside the code format. */
export function normalizeQrCode(raw: string | undefined | null): string | null {
  const code = (raw ?? '').trim().toUpperCase();
  return QR_CODE_PATTERN.test(code) ? code : null;
}

export type ShopQrCodeRow = { id: string; shopId: string; code: string; placement: ShopQrPlacement };

const QR_ROW_SELECT = { id: true, shopId: true, code: true, placement: true } as const;

/**
 * Ensures the canonical WINDOW + REBOOK codes inside an existing transaction.
 * Takes the shop row lock so concurrent calls for one shop cannot both create a placement.
 * A random-code UNIQUE collision aborts the transaction; use `ensureShopQrCodes` to retry.
 */
export async function ensureShopQrCodesInTx(
  tx: Prisma.TransactionClient,
  shopId: string,
  generateCode: () => string = generateOpaqueQrCode,
): Promise<ShopQrCodeRow[]> {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${shopId} FOR UPDATE`);

  const existing = await tx.shopQrCode.findMany({ where: { shopId }, select: QR_ROW_SELECT });
  const byPlacement = new Map(existing.map((row) => [row.placement, row]));

  for (const placement of SHOP_QR_PLACEMENTS) {
    if (byPlacement.has(placement)) continue;
    let code = generateCode();
    // Cheap pre-check avoids aborting the transaction on the (negligible) random collision.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await tx.shopQrCode.findUnique({ where: { code }, select: { id: true } });
      if (!clash) break;
      code = generateCode();
    }
    const created = await tx.shopQrCode.create({
      data: { shopId, placement, code },
      select: QR_ROW_SELECT,
    });
    byPlacement.set(placement, created);
  }

  return SHOP_QR_PLACEMENTS.map((placement) => byPlacement.get(placement)!);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Idempotently ensures one WINDOW and one REBOOK code for the shop. Not called from generic shop
 * creation; QR request/fulfilment (later phase) is the intended caller.
 * Retries the whole transaction on a UNIQUE violation, then re-reads, so it never returns a row
 * that belongs to another shop or placement.
 */
export async function ensureShopQrCodes(
  shopId: string,
  options: { db?: typeof prisma; generateCode?: () => string } = {},
): Promise<ShopQrCodeRow[]> {
  const db = options.db ?? prisma;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ENSURE_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction((tx) => ensureShopQrCodesInTx(tx, shopId, options.generateCode));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
