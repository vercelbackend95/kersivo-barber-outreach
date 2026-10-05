export const prerender = false;

import type { APIRoute } from 'astro';
import { loadOnboardingState, requireOnboardingAccess } from '@/lib/admin/onboarding';
import { parseTermsAccepted } from '@/lib/legal/requireTermsAcceptance';
import { activateFreeBooking } from '@/lib/shop/freeBookingActivation';

export const POST: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  const body: unknown = await ctx.request.json().catch(() => null);
  const plan =
    body && typeof body === 'object' && typeof (body as { plan?: unknown }).plan === 'string'
      ? (body as { plan: string }).plan
      : null;

  try {
    const result = await activateFreeBooking({
      shopId,
      userId: access.userId!,
      email: access.userEmail,
      termsAccepted: parseTermsAccepted(body),
      plan,
      request: ctx.request,
    });

    if (!result.ok) {
      const { status, ok: _ok, ...payload } = result;
      return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const state = await loadOnboardingState(shopId, access);
    return new Response(JSON.stringify({ ...state, activation: result.outcome }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
