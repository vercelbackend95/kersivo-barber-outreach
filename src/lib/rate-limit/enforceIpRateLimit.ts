import { isPreviewHubRealQaEnabled } from '@/lib/previewHub/realQa';
import {
  checkDurableRateLimit,
  clientIpFromRequest,
  rateLimitExceededResponse,
} from '@/lib/rate-limit/durableRateLimit';

/** Enforce IP rate limit; returns 429 Response when exceeded, otherwise null. */
export async function enforceIpRateLimit(
  request: Request,
  action: string,
  limit: number,
  windowMs: number,
): Promise<Response | null> {
  if (isPreviewHubRealQaEnabled()) return null;
  const ip = clientIpFromRequest(request);
  const result = await checkDurableRateLimit({ key: ip, action, limit, windowMs });
  if (!result.ok) return rateLimitExceededResponse(result.retryAfterSeconds);
  return null;
}
