import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireOperatorAccess, buildRemoteImageThumb } = vi.hoisted(() => ({
  requireOperatorAccess: vi.fn(),
  buildRemoteImageThumb: vi.fn(),
}));

vi.mock('@/lib/ops/operatorAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/operatorAuth')>();
  return { ...actual, requireOperatorAccess: (...args: unknown[]) => requireOperatorAccess(...args) };
});
vi.mock('@/lib/ops/buildPackRemoteImageThumb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ops/buildPackRemoteImageThumb')>();
  return { ...actual, buildRemoteImageThumb: (...args: unknown[]) => buildRemoteImageThumb(...args) };
});

import { GET } from './remote-image';

function call(query: string, id = 'req_1') {
  const request = new Request(`http://localhost/api/ops/preview-requests/${id}/remote-image${query}`);
  return GET({ request, params: { id } } as never) as Promise<Response>;
}

beforeEach(() => {
  requireOperatorAccess.mockReset().mockResolvedValue({ userId: 'op-1', email: 'ops@kersivo.co.uk' });
  buildRemoteImageThumb.mockReset();
});

describe('GET /api/ops/preview-requests/[id]/remote-image', () => {
  it('refuses non-operators before any lookup', async () => {
    requireOperatorAccess.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    expect((await call('?ref=barber:b1&w=96')).status).toBe(401);
    requireOperatorAccess.mockResolvedValueOnce(new Response('{}', { status: 403 }));
    expect((await call('?ref=barber:b1&w=96')).status).toBe(403);
    expect(buildRemoteImageThumb).not.toHaveBeenCalled();
  });

  it('rejects a URL in ref and unsupported widths', async () => {
    expect((await call('?ref=https://evil.example/a.png&w=96')).status).toBe(400);
    expect((await call('?ref=barber:b1&w=1200')).status).toBe(400);
    expect(buildRemoteImageThumb).not.toHaveBeenCalled();
  });

  it('returns WebP with a private one-hour cache', async () => {
    buildRemoteImageThumb.mockResolvedValueOnce({ ok: true, bytes: Buffer.from([1, 2, 3]), contentType: 'image/webp' });
    const response = await call('?ref=product:p1&w=240');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(buildRemoteImageThumb).toHaveBeenCalledWith('req_1', { source: 'product', ownerId: 'p1' }, 240);
  });

  it('maps lookup failures to 404 / 410 / 502', async () => {
    buildRemoteImageThumb.mockResolvedValueOnce({ ok: false, status: 404, reason: 'image_not_found' });
    expect((await call('?ref=barber:b1&w=96')).status).toBe(404);
    buildRemoteImageThumb.mockResolvedValueOnce({ ok: false, status: 410, reason: 'gone' });
    expect((await call('?ref=barber:b1&w=96')).status).toBe(410);
    buildRemoteImageThumb.mockResolvedValueOnce({ ok: false, status: 502, reason: 'timed out' });
    expect((await call('?ref=barber:b1&w=96')).status).toBe(502);
  });
});
