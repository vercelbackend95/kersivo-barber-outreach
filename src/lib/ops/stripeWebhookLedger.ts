import type { StripeWebhookEventStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { opsLog, opsLogError } from '@/lib/ops/opsLog';

export type WebhookIngestResult = {
  alreadyFinalized: boolean;
  previousStatus: StripeWebhookEventStatus | null;
};

export async function recordStripeWebhookReceived(input: {
  id: string;
  type: string;
  livemode?: boolean;
  eventCreatedAt?: Date | null;
}): Promise<WebhookIngestResult> {
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { id: input.id },
    select: { status: true },
  });

  const previousStatus = existing?.status ?? null;
  const alreadyFinalized = previousStatus === 'PROCESSED' || previousStatus === 'IGNORED';

  await prisma.stripeWebhookEvent.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      type: input.type,
      livemode: Boolean(input.livemode),
      status: 'RECEIVED',
      eventCreatedAt: input.eventCreatedAt ?? null,
    },
    update: {
      type: input.type,
      livemode: Boolean(input.livemode),
      ...(input.eventCreatedAt ? { eventCreatedAt: input.eventCreatedAt } : {}),
    },
  });

  return { alreadyFinalized, previousStatus };
}

export async function markStripeWebhookStatus(
  id: string,
  status: StripeWebhookEventStatus,
  options: { error?: string; httpStatus?: number } = {},
): Promise<void> {
  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { id } });
  if (!existing) {
    await prisma.stripeWebhookEvent.create({
      data: {
        id,
        type: 'unknown',
        status,
        error: options.error ?? null,
        httpStatus: options.httpStatus ?? null,
        processedAt: status === 'PROCESSED' || status === 'IGNORED' ? new Date() : null,
      },
    });
    return;
  }

  // Never overwrite PROCESSED with FAILED on a late retry of a success response path.
  if (existing.status === 'PROCESSED' && status === 'FAILED') {
    return;
  }

  await prisma.stripeWebhookEvent.update({
    where: { id },
    data: {
      status,
      error: options.error ?? null,
      httpStatus: options.httpStatus ?? null,
      processedAt:
        status === 'PROCESSED' || status === 'IGNORED' ? new Date() : existing.processedAt,
    },
  });
}

export async function alertStripeWebhookFailure(input: {
  eventId: string;
  type: string;
  error: string;
  httpStatus: number;
}): Promise<void> {
  opsLogError('stripe.webhook', 'processing_failed', input.error, {
    eventId: input.eventId,
    type: input.type,
    httpStatus: input.httpStatus,
  });
}

/** Non-material race/orphan path — ordinary ops log only (no Sentry alert). */
export async function alertLifecycleNotFound(input: {
  eventType: string;
  eventId?: string;
}): Promise<void> {
  opsLog('stripe.webhook', 'lifecycle_not_found', {
    eventType: input.eventType,
    eventId: input.eventId,
  });
}
