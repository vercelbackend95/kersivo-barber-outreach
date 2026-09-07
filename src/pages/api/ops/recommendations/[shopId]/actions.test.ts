import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const executeOpsAction = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {},
}));

vi.mock('@/lib/recommendations/ops/actions/executeOpsAction', () => ({
  executeOpsAction: (...args: unknown[]) => executeOpsAction(...args),
}));

import { DELETE, GET, PATCH, POST, PUT } from './actions';

function postCtx(body: unknown, headers: Record<string, string> = {}) {
  return {
    request: new Request('https://kersivo.co.uk/api/ops/recommendations/shop_1/actions', {
      method: 'POST',
      headers: {
        Origin: 'https://kersivo.co.uk',
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    params: { shopId: 'shop_1' },
  } as never;
}

describe('POST /api/ops/recommendations/[shopId]/actions', () => {
  beforeEach(() => {
    getSession.mockReset();
    executeOpsAction.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv('KERSIVO_OPS_EMAILS', 'hello@kersivo.co.uk');
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'hello@kersivo.co.uk', emailVerified: true },
    });
  });

  it('rejects unsupported methods', async () => {
    expect((await GET()).status).toBe(405);
    expect((await PUT()).status).toBe(405);
    expect((await PATCH()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });

  it('rejects cross-origin', async () => {
    const res = await POST(
      postCtx(
        {
          action: 'REBUILD',
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
        },
        { Origin: 'https://evil.example' },
      ),
    );
    expect(res.status).toBe(403);
    expect(executeOpsAction).not.toHaveBeenCalled();
  });

  it('returns 202 queued rebuild envelope', async () => {
    executeOpsAction.mockResolvedValue({
      ok: true,
      httpStatus: 202,
      data: {
        actionId: 'a1',
        action: 'REBUILD',
        outcome: 'QUEUED',
        replayed: false,
        queued: true,
        state: { catalogueVersion: 2 },
      },
    });

    const res = await POST(
      postCtx({
        action: 'REBUILD',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(res.status).toBe(202);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.queued).toBe(true);
  });

  it('rejects invalid body without executing', async () => {
    const res = await POST(postCtx({ action: 'REBUILD', idempotencyKey: 'bad' }));
    expect(res.status).toBe(400);
    expect(executeOpsAction).not.toHaveBeenCalled();
  });
});
