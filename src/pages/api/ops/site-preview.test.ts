import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn();
const createEvent = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
    siteLaunchEvent: {
      create: (...args: unknown[]) => createEvent(...args),
    },
  },
}));

import { POST } from './site-preview';

const SECRET = 'test-cron-secret';

vi.stubEnv('CRON_SECRET', SECRET);

function makeRequest(body: unknown, token?: string): Request {
  return new Request('http://localhost/api/ops/site-preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ops/site-preview', () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    createEvent.mockReset();
    update.mockResolvedValue({});
    createEvent.mockResolvedValue({});
  });

  it('returns 401 without valid secret', async () => {
    const res = await POST({ request: makeRequest({}, 'wrong') } as never);
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 400 for missing fields', async () => {
    const res = await POST({ request: makeRequest({ shopId: 'x' }, SECRET) } as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-https previewUrl', async () => {
    const res = await POST({
      request: makeRequest(
        { shopId: 'shop-1', previewUrl: 'http://insecure.test', siteVersion: 'v1' },
        SECRET,
      ),
    } as never);
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('sets preview URL and records PREVIEW_READY for first time', async () => {
    findUnique.mockResolvedValue({ sitePreviewUrl: null });
    const body = { shopId: 'shop-1', previewUrl: 'https://preview.test', siteVersion: 'v1' };
    const res = await POST({ request: makeRequest(body, SECRET) } as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.action).toBe('ready');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'shop-1' },
        data: expect.objectContaining({
          sitePreviewUrl: 'https://preview.test',
          sitePreviewVersion: 'v1',
          launchApprovedAt: null,
        }),
      }),
    );
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PREVIEW_READY', shopId: 'shop-1' }),
      }),
    );
  });

  it('records PREVIEW_UPDATED and clears approval when URL already exists', async () => {
    findUnique.mockResolvedValue({ sitePreviewUrl: 'https://old.test' });
    const body = { shopId: 'shop-1', previewUrl: 'https://new.test', siteVersion: 'v2' };
    const res = await POST({ request: makeRequest(body, SECRET) } as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.action).toBe('updated');
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PREVIEW_UPDATED' }),
      }),
    );
  });
});
