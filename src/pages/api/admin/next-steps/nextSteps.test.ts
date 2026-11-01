import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminPermission = vi.fn();
const markNextStepsWebsiteViewed = vi.fn();
const dismissNextSteps = vi.fn();
let adminHubOn = true;

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));
vi.mock('@/lib/adminHub/nextSteps', () => ({
  markNextStepsWebsiteViewed: (...args: unknown[]) => markNextStepsWebsiteViewed(...args),
  dismissNextSteps: (...args: unknown[]) => dismissNextSteps(...args),
}));
vi.mock('@/lib/freePreview/config', () => ({
  isAdminHubEnabled: () => adminHubOn,
}));

import { POST as viewSite } from './view-site';
import { POST as dismiss } from './dismiss';

const session = { via: 'session', shopId: 'shop-live', role: 'OWNER' };

function ctx() {
  return { request: new Request('http://localhost/api/admin/next-steps/view-site', { method: 'POST' }) };
}

describe('POST /api/admin/next-steps', () => {
  beforeEach(() => {
    adminHubOn = true;
    requireAdminPermission.mockReset().mockResolvedValue(session);
    markNextStepsWebsiteViewed.mockReset().mockResolvedValue({ done: 1, total: 3 });
    dismissNextSteps.mockReset().mockResolvedValue({ ok: true });
  });

  it('404s when the admin hub flag is off', async () => {
    adminHubOn = false;
    expect((await viewSite(ctx() as never)).status).toBe(404);
    expect((await dismiss(ctx() as never)).status).toBe(404);
    expect(markNextStepsWebsiteViewed).not.toHaveBeenCalled();
  });

  it('rejects a hub cookie / preview via', async () => {
    requireAdminPermission.mockResolvedValue({ via: 'preview', shopId: 'shop-live', role: 'OWNER' });
    expect((await viewSite(ctx() as never)).status).toBe(403);
    expect((await dismiss(ctx() as never)).status).toBe(403);
  });

  it('marks the website viewed and dismisses for a real session', async () => {
    const viewed = await viewSite(ctx() as never);
    expect(viewed.status).toBe(200);
    expect(await viewed.json()).toEqual({ ok: true, nextSteps: { done: 1, total: 3 } });
    expect(markNextStepsWebsiteViewed).toHaveBeenCalledWith('shop-live');

    const hidden = await dismiss(ctx() as never);
    expect(hidden.status).toBe(200);
    expect(await hidden.json()).toEqual({ ok: true, nextSteps: null });
    expect(dismissNextSteps).toHaveBeenCalledWith('shop-live');
  });
});
