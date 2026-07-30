import {
  checkDurableRateLimit,
  clientIpFromRequest,
  rateLimitExceededResponse,
} from '@/lib/rate-limit/durableRateLimit';

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;

/** Booking create rate limit (IP, durable Postgres). */
export async function checkBookingRateLimit(
  ip: string,
  action: 'booking_create' | 'public_booking_create' = 'booking_create',
): Promise<{ ok: boolean; retryAfterSeconds?: number }> {
  return checkDurableRateLimit({
    key: ip,
    action,
    limit: LIMIT,
    windowMs: WINDOW_MS,
  });
}

export { clientIpFromRequest, rateLimitExceededResponse };
