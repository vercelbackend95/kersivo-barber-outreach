import type { APIContext } from 'astro';
import { QrKitFulfilmentStatus } from '@prisma/client';

import { OPS_API_HEADERS } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';
import { parseQrKitInternalFields, transitionQrKitFulfilment } from '@/lib/qr/qrKitFulfilment';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

/** Operator-only status transition. Body: { toStatus, note?, ...internal fields }. */
export async function POST(context: APIContext): Promise<Response> {
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const id = context.params.id?.trim();
  if (!id) return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);

  let body: Record<string, unknown>;
  try {
    const parsed = await context.request.json();
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);
  }

  const toStatus = typeof body.toStatus === 'string' ? body.toStatus : '';
  if (!(toStatus in QrKitFulfilmentStatus)) {
    return json({ ok: false, error: { code: 'INVALID_STATUS' } }, 400);
  }
  const fields = parseQrKitInternalFields(body);
  if (!fields.ok) return json({ ok: false, error: { code: 'INVALID_FIELDS', message: fields.error } }, 400);
  const note = typeof body.note === 'string' ? body.note.slice(0, 4000) : null;

  const result = await transitionQrKitFulfilment({
    fulfilmentId: id,
    toStatus: toStatus as QrKitFulfilmentStatus,
    actor: { userId: access.userId, email: access.email },
    note,
    fields: fields.fields,
  });

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
    if (result.reason === 'INVALID_TRANSITION') {
      return json(
        { ok: false, error: { code: 'INVALID_TRANSITION', from: result.from, to: result.to } },
        409,
      );
    }
    return json({ ok: false, error: { code: 'CONFLICT' } }, 409);
  }

  return json({ ok: true, data: { kit: result.fulfilment } });
}
