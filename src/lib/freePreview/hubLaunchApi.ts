import type { APIContext } from 'astro';
import { resolveAdminAccess } from '@/lib/admin/auth';
import { accessCan } from '@/lib/admin/rbac/can';
import { evaluateExactSameOrigin } from '@/lib/ops/requireOperatorMutation';
import { PRIVATE_PREVIEW_HEADERS } from './previewHeaders';
import { isAdminHubRouteEnabled, isHubRouteEnabled } from './hubPage';
import { prisma } from '@/lib/db/client';
import { ensureClientOnboarding } from '@/lib/admin/clientOnboarding/service';

export const LAUNCH_API_HEADERS: Record<string, string> = {
  ...PRIVATE_PREVIEW_HEADERS,
  'Content-Type': 'application/json',
};

export function launchJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...LAUNCH_API_HEADERS } });
}

export async function requireLaunchOwner(
  ctx: APIContext,
  method: 'GET' | 'MUTATE',
): Promise<{ shopId: string; previewRequestId: string } | Response> {
  if (!isHubRouteEnabled() && !isAdminHubRouteEnabled()) return launchJson({ error: 'Not found.' }, 404);
  if (method === 'MUTATE') {
    const origin = evaluateExactSameOrigin(ctx.request);
    if (!origin.ok) return launchJson({ error: 'Forbidden.' }, 403);
  }
  const access = await resolveAdminAccess(ctx);
  if (!access || access.via !== 'session' || !accessCan(access, 'billing.manage')) {
    return launchJson({ error: 'Unauthorized.' }, 401);
  }
  const request = await prisma.previewRequest.findUnique({
    where: { draftShopId: access.shopId },
    select: { id: true },
  });
  if (!request) return launchJson({ error: 'Not found.' }, 404);
  await ensureClientOnboarding(access.shopId);
  return { shopId: access.shopId, previewRequestId: request.id };
}
