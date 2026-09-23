import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermission = vi.fn();
const assertClientAccessible = vi.fn();
const eraseClientPersonalData = vi.fn();
const isClientErasureBlockedError = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));

vi.mock('@/lib/admin/rbac/scope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/rbac/scope')>();
  return {
    ...actual,
    assertClientAccessible: (...args: unknown[]) => assertClientAccessible(...args),
  };
});

vi.mock('@/lib/admin/clientErasure', () => ({
  eraseClientPersonalData: (...args: unknown[]) => eraseClientPersonalData(...args),
  isClientErasureBlockedError: (...args: unknown[]) => isClientErasureBlockedError(...args),
  CLIENT_ERASURE_BLOCKED_CODE: 'CLIENT_ERASURE_BLOCKED_ACTIVE_BOOKING',
  CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT: 'CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT',
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    booking: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
  },
}));

import { DELETE } from './index';
import {
  CLIENT_ERASURE_BLOCKED_CODE,
  CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT,
} from '@/lib/admin/clientErasure';

function makeContext(opts: {
  clientId?: string;
  method?: string;
  body?: unknown;
}): APIContext {
  const clientId = opts.clientId ?? 'client-1';
  const url = `http://localhost/api/admin/clients/${clientId}`;
  const init: RequestInit = { method: opts.method ?? 'DELETE' };
  if (opts.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(opts.body);
  }
  return {
    request: new Request(url, init),
    url: new URL(url),
    params: { clientId },
  } as unknown as APIContext;
}

const ownerAccess = {
  shopId: 'shop-1',
  userId: 'user-owner',
  userName: 'Owner',
  userEmail: 'owner@shop.example',
  userImage: null,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'm-o',
  barberId: null,
  permissions: ['clients.erase', 'clients.write', 'clients.read'],
};

const managerAccess = {
  ...ownerAccess,
  userId: 'user-mgr',
  role: 'MANAGER' as const,
  memberId: 'm-m',
};

describe('DELETE /api/admin/clients/[clientId]', () => {
  beforeEach(() => {
    requireAdminPermission.mockReset();
    assertClientAccessible.mockReset();
    eraseClientPersonalData.mockReset();
    isClientErasureBlockedError.mockReset();
    isClientErasureBlockedError.mockImplementation(
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        ((error as { code?: string }).code === CLIENT_ERASURE_BLOCKED_CODE ||
          (error as { code?: string }).code === CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT),
    );
    assertClientAccessible.mockResolvedValue({ id: 'client-1' });
    eraseClientPersonalData.mockResolvedValue({
      ok: true,
      operationId: 'op-1',
      bookingCount: 1,
      orderCount: 0,
      blobCleanupAttempted: 0,
      blobCleanupFailed: 0,
      blobCleanupWarning: false,
    });
  });

  it('rejects unauthenticated / unauthorized via requireAdminPermission', async () => {
    requireAdminPermission.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    const res = await DELETE(makeContext({ body: { confirm: 'DELETE' } }));
    expect(res.status).toBe(401);
    expect(eraseClientPersonalData).not.toHaveBeenCalled();
  });

  it('rejects BARBER (clients.erase denied)', async () => {
    requireAdminPermission.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );
    const res = await DELETE(makeContext({ body: { confirm: 'DELETE' } }));
    expect(res.status).toBe(403);
    expect(eraseClientPersonalData).not.toHaveBeenCalled();
  });

  it('allows OWNER', async () => {
    requireAdminPermission.mockResolvedValue(ownerAccess);
    const res = await DELETE(makeContext({ body: { confirm: 'DELETE' } }));
    expect(res.status).toBe(200);
    expect(requireAdminPermission).toHaveBeenCalledWith(expect.anything(), 'clients.erase');
    expect(eraseClientPersonalData).toHaveBeenCalledWith({
      shopId: 'shop-1',
      clientId: 'client-1',
      actorUserId: 'user-owner',
    });
  });

  it('allows MANAGER', async () => {
    requireAdminPermission.mockResolvedValue(managerAccess);
    const res = await DELETE(makeContext({ body: { confirm: 'DELETE' } }));
    expect(res.status).toBe(200);
  });

  it('rejects missing confirm DELETE', async () => {
    requireAdminPermission.mockResolvedValue(ownerAccess);
    const res = await DELETE(makeContext({ body: { confirm: 'yes' } }));
    expect(res.status).toBe(400);
    expect(eraseClientPersonalData).not.toHaveBeenCalled();
  });

  it('returns 404 when client is missing / other shop (assertClientAccessible)', async () => {
    requireAdminPermission.mockResolvedValue(ownerAccess);
    assertClientAccessible.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 }),
    );
    const res = await DELETE(
      makeContext({ clientId: 'foreign-client', body: { confirm: 'DELETE' } }),
    );
    expect(res.status).toBe(404);
    expect(eraseClientPersonalData).not.toHaveBeenCalled();
  });

  it('returns 404 on second erase when CLIENT_NOT_FOUND (idempotent effect)', async () => {
    requireAdminPermission.mockResolvedValue(ownerAccess);
    eraseClientPersonalData.mockRejectedValue(new Error('CLIENT_NOT_FOUND'));
    const res = await DELETE(makeContext({ body: { confirm: 'DELETE' } }));
    expect(res.status).toBe(404);
  });

  it('returns 409 with CLIENT_ERASURE_BLOCKED_ACTIVE_BOOKING without PII', async () => {
    requireAdminPermission.mockResolvedValue(ownerAccess);
    const blocked = {
      code: CLIENT_ERASURE_BLOCKED_CODE,
      message:
        'This customer still has an active or unpaid appointment. Finish, cancel, or resolve it before erasing their data.',
    };
    eraseClientPersonalData.mockRejectedValue(blocked);

    const res = await DELETE(makeContext({ body: { confirm: 'DELETE' } }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe(CLIENT_ERASURE_BLOCKED_CODE);
    expect(body.error).toContain('active or unpaid');
    expect(JSON.stringify(body)).not.toMatch(/@|phone|\+44/i);
  });

  it('returns 409 with CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT without PII', async () => {
    requireAdminPermission.mockResolvedValue(ownerAccess);
    eraseClientPersonalData.mockRejectedValue({
      code: CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT,
      message: 'A message for this customer is currently being processed. Try again shortly.',
    });

    const res = await DELETE(makeContext({ body: { confirm: 'DELETE' } }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe(CLIENT_ERASURE_BLOCKED_MESSAGE_IN_FLIGHT);
    expect(body.error).toContain('currently being processed');
    expect(JSON.stringify(body)).not.toMatch(/@|phone|payload|provider/i);
  });

  it('returns blobCleanupWarning when cleanup partially failed', async () => {
    requireAdminPermission.mockResolvedValue(ownerAccess);
    eraseClientPersonalData.mockResolvedValue({
      ok: true,
      operationId: 'op-w',
      bookingCount: 0,
      orderCount: 0,
      blobCleanupAttempted: 1,
      blobCleanupFailed: 1,
      blobCleanupWarning: true,
    });
    const res = await DELETE(makeContext({ body: { confirm: 'DELETE' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.blobCleanupWarning).toBe(true);
  });
});
