import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubContext = vi.fn();
const isAdminHubRouteEnabled = vi.fn();
const resolveOperatorAccess = vi.fn();
const enforceIpRateLimit = vi.fn();

vi.mock('@/lib/freePreview/hubPage', () => ({
  resolveHubContext: (...args: unknown[]) => resolveHubContext(...args),
  isAdminHubRouteEnabled: () => isAdminHubRouteEnabled(),
}));
vi.mock('@/lib/ops/operatorAuth', () => ({
  resolveOperatorAccess: (...args: unknown[]) => resolveOperatorAccess(...args),
}));
vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: (...args: unknown[]) => enforceIpRateLimit(...args),
}));

import { adminHubBridge } from './bridge';
import { verifyHubSession } from './hubSession';

const TOKEN = 'T'.repeat(43);
const NOW = new Date('2026-11-01T12:00:00Z');
const SECRET = 'bridge-test-secret-0123456789abcdef';

function ctx(stage: string, isOperator = false) {
  return {
    token: TOKEN,
    source: 'token',
    request: { id: 'req_1', expiresAt: new Date(NOW.getTime() + 10 * 86_400_000) },
    state: { kind: 'hub', stage },
    isOperator,
    draft: null,
  };
}

async function bridge(path: string, subroute: Parameters<typeof adminHubBridge>[0]['subroute']) {
  const url = new URL(`http://localhost/preview/${TOKEN}${path}`);
  return adminHubBridge({ request: new Request(url), url, token: TOKEN, subroute, rateLimit: true, now: NOW });
}

function cookieValue(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  return header.split(';')[0]!.slice('ks_hub='.length);
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', SECRET);
  isAdminHubRouteEnabled.mockReset().mockReturnValue(true);
  resolveHubContext.mockReset().mockResolvedValue(ctx('review'));
  resolveOperatorAccess.mockReset().mockResolvedValue({ ok: false });
  enforceIpRateLimit.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('adminHubBridge', () => {
  it.each([
    ['', '', '/admin'],
    ['', '?view=booking', '/admin/website?view=booking'],
    ['overview', '/overview', '/admin'],
    ['website', '/website', '/admin/website'],
    ['website', '/website?view=booking', '/admin/website?view=booking'],
    ['changes', '/changes', '/admin/changes'],
    ['messages', '/messages', '/admin/messages'],
    ['messages', '/messages?draft=reopen', '/admin/messages?draft=reopen'],
    ['messages', '/messages?draft=<x>', '/admin/messages'],
    ['details', '/details', '/admin?app=setup'],
  ] as const)('maps /preview/{token}%s to %s', async (subroute, path, location) => {
    const response = await bridge(path, subroute);
    expect(response?.status).toBe(303);
    expect(response?.headers.get('location')).toBe(location);
    expect(response?.headers.get('location')).not.toContain(TOKEN);
  });

  it('sets a secure owner cookie and private headers', async () => {
    const response = (await bridge('', ''))!;
    const header = response.headers.get('set-cookie')!;
    expect(header).toMatch(/^ks_hub=v1\.req_1\.\d+\.[A-Za-z0-9_-]{43}; Max-Age=\d+; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
    expect(verifyHubSession(cookieValue(response), NOW, SECRET)).toMatchObject({ previewRequestId: 'req_1', operator: false });
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('gives operators the op-flag cookie', async () => {
    resolveOperatorAccess.mockResolvedValue({ ok: true });
    resolveHubContext.mockResolvedValue(ctx('review', true));
    const response = (await bridge('/overview', 'overview'))!;
    expect(resolveHubContext).toHaveBeenCalledWith({ token: TOKEN }, { isOperator: true, now: NOW });
    expect(verifyHubSession(cookieValue(response), NOW, SECRET)?.operator).toBe(true);
  });

  it('keeps 404 for rejected or unknown tokens and sets no cookie', async () => {
    resolveHubContext.mockResolvedValue(null);
    const response = (await bridge('', ''))!;
    expect(response.status).toBe(404);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each(['expired', 'declined', 'requested', 'launch'])('bridges the %s stage', async (stage) => {
    resolveHubContext.mockResolvedValue(ctx(stage));
    const response = (await bridge('', ''))!;
    expect(response.status).toBe(303);
    expect(verifyHubSession(cookieValue(response), NOW, SECRET)?.previewRequestId).toBe('req_1');
  });

  it('gives an expired preview a 24-hour cookie', async () => {
    resolveHubContext.mockResolvedValue(ctx('expired'));
    const header = (await bridge('', ''))!.headers.get('set-cookie')!;
    expect(header).toContain('Max-Age=86400;');
  });

  it('returns null (today’s token page) when the flag is off', async () => {
    isAdminHubRouteEnabled.mockReturnValue(false);
    expect(await bridge('/website', 'website')).toBeNull();
    expect(resolveHubContext).not.toHaveBeenCalled();
    expect(enforceIpRateLimit).not.toHaveBeenCalled();
  });

  it('returns null when there is no secret to sign with', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', '');
    vi.stubEnv('ADMIN_SECRET', '');
    expect(await bridge('', '')).toBeNull();
  });

  it('honours the page rate limit', async () => {
    enforceIpRateLimit.mockResolvedValue(new Response('{}', { status: 429 }));
    expect((await bridge('/website', 'website'))?.status).toBe(429);
    expect(resolveHubContext).not.toHaveBeenCalled();
  });
});
