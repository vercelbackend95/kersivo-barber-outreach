import type { APIContext } from 'astro';

import { prisma } from '@/lib/db/client';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';
import {
  QR_KIT_ALLOWED_TRANSITIONS,
  QR_KIT_MANIFEST_STATUSES,
  buildQrKitPrintManifest,
} from '@/lib/qr/qrKitFulfilment';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

/** Internal kit detail: record, audit trail, allowed next states and (once approved) print manifest. */
export async function GET(context: APIContext): Promise<Response> {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const id = context.params.id?.trim();
  if (!id) return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);

  const kit = await prisma.qrKitFulfilment.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  if (!kit) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  let manifest = null;
  if (QR_KIT_MANIFEST_STATUSES.has(kit.status)) {
    const qrCodes = await prisma.shopQrCode.findMany({
      where: { shopId: kit.shopId },
      select: { id: true, shopId: true, code: true, placement: true },
    });
    manifest = buildQrKitPrintManifest({ fulfilment: kit, qrCodes, baseUrl: getPublicSiteUrl() });
  }

  return json({
    ok: true,
    data: { kit, allowedTransitions: QR_KIT_ALLOWED_TRANSITIONS[kit.status], manifest },
  });
}
