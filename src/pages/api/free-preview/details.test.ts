import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const savePreviewRequestDetails = vi.fn();
const enforceIpRateLimit = vi.fn();

vi.mock('@/lib/freePreview/savePreviewRequestDetails', () => ({
  savePreviewRequestDetails: (...args: unknown[]) => savePreviewRequestDetails(...args),
}));
vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: (...args: unknown[]) => enforceIpRateLimit(...args),
}));

import { POST } from './details';

const TOKEN = 'a'.repeat(43);

function call(body: unknown) {
  const request = new Request('http://localhost/api/free-preview/details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return POST({ request } as Parameters<typeof POST>[0]) as Promise<Response>;
}

describe('POST /api/free-preview/details', () => {
  beforeEach(() => {
    vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'true');
    savePreviewRequestDetails.mockReset().mockResolvedValue({ ok: true, updated: true });
    enforceIpRateLimit.mockReset().mockResolvedValue(null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 and does nothing while the flag is off', async () => {
    vi.stubEnv('FREE_PREVIEW_FLOW_ENABLED', 'false');
    expect((await call({ token: TOKEN })).status).toBe(404);
    expect(enforceIpRateLimit).not.toHaveBeenCalled();
    expect(savePreviewRequestDetails).not.toHaveBeenCalled();
  });

  it('saves valid details', async () => {
    const response = await call({ token: TOKEN, barberCount: '2-3' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(savePreviewRequestDetails).toHaveBeenCalledWith({ token: TOKEN, barberCount: '2-3' });
  });

  it('rate limits before reading anything', async () => {
    enforceIpRateLimit.mockResolvedValue(new Response('{}', { status: 429 }));
    expect((await call({ token: TOKEN })).status).toBe(429);
    expect(savePreviewRequestDetails).not.toHaveBeenCalled();
  });

  it('rejects bad JSON, a malformed token and any non-Step-2 field', async () => {
    expect((await call('{nope')).status).toBe(400);
    expect((await call({ token: 'short', barberCount: '1' })).status).toBe(400);
    expect((await call({ token: TOKEN, email: 'attacker@example.com' })).status).toBe(400);
    expect((await call({ token: TOKEN, barberCount: '12' })).status).toBe(400);
    expect(savePreviewRequestDetails).not.toHaveBeenCalled();
  });

  it('answers a bad or expired token with its status and the same message', async () => {
    savePreviewRequestDetails.mockResolvedValueOnce({ ok: false, code: 'NOT_FOUND', httpStatus: 404 });
    const unknown = await call({ token: TOKEN, barberCount: '1' });
    savePreviewRequestDetails.mockResolvedValueOnce({ ok: false, code: 'EXPIRED', httpStatus: 410 });
    const expired = await call({ token: TOKEN, barberCount: '1' });
    expect(unknown.status).toBe(404);
    expect(expired.status).toBe(410);
    expect(((await unknown.json()) as { error: string }).error).toBe('This form has expired.');
    expect(((await expired.json()) as { error: string }).error).toBe('This form has expired.');
  });

  it('turns an unexpected failure into a 500', async () => {
    savePreviewRequestDetails.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call({ token: TOKEN, barberCount: '1' })).status).toBe(500);
    spy.mockRestore();
  });
});
