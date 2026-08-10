import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const clearPreviewCookie = vi.fn();
const cookiesSet = vi.fn();

vi.mock('../../../lib/preview/shopPreviewSession', () => ({
  clearPreviewCookie: (...args: unknown[]) => clearPreviewCookie(...args),
}));

vi.mock('../../../lib/admin/session', () => ({
  getAdminSessionCookieName: () => 'kersivo_admin_session',
  getAdminSessionCookieOptions: () => ({ path: '/', httpOnly: true }),
}));

import { POST } from './logout';

function makeContext(): APIContext {
  return {
    cookies: {
      set: (...args: unknown[]) => cookiesSet(...args),
      delete: vi.fn(),
      get: vi.fn(),
    },
  } as unknown as APIContext;
}

describe('POST /api/admin/logout', () => {
  beforeEach(() => {
    clearPreviewCookie.mockReset();
    cookiesSet.mockReset();
  });

  it('clears legacy admin cookie and preview cookie', async () => {
    const ctx = makeContext();
    const res = await POST(ctx as never);
    expect(res.status).toBe(200);
    expect(cookiesSet).toHaveBeenCalled();
    expect(clearPreviewCookie).toHaveBeenCalledWith(ctx);
  });
});
