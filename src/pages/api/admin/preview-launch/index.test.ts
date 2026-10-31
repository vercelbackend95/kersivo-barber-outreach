import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireLaunchOwner = vi.fn();
const loadLaunchChecklist = vi.fn();
const saveLaunchBusinessDetails = vi.fn();
const skipLaunchItem = vi.fn();
const markMigrationUploaded = vi.fn();

vi.mock('@/lib/freePreview/hubLaunchApi', () => ({
  launchJson: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  requireLaunchOwner: (...args: unknown[]) => requireLaunchOwner(...args),
}));
vi.mock('@/lib/freePreview/hubLaunch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubLaunch')>();
  return {
    ...actual,
    loadLaunchChecklist: (...args: unknown[]) => loadLaunchChecklist(...args),
    saveLaunchBusinessDetails: (...args: unknown[]) => saveLaunchBusinessDetails(...args),
    skipLaunchItem: (...args: unknown[]) => skipLaunchItem(...args),
    markMigrationUploaded: (...args: unknown[]) => markMigrationUploaded(...args),
  };
});
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => null,
}));

import { GET, PATCH } from './index';

const owner = { shopId: 'shop_1', previewRequestId: 'req_1' };
const checklist = { shopName: 'Fade', items: [], business: { complete: true, isLimitedCompany: false } };

beforeEach(() => {
  requireLaunchOwner.mockReset().mockResolvedValue(owner);
  loadLaunchChecklist.mockReset().mockResolvedValue(checklist);
  saveLaunchBusinessDetails.mockReset().mockResolvedValue({ state: checklist, completedItem: true });
  skipLaunchItem.mockReset().mockResolvedValue(checklist);
  markMigrationUploaded.mockReset().mockResolvedValue(checklist);
});
afterEach(() => vi.unstubAllEnvs());

function patch(body: unknown) {
  return PATCH({
    request: new Request('http://localhost/api/admin/preview-launch', {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as never);
}

describe('GET /api/admin/preview-launch', () => {
  it('returns the checklist', async () => {
    const response = await GET({ request: new Request('http://localhost/api/admin/preview-launch') } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).checklist.shopName).toBe('Fade');
  });

  it('forwards auth denial', async () => {
    requireLaunchOwner.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401 }));
    const response = await GET({ request: new Request('http://localhost/api/admin/preview-launch') } as never);
    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/admin/preview-launch', () => {
  it('saves business details', async () => {
    const response = await patch({
      item: 'business',
      publicEmail: 'a@b.co',
      publicPhone: null,
      addressLine1: '1 High St',
      townCity: 'Leeds',
      postcode: 'LS1 1AA',
      primaryContactName: 'Alex',
      primaryContactEmail: 'a@b.co',
      isLimitedCompany: false,
      legalBusinessName: null,
      companyNumber: null,
      registeredOfficeAddress: null,
    });
    expect(response.status).toBe(200);
    expect(saveLaunchBusinessDetails).toHaveBeenCalled();
  });

  it('skips payments and migration without blocking approval', async () => {
    expect((await patch({ item: 'payments', skip: true })).status).toBe(200);
    expect((await patch({ item: 'migration', skip: true })).status).toBe(200);
    expect(skipLaunchItem).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid payloads', async () => {
    const response = await patch({ item: 'nope' });
    expect(response.status).toBe(400);
  });
});
