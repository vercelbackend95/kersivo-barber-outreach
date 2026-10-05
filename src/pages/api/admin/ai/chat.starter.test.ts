import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermissionAndCapability = vi.fn();
const openAiConstructor = vi.fn();

vi.mock('@/lib/admin/productCapability', () => ({
  requireAdminPermissionAndCapability: (...args: unknown[]) =>
    requireAdminPermissionAndCapability(...args),
}));

vi.mock('openai', () => ({
  default: class OpenAI {
    constructor(...args: unknown[]) {
      openAiConstructor(...args);
    }
  },
}));

vi.mock('@/lib/rate-limit/durableRateLimit', () => ({
  checkDurableRateLimit: vi.fn(),
  clientIpFromRequest: vi.fn(),
  rateLimitExceededResponse: vi.fn(),
}));

import { POST } from './chat';

function context(): APIContext {
  return {
    request: new Request('http://localhost/api/admin/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'How is today looking?' }] }),
    }),
    url: new URL('http://localhost/api/admin/ai/chat'),
  } as unknown as APIContext;
}

describe('POST /api/admin/ai/chat Starter lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the product capability gate before any OpenAI client/request is created', async () => {
    requireAdminPermissionAndCapability.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'This feature is available with Full KERSIVO.',
          code: 'KERSIVO_UPGRADE_REQUIRED',
          requiredCapability: 'ASSISTANT',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = await POST(context());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toMatchObject({
      code: 'KERSIVO_UPGRADE_REQUIRED',
      requiredCapability: 'ASSISTANT',
    });
    expect(requireAdminPermissionAndCapability).toHaveBeenCalledWith(
      expect.anything(),
      'ai.use',
      'ASSISTANT',
    );
    expect(openAiConstructor).not.toHaveBeenCalled();
  });
});
