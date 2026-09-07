import type { APIContext } from 'astro';

import { OPS_API_HEADERS } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';
import { prisma } from '@/lib/db/client';
import { executeOpsAction } from '@/lib/recommendations/ops/actions/executeOpsAction';
import { parseOpsActionRequest } from '@/lib/recommendations/ops/actions/parseActionRequest';
import { parseOpsShopId } from '@/lib/recommendations/ops/shopId';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...OPS_API_HEADERS },
  });
}

export async function POST(context: APIContext): Promise<Response> {
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);
  }

  const parsedShop = parseOpsShopId(context.params.shopId);
  if (!parsedShop.ok) {
    return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);
  }

  const parsedBody = parseOpsActionRequest(body);
  if (!parsedBody.ok) {
    return json({ ok: false, error: { code: parsedBody.code } }, 400);
  }

  try {
    const result = await executeOpsAction(
      {
        shopId: parsedShop.shopId,
        operator: { userId: access.userId, email: access.email },
        request: parsedBody.value,
      },
      { db: prisma },
    );

    if (!result.ok) {
      return json(
        {
          ok: false,
          error: {
            code: result.error.code,
            ...(result.error.retryAfterSeconds != null
              ? { retryAfterSeconds: result.error.retryAfterSeconds }
              : {}),
          },
        },
        result.httpStatus,
      );
    }

    return json({ ok: true, data: result.data }, result.httpStatus);
  } catch {
    return json({ ok: false, error: { code: 'INTERNAL_ERROR' } }, 500);
  }
}

export async function GET(): Promise<Response> {
  return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
}

export async function PUT(): Promise<Response> {
  return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
}

export async function PATCH(): Promise<Response> {
  return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
}

export async function DELETE(): Promise<Response> {
  return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
}
