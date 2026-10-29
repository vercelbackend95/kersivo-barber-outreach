import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createPreviewRequest = vi.fn();
const enforceIpRateLimit = vi.fn();
const checkDurableRateLimit = vi.fn();

vi.mock('@/lib/freePreview/createPreviewRequest', () => ({
  createPreviewRequest: (...args: unknown[]) => createPreviewRequest(...args),
}));
vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: (...args: unknown[]) => enforceIpRateLimit(...args),
}));
vi.mock('@/lib/rate-limit/durableRateLimit', () => ({
  checkDurableRateLimit: (...args: unknown[]) => checkDurableRateLimit(...args),
  rateLimitExceededResponse: () => new Response('{}', { status: 429 }),
}));

import { POST } from './free-preview';

const validBody = {
  email: 'sam@example.com',
  shopName: 'Sharp Cuts',
  townCity: 'Leeds',
  instagramUrl: 'instagram.com/sharpcuts',
  barberCount: '1',
  currentBookingSystem: 'none',
  hasOwnDomain: 'no',
  authorisationConsent: true,
};

function call(body: unknown) {
  const request = new Request('http://localhost/api/free-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST({ request } as Parameters<typeof POST>[0]) as Promise<Response>;
}

describe('POST /api/free-preview', () => {
  beforeEach(() => {
    vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
    createPreviewRequest.mockReset().mockResolvedValue({ id: 'req_1' });
    enforceIpRateLimit.mockReset().mockResolvedValue(null);
    checkDurableRateLimit.mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 and does nothing while the flag is off', async () => {
    vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'false');
    const response = await call(validBody);
    expect(response.status).toBe(404);
    expect(enforceIpRateLimit).not.toHaveBeenCalled();
    expect(createPreviewRequest).not.toHaveBeenCalled();
  });

  it('silently accepts honeypot submissions without saving or rate limiting', async () => {
    const response = await call({ ...validBody, companyWebsite: 'spam.example' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(enforceIpRateLimit).not.toHaveBeenCalled();
    expect(createPreviewRequest).not.toHaveBeenCalled();
  });

  it('returns field errors for invalid input', async () => {
    const response = await call({ ...validBody, instagramUrl: '' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { fieldErrors: Record<string, string> };
    expect(body.fieldErrors.links).toBeTruthy();
    expect(createPreviewRequest).not.toHaveBeenCalled();
  });

  it('enforces the IP and per-email limits', async () => {
    enforceIpRateLimit.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    expect((await call(validBody)).status).toBe(429);

    checkDurableRateLimit.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 60 });
    expect((await call(validBody)).status).toBe(429);
    const emailKey = checkDurableRateLimit.mock.calls[0]?.[0]?.key as string;
    expect(emailKey).toMatch(/^email:[0-9a-f]{64}$/);
    expect(emailKey).not.toContain('sam@example.com');
    expect(createPreviewRequest).not.toHaveBeenCalled();
  });

  it('creates the request on valid input', async () => {
    const response = await call(validBody);
    expect(response.status).toBe(200);
    expect(createPreviewRequest).toHaveBeenCalledTimes(1);
    expect(createPreviewRequest.mock.calls[0]?.[0]).toMatchObject({
      email: 'sam@example.com',
      instagramUrl: 'https://instagram.com/sharpcuts',
    });
  });
});
