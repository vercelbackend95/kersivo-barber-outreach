import { describe, expect, it } from 'vitest';
import {
  canTransitionQrKitStatus,
  qrKitTransitionTimestampData,
} from './qrKitFulfilment';

describe('QR Kit fulfilment state machine', () => {
  it('allows the approved happy path in order', () => {
    expect(canTransitionQrKitStatus('REQUESTED', 'VERIFYING')).toBe(true);
    expect(canTransitionQrKitStatus('VERIFYING', 'APPROVED')).toBe(true);
    expect(canTransitionQrKitStatus('APPROVED', 'PRINT_QUEUED')).toBe(true);
    expect(canTransitionQrKitStatus('PRINT_QUEUED', 'DISPATCHED')).toBe(true);
  });

  it('allows review/reject exceptions without allowing arbitrary skips', () => {
    expect(canTransitionQrKitStatus('REQUESTED', 'NEEDS_REVIEW')).toBe(true);
    expect(canTransitionQrKitStatus('NEEDS_REVIEW', 'VERIFYING')).toBe(true);
    expect(canTransitionQrKitStatus('NEEDS_REVIEW', 'APPROVED')).toBe(true);
    expect(canTransitionQrKitStatus('VERIFYING', 'REJECTED')).toBe(true);

    expect(canTransitionQrKitStatus('REQUESTED', 'APPROVED')).toBe(false);
    expect(canTransitionQrKitStatus('REQUESTED', 'DISPATCHED')).toBe(false);
    expect(canTransitionQrKitStatus('APPROVED', 'DISPATCHED')).toBe(false);
    expect(canTransitionQrKitStatus('DISPATCHED', 'VERIFYING')).toBe(false);
    expect(canTransitionQrKitStatus('REJECTED', 'VERIFYING')).toBe(false);
  });

  it('stamps business milestones only at the matching transition', () => {
    const now = new Date('2026-10-05T15:00:00.000Z');

    expect(qrKitTransitionTimestampData('APPROVED', now)).toEqual({ approvedAt: now });
    expect(qrKitTransitionTimestampData('PRINT_QUEUED', now)).toEqual({ printQueuedAt: now });
    expect(qrKitTransitionTimestampData('DISPATCHED', now)).toEqual({ dispatchedAt: now });
    expect(qrKitTransitionTimestampData('REJECTED', now)).toEqual({ rejectedAt: now });
    expect(qrKitTransitionTimestampData('VERIFYING', now)).toEqual({});
  });
});
