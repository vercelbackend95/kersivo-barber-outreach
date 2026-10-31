export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { isHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { setOpsLaunchStep } from '@/lib/freePreview/hubLaunch';
import { OPS_API_HEADERS } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

const schema = z.object({
  step: z.enum(['domain', 'ssl', 'live']),
  confirm: z.literal(true),
});

export const POST: APIRoute = async (context) => {
  if (!isHubRouteEnabled()) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const body = await context.request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: { code: 'VALIDATION' } }, 400);

  const result = await setOpsLaunchStep({
    previewRequestId: requestId,
    step: parsed.data.step,
    actorEmail: access.email,
  });
  if (!result.ok) return json({ ok: false, error: { code: result.code } }, 404);
  return json({ ok: true, liveAt: result.liveAt });
};
