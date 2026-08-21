import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BLACKLINE_DEMO_CONTACT_SOURCE } from '@/lib/demo/kersivoContact';

const sendBlacklineDemoContactEmail = vi.fn();
const enforceIpRateLimit = vi.fn();

vi.mock('@/lib/email/sender', () => ({
  EmailDeliveryError: class EmailDeliveryError extends Error {},
  sendBlacklineDemoContactEmail: (...args: unknown[]) => sendBlacklineDemoContactEmail(...args),
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: (...args: unknown[]) => enforceIpRateLimit(...args),
}));

import { EmailDeliveryError } from '@/lib/email/sender';
import { POST } from './blackline-contact';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/demo/blackline-contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:4321',
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: 'Alex',
  email: 'alex@example.com',
  message: 'How does switching from Booksy work?',
  shopName: 'Alex Barbers',
  source: 'client_spoofed_source',
};

describe('POST /api/demo/blackline-contact', () => {
  beforeEach(() => {
    sendBlacklineDemoContactEmail.mockReset();
    enforceIpRateLimit.mockReset();
    enforceIpRateLimit.mockResolvedValue(null);
    sendBlacklineDemoContactEmail.mockResolvedValue(undefined);
  });

  it('silently accepts honeypot fills without sending email', async () => {
    const res = await POST({
      request: makeRequest({ ...validBody, companyWebsite: 'https://spam.example' }),
    } as never);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, delivered: false });
    expect(sendBlacklineDemoContactEmail).not.toHaveBeenCalled();
    expect(enforceIpRateLimit).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    enforceIpRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      }),
    );
    const res = await POST({ request: makeRequest(validBody) } as never);
    const data = await res.json();
    expect(res.status).toBe(429);
    expect(data.delivered).not.toBe(true);
    expect(sendBlacklineDemoContactEmail).not.toHaveBeenCalled();
  });

  it('sends email for valid submissions and ignores client source spoofing', async () => {
    const res = await POST({ request: makeRequest(validBody) } as never);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, delivered: true });
    expect(enforceIpRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'blackline_demo_contact_form',
      5,
      15 * 60 * 1000,
    );
    expect(sendBlacklineDemoContactEmail).toHaveBeenCalledOnce();
    expect(sendBlacklineDemoContactEmail).toHaveBeenCalledWith({
      name: 'Alex',
      email: 'alex@example.com',
      shopName: 'Alex Barbers',
      message: 'How does switching from Booksy work?',
    });
    expect(BLACKLINE_DEMO_CONTACT_SOURCE).toBe('blackline_demo_contact');
  });

  it('allows optional shop name', async () => {
    const { shopName: _shopName, ...body } = validBody;
    const res = await POST({ request: makeRequest(body) } as never);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.delivered).toBe(true);
    expect(sendBlacklineDemoContactEmail).toHaveBeenCalledWith({
      name: 'Alex',
      email: 'alex@example.com',
      message: 'How does switching from Booksy work?',
      shopName: undefined,
    });
  });

  it('returns 400 when name is missing', async () => {
    const res = await POST({
      request: makeRequest({ ...validBody, name: '  ' }),
    } as never);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(sendBlacklineDemoContactEmail).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid email', async () => {
    const res = await POST({
      request: makeRequest({ ...validBody, email: 'not-an-email' }),
    } as never);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.delivered).not.toBe(true);
    expect(sendBlacklineDemoContactEmail).not.toHaveBeenCalled();
  });

  it('returns 400 when question is missing', async () => {
    const res = await POST({
      request: makeRequest({ ...validBody, message: '' }),
    } as never);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(sendBlacklineDemoContactEmail).not.toHaveBeenCalled();
  });

  it('returns 502 when email delivery fails', async () => {
    sendBlacklineDemoContactEmail.mockRejectedValue(new EmailDeliveryError('boom', null));
    const res = await POST({ request: makeRequest(validBody) } as never);
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.ok).toBe(false);
    expect(data.delivered).not.toBe(true);
  });
});
