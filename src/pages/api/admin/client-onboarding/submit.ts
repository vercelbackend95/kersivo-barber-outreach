export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '@/lib/admin/auth';
import {
  requireClientOnboardingAccess,
  submitClientOnboarding,
} from '@/lib/admin/clientOnboarding/service';

export const POST: APIRoute = async (ctx) => {
  const accessOrErr = await requireClientOnboardingAccess(await resolveAdminAccess(ctx));
  if (accessOrErr instanceof Response) return accessOrErr;

  try {
    const result = await submitClientOnboarding(accessOrErr.shopId, accessOrErr);
    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: 'Submit validation failed.', missing: result.errors }),
        { status: 400 },
      );
    }
    return new Response(
      JSON.stringify({
        ok: true,
        idempotent: result.idempotent,
        onboarding: result.onboarding,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to submit client onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
