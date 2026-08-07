export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '@/lib/admin/auth';
import {
  loadClientOnboardingState,
  parseDraftBody,
  requireClientOnboardingAccess,
  saveClientOnboardingDraft,
} from '@/lib/admin/clientOnboarding/service';

export const GET: APIRoute = async (ctx) => {
  const accessOrErr = await requireClientOnboardingAccess(await resolveAdminAccess(ctx));
  if (accessOrErr instanceof Response) return accessOrErr;

  try {
    const state = await loadClientOnboardingState(accessOrErr.shopId, accessOrErr);
    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load client onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

async function saveDraft(ctx: Parameters<APIRoute>[0]) {
  const accessOrErr = await requireClientOnboardingAccess(await resolveAdminAccess(ctx));
  if (accessOrErr instanceof Response) return accessOrErr;

  let body: unknown;
  try {
    body = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }

  const parsed = parseDraftBody(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Validation failed.', details: parsed.error.flatten() }),
      { status: 400 },
    );
  }

  try {
    const onboarding = await saveClientOnboardingDraft(accessOrErr.shopId, parsed.data);
    return new Response(JSON.stringify({ ok: true, onboarding }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to save client onboarding draft.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

export const PUT: APIRoute = async (ctx) => saveDraft(ctx);
export const PATCH: APIRoute = async (ctx) => saveDraft(ctx);
