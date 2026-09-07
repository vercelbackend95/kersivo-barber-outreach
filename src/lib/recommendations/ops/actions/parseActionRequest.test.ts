import { describe, expect, it } from 'vitest';

import { parseOpsActionRequest } from './parseActionRequest';

describe('parseOpsActionRequest', () => {
  it('accepts rebuild without reason', () => {
    const parsed = parseOpsActionRequest({
      action: 'REBUILD',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    });
    expect(parsed).toEqual({
      ok: true,
      value: {
        action: 'REBUILD',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      },
    });
  });

  it('requires reason for pause/resume and rejects unknown fields', () => {
    expect(
      parseOpsActionRequest({
        action: 'PAUSE_RAIL',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      }).ok,
    ).toBe(false);

    expect(
      parseOpsActionRequest({
        action: 'PAUSE_RAIL',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        reason: 'Emergency',
        extra: true,
      }).ok,
    ).toBe(false);
  });

  it('rejects non-uuid keys and oversized reason', () => {
    expect(
      parseOpsActionRequest({
        action: 'REBUILD',
        idempotencyKey: 'not-a-uuid',
      }).ok,
    ).toBe(false);

    expect(
      parseOpsActionRequest({
        action: 'PAUSE_RAIL',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        reason: 'x'.repeat(501),
      }).ok,
    ).toBe(false);
  });
});
