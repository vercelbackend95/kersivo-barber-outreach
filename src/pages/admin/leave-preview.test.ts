import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './leave-preview';

function post(headers: Record<string, string>) {
  const request = new Request('http://localhost/admin/leave-preview', {
    method: 'POST',
    headers: { cookie: 'ks_hub=v1.req_1.1.x', ...headers },
  });
  return POST({ request } as never) as Promise<Response>;
}

beforeEach(() => {
  vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
  vi.stubEnv('ADMIN_HUB_ENABLED', 'true');
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /admin/leave-preview', () => {
  it('clears ks_hub and goes home', async () => {
    const response = await post({ origin: 'null', 'sec-fetch-site': 'same-origin' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/');
    expect(response.headers.get('set-cookie')).toBe('ks_hub=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('refuses cross-site posts', async () => {
    const response = await post({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' });
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('is 404 with the flag off', async () => {
    vi.stubEnv('ADMIN_HUB_ENABLED', 'false');
    expect((await post({ origin: 'http://localhost' })).status).toBe(404);
  });
});
