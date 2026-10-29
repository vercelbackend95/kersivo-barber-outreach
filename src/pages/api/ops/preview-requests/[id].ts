import type { APIContext } from 'astro';

import {
  executePreviewRequestOpsAction,
  previewRequestOpsActionSchema,
} from '@/lib/freePreview/opsActions';
import { OPS_API_HEADERS } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...OPS_API_HEADERS },
  });
}

/** Operator actions on one free preview request (notes, status, reject, draft shop). */
export async function POST(context: APIContext): Promise<Response> {
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const id = context.params.id?.trim() ?? '';
  if (!id || id.length > 64) {
    return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);
  }

  const parsed = previewRequestOpsActionSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);
  }

  try {
    const result = await executePreviewRequestOpsAction({
      id,
      action: parsed.data,
      actorEmail: access.email,
    });
    if (!result.ok) {
      return json({ ok: false, error: { code: result.code } }, result.httpStatus);
    }
    return json({ ok: true, data: { status: result.status, draftShopId: result.draftShopId } });
  } catch (error) {
    console.error('[ops/preview-requests] action failed', {
      id,
      action: parsed.data.action,
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: { code: 'INTERNAL_ERROR' } }, 500);
  }
}

export async function GET(): Promise<Response> {
  return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
}
