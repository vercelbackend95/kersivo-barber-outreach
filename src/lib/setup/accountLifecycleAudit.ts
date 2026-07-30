import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

export const ACCOUNT_LIFECYCLE_ACTIONS = {
  SUBSCRIPTION_CANCEL_REQUESTED: 'SUBSCRIPTION_CANCEL_REQUESTED',
  ACCOUNT_DELETE_BLOCKED: 'ACCOUNT_DELETE_BLOCKED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  SHOP_PURGED_AFTER_RETENTION: 'SHOP_PURGED_AFTER_RETENTION',
} as const;

export type AccountLifecycleAction =
  (typeof ACCOUNT_LIFECYCLE_ACTIONS)[keyof typeof ACCOUNT_LIFECYCLE_ACTIONS];

export async function recordAccountLifecycleEvent(input: {
  action: AccountLifecycleAction | string;
  userId?: string | null;
  email?: string | null;
  shopId?: string | null;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.accountLifecycleEvent.create({
      data: {
        action: input.action,
        userId: input.userId ?? null,
        email: input.email?.trim().toLowerCase() || null,
        shopId: input.shopId ?? null,
        meta: input.meta ?? undefined,
      },
    });
  } catch (error) {
    console.error('[account-lifecycle-audit] failed to record event', error);
  }
}
