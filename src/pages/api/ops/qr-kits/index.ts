import type { APIContext } from 'astro';
import { QrKitFulfilmentStatus } from '@prisma/client';

import { prisma } from '@/lib/db/client';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

/** Internal QR Kit fulfilment queue (operator session + KERSIVO_OPS_EMAILS allowlist). */
export async function GET(context: APIContext): Promise<Response> {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const rawStatus = context.url.searchParams.get('status');
  let status: QrKitFulfilmentStatus | undefined;
  if (rawStatus) {
    if (!(rawStatus in QrKitFulfilmentStatus)) {
      return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);
    }
    status = rawStatus as QrKitFulfilmentStatus;
  }

  const kits = await prisma.qrKitFulfilment.findMany({
    where: status ? { status } : {},
    orderBy: { requestedAt: 'asc' },
    take: 200,
  });
  return json({ ok: true, data: { kits } });
}
