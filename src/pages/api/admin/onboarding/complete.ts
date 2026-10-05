export const prerender = false;

import type { APIRoute } from 'astro';
import { loadOnboardingState, requireOnboardingAccess } from '@/lib/admin/onboarding';
import { parseTermsAccepted } from '@/lib/legal/requireTermsAcceptance';
import { activateFreeBooking } from '@/lib/shop/freeBookingActivation';
import { loadKersivoAccess } from '@/lib/shop/kersivoAccess';

export const POST: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  const body: unknown = await ctx.request.json().catch(() => null);
  const plan =
    body && typeof body === 'object'
      ? String((body as { plan?: unknown }).plan ?? '').trim().toUpperCase()
      : '';

  const currentAccess = await loadKersivoAccess(shopId);
  if (currentAccess.state === 'SETUP' && plan !== 'STARTER') {
    return new Response(
      JSON.stringify({
        error: 'Choose KERSIVO Starter explicitly before activation.',
        code: 'STARTER_PLAN_NOT_SELECTED',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const result = await activateFreeBooking({
      shopId,
      userId: access.userId!,
      email: access.userEmail,
      termsAccepted: parseTermsAccepted(body),
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
