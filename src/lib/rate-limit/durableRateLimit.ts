import { prisma } from '@/lib/db/client';

/**
 * Durable rate limit backed by RateLimitEvent (Postgres).
 * Column `ip` stores an opaque key (real IP or `user:<id>`), not always an address.
 *
 * Uses a transaction + pg_advisory_xact_lock so concurrent serverless
 * invocations cannot all pass the same under-limit count (TOCTOU).
 */

function advisoryLockKey(action: string, key: string): number {
  // Stable 31-bit positive int for pg_advisory_xact_lock(int4).
  let hash = 2166136261;
  const input = `${action}\0${key}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 1;
}

export async function countDurableRateLimitHits(input: {
  key: string;
  action: string;
  windowMs: number;
}): Promise<{ count: number; oldestAt: Date | null }> {
  const key = input.key.trim().slice(0, 200);
  const action = input.action.trim().slice(0, 120);
  const windowStart = new Date(Date.now() - input.windowMs);

  const [count, oldest] = await Promise.all([
    prisma.rateLimitEvent.count({
      where: { ip: key, action, createdAt: { gte: windowStart } },
    }),
    prisma.rateLimitEvent.findFirst({
      where: { ip: key, action, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  return { count, oldestAt: oldest?.createdAt ?? null };
}

export async function recordDurableRateLimitHit(input: {
  key: string;
  action: string;
}): Promise<void> {
  const key = input.key.trim().slice(0, 200);
  const action = input.action.trim().slice(0, 120);
  if (!key || !action) return;
  await prisma.rateLimitEvent.create({ data: { ip: key, action } });
}

export async function checkDurableRateLimit(input: {
  /** Opaque bucket key stored in RateLimitEvent.ip */
  key: string;
  action: string;
  limit: number;
  windowMs: number;
}): Promise<{ ok: boolean; retryAfterSeconds?: number }> {
  const key = input.key.trim().slice(0, 200);
  const action = input.action.trim().slice(0, 120);
  if (!key || !action || input.limit < 1 || input.windowMs < 1) {
    return { ok: true };
  }

  const now = Date.now();
  const windowStart = new Date(now - input.windowMs);
  const lockId = advisoryLockKey(action, key);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    const [count, oldest] = await Promise.all([
      tx.rateLimitEvent.count({
        where: { ip: key, action, createdAt: { gte: windowStart } },
      }),
      tx.rateLimitEvent.findFirst({
        where: { ip: key, action, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    if (count >= input.limit) {
      const oldestMs = oldest?.createdAt.getTime() ?? now;
      return {
        ok: false as const,
        retryAfterSeconds: Math.max(1, Math.ceil((input.windowMs - (now - oldestMs)) / 1000)),
      };
    }

    await tx.rateLimitEvent.create({ data: { ip: key, action } });
    return { ok: true as const };
  });
}

/** Locked consume — same semantics as checkDurableRateLimit (for login failures). */
export async function consumeRateLimitSlot(input: {
  key: string;
  action: string;
  limit: number;
  windowMs: number;
}): Promise<{ ok: boolean; retryAfterSeconds?: number }> {
  return checkDurableRateLimit(input);
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 120);
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 120);
  return 'unknown';
}

export function rateLimitExceededResponse(retryAfterSeconds?: number): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    headers['Retry-After'] = String(retryAfterSeconds);
  }
  return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
    status: 429,
    headers,
  });
}
