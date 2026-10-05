import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermission = vi.fn();
const requireVerifiedEmail = vi.fn();
const requireAdminProductCapability = vi.fn();
const isDemoShopId = vi.fn();

const shopFindUnique = vi.fn();
const barberCount = vi.fn();
const serviceCount = vi.fn();
const availabilityCount = vi.fn();
const legalAcceptanceCount = vi.fn();
const transaction = vi.fn();

const requestFindUnique = vi.fn();
const requestCreate = vi.fn();
const ensureShopBookingSlug = vi.fn();
const ensureShopQrCodesInTx = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
  requireVerifiedEmail: (...args: unknown[]) => requireVerifiedEmail(...args),
}));

vi.mock('@/lib/admin/productCapability', () => ({
  requireAdminProductCapability: (...args: unknown[]) =>
    requireAdminProductCapability(...args),
}));

vi.mock('@/lib/shop/cardPaymentsGate', () => ({
  isDemoShopId: (...args: unknown[]) => isDemoShopId(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => shopFindUnique(...args),
    },
    barber: { count: (...args: unknown[]) => barberCount(...args) },
    service: { count: (...args: unknown[]) => serviceCount(...args) },
    availabilityRule: { count: (...args: unknown[]) => availabilityCount(...args) },
    legalAcceptance: { count: (...args: unknown[]) => legalAcceptanceCount(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/booking/bookingSlug', () => ({
  ensureShopBookingSlug: (...args: unknown[]) => ensureShopBookingSlug(...args),
}));

vi.mock('@/lib/qr/shopQrCodes', () => ({
  ensureShopQrCodesInTx: (...args: unknown[]) => ensureShopQrCodesInTx(...args),
}));

vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.test',
}));

import { GET, POST } from './qr-kit';

const access = {
  shopId: 'shop-1',
  userId: 'user-1',
  userName: 'Owner',
  userEmail: 'owner@example.com',
  userImage: null,
  emailVerified: true,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'member-1',
  barberId: null,
  permissions: ['billing.manage'],
};

const validClaim = {
  deliveryContactName: 'Jamie Barber',
  deliveryPhone: '07123456789',
  addressLine1: '10 High Street',
  addressLine2: '',
  townCity: 'Bournemouth',
  postcode: 'BH1 1AA',
};

function ctx(method: 'GET' | 'POST', body?: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/qr-kit', {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    url: new URL('http://localhost/api/admin/qr-kit'),
  } as unknown as APIContext;
}

describe('/api/admin/qr-kit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermission.mockResolvedValue(access);
    requireVerifiedEmail.mockReturnValue(null);
    requireAdminProductCapability.mockResolvedValue({
      access,
      productAccess: { state: 'FREE_BOOKING', capabilities: ['PUBLIC_BOOKING'] },
    });
    isDemoShopId.mockReturnValue(false);

    shopFindUnique.mockResolvedValue({
      name: 'Fade Studio',
      bookingSlug: 'fade-studio',
      qrKitRequest: null,
    });
    barberCount.mockResolvedValue(1);
    serviceCount.mockResolvedValue(1);
    availabilityCount.mockResolvedValue(5);
    legalAcceptanceCount.mockResolvedValue(1);

    ensureShopBookingSlug.mockResolvedValue('fade-studio');
    ensureShopQrCodesInTx.mockResolvedValue([
      { id: 'qr-1', shopId: 'shop-1', code: 'ABCDEFGH2345', placement: 'WINDOW' },
      { id: 'qr-2', shopId: 'shop-1', code: 'ABCDEFGH2346', placement: 'REBOOK' },
    ]);
    requestFindUnique.mockResolvedValue(null);
    requestCreate.mockResolvedValue({
      id: 'request-1',
      requestedAt: new Date('2026-10-05T12:00:00.000Z'),
      status: 'REQUESTED',
    });
    enqueueEmail.mockResolvedValue({ id: 'email-1' });
    tryDeliverOutboxEmail.mockResolvedValue(undefined);

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        shopQrKitRequest: {
          findUnique: (...args: unknown[]) => requestFindUnique(...args),
          create: (...args: unknown[]) => requestCreate(...args),
        },
      }),
    );
  });

  it('GET reports eligible without requiring a first customer booking', async () => {
    const res = await GET(ctx('GET'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      eligible: true,
      reasons: [],
      existingRequest: null,
      includedPlacements: ['WINDOW', 'REBOOK'],
      windowTargetMm: { width: 150, height: 170 },
      rebookTargetMm: { width: 100, height: 100 },
    });
  });

  it('GET exposes concrete setup blockers but no fake business-verification result', async () => {
    serviceCount.mockResolvedValue(0);
    availabilityCount.mockResolvedValue(0);
    legalAcceptanceCount.mockResolvedValue(0);

    const res = await GET(ctx('GET'));
    const body = await res.json();

    expect(body.eligible).toBe(false);
    expect(body.reasons).toEqual([
      'active_service_required',
      'availability_required',
      'terms_acceptance_required',
    ]);
    expect(body.verified).toBeUndefined();
  });

  it('GET reports an existing initial request instead of allowing another claim', async () => {
    shopFindUnique.mockResolvedValue({
      name: 'Fade Studio',
      bookingSlug: 'fade-studio',
      qrKitRequest: {
        requestedAt: new Date('2026-10-01T10:00:00.000Z'),
        status: 'VERIFYING',
      },
    });

    const res = await GET(ctx('GET'));
    const body = await res.json();

    expect(body.eligible).toBe(false);
    expect(body.reasons).toEqual(['initial_kit_already_requested']);
    expect(body.existingRequest).toEqual({
      requestedAt: '2026-10-01T10:00:00.000Z',
      status: 'VERIFYING',
    });
  });

  it('POST atomically creates both QR placements, request and acknowledgement', async () => {
    const res = await POST(ctx('POST', validClaim));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({
      ok: true,
      request: {
        requestedAt: '2026-10-05T12:00:00.000Z',
        status: 'REQUESTED',
      },
      bookingUrl: 'https://kersivo.test/book/fade-studio',
      includedPlacements: ['WINDOW', 'REBOOK'],
    });
    expect(ensureShopBookingSlug).toHaveBeenCalledWith(expect.anything(), 'shop-1');
    expect(ensureShopQrCodesInTx).toHaveBeenCalledWith(expect.anything(), 'shop-1');
    expect(requestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shopId: 'shop-1',
        status: 'REQUESTED',
        deliveryContactName: 'Jamie Barber',
        deliveryPhone: '07123456789',
        addressLine1: '10 High Street',
        townCity: 'Bournemouth',
        postcode: 'BH1 1AA',
        countryCode: 'GB',
      }),
      select: {
        id: true,
        requestedAt: true,
        status: true,
      },
    });
    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        shopId: 'shop-1',
        purpose: 'QR_KIT_REQUESTED',
        to: 'owner@example.com',
        dedupeKey: 'qr-kit-requested:shop-1',
      }),
    );
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('email-1');
  });

  it('POST rejects a request until the operational booking setup is eligible', async () => {
    barberCount.mockResolvedValue(0);

    const res = await POST(ctx('POST', validClaim));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('QR_KIT_NOT_ELIGIBLE');
    expect(body.reasons).toContain('active_barber_required');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('POST refuses a second initial kit for the same location', async () => {
    shopFindUnique.mockResolvedValue({
      name: 'Fade Studio',
      bookingSlug: 'fade-studio',
      qrKitRequest: {
        requestedAt: new Date('2026-10-01T10:00:00.000Z'),
        status: 'REQUESTED',
      },
    });

    const res = await POST(ctx('POST', validClaim));

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('QR_KIT_ALREADY_REQUESTED');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('requires a verified signed-in owner/billing manager', async () => {
    requireVerifiedEmail.mockReturnValue(
      new Response(JSON.stringify({ code: 'EMAIL_NOT_VERIFIED' }), { status: 403 }),
    );

    const res = await POST(ctx('POST', validClaim));

    expect(res.status).toBe(403);
    expect(requireAdminProductCapability).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('stops at PUBLIC_BOOKING entitlement before eligibility reads', async () => {
    requireAdminProductCapability.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'KERSIVO_UPGRADE_REQUIRED',
          requiredCapability: 'PUBLIC_BOOKING',
        }),
        { status: 403 },
      ),
    );

    const res = await GET(ctx('GET'));

    expect(res.status).toBe(403);
    expect(shopFindUnique).not.toHaveBeenCalled();
  });
});
