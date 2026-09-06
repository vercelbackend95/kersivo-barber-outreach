import { describe, expect, it } from 'vitest';

import { resolveOpsPageView } from './opsPageView';

describe('resolveOpsPageView', () => {
  it('maps auth results without exposing identity', () => {
    expect(resolveOpsPageView({ ok: true, access: { userId: 'u', email: 'ops@x.com' } })).toBe(
      'dashboard',
    );
    expect(
      resolveOpsPageView({ ok: false, status: 401, code: 'UNAUTHORIZED' }),
    ).toBe('sign_in');
    expect(
      resolveOpsPageView({ ok: false, status: 403, code: 'FORBIDDEN' }),
    ).toBe('denied');
    expect(
      resolveOpsPageView({ ok: false, status: 403, code: 'EMAIL_NOT_VERIFIED' }),
    ).toBe('denied');
    expect(
      resolveOpsPageView({ ok: false, status: 503, code: 'OPS_ACCESS_NOT_CONFIGURED' }),
    ).toBe('unconfigured');
    expect(
      resolveOpsPageView({ ok: false, status: 500, code: 'INTERNAL_ERROR' }),
    ).toBe('denied');
  });
});
