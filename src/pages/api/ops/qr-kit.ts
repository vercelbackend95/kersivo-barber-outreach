export const prerender = false;

import type { APIRoute } from 'astro';
import { QrKitFulfilmentStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { authorizeCronRequest } from '@/lib/ops/cronAuth';
import {
  canTransitionQrKitStatus,
  qrKitTransitionTimestampData,
} from '@/lib/qr/qrKitFulfilment';

const transitionSchema = z.object({
  requestId: z.string().trim().min(1),
  status: z.nativeEnum(QrKitFulfilmentStatus),
  verificationNote: z.string().trim().max(2000).optional().nullable(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const rawStatus = url.searchParams.get('status')?.trim().toUpperCase() ?? '';
  const status = Object.values(QrKitFulfilmentStatus).includes(rawStatus as QrKitFulfilmentStatus)
    ? (rawStatus as QrKitFulfilmentStatus)
    : null;

  const requests = await prisma.shopQrKitRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
    take: 100,
    select: {
      id: true,
      status: true,
      requestedAt: true,
      statusUpdatedAt: true,
      deliveryContactName: true,
      deliveryPhone: true,
      addressLine1: true,
      addressLine2: true,
      townCity: true,
      postcode: true,
      countryCode: true,
      verificationNote: true,
      approvedAt: true,
      printQueuedAt: true,
      dispatchedAt: true,
      rejectedAt: true,
      shop: {
        select: {
          id: true,
          name: true,
          bookingSlug: true,
          qrCodes: {
            orderBy: { placement: 'asc' },
            select: { placement: true, code: true },
          },
        },
      },
    },
  });

  return json({ requests });
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const parsed = transitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: 'Invalid QR fulfilment transition.', issues: parsed.error.flatten() }, 400);
  }

  const current = await prisma.shopQrKitRequest.findUnique({
    where: { id: parsed.data.requestId },
    select: { id: true, status: true },
  });
  if (!current) return json({ error: 'QR Kit request not found.' }, 404);

  if (!canTransitionQrKitStatus(current.status, parsed.data.status)) {
    return json(
      {
        error: `Invalid QR Kit transition: ${current.status} → ${parsed.data.status}.`,
        code: 'QR_KIT_INVALID_TRANSITION',
        currentStatus: current.status,
      },
      409,
    );
  }

  const now = new Date();
  const updated = await prisma.shopQrKitRequest.updateMany({
    where: { id: current.id, status: current.status },
    data: {
      status: parsed.data.status,
      statusUpdatedAt: now,
      ...(parsed.data.verificationNote !== undefined
        ? { verificationNote: parsed.data.verificationNote?.trim() || null }
        : {}),
      ...qrKitTransitionTimestampData(parsed.data.status, now),
    },
  });

  if (updated.count !== 1) {
    return json(
      {
        error: 'QR Kit request changed concurrently. Reload the queue and retry.',
        code: 'QR_KIT_CONCURRENT_CHANGE',
      },
      409,
    );
  }

  const requestRow = await prisma.shopQrKitRequest.findUniqueOrThrow({
    where: { id: current.id },
  });

  return json({ ok: true, request: requestRow });
};
