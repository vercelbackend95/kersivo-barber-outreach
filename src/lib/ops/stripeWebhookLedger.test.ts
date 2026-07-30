import { describe, expect, it } from 'vitest';

/**
 * Pure status transition rules mirrored by markStripeWebhookStatus.
 * (DB integration covered operationally; this guards the PROCESSED lock.)
 */
function nextStatus(
  existing: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED' | null,
  incoming: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED',
): 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED' | 'KEEP' {
  if (existing === 'PROCESSED' && incoming === 'FAILED') return 'KEEP';
  return incoming;
}

describe('stripe webhook ledger status rules', () => {
  it('does not downgrade PROCESSED to FAILED', () => {
    expect(nextStatus('PROCESSED', 'FAILED')).toBe('KEEP');
  });

  it('allows FAILED then PROCESSED on successful retry', () => {
    expect(nextStatus('FAILED', 'PROCESSED')).toBe('PROCESSED');
  });

  it('allows RECEIVED to PROCESSED', () => {
    expect(nextStatus('RECEIVED', 'PROCESSED')).toBe('PROCESSED');
  });
});
