import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}));

import {
  evaluateExactSameOrigin,
  requireOperatorMutation,
} from './requireOperatorMutation';

function ctx(init: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
}) {
  const url = init.url ?? 'https://kersivo.co.uk/api/ops/recommendations/shop_1/actions';
  const headers = new Headers(init.headers ?? {});
  return {
    request: new Request(url, {
      method: init.method ?? 'POST',
      headers,
    }),
    params: {},
  } as never;
}

describe('evaluateExactSameOrigin', () => {
  it('rejects missing Origin', () => {
    const req = new Request('https://kersivo.co.uk/api/ops/x', { method: 'POST' });
    expect(evaluateExactSameOrigin(req)).toEqual({ ok: false, code: 'MISSING_ORIGIN' });
  });

  it('rejects malformed Origin', () => {
    const req = new Request('https://kersivo.co.uk/api/ops/x', {
      method: 'POST',
      headers: { Origin: 'not-a-url' },
    });
    expect(evaluateExactSameOrigin(req)).toEqual({ ok: false, code: 'MALFORMED_ORIGIN' });
  });

  it('rejects cross-origin', () => {
    const req = new Request('https://kersivo.co.uk/api/ops/x', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    });
    expect(evaluateExactSameOrigin(req)).toEqual({ ok: false, code: 'CROSS_ORIGIN' });
  });

  it('rejects when Sec-Fetch-Site is cross-site even if Origin matches', () => {
    const req = new Request('https://kersivo.co.uk/api/ops/x', {
      method: 'POST',
      headers: {
        Origin: 'https://kersivo.co.uk',
        'Sec-Fetch-Site': 'cross-site',
      },
    });
    expect(evaluateExactSameOrigin(req)).toEqual({ ok: false, code: 'CROSS_ORIGIN' });
  });

  it('accepts exact same-origin Production', () => {
    const req = new Request('https://kersivo.co.uk/api/ops/x', {
      method: 'POST',
      headers: {
        Origin: 'https://kersivo.co.uk',
        'Sec-Fetch-Site': 'same-origin',
      },
    });
    expect(evaluateExactSameOrigin(req)).toEqual({ ok: true });
  });

  it('accepts exact same-origin Preview host without trusting sibling vercel.app', () => {
    const preview =
      'https://kersivo-barber-outreach-git-feat-smart-retail-ops-actions-vercelbackend95s-projects.vercel.app';
    const req = new Request(`${preview}/api/ops/x`, {
      method: 'POST',
      headers: { Origin: preview },
    });
    expect(evaluateExactSameOrigin(req)).toEqual({ ok: true });

    const evil = new Request(`${preview}/api/ops/x`, {
      method: 'POST',
      headers: {
        Origin: 'https://other-app.vercel.app',
      },
    });
    expect(evaluateExactSameOrigin(evil)).toEqual({ ok: false, code: 'CROSS_ORIGIN' });
  });

  it('rejects Origin with path, query, fragment, userinfo, null, or multiple values', () => {
    const base = 'https://kersivo.co.uk/api/ops/x';
    const cases: Array<{ origin: string; code: 'MALFORMED_ORIGIN' | 'CROSS_ORIGIN' }> = [
      { origin: 'https://kersivo.co.uk/admin', code: 'MALFORMED_ORIGIN' },
      { origin: 'https://kersivo.co.uk?x=1', code: 'MALFORMED_ORIGIN' },
      { origin: 'https://kersivo.co.uk#frag', code: 'MALFORMED_ORIGIN' },
      { origin: 'https://user:pass@kersivo.co.uk', code: 'MALFORMED_ORIGIN' },
      { origin: 'null', code: 'MALFORMED_ORIGIN' },
      { origin: 'https://kersivo.co.uk, https://evil.example', code: 'MALFORMED_ORIGIN' },
      { origin: 'https://kersivo.co.uk https://evil.example', code: 'MALFORMED_ORIGIN' },
    ];
    for (const c of cases) {
      const req = new Request(base, {
        method: 'POST',
        headers: { Origin: c.origin },
      });
      expect(evaluateExactSameOrigin(req)).toEqual({ ok: false, code: c.code });
    }
  });
});

describe('requireOperatorMutation', () => {
  beforeEach(() => {
    getSession.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'hello@kersivo.co.uk');
  });

  it('rejects non-POST', async () => {
    const res = await requireOperatorMutation(
      ctx({
        method: 'GET',
        headers: {
          Origin: 'https://kersivo.co.uk',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(405);
  });

  it('rejects wrong Content-Type', async () => {
    const res = await requireOperatorMutation(
      ctx({
        headers: {
          Origin: 'https://kersivo.co.uk',
          'Content-Type': 'text/plain',
        },
      }),
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(415);
    expect(await (res as Response).json()).toEqual({
      ok: false,
      error: { code: 'WRONG_CONTENT_TYPE' },
    });
  });

  it('rejects missing Origin before auth side effects matter', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'hello@kersivo.co.uk', emailVerified: true },
    });
    const res = await requireOperatorMutation(
      ctx({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
    expect(await (res as Response).json()).toEqual({
      ok: false,
      error: { code: 'MISSING_ORIGIN' },
    });
  });

  it('rejects unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await requireOperatorMutation(
      ctx({
        headers: {
          Origin: 'https://kersivo.co.uk',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });

  it('rejects unverified allowlisted email', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'hello@kersivo.co.uk', emailVerified: false },
    });
    const res = await requireOperatorMutation(
      ctx({
        headers: {
          Origin: 'https://kersivo.co.uk',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it('rejects non-allowlisted email', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'bartosz@kersivo.co.uk', emailVerified: true },
    });
    const res = await requireOperatorMutation(
      ctx({
        headers: {
          Origin: 'https://kersivo.co.uk',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it('returns access for verified allowlisted same-origin JSON POST', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'hello@kersivo.co.uk', emailVerified: true },
    });
    const access = await requireOperatorMutation(
      ctx({
        headers: {
          Origin: 'https://kersivo.co.uk',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(access).toEqual(
      expect.objectContaining({ userId: 'u1', email: 'hello@kersivo.co.uk' }),
    );
  });
});
