import type { SaasSubscriptionStatus } from '@prisma/client';

/** Full paid access while PAST_DUE for this many days after pastDueSince. */
export const SAAS_GRACE_DAYS = 7;

/** Self-serve CSV window after CANCELED (aligned with Terms/FAQ). */
export const SAAS_EXPORT_RETENTION_DAYS = 30;

export type SaasSubscriptionAccessFields = {
  status: SaasSubscriptionStatus | string;
  currentPeriodEnd: Date | null;
  pastDueSince?: Date | null;
  cancelAtPeriodEnd?: boolean;
};

export type SaasSubscriptionExportFields = SaasSubscriptionAccessFields & {
  retentionEndsAt?: Date | null;
  dataExportDownloadedAt?: Date | null;
  canceledAt?: Date | null;
};

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function graceEndsAt(pastDueSince: Date): Date {
  return addDays(pastDueSince, SAAS_GRACE_DAYS);
}

export function retentionEndsAtFrom(canceledAt: Date): Date {
  return addDays(canceledAt, SAAS_EXPORT_RETENTION_DAYS);
}

function periodStillValid(sub: SaasSubscriptionAccessFields, now: Date): boolean {
  if (!sub.currentPeriodEnd) return true;
  return sub.currentPeriodEnd.getTime() > now.getTime();
}

/**
 * Paid-tenant features (public booking, SMS, deposits).
 * PAST_DUE keeps access only during the 7-day grace window.
 */
export function saasSubscriptionGrantsAccess(
  sub: SaasSubscriptionAccessFields,
  now: Date = new Date(),
): boolean {
  const status = String(sub.status);
  if (status === 'PENDING' || status === 'CANCELED' || status === 'SUSPENDED') return false;
  if (!periodStillValid(sub, now)) return false;

  if (status === 'ACTIVE') return true;

  if (status === 'PAST_DUE') {
    if (!sub.pastDueSince) return true;
    return now.getTime() < graceEndsAt(sub.pastDueSince).getTime();
  }

  return false;
}

/** Whether the shop may download the one-time client CSV. */
export function saasSubscriptionAllowsDataExport(
  sub: SaasSubscriptionExportFields,
  now: Date = new Date(),
): boolean {
  if (sub.dataExportDownloadedAt) return false;

  if (saasSubscriptionGrantsAccess(sub, now)) return true;

  const status = String(sub.status);
  if (status === 'SUSPENDED') return true;

  if (status !== 'CANCELED') return false;

  const retentionEnd =
    sub.retentionEndsAt ?? (sub.canceledAt ? retentionEndsAtFrom(sub.canceledAt) : null);
  if (!retentionEnd) return false;
  return retentionEnd.getTime() > now.getTime();
}

export type SaasBillingPhase = 'none' | 'active' | 'grace' | 'suspended' | 'canceled';

export function resolveSaasBillingPhase(
  sub: SaasSubscriptionExportFields | null | undefined,
  now: Date = new Date(),
): SaasBillingPhase {
  if (!sub) return 'none';
  const status = String(sub.status);
  if (status === 'PENDING') return 'none';
  if (status === 'CANCELED') return 'canceled';
  if (status === 'SUSPENDED') return 'suspended';
  if (status === 'PAST_DUE') {
    if (sub.pastDueSince && now.getTime() >= graceEndsAt(sub.pastDueSince).getTime()) {
      return 'suspended';
    }
    return 'grace';
  }
  if (status === 'ACTIVE') return 'active';
  return 'none';
}

export function mapStripeSubscriptionStatus(
  stripeStatus: string | null | undefined,
): Extract<SaasSubscriptionStatus, 'ACTIVE' | 'PAST_DUE' | 'CANCELED'> {
  const normalized = (stripeStatus ?? '').trim().toLowerCase();
  if (normalized === 'past_due' || normalized === 'unpaid') return 'PAST_DUE';
  if (
    normalized === 'canceled' ||
    normalized === 'cancelled' ||
    normalized === 'incomplete_expired'
  ) {
    return 'CANCELED';
  }
  return 'ACTIVE';
}

export function periodEndFromUnixSeconds(seconds: number | null | undefined): Date | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
}
