import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_LOOKBACK_DAYS,
  buildIndexNowPayload,
  selectRecentlyChangedPaths,
  submitRecentlyChangedUrls,
} from './indexNow';
import { GET } from '../../pages/api/cron/indexnow';

const entries = [
  { path: '/', lastmod: '2026-11-14' },
  { path: '/pricing', lastmod: '2026-11-13' },
  { path: '/starter', lastmod: '2026-11-11' },
  { path: '/about', lastmod: '2026-11-10' },
  { path: '/compare', lastmod: '2026-10-01' },
];
const now = new Date('2026-11-14T06:30:00Z');

describe('IndexNow key file', () => {
  it('is served from public/ at the site root and contains only the key', () => {
    const file = join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8').trim()).toBe(INDEXNOW_KEY);
  });

  it('is scheduled once a day in vercel.json', () => {
    const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons: { path: string; schedule: string }[];
    };
    const cron = vercel.crons.find((c) => c.path === '/api/cron/indexnow');
    expect(cron?.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
  });
});

describe('selectRecentlyChangedPaths', () => {
  it('keeps only URLs whose lastmod is today or in the three days before', () => {
    expect(INDEXNOW_LOOKBACK_DAYS).toBe(3);
    expect(selectRecentlyChangedPaths(now, entries)).toEqual(['/', '/pricing', '/starter']);
  });

  it('still submits a change whose PR was merged two days after its lastmod', () => {
    const written = [{ path: '/compare', lastmod: '2026-11-26' }];
    const firstRunAfterMerge = new Date('2026-11-29T06:40:00Z');
    expect(selectRecentlyChangedPaths(firstRunAfterMerge, written)).toEqual(['/compare']);
  });

  it('ignores future-dated entries', () => {
    expect(selectRecentlyChangedPaths(now, [{ path: '/x', lastmod: '2026-12-01' }])).toEqual([]);
  });
});

describe('buildIndexNowPayload', () => {
  it('uses the production host, key and key location', () => {
    const payload = buildIndexNowPayload(['/pricing']);
    expect(payload).toEqual({
      host: 'kersivo.co.uk',
      key: INDEXNOW_KEY,
      keyLocation: `https://kersivo.co.uk/${INDEXNOW_KEY}.txt`,
      urlList: ['https://kersivo.co.uk/pricing'],
    });
  });
});

describe('submitRecentlyChangedUrls', () => {
  it('does not call IndexNow outside production', async () => {
    const fetchImpl = vi.fn();
    const result = await submitRecentlyChangedUrls({ now, enabled: false, fetchImpl, entries });
    expect(result.status).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not call IndexNow when nothing changed', async () => {
    const fetchImpl = vi.fn();
    const result = await submitRecentlyChangedUrls({ now, enabled: true, fetchImpl, entries: [entries[3]] });
    expect(result).toMatchObject({ status: 'skipped', reason: 'no changed URLs' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts one batch of changed URLs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const result = await submitRecentlyChangedUrls({ now, enabled: true, fetchImpl, entries });
    expect(result).toMatchObject({ status: 'submitted', httpStatus: 202 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(JSON.parse(init.body).urlList).toEqual([
      'https://kersivo.co.uk/',
      'https://kersivo.co.uk/pricing',
      'https://kersivo.co.uk/starter',
    ]);
  });

  it('never throws when IndexNow is down or rejects the request', async () => {
    const down = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(submitRecentlyChangedUrls({ now, enabled: true, fetchImpl: down, entries })).resolves.toMatchObject({
      status: 'failed',
      error: 'network down',
    });
    const rejected = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(submitRecentlyChangedUrls({ now, enabled: true, fetchImpl: rejected, entries })).resolves.toMatchObject({
      status: 'failed',
      httpStatus: 403,
    });
  });
});

describe('GET /api/cron/indexnow', () => {
  const call = (auth?: string) =>
    GET({
      request: new Request('https://kersivo.co.uk/api/cron/indexnow', { headers: auth ? { authorization: auth } : {} }),
    } as never) as Promise<Response>;

  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-value');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('401s without the cron secret', async () => {
    expect((await call()).status).toBe(401);
  });

  it('skips the ping on non-production deployments', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await call('Bearer cron-secret-value');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: 'skipped', reason: 'not production' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
