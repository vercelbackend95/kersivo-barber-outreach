import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } } }));
vi.mock('@/lib/db/client', () => ({
  prisma: new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'then') return undefined;
        if (property === 'previewRequest' || property === 'shopSettings' || property === 'previewRequestEvent') {
          return new Proxy(
            {},
            {
              get() {
                return async () => null;
              },
            },
          );
        }
        throw new Error(`database touched: prisma.${String(property)}`);
      },
    },
  ),
}));

import { signHubSession } from './hubSession';
import { GET as bookingsGET } from '@/pages/api/admin/bookings';
import { GET as clientsGET } from '@/pages/api/admin/clients';
import { GET as settingsGET } from '@/pages/api/admin/barbershop-settings/index';
import { GET as retailGET, PATCH as retailPATCH } from '@/pages/api/admin/barbershop-settings/retail';
import { GET as teamGET } from '@/pages/api/admin/team/index';

const SECRET = 'isolation-test-secret-0123456789ab';

function contextWith(cookieValue: string, path: string, method = 'GET') {
  const request = new Request(`http://localhost${path}`, {
    method,
    headers: { cookie: `ks_hub=${cookieValue}`, origin: 'http://localhost', 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : '{}',
  });
  const cookies = {
    get: (name: string) => (name === 'ks_hub' ? { value: cookieValue } : undefined),
    has: (name: string) => name === 'ks_hub',
  };
  return { request, cookies, url: new URL(request.url), params: {}, locals: {} } as never;
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', SECRET);
  vi.stubEnv('ADMIN_SECRET', '');
  getSession.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('ks_hub never unlocks the full admin API', () => {
  const owner = () =>
    signHubSession({ previewRequestId: 'req_1', expiresAt: new Date(Date.now() + 86_400_000) }, SECRET)!;
  const operator = () =>
    signHubSession({ previewRequestId: 'req_1', expiresAt: new Date(Date.now() + 86_400_000), operator: true }, SECRET)!;

  it.each([
    ['bookings', bookingsGET, '/api/admin/bookings', 'GET'],
    ['clients', clientsGET, '/api/admin/clients', 'GET'],
    ['settings', settingsGET, '/api/admin/barbershop-settings', 'GET'],
    ['team', teamGET, '/api/admin/team', 'GET'],
    ['retail', retailGET, '/api/admin/barbershop-settings/retail', 'GET'],
    ['retail (write)', retailPATCH, '/api/admin/barbershop-settings/retail', 'PATCH'],
  ] as const)('%s returns 401/403 with only an owner or operator ks_hub', async (_name, handler, path, method) => {
    for (const value of [owner(), operator()]) {
      const response = await handler(contextWith(value, path, method));
      expect([401, 403]).toContain(response.status);
    }
  });
});
