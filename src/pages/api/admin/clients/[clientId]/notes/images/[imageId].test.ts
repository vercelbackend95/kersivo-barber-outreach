import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermission = vi.fn();
const assertClientAccessible = vi.fn();
const clientNoteImageFindFirst = vi.fn();
const retrievePrivateOnboardingFile = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));

vi.mock('@/lib/admin/rbac/scope', () => ({
  assertClientAccessible: (...args: unknown[]) => assertClientAccessible(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    clientNoteImage: {
      findFirst: (...args: unknown[]) => clientNoteImageFindFirst(...args),
    },
  },
}));

vi.mock('@/lib/storage/privateOnboardingBlob', () => ({
  retrievePrivateOnboardingFile: (...args: unknown[]) => retrievePrivateOnboardingFile(...args),
}));

import { GET } from './[imageId]';

function makeContext(opts: { clientId: string; imageId: string }): APIContext {
  const url = `http://localhost/api/admin/clients/${opts.clientId}/notes/images/${opts.imageId}`;
  return {
    request: new Request(url, { method: 'GET' }),
    url: new URL(url),
    params: { clientId: opts.clientId, imageId: opts.imageId },
  } as unknown as APIContext;
}

const access = {
  shopId: 'shop-1',
  userId: 'user-1',
  role: 'OWNER' as const,
};

describe('GET /api/admin/clients/[clientId]/notes/images/[imageId]', () => {
  beforeEach(() => {
    requireAdminPermission.mockReset();
    assertClientAccessible.mockReset();
    clientNoteImageFindFirst.mockReset();
    retrievePrivateOnboardingFile.mockReset();
  });

  it('returns auth failure from requireAdminPermission', async () => {
    requireAdminPermission.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    const res = await GET(makeContext({ clientId: 'c1', imageId: 'img1' }));
    expect(res.status).toBe(401);
  });

  it('returns scope failure when client is outside shop', async () => {
    requireAdminPermission.mockResolvedValue(access);
    assertClientAccessible.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );
    const res = await GET(makeContext({ clientId: 'c1', imageId: 'img1' }));
    expect(res.status).toBe(403);
    expect(clientNoteImageFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when image is missing for this shop/client', async () => {
    requireAdminPermission.mockResolvedValue(access);
    assertClientAccessible.mockResolvedValue({ id: 'c1' });
    clientNoteImageFindFirst.mockResolvedValue(null);
    const res = await GET(makeContext({ clientId: 'c1', imageId: 'img1' }));
    expect(res.status).toBe(404);
  });

  it('streams private blob for authorised shop-scoped image', async () => {
    requireAdminPermission.mockResolvedValue(access);
    assertClientAccessible.mockResolvedValue({ id: 'c1' });
    clientNoteImageFindFirst.mockResolvedValue({
      id: 'img1',
      url: 'client-notes/shop-1/c1/note-0.webp',
    });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    retrievePrivateOnboardingFile.mockResolvedValue({
      stream,
      contentType: 'image/webp',
      statusCode: 200,
    });

    const res = await GET(makeContext({ clientId: 'c1', imageId: 'img1' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(retrievePrivateOnboardingFile).toHaveBeenCalledWith(
      'client-notes/shop-1/c1/note-0.webp',
    );
  });
});
