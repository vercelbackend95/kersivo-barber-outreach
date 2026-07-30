import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findUnique = vi.fn();
const updateShop = vi.fn();
const createEvent = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => updateShop(...args),
    },
    siteLaunchEvent: {
      create: (...args: unknown[]) => createEvent(...args),
    },
  },
}));

import { POST } from './approve';

function makeContext(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/site-launch/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'vitest' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('POST /api/admin/site-launch/approve', () => {
  beforeEach(() => {
    resolveAdminAccess.mockReset();
    requirePermission.mockReset();
    findUnique.mockReset();
    updateShop.mockReset();
    createEvent.mockReset();
    requirePermission.mockReturnValue(null);
    updateShop.mockResolvedValue({});
    createEvent.mockResolvedValue({});
  });

  it('returns 401 without session', async () => {
    resolveAdminAccess.mockResolvedValue(null);
    const res = await POST(makeContext({ confirm: true }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-owner (Manager)', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session', shopId: 'shop-1', userId: 'u1', userEmail: 'm@example.com', role: 'MANAGER',
    });
    requirePermission.mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );
    const res = await POST(makeContext({ confirm: true }) as never);
    expect(res.status).toBe(403);
  });

  it('returns 400 when preview not ready', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session', shopId: 'shop-1', userId: 'u1', userEmail: 'o@example.com',
    });
    findUnique.mockResolvedValue({ sitePreviewUrl: null, sitePreviewVersion: null });
    const res = await POST(makeContext({ confirm: true }) as never);
    expect(res.status).toBe(400);
  });

  it('approves and records event for ready shop', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session', shopId: 'shop-1', userId: 'u1', userEmail: 'owner@example.com',
    });
    findUnique.mockResolvedValue({
      sitePreviewUrl: 'https://preview.test',
      sitePreviewVersion: 'v1',
      launchApprovedAt: null,
      launchApprovedVersion: null,
    });
    const res = await POST(makeContext({ confirm: true }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(updateShop).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          launchApprovedVersion: 'v1',
          launchApprovedByEmail: 'owner@example.com',
        }),
      }),
    );
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'APPROVED', shopId: 'shop-1' }),
      }),
    );
  });

  it('returns ok with alreadyApproved when same version', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session', shopId: 'shop-1', userId: 'u1', userEmail: 'owner@example.com',
    });
    findUnique.mockResolvedValue({
      sitePreviewUrl: 'https://preview.test',
      sitePreviewVersion: 'v1',
      launchApprovedAt: new Date(),
      launchApprovedVersion: 'v1',
    });
    const res = await POST(makeContext({ confirm: true }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alreadyApproved).toBe(true);
    expect(updateShop).not.toHaveBeenCalled();
  });
});
