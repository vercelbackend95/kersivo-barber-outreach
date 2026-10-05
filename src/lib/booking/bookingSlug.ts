import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { DEMO_SHOP_KEY } from '../demo/services';

/** Fallback when a shop name contains no usable characters. */
const EMPTY_NAME_SLUG = 'barbershop';
const MAX_SLUG_BASE_LENGTH = 48;
/** Hash-suffix lengths tried in order after the name and name+town candidates. */
const HASH_SUFFIX_LENGTHS = [4, 6, 8, 12] as const;
const SLUG_SUFFIX_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/**
 * Serialises slug allocation across shops (transaction-scoped advisory lock).
 * The UNIQUE constraint on ShopSettings.bookingSlug stays the final guarantee.
 */
export const BOOKING_SLUG_ADVISORY_LOCK_KEY = 73_120_261;

/**
 * Identifiers that must never become a tenant slug: static /book/* routes, demo shop ids and
 * KERSIVO system words that could be confused with product routing.
 */
export const RESERVED_BOOKING_SLUGS: ReadonlySet<string> = new Set([
  DEMO_SHOP_ID,
  DEMO_SHOP_KEY,
  'admin',
  'api',
  'book',
  'booking',
  'calendar',
  'cancel',
  'confirm',
  'demo',
  'index',
  'kersivo',
  'new',
  'ops',
  'preview',
  'q',
  'reschedule',
  'setup',
  'shop',
  'success',
  'test',
]);

const TRANSLITERATIONS: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
};

/** "John & Sons" → "john-and-sons". Returns '' when nothing usable remains. */
export function slugifyBookingName(input: string): string {
  const lowered = input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[ßæœøłđðþ]/g, (char) => TRANSLITERATIONS[char] ?? '')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '');
  const hyphenated = lowered
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (hyphenated.length <= MAX_SLUG_BASE_LENGTH) return hyphenated;
  const truncated = hyphenated.slice(0, MAX_SLUG_BASE_LENGTH);
  const lastHyphen = truncated.lastIndexOf('-');
  return (lastHyphen > 0 ? truncated.slice(0, lastHyphen) : truncated).replace(/-+$/g, '');
}

/** Stable, non-reversible short suffix derived from the shop id (never the raw id). */
export function deterministicSlugSuffix(shopId: string, length: number): string {
  const digest = createHash('sha256').update(`kersivo-booking-slug:${shopId}`).digest();
  let out = '';
  for (let index = 0; index < length; index += 1) {
    out += SLUG_SUFFIX_ALPHABET[digest[index]! % SLUG_SUFFIX_ALPHABET.length];
  }
  return out;
}

/** Ordered candidates: name, name-town, then name-{hash suffix} of increasing length. */
export function bookingSlugCandidates(params: {
  shopId: string;
  name: string;
  townCity?: string | null;
}): string[] {
  const base = slugifyBookingName(params.name) || EMPTY_NAME_SLUG;
  const town = params.townCity ? slugifyBookingName(params.townCity) : '';
  const candidates = [base];
  if (town && !base.endsWith(`-${town}`) && base !== town) candidates.push(`${base}-${town}`);
  for (const length of HASH_SUFFIX_LENGTHS) {
    candidates.push(`${base}-${deterministicSlugSuffix(params.shopId, length)}`);
  }
  return candidates.filter((candidate) => !RESERVED_BOOKING_SLUGS.has(candidate));
}

/** SQL for the transaction-scoped slug allocation lock; returns an int row, not PostgreSQL void. */
export function bookingSlugAllocationLockSql(): Prisma.Sql {
  return Prisma.sql`
    WITH lock_row AS (
      SELECT pg_advisory_xact_lock(${BOOKING_SLUG_ADVISORY_LOCK_KEY}::bigint)
    )
    SELECT 1::int AS locked
    FROM lock_row
  `;
}

/** Blocks until this transaction holds the slug allocation lock; released at commit/rollback. */
export async function acquireBookingSlugAllocationLock(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<void> {
  await tx.$queryRaw<Array<{ locked: number }>>(bookingSlugAllocationLockSql());
}

/**
 * Returns the shop's bookingSlug, allocating one if missing. An existing slug is never changed.
 * Must run inside a transaction; takes the shop row lock and the slug advisory lock.
 */
export async function ensureShopBookingSlug(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<string> {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${shopId} FOR UPDATE`);
  const shop = await tx.shopSettings.findUniqueOrThrow({
    where: { id: shopId },
    select: { bookingSlug: true, name: true, townCity: true },
  });
  if (shop.bookingSlug) return shop.bookingSlug;

  await acquireBookingSlugAllocationLock(tx);

  const candidates = bookingSlugCandidates({ shopId, name: shop.name, townCity: shop.townCity });
  // Slugs and shop ids share the /book/{identifier} namespace, so a candidate equal to any
  // existing shop id is as unavailable as one equal to another shop's slug.
  const conflicts = await tx.shopSettings.findMany({
    where: { OR: [{ bookingSlug: { in: candidates } }, { id: { in: candidates } }] },
    select: { id: true, bookingSlug: true },
  });
  const takenSet = new Set<string>();
  for (const row of conflicts) {
    takenSet.add(row.id);
    if (row.bookingSlug) takenSet.add(row.bookingSlug);
  }
  const slug = candidates.find((candidate) => !takenSet.has(candidate));
  if (!slug) {
    throw new Error('Unable to allocate a unique booking slug.');
  }

  await tx.shopSettings.update({ where: { id: shopId }, data: { bookingSlug: slug } });
  return slug;
}
