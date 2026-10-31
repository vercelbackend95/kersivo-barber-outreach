export const prerender = false;

import type { APIRoute } from 'astro';
import { hubJson, hubNotFoundJson, resolveHubApiContext, withHubApiHeaders } from '@/lib/freePreview/hubApi';
import { isAdminHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { previewLaunchSchema, startPreviewLaunchCheckoutFor } from '@/lib/freePreview/launchCheckout';
import { PREVIEW_CHECKOUT_RATE } from '@/lib/freePreview/previewApi';
import { termsAcceptedErrorResponse } from '@/lib/legal/requireTermsAcceptance';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

/** "Launch this website" from the hub inside /admin: the preview checkout, resolved from `ks_hub`. */
export const POST: APIRoute = async ({ request }) => {
  if (!isAdminHubRouteEnabled()) return hubNotFoundJson();

  const limited = await enforceIpRateLimit(
    request,
    PREVIEW_CHECKOUT_RATE.action,
    PREVIEW_CHECKOUT_RATE.limit,
    PREVIEW_CHECKOUT_RATE.windowMs,
  );
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, source: { kind: 'cookie' }, mutation: true });
  if (!ctxResult.ok) return ctxResult.response;
  if (ctxResult.ctx.isOperator) return hubJson({ error: 'Operator view: owner actions are disabled.' }, 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return hubJson({ error: 'Invalid request body.' }, 400);
  }
  if (body?.termsAccepted !== true) return withHubApiHeaders(termsAcceptedErrorResponse());

  const parsed = previewLaunchSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === 'domainMode' || field === 'domain' || field === 'domainRegistrationAuthorised') {
      return hubJson({ error: 'Choose a domain before continuing.' }, 400);
    }
    return hubJson({ error: 'Please enter your name (at least 2 characters).' }, 400);
  }

  try {
    const response = await startPreviewLaunchCheckoutFor({
      request,
      preview: ctxResult.ctx.request,
      cancelPath: '/admin',
      name: parsed.data.name,
      checkoutAttemptId: parsed.data.checkoutAttemptId,
      domainMode: parsed.data.domainMode,
      domain: parsed.data.domain,
      domainRegistrationAuthorised: parsed.data.domainRegistrationAuthorised,
    });
    return withHubApiHeaders(response);
  } catch (error) {
    console.error('[admin-hub] checkout failed', error instanceof Error ? error.message : error);
    return hubJson({ error: 'Unable to create checkout session.' }, 500);
  }
};
