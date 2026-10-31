import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubContext = vi.fn();
const isAdminHubRouteEnabled = vi.fn();
const resolvePreviewRequestByDraftShopId = vi.fn();
const resolveOperatorAccess = vi.fn();

vi.mock('@/lib/freePreview/hubPage', () => ({
  resolveHubContext: (...args: unknown[]) => resolveHubContext(...args),
  isAdminHubRouteEnabled: () => isAdminHubRouteEnabled(),
}));
vi.mock('@/lib/freePreview/previewAccess', () => ({
  resolvePreviewRequestByDraftShopId: (...args: unknown[]) => resolvePreviewRequestByDraftShopId(...args),
}));
vi.mock('@/lib/ops/operatorAuth', () => ({
  resolveOperatorAccess: (...args: unknown[]) => resolveOperatorAccess(...args),
}));
vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: vi.fn(),
  isTenantAdminAccess: vi.fn(),
}));

import { ADMIN_PRIVATE_HEADERS, isSameOriginFormPost, resolveAdminPageMode, type AdminSessionShop } from './adminMode';
import { signHubSession, verifyHubSession } from './hubSession';

const NOW = new Date('2026-11-01T12:00:00Z');
const SECRET = 'admin-mode-test-secret-0123456789';
const WEEK = new Date(NOW.getTime() + 7 * 86_400_000);

function cookie(input: { id?: string; operator?: boolean } = {}) {
  return signHubSession({ previewRequestId: input.id ?? 'req_1', expiresAt: WEEK, operator: input.operator }, SECRET)!;
}

function hubCtx(stage: string, isOperator = false, id = 'req_1') {
  return { token: '', source: 'cookie', request: { id, expiresAt: WEEK }, state: { kind: 'hub', stage }, isOperator, draft: null };
}

function run(input: { cookie?: string; session?: AdminSessionShop | null }) {
  const headers = new Headers();
  if (input.cookie) headers.set('cookie', `other=1; ks_hub=${input.cookie}`);
  const sessionShop = vi.fn().mockResolvedValue(input.session ?? null);
  return {
    sessionShop,
    result: resolveAdminPageMode({ request: new Request('http://localhost/admin', { headers }), now: NOW, sessionShop }),
  };
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', SECRET);
  isAdminHubRouteEnabled.mockReset().mockReturnValue(true);
  resolveHubContext.mockReset().mockResolvedValue(hubCtx('review'));
  resolvePreviewRequestByDraftShopId.mockReset().mockResolvedValue(null);
  resolveOperatorAccess.mockReset().mockResolvedValue({ ok: false });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('resolveAdminPageMode', () => {
  it('returns null with the flag off and touches nothing', async () => {
    isAdminHubRouteEnabled.mockReturnValue(false);
    const { result, sessionShop } = run({ cookie: cookie() });
    expect(await result).toBeNull();
    expect(sessionShop).not.toHaveBeenCalled();
    expect(resolveHubContext).not.toHaveBeenCalled();
  });

  it('renders the normal admin for a visitor with nothing', async () => {
    expect(await run({}).result).toEqual({ kind: 'full', setCookie: null });
  });

  it('renders hub mode from a valid owner cookie', async () => {
    const mode = await run({ cookie: cookie() }).result;
    expect(mode).toMatchObject({ kind: 'hub', setCookie: null, phase: 'preview' });
    expect(resolveHubContext).toHaveBeenCalledWith({ cookie: cookie() }, { isOperator: false, now: NOW });
  });

  it('maps launch and live stages to the launch phase', async () => {
    resolveHubContext.mockResolvedValue(hubCtx('launch'));
    expect(await run({ cookie: cookie() }).result).toMatchObject({ kind: 'hub', phase: 'launch' });
  });

  it('shows the expired state rather than the sign-in page', async () => {
    resolveHubContext.mockResolvedValue(hubCtx('expired'));
    expect(await run({ cookie: cookie() }).result).toMatchObject({ kind: 'hub', ctx: { state: { stage: 'expired' } } });
  });

  it('clears a cookie whose request no longer resolves (rejected / unknown)', async () => {
    resolveHubContext.mockResolvedValue(null);
    const mode = await run({ cookie: cookie() }).result;
    expect(mode).toEqual({ kind: 'full', setCookie: expect.stringMatching(/^ks_hub=; Max-Age=0;/) });
  });

  it('clears a tampered cookie without a lookup', async () => {
    const mode = await run({ cookie: `${cookie()}x` }).result;
    expect(mode).toEqual({ kind: 'full', setCookie: expect.stringMatching(/^ks_hub=; Max-Age=0;/) });
    expect(resolveHubContext).not.toHaveBeenCalled();
  });

  it('honours the operator cookie only with a live operator session', async () => {
    resolveOperatorAccess.mockResolvedValue({ ok: true });
    resolveHubContext.mockResolvedValue(hubCtx('review', true));
    const mode = await run({ cookie: cookie({ operator: true }) }).result;
    expect(mode).toMatchObject({ kind: 'hub', ctx: { isOperator: true } });

    resolveOperatorAccess.mockResolvedValue({ ok: false });
    resolveHubContext.mockClear();
    const dropped = await run({ cookie: cookie({ operator: true }) }).result;
    expect(dropped).toEqual({ kind: 'full', setCookie: expect.stringMatching(/^ks_hub=; Max-Age=0;/) });
    expect(resolveHubContext).not.toHaveBeenCalled();
  });

  it('lets a signed-in session win over an owner cookie (paid shop without a preview)', async () => {
    const mode = await run({ cookie: cookie(), session: { shopId: 'shop_paid', role: 'OWNER', via: 'session' } }).result;
    expect(mode).toEqual({ kind: 'full', setCookie: null });
    expect(resolveHubContext).not.toHaveBeenCalled();
  });

  it.each([
    ['paid shop', { shopId: 'shop_paid', role: 'OWNER', via: 'session' }],
    ['Starter shop', { shopId: 'shop_starter', role: 'OWNER', via: 'session' }],
    ['team member', { shopId: 'shop_paid', role: 'MANAGER', via: 'session' }],
    ['guest preview cookie', { shopId: 'shop_demo', role: 'OWNER', via: 'preview' }],
  ] as const)('keeps the full admin for a %s', async (_label, session) => {
    expect(await run({ session }).result).toEqual({ kind: 'full', setCookie: null });
  });

  it('opens the launch phase for an owner whose converted preview is not live yet, and mints the cookie', async () => {
    resolvePreviewRequestByDraftShopId.mockResolvedValue({ id: 'req_9' });
    resolveHubContext.mockResolvedValue(hubCtx('launch', false, 'req_9'));
    const mode = await run({ session: { shopId: 'shop_draft', role: 'OWNER', via: 'session' } }).result;
    expect(resolveHubContext).toHaveBeenCalledWith({ previewRequestId: 'req_9' }, { isOperator: false, now: NOW });
    expect(mode).toMatchObject({ kind: 'hub', phase: 'launch' });
    const value = (mode as { setCookie: string }).setCookie.split(';')[0]!.slice('ks_hub='.length);
    expect(verifyHubSession(value, NOW, SECRET)).toMatchObject({ previewRequestId: 'req_9', operator: false });

    const again = await run({ cookie: cookie({ id: 'req_9' }), session: { shopId: 'shop_draft', role: 'OWNER', via: 'session' } }).result;
    expect(again).toMatchObject({ kind: 'hub', setCookie: null });
  });

  it('keeps the full admin once the converted shop is live', async () => {
    resolvePreviewRequestByDraftShopId.mockResolvedValue({ id: 'req_9' });
    resolveHubContext.mockResolvedValue(hubCtx('live', false, 'req_9'));
    expect(await run({ session: { shopId: 'shop_draft', role: 'OWNER', via: 'session' } }).result).toEqual({
      kind: 'full',
      setCookie: null,
    });
  });
});

describe('ADMIN_PRIVATE_HEADERS', () => {
  it('keeps /admin private', () => {
    expect(ADMIN_PRIVATE_HEADERS).toEqual({
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'private, no-store',
    });
  });
});

describe('isSameOriginFormPost', () => {
  const post = (headers: Record<string, string>) =>
    new Request('http://localhost/admin/leave-preview', { method: 'POST', headers });

  it('accepts an exact same-origin Origin', () => {
    expect(isSameOriginFormPost(post({ origin: 'http://localhost' }))).toBe(true);
  });

  it('accepts Origin: null only with Sec-Fetch-Site: same-origin (no-referrer pages)', () => {
    expect(isSameOriginFormPost(post({ origin: 'null', 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOriginFormPost(post({ origin: 'null', 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isSameOriginFormPost(post({ origin: 'null' }))).toBe(false);
  });

  it('rejects other origins', () => {
    expect(isSameOriginFormPost(post({ origin: 'https://evil.example', 'sec-fetch-site': 'same-origin' }))).toBe(false);
  });
});
