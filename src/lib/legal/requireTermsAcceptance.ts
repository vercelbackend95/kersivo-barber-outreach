import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import {
  CURRENT_TERMS_VERSION,
  type TermsAcceptancePurpose,
} from '@/lib/legal/termsVersion';

export const TERMS_ACCEPTANCE_REQUIRED_MESSAGE = 'Please accept the Terms to continue.';

/**
 * Strict boolean check — string "true" / 1 do not count.
 */
export function parseTermsAccepted(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  return (body as { termsAccepted?: unknown }).termsAccepted === true;
}

export function termsAcceptedErrorResponse(): Response {
  return new Response(JSON.stringify({ error: TERMS_ACCEPTANCE_REQUIRED_MESSAGE }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 120);
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp ? realIp.slice(0, 120) : null;
}

/**
 * Persist Terms acceptance proof. Failures are logged only — Checkout session may already exist.
 */
export async function recordTermsAcceptance(input: {
  purpose: TermsAcceptancePurpose;
  email: string;
  userId?: string | null;
  shopId?: string | null;
  stripeSessionId?: string | null;
  request: Request;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    console.error('[legal-acceptance] missing email; skip record', { purpose: input.purpose });
    return;
  }

  try {
    await prisma.legalAcceptance.create({
      data: {
        purpose: input.purpose,
        termsVersion: CURRENT_TERMS_VERSION,
        userId: input.userId ?? null,
        email,
        shopId: input.shopId ?? null,
        stripeSessionId: input.stripeSessionId ?? null,
        ip: clientIp(input.request),
        userAgent: (input.request.headers.get('user-agent') ?? '').trim().slice(0, 500) || null,
        meta: input.meta ?? undefined,
      },
    });
  } catch (error) {
    console.error('[legal-acceptance] failed to record', {
      purpose: input.purpose,
      email,
      stripeSessionId: input.stripeSessionId,
      error,
    });
  }
}

/** Stripe metadata fragment for payment trail. */
export function termsAcceptanceStripeMetadata(): Record<string, string> {
  return {
    terms_accepted: '1',
    terms_version: CURRENT_TERMS_VERSION,
  };
}
