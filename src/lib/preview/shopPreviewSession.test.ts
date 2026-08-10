import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const deleteSession = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopPreviewSession: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      delete: (...a: unknown[]) => deleteSession(...a),
    },
  },
}));

import {
  hashPreviewToken,
  resolvePreviewShopIdFromRequest,
  SHOP_PREVIEW_COOKIE,
} from './shopPreviewSession';

describe('shopPreviewSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hashes tokens with sha256', () => {
    const token = 'abc';
    expect(hashPreviewToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('resolves shopId from request cookie', async () => {
    const token = 'preview-plain';
    findUnique.mockResolvedValue({
      id: 'sess_1',
      shopId: 'shop_bound',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const shopId = await resolvePreviewShopIdFromRequest(
      new Request('http://localhost/', {
        headers: { cookie: `${SHOP_PREVIEW_COOKIE}=${token}` },
      }),
    );
    expect(shopId).toBe('shop_bound');
    expect(findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashPreviewToken(token) },
      select: { shopId: true, expiresAt: true, id: true },
    });
  });

  it('returns null for missing cookie', async () => {
    expect(await resolvePreviewShopIdFromRequest(new Request('http://localhost/'))).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
