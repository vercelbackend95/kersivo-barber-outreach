import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

/** At most one owner-edit event per section per this window. */
export const HUB_OWNER_EDIT_DEBOUNCE_MS = 10 * 60 * 1000;

/** Best-effort: at most one event of this action per request per 10 minutes. Never throws. */
export async function recordDebouncedPreviewRequestEvent(input: {
  previewRequestId: string;
  action: string;
  meta?: Prisma.InputJsonValue;
  now?: Date;
}): Promise<boolean> {
  const since = new Date((input.now ?? new Date()).getTime() - HUB_OWNER_EDIT_DEBOUNCE_MS);
  try {
    const recent = await prisma.previewRequestEvent.findFirst({
      where: {
        previewRequestId: input.previewRequestId,
        action: input.action,
        createdAt: { gt: since },
      },
      select: { id: true },
    });
    if (recent) return false;
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: input.previewRequestId,
        action: input.action,
        meta: input.meta,
      },
    });
    return true;
  } catch (error) {
    console.error('[admin-hub] preview event failed', {
      action: input.action,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}
