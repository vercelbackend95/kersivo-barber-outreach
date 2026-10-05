import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';

type Db = Prisma.TransactionClient | typeof prisma;

export type ConnectStateApplyResult = {
  shopsUpdated: number;
  ignored: 'stale_event' | 'unknown_account' | 'deauthorized_account' | null;
};

async function ignoredReason(
  db: Db,
  accountId: string,
  disconnectedOnly = false,
): Promise<ConnectStateApplyResult['ignored']> {
  const shop = await db.shopSettings.findFirst({
    where: { stripeConnectAccountId: accountId },
    select: { stripeConnectDisconnectedAt: true },
  });
  if (!shop) return 'unknown_account';
  if (disconnectedOnly && shop.stripeConnectDisconnectedAt) return 'deauthorized_account';
  return 'stale_event';
}

/**
 * Applies an account.updated status snapshot to the shop's CURRENT Connect account.
 * Once account.application.deauthorized has been accepted, account.updated is not allowed
 * to silently revive that account; reconnect creates a new Standard account instead.
 */
export async function applyConnectAccountUpdated(
  input: {
    accountId: string;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    eventAt: Date;
  },
  db: Db = prisma,
): Promise<ConnectStateApplyResult> {
  const result = await db.shopSettings.updateMany({
    where: {
      stripeConnectAccountId: input.accountId,
      stripeConnectDisconnectedAt: null,
      OR: [{ connectStatusEventAt: null }, { connectStatusEventAt: { lte: input.eventAt } }],
    },
    data: {
      stripeConnectChargesEnabled: input.chargesEnabled,
      stripeConnectDetailsSubmitted: input.detailsSubmitted,
      connectStatusEventAt: input.eventAt,
    },
  });

  if (result.count > 0) return { shopsUpdated: result.count, ignored: null };
  return {
    shopsUpdated: 0,
    ignored: await ignoredReason(db, input.accountId, true),
  };
}

/**
 * Permanently marks the current account connection as deauthorized for KERSIVO.
 * The account id is intentionally retained: historical Booking/Order rows may still reference it,
 * and replacing/clearing historical payment-account identity would break reconciliation.
 */
export async function applyConnectAccountDeauthorized(
  input: { accountId: string; eventAt: Date },
  db: Db = prisma,
): Promise<ConnectStateApplyResult> {
  const result = await db.shopSettings.updateMany({
    where: {
      stripeConnectAccountId: input.accountId,
      OR: [{ connectStatusEventAt: null }, { connectStatusEventAt: { lte: input.eventAt } }],
    },
    data: {
      stripeConnectChargesEnabled: false,
      stripeConnectDetailsSubmitted: false,
      stripeConnectDisconnectedAt: input.eventAt,
      connectStatusEventAt: input.eventAt,
    },
  });

  if (result.count > 0) return { shopsUpdated: result.count, ignored: null };
  return {
    shopsUpdated: 0,
    ignored: await ignoredReason(db, input.accountId),
  };
}
