import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendContactInquiryEmail = vi.fn();
const enforceIpRateLimit = vi.fn();

vi.mock('../../lib/email/sender', () => ({
  EmailDeliveryError: class EmailDeliveryError extends Error {},
  sendContactInquiryEmail: (...args: unknown[]) => sendContactInquiryEmail(...args),
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: (...args: unknown[]) => enforceIpRateLimit(...args),
}));

import { POST } from './contact';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/contact', {
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
  message: 'Need a booking system',
  shopSize: '1-2',
  currentStack: 'none',
};

describe('POST /api/contact', () => {
  beforeEach(() => {
    sendContactInquiryEmail.mockReset();
    enforceIpRateLimit.mockReset();
    enforceIpRateLimit.mockResolvedValue(null);
    sendContactInquiryEmail.mockResolvedValue(undefined);
  });

  it('silently accepts honeypot fills without sending email', async () => {
    const res = await POST({
      request: makeRequest({ ...validBody, companyWebsite: 'https://spam.example' }),
    } as never);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(sendContactInquiryEmail).not.toHaveBeenCalled();
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
    expect(res.status).toBe(429);
    expect(sendContactInquiryEmail).not.toHaveBeenCalled();
  });

  it('sends email for valid submissions', async () => {
    const res = await POST({ request: makeRequest(validBody) } as never);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(sendContactInquiryEmail).toHaveBeenCalledOnce();
  });
});
