import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermission = vi.fn();
const kitFindUnique = vi.fn();
const onboardingFindUnique = vi.fn();
const loadQrKitShopFacts = vi.fn();
const requestInitialQrKit = vi.fn();
const deliverOutboxEmail = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    qrKitFulfilment: { findUnique: (...args: unknown[]) => kitFindUnique(...args) },
    clientOnboarding: { findUnique: (...args: unknown[]) => onboardingFindUnique(...args) },
  },
}));

vi.mock('@/lib/email/outbox', () => ({
  deliverOutboxEmail: (...args: unknown[]) => deliverOutboxEmail(...args),
}));

vi.mock('@/lib/qr/qrKitFulfilment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/qr/qrKitFulfilment')>();
  return {
    ...actual,
    loadQrKitShopFacts: (...args: unknown[]) => loadQrKitShopFacts(...args),
    requestInitialQrKit: (...args: unknown[]) => requestInitialQrKit(...args),
  };
});

import { GET, POST } from './qr-kit';

const access = {
  shopId: 'shop-1',
  userId: 'owner-1',
  userName: 'Sam Owner',
  userEmail: 'sam@example.co.uk',
  emailVerified: true,
  via: 'session' as const,
  role: 'OWNER' as const,
};

const facts = {
  productState: 'FREE_BOOKING',
  publicBookingCapable: true,
  shopName: 'Fade Room',
  bookingSlug: 'fade-room',
  emailVerified: true,
  activeBookableBarbers: 1,
  activeServices: 1,
  hasWorkingHours: true,
  termsAccepted: true,
};

function ctx(method = 'GET', body?: unknown): APIContext {
  return {
    request: new Request('https://kersivo.test/api/admin/qr-kit', {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  } as unknown as APIContext;
}

const FORBIDDEN_KEYS = [
  'status',
  'printCostPence',
  'packagingCostPence',
  'postageCostPence',
  'otherCostPence',
  'verificationNote',
  'dispatchReference',
  'dispatchCarrier',
  'printReference',
  'fulfilmentId',
];

function expectNoInternalState(body: Record<string, unknown>) {
  const text = JSON.stringify(body);
  for (const key of FORBIDDEN_KEYS) expect(text).not.toContain(`"${key}"`);
  for (const status of ['VERIFYING', 'APPROVED', 'PRINT_QUEUED', 'DISPATCHED', 'NEEDS_REVIEW', 'REJECTED']) {
    expect(text).not.toContain(status);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminPermission.mockResolvedValue(access);
  kitFindUnique.mockResolvedValue(null);
  onboardingFindUnique.mockResolvedValue(null);
  loadQrKitShopFacts.mockResolvedValue(facts);
  deliverOutboxEmail.mockResolvedValue({ status: 'sent' });
});

describe('/api/admin/qr-kit', () => {
  it('requires shop.settings permission', async () => {
    requireAdminPermission.mockResolvedValue(new Response('no', { status: 403 }));
    expect((await GET(ctx())).status).toBe(403);
    expect((await POST(ctx('POST', {}))).status).toBe(403);
    expect(requireAdminPermission).toHaveBeenCalledWith(expect.anything(), 'shop.settings');
  });

  it('GET returns eligibility and a prefill for an eligible Starter shop', async () => {
    const res = await GET(ctx());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ requestReceived: false, eligible: true, blockers: [] });
    expect(body.prefill).toMatchObject({ shopName: 'Fade Room', contactEmail: 'sam@example.co.uk' });
  });

  it('GET for a SETUP shop reports NOT_STARTER', async () => {
    loadQrKitShopFacts.mockResolvedValue({ ...facts, productState: 'SETUP' });
    const body = await (await GET(ctx())).json();
    expect(body.eligible).toBe(false);
    expect(body.blockers.map((b: { code: string }) => b.code)).toContain('NOT_STARTER');
  });

  it('GET after a request only says it was received — no tracker, status or costs', async () => {
    kitFindUnique.mockResolvedValue({ id: 'kit_1' });
    const body = await (await GET(ctx())).json();
    expect(body).toEqual({
      requestReceived: true,
      message:
        "Your QR Kit request has been received. We'll verify the shop details before it goes to print.",
    });
    expectNoInternalState(body);
    expect(kitFindUnique).toHaveBeenCalledWith({ where: { shopId: 'shop-1' }, select: { id: true } });
  });

  it('POST acknowledges and delivers the email only when a kit was created', async () => {
    requestInitialQrKit.mockResolvedValueOnce({
      ok: true,
      created: true,
      fulfilmentId: 'kit_1',
      outboxId: 'email_1',
      internalOutboxId: 'email_2',
    });
    const first = await POST(ctx('POST', { contactName: 'Sam' }));
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.requestReceived).toBe(true);
    expectNoInternalState(firstBody);
    expect(deliverOutboxEmail).toHaveBeenCalledTimes(2);
    expect(deliverOutboxEmail).toHaveBeenCalledWith('email_1');
    expect(deliverOutboxEmail).toHaveBeenCalledWith('email_2');

    requestInitialQrKit.mockResolvedValueOnce({
      ok: true,
      created: false,
      fulfilmentId: 'kit_1',
      outboxId: null,
      internalOutboxId: null,
    });
    const retry = await POST(ctx('POST', { contactName: 'Sam' }));
    expect(retry.status).toBe(200);
    expect(deliverOutboxEmail).toHaveBeenCalledTimes(2);
  });

  it('POST still confirms the durable request when email delivery fails', async () => {
    requestInitialQrKit.mockResolvedValueOnce({
      ok: true,
      created: true,
      fulfilmentId: 'kit_1',
      outboxId: 'email_1',
      internalOutboxId: 'email_2',
    });
    deliverOutboxEmail.mockRejectedValue(new Error('smtp down'));
    const res = await POST(ctx('POST', { contactName: 'Sam' }));
    expect(res.status).toBe(200);
    expect((await res.json()).requestReceived).toBe(true);
    expect(deliverOutboxEmail).toHaveBeenCalledTimes(2);
  });

  it('POST passes server-loaded facts; guest preview access is never email-verified', async () => {
    requireAdminPermission.mockResolvedValue({ ...access, via: 'preview' });
    requestInitialQrKit.mockResolvedValue({ ok: false, reason: 'INELIGIBLE', blockers: ['EMAIL_NOT_VERIFIED'] });
    const res = await POST(ctx('POST', {}));
    expect(res.status).toBe(409);
    expect(loadQrKitShopFacts).toHaveBeenCalledWith('shop-1', { emailVerified: false });
  });

  it('POST returns field errors for invalid details', async () => {
    requestInitialQrKit.mockResolvedValue({
      ok: false,
      reason: 'INVALID_DETAILS',
      errors: ['ADDRESS_MISSING'],
    });
    const res = await POST(ctx('POST', {}));
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toEqual(['ADDRESS_MISSING']);
  });
});
