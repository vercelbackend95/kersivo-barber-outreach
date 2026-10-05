import type { APIContext } from 'astro';

import { OPS_API_HEADERS } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';
import { parseQrKitInternalFields, updateQrKitInternalFields } from '@/lib/qr/qrKitFulfilment';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

/** Operator-only edit of notes, print/dispatch references and internal costs (no status change). */
export async function POST(context: APIContext): Promise<Response> {
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const id = context.params.id?.trim();
  if (!id) return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);
  }

  const fields = parseQrKitInternalFields(body);
  if (!fields.ok) return json({ ok: false, error: { code: 'INVALID_FIELDS', message: fields.error } }, 400);
  if (Object.keys(fields.fields).length === 0) {
    return json({ ok: false, error: { code: 'NOTHING_TO_UPDATE' } }, 400);
  }

  const result = await updateQrKitInternalFields({
    fulfilmentId: id,
    actor: { userId: access.userId, email: access.email },
    fields: fields.fields,
  });
  if (!result.ok) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  return json({ ok: true, data: { kit: result.fulfilment } });
}
