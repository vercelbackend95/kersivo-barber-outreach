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
  normalizeOperatorEmail,
  parseOpsEmailAllowlist,
  requireOperatorAccess,
  resolveOperatorAccess,
} from './operatorAuth';

describe('parseOpsEmailAllowlist', () => {
  it('returns empty for missing or whitespace-only', () => {
    expect(parseOpsEmailAllowlist(undefined)).toEqual([]);
    expect(parseOpsEmailAllowlist(null)).toEqual([]);
    expect(parseOpsEmailAllowlist('')).toEqual([]);
    expect(parseOpsEmailAllowlist('  , , ')).toEqual([]);
  });

  it('trims, lowercases, and drops empties', () => {
    expect(parseOpsEmailAllowlist(' Alice@Example.com , bob@x.com,, ')).toEqual([
      'alice@example.com',
      'bob@x.com',
    ]);
  });
});

describe('normalizeOperatorEmail', () => {
  it('normalizes and rejects empty', () => {
    expect(normalizeOperatorEmail('  A@B.Com ')).toBe('a@b.com');
    expect(normalizeOperatorEmail('')).toBeNull();
    expect(normalizeOperatorEmail('   ')).toBeNull();
    expect(normalizeOperatorEmail(null)).toBeNull();
  });
});

describe('resolveOperatorAccess', () => {
  beforeEach(() => {
    getSession.mockReset();
    vi.unstubAllEnvs();
  });

  it('returns UNAUTHORIZED when session missing', async () => {
    getSession.mockResolvedValue(null);
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
    const result = await resolveOperatorAccess(new Request('http://localhost'));
    expect(result).toEqual({ ok: false, status: 401, code: 'UNAUTHORIZED' });
  });

  it('returns UNAUTHORIZED when email missing', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: '', emailVerified: true } });
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
    const result = await resolveOperatorAccess(new Request('http://localhost'));
    expect(result).toEqual({ ok: false, status: 401, code: 'UNAUTHORIZED' });
  });

  it('returns EMAIL_NOT_VERIFIED when unverified', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: false },
    });
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
    const result = await resolveOperatorAccess(new Request('http://localhost'));
    expect(result).toEqual({ ok: false, status: 403, code: 'EMAIL_NOT_VERIFIED' });
  });

  it('returns OPS_ACCESS_NOT_CONFIGURED when allowlist missing', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    vi.stubEnv('KERSIVO_OPS_EMAILS', '');
    const result = await resolveOperatorAccess(new Request('http://localhost'));
    expect(result).toEqual({ ok: false, status: 503, code: 'OPS_ACCESS_NOT_CONFIGURED' });
  });

  it('returns OPS_ACCESS_NOT_CONFIGURED for whitespace-only allowlist', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'ops@kersivo.co.uk', emailVerified: true },
    });
    vi.stubEnv('KERSIVO_OPS_EMAILS', ' , , ');
    const result = await resolveOperatorAccess(new Request('http://localhost'));
    expect(result).toEqual({ ok: false, status: 503, code: 'OPS_ACCESS_NOT_CONFIGURED' });
  });

  it('returns FORBIDDEN for verified non-allowlisted email', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'owner@shop.com', emailVerified: true },
    });
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
    const result = await resolveOperatorAccess(new Request('http://localhost'));
    expect(result).toEqual({ ok: false, status: 403, code: 'FORBIDDEN' });
  });

  it('rejects substring and suffix matches', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'notops@kersivo.co.uk', emailVerified: true },
    });
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
    const result = await resolveOperatorAccess(new Request('http://localhost'));
    expect(result).toEqual({ ok: false, status: 403, code: 'FORBIDDEN' });
  });

  it('accepts exact match with case and whitespace normalization', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: '  Ops@Kersivo.co.uk ', emailVerified: true, name: 'Founder' },
    });
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
    const result = await resolveOperatorAccess(new Request('http://localhost'));
    expect(result).toEqual({
      ok: true,
      access: { userId: 'u1', email: 'ops@kersivo.co.uk', name: 'Founder' },
    });
  });

  it('does not grant access via CRON_SECRET or ADMIN_SECRET headers alone', async () => {
    getSession.mockResolvedValue(null);
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
    vi.stubEnv('CRON_SECRET', 'cron');
    vi.stubEnv('ADMIN_SECRET', 'admin');
    const req = new Request('http://localhost', {
      headers: {
        Authorization: 'Bearer cron',
        'x-admin-secret': 'admin',
      },
    });
    const result = await resolveOperatorAccess(req);
    expect(result).toEqual({ ok: false, status: 401, code: 'UNAUTHORIZED' });
  });

  it('fails closed when getSession throws', async () => {
    getSession.mockRejectedValue(new Error('boom secret token xyz'));
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
    const result = await resolveOperatorAccess(new Request('http://localhost'));
    expect(result).toEqual({ ok: false, status: 401, code: 'UNAUTHORIZED' });
    expect(JSON.stringify(result)).not.toContain('boom');
  });

  it('requireOperatorAccess returns Response without leaking email', async () => {
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'owner@shop.com', emailVerified: true },
    });
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'ops@kersivo.co.uk');
    const res = await requireOperatorAccess({
      request: new Request('http://localhost'),
    } as never);
    expect(res).toBeInstanceOf(Response);
    const body = await (res as Response).json();
    expect(body).toEqual({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(JSON.stringify(body)).not.toContain('owner@shop.com');
    expect(JSON.stringify(body)).not.toContain('ops@kersivo.co.uk');
    expect((res as Response).headers.get('Cache-Control')).toBe('private, no-store');
  });
});
