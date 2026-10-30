export const prerender = false;

import type { APIRoute } from 'astro';
import { previewLaunchSchema, startPreviewLaunchCheckout } from '@/lib/freePreview/launchCheckout';
import { PREVIEW_CHECKOUT_RATE, previewApiGuard, previewJson } from '@/lib/freePreview/previewApi';
import { termsAcceptedErrorResponse } from '@/lib/legal/requireTermsAcceptance';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

/** "Continue to secure checkout" from the preview's launch panel (spec §7). */
export const POST: APIRoute = async ({ request, params }) => {
  const blocked = previewApiGuard(request);
  if (blocked) return blocked;

  const limited = await enforceIpRateLimit(
    request,
    PREVIEW_CHECKOUT_RATE.action,
    PREVIEW_CHECKOUT_RATE.limit,
    PREVIEW_CHECKOUT_RATE.windowMs,
  );
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return previewJson({ error: 'Invalid request body.' }, 400);
  }
  if (body?.termsAccepted !== true) return termsAcceptedErrorResponse();

  const parsed = previewLaunchSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === 'domainMode' || field === 'domain' || field === 'domainRegistrationAuthorised') {
      return previewJson({ error: 'Choose a domain before continuing.' }, 400);
    }
    return previewJson({ error: 'Please enter your name (at least 2 characters).' }, 400);
  }

  try {
    return await startPreviewLaunchCheckout({
      request,
      token: params.token ?? '',
      name: parsed.data.name,
      checkoutAttemptId: parsed.data.checkoutAttemptId,
      domainMode: parsed.data.domainMode,
      domain: parsed.data.domain,
      domainRegistrationAuthorised: parsed.data.domainRegistrationAuthorised,
    });
  } catch (error) {
    console.error('[free-preview] checkout failed', error instanceof Error ? error.message : error);
    return previewJson({ error: 'Unable to create checkout session.' }, 500);
  }
};
