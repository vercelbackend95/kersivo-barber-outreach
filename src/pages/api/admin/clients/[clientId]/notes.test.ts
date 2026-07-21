import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermission = vi.fn();
const resolveActingBarberId = vi.fn();
const clientFindFirst = vi.fn();
const clientNoteFindMany = vi.fn();
const clientNoteCreate = vi.fn();
const clientNoteFindUniqueOrThrow = vi.fn();
const barberFindFirst = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));

vi.mock('@/lib/admin/rbac/actingBarber', () => ({
  resolveActingBarberId: (...args: unknown[]) => resolveActingBarberId(...args),
}));

vi.mock('@/lib/storage/storeNoteImage', () => ({
  storeNoteImage: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      findFirst: (...args: unknown[]) => clientFindFirst(...args),
    },
    clientNote: {
      findMany: (...args: unknown[]) => clientNoteFindMany(...args),
      create: (...args: unknown[]) => clientNoteCreate(...args),
      findUniqueOrThrow: (...args: unknown[]) => clientNoteFindUniqueOrThrow(...args),
    },
    barber: {
      findFirst: (...args: unknown[]) => barberFindFirst(...args),
    },
  },
}));

import { GET, POST } from './notes';

function makeContext(opts: {
  clientId: string;
  method?: string;
  body?: unknown;
}): APIContext {
  const url = `http://localhost/api/admin/clients/${opts.clientId}/notes`;
  const init: RequestInit = { method: opts.method ?? 'GET' };
  if (opts.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(opts.body);
  }
  return {
    request: new Request(url, init),
    url: new URL(url),
    params: { clientId: opts.clientId },
  } as unknown as APIContext;
}

const barberAccess = {
  shopId: 'shop-1',
  userId: 'user-b',
  userName: 'Barber',
  userEmail: 'barber@example.com',
  userImage: null,
  via: 'session' as const,
  role: 'BARBER' as const,
  memberId: 'm-b',
  barberId: 'barber-1',
  permissions: [],
};

const managerAccess = {
  ...barberAccess,
  userId: 'user-m',
  userName: 'Manager',
  userEmail: 'manager@example.com',
  role: 'MANAGER' as const,
  memberId: 'm-m',
  barberId: 'barber-mgr',
};

const sampleNote = {
  id: 'note-1',
  body: 'Public note',
  isInternal: false,
  createdAt: new Date('2026-06-01T10:00:00.000Z'),
  barber: { id: 'barber-1', name: 'Alex', avatarUrl: null },
  images: [],
  _count: { likes: 0 },
  likes: [],
};

describe('GET /api/admin/clients/[clientId]/notes', () => {
  beforeEach(() => {
    requireAdminPermission.mockReset();
    resolveActingBarberId.mockReset();
    clientFindFirst.mockReset();
    clientNoteFindMany.mockReset();
    clientFindFirst.mockResolvedValue({ id: 'client-1' });
    resolveActingBarberId.mockReturnValue('barber-1');
    clientNoteFindMany.mockResolvedValue([sampleNote]);
  });

  it('filters internal notes for BARBER and sets canMarkInternal false', async () => {
    requireAdminPermission.mockResolvedValue(barberAccess);

    const res = await GET(makeContext({ clientId: 'client-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.canMarkInternal).toBe(false);
    expect(clientNoteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1', isInternal: false },
      }),
    );
    expect(body.notes[0].isInternal).toBe(false);
  });

  it('returns all notes for MANAGER and sets canMarkInternal true', async () => {
    requireAdminPermission.mockResolvedValue(managerAccess);
    clientNoteFindMany.mockResolvedValue([
      sampleNote,
      { ...sampleNote, id: 'note-2', body: 'Secret', isInternal: true },
    ]);

    const res = await GET(makeContext({ clientId: 'client-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.canMarkInternal).toBe(true);
    expect(clientNoteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1' },
      }),
    );
    expect(body.notes).toHaveLength(2);
    expect(body.notes[1].isInternal).toBe(true);
  });
});

describe('POST /api/admin/clients/[clientId]/notes isInternal', () => {
  beforeEach(() => {
    requireAdminPermission.mockReset();
    resolveActingBarberId.mockReset();
    clientFindFirst.mockReset();
    clientNoteCreate.mockReset();
    clientNoteFindUniqueOrThrow.mockReset();
    barberFindFirst.mockReset();
    clientFindFirst.mockResolvedValue({ id: 'client-1' });
    resolveActingBarberId.mockReturnValue('barber-1');
    barberFindFirst.mockResolvedValue({ id: 'barber-1' });
    clientNoteCreate.mockResolvedValue({ id: 'note-new' });
    clientNoteFindUniqueOrThrow.mockResolvedValue({
      ...sampleNote,
      id: 'note-new',
      body: 'Fresh note',
      isInternal: false,
    });
  });

  it('forces isInternal false for BARBER even when requested', async () => {
    requireAdminPermission.mockResolvedValue(barberAccess);

    const res = await POST(
      makeContext({
        clientId: 'client-1',
        method: 'POST',
        body: { body: 'Fresh note', isInternal: true },
      }),
    );

    expect(res.status).toBe(201);
    expect(clientNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isInternal: false }),
      }),
    );
  });

  it('allows MANAGER to create an internal note', async () => {
    requireAdminPermission.mockResolvedValue(managerAccess);
    resolveActingBarberId.mockReturnValue('barber-mgr');
    barberFindFirst.mockResolvedValue({ id: 'barber-mgr' });
    clientNoteFindUniqueOrThrow.mockResolvedValue({
      ...sampleNote,
      id: 'note-new',
      body: 'Manager secret',
      isInternal: true,
      barber: { id: 'barber-mgr', name: 'Morgan', avatarUrl: null },
    });

    const res = await POST(
      makeContext({
        clientId: 'client-1',
        method: 'POST',
        body: { body: 'Manager secret', isInternal: true },
      }),
    );

    expect(res.status).toBe(201);
    expect(clientNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isInternal: true }),
      }),
    );
    const body = await res.json();
    expect(body.note.isInternal).toBe(true);
  });
});
