import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { runShopHealthCron } = vi.hoisted(() => ({ runShopHealthCron: vi.fn() }));
vi.mock('@/lib/ops/shopHealth/cron', () => ({ runShopHealthCron }));

import { GET } from './shop-health';

const call = (auth?: string) =>
  GET({ request: new Request('https://kersivo.co.uk/api/cron/shop-health', { headers: auth ? { authorization: auth } : {} }) } as never) as Promise<Response>;

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'cron-secret-value');
  runShopHealthCron.mockReset().mockResolvedValue({ due: 1, processed: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/cron/shop-health', () => {
  it('401s without the cron secret and runs nothing', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    expect(runShopHealthCron).not.toHaveBeenCalled();
  });

  it('runs the cron with the secret', async () => {
    const response = await call('Bearer cron-secret-value');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, due: 1, processed: 1 });
  });

  it('500s (and logs) when the cron itself fails', async () => {
    runShopHealthCron.mockRejectedValueOnce(new Error('db down'));
    expect((await call('Bearer cron-secret-value')).status).toBe(500);
  });
});
