import type { QrKitFulfilmentStatus } from '@prisma/client';

export const QR_KIT_ALLOWED_TRANSITIONS: Readonly<
  Record<QrKitFulfilmentStatus, readonly QrKitFulfilmentStatus[]>
> = {
  REQUESTED: ['VERIFYING', 'NEEDS_REVIEW', 'REJECTED'],
  VERIFYING: ['APPROVED', 'NEEDS_REVIEW', 'REJECTED'],
  NEEDS_REVIEW: ['VERIFYING', 'APPROVED', 'REJECTED'],
  APPROVED: ['PRINT_QUEUED'],
  PRINT_QUEUED: ['DISPATCHED'],
  DISPATCHED: [],
  REJECTED: [],
};

export function canTransitionQrKitStatus(
  from: QrKitFulfilmentStatus,
  to: QrKitFulfilmentStatus,
): boolean {
  return QR_KIT_ALLOWED_TRANSITIONS[from].includes(to);
}

export function qrKitTransitionTimestampData(
  status: QrKitFulfilmentStatus,
  now: Date,
): {
  approvedAt?: Date;
  printQueuedAt?: Date;
  dispatchedAt?: Date;
  rejectedAt?: Date;
} {
  switch (status) {
    case 'APPROVED':
      return { approvedAt: now };
    case 'PRINT_QUEUED':
      return { printQueuedAt: now };
    case 'DISPATCHED':
      return { dispatchedAt: now };
    case 'REJECTED':
      return { rejectedAt: now };
    default:
      return {};
  }
}
