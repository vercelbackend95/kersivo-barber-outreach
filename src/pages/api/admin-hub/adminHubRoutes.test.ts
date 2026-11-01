import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubContext = vi.fn();
const loadHubMessages = vi.fn();

vi.mock('@/lib/freePreview/hubPage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubPage')>();
  return { ...actual, resolveHubContext: (...args: unknown[]) => resolveHubContext(...args) };
});
vi.mock('@/lib/freePreview/hubMessages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubMessages')>();
  return { ...actual, loadHubMessages: (...args: unknown[]) => loadHubMessages(...args) };
});
vi.mock('@/lib/ops/operatorAuth', () => ({ resolveOperatorAccess: async () => ({ ok: false }) }));
vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({ enforceIpRateLimit: async () => null }));
vi.mock('@/lib/rate-limit/durableRateLimit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit/durableRateLimit')>();
  return { ...actual, checkDurableRateLimit: async () => ({ ok: true }) };
});

import * as assets from './assets';
import * as assetById from './assets/[id]';
import * as changes from './changes';
import * as changeById from './changes/[id]';
import * as changesSend from './changes/send';
import * as details from './details';
import * as messages from './messages';
import * as messagesRead from './messages/read';
import * as reviews from './reviews';
import * as checkout from './checkout';
import * as event from './event';
import * as domainSearch from './domain-search';
import * as brandColours from './brand-colours';
import * as draftShop from './draft-shop';

type Handler = (context: never) => Promise<Response> | Response;
const ROUTES: Array<[string, Record<string, unknown>]> = [
  ['assets', assets],
  ['assets/[id]', assetById],
  ['changes', changes],
  ['changes/[id]', changeById],
  ['changes/send', changesSend],
  ['details', details],
  ['messages', messages],
  ['messages/read', messagesRead],
  ['reviews', reviews],
  ['checkout', checkout],
  ['event', event],
  ['domain-search', domainSearch],
  ['brand-colours', brandColours],
  ['draft-shop', draftShop],
];
const METHODS = ['GET', 'POST', 'PATCH', 'DELETE'] as const;

const cases = ROUTES.flatMap(([path, module]) =>
  METHODS.filter((method) => typeof module[method] === 'function').map(
    (method) => [path, method, module[method] as Handler] as const,
  ),
);

function call(handler: Handler, path: string, method: string, headers: Record<string, string> = {}) {
  const url = `http://localhost/api/admin-hub/${path.replace('[id]', 'asset_1')}${path === 'domain-search' ? '?q=shop' : ''}`;
  const request = new Request(url, {
    method,
    headers: { cookie: 'ks_hub=v1.req_1.1.x', 'content-type': 'application/json', ...headers },
    body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
  });
  return handler({ request, params: { id: 'asset_1' }, url: new URL(url), locals: {} } as never);
}

beforeEach(() => {
  vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
  vi.stubEnv('ADMIN_HUB_ENABLED', 'true');
  resolveHubContext.mockReset().mockResolvedValue(null);
  loadHubMessages.mockReset().mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('/api/admin-hub/*', () => {
  it('mirrors every token hub endpoint', () => {
    const hubRoutes = ['assets', 'assets/[id]', 'changes', 'changes/[id]', 'changes/send', 'details', 'messages', 'messages/read', 'reviews', 'brand-colours'];
    for (const path of hubRoutes) {
      const source = readFileSync(resolve(process.cwd(), `src/pages/api/admin-hub/${path}.ts`), 'utf8');
      const tokenSource = readFileSync(resolve(process.cwd(), `src/pages/api/preview-hub/[token]/${path}.ts`), 'utf8');
      expect(source).toContain('(cookieSourceOf)');
      expect(tokenSource).toContain('(tokenSourceOf)');
      const factory = /create\w+Handlers/.exec(tokenSource)?.[0];
      expect(factory).toBeTruthy();
      expect(source).toContain(factory!);
    }
  });

  it.each(cases)('%s %s is 404 with the flag off', async (path, method, handler) => {
    vi.stubEnv('ADMIN_HUB_ENABLED', 'false');
    const response = await call(handler, path, method, { origin: 'http://localhost' });
    expect(response.status).toBe(404);
    expect(resolveHubContext).not.toHaveBeenCalled();
  });

  it.each(cases.filter(([, method]) => method !== 'GET'))(
    '%s %s refuses a cross-origin mutation before resolving the cookie',
    async (path, method, handler) => {
      const response = await call(handler, path, method, { origin: 'https://evil.example' });
      expect(response.status).toBe(403);
      expect(resolveHubContext).not.toHaveBeenCalled();
    },
  );

  it.each(cases)('%s %s is 404 when the cookie does not resolve, with private headers', async (path, method, handler) => {
    const response = await call(handler, path, method, { origin: 'http://localhost' });
    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('resolves the hub from ks_hub, never from a token', async () => {
    resolveHubContext.mockResolvedValue({
      token: '',
      source: 'cookie',
      request: { id: 'req_1' },
      state: { kind: 'hub', stage: 'review', capabilities: { canMessage: true } },
      isOperator: false,
      draft: null,
    });
    const response = await call(messages.GET as Handler, 'messages', 'GET');
    expect(response.status).toBe(200);
    expect(resolveHubContext).toHaveBeenCalledWith({ cookie: 'v1.req_1.1.x' }, expect.objectContaining({ isOperator: false }));
    expect(loadHubMessages).toHaveBeenCalledWith('req_1');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});
