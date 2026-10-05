import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminContext = vi.fn();
const requireAnyPermission = vi.fn();
const requireAdminProductCapability = vi.fn();
const shopFindUnique = vi.fn();
const shopFindUniqueOrThrow = vi.fn();
const shopUpdate = vi.fn();
const transaction = vi.fn();
const ensureShopBookingSlug = vi.fn();
const isDemoShopId = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));
vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: (...args: unknown[]) => requireAnyPermission(...args),
}));
vi.mock('@/lib/admin/productCapability', () => ({
  requireAdminProductCapability: (...args: unknown[]) =>
    requireAdminProductCapability(...args),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => shopFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));
vi.mock('@/lib/booking/bookingSlug', () => ({
  ensureShopBookingSlug: (...args: unknown[]) => ensureShopBookingSlug(...args),
}));
vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.test',
}));
vi.mock('@/lib/shop/cardPaymentsGate', () => ({
  isDemoShopId: (...args: unknown[]) => isDemoShopId(...args),
}));

import { GET, POST } from './google-booking';

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
  permissions: ['shop.settings'],
};

function ctx(method: 'GET' | 'POST', body?: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/google-booking', {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    url: new URL('http://localhost/api/admin/google-booking'),
  } as unknown as APIContext;
}

describe('/api/admin/google-booking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue(access);
    requireAnyPermission.mockReturnValue(null);
    requireAdminProductCapability.mockResolvedValue({ access, productAccess: { state: 'FREE_BOOKING' } });
    isDemoShopId.mockReturnValue(false);
    ensureShopBookingSlug.mockResolvedValue('fade-studio');
    shopUpdate.mockResolvedValue({});
    shopFindUniqueOrThrow.mockResolvedValue({
      googleBookingLinkConfirmedAt: null,
      googleBookingLinkConfirmedUrl: null,
    });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        shopSettings: {
          update: (...args: unknown[]) => shopUpdate(...args),
          findUniqueOrThrow: (...args: unknown[]) => shopFindUniqueOrThrow(...args),
        },
      }),
    );
  });

  it('GET reports preparation required when the stable booking slug is missing', async () => {
    shopFindUnique.mockResolvedValue({
      bookingSlug: null,
      googleBookingLinkConfirmedAt: null,
      googleBookingLinkConfirmedUrl: null,
    });

    const res = await GET(ctx('GET'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      bookingUrl: null,
      needsPreparation: true,
      confirmed: false,
      staleConfirmation: false,
    });
    expect(ensureShopBookingSlug).not.toHaveBeenCalled();
  });

  it('GET returns the canonical /book/{slug} URL and never a QR destination', async () => {
    shopFindUnique.mockResolvedValue({
      bookingSlug: 'fade-studio',
      googleBookingLinkConfirmedAt: null,
      googleBookingLinkConfirmedUrl: null,
    });

    const res = await GET(ctx('GET'));
    const body = await res.json();

    expect(body.bookingUrl).toBe('https://kersivo.test/book/fade-studio');
    expect(body.bookingUrl).not.toContain('/q/');
    expect(body.needsPreparation).toBe(false);
  });

  it('GET only reports confirmed while the stored snapshot matches the current canonical URL', async () => {
    shopFindUnique.mockResolvedValue({
      bookingSlug: 'fade-studio',
      googleBookingLinkConfirmedAt: new Date('2026-10-05T12:00:00.000Z'),
      googleBookingLinkConfirmedUrl: 'https://old.example/book/fade-studio',
    });

    const res = await GET(ctx('GET'));
    const body = await res.json();

    expect(body.confirmed).toBe(false);
    expect(body.staleConfirmation).toBe(true);
    expect(body.confirmedAt).toBeNull();
  });

  it('prepare allocates a stable slug but does not mark the Google setup as confirmed', async () => {
    const res = await POST(ctx('POST', { action: 'prepare' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(ensureShopBookingSlug).toHaveBeenCalledWith(expect.anything(), 'shop-1');
    expect(body.bookingUrl).toBe('https://kersivo.test/book/fade-studio');
    expect(body.confirmed).toBe(false);
    expect(shopUpdate).not.toHaveBeenCalled();
  });

  it('confirm snapshots the exact canonical booking URL and timestamp', async () => {
    const confirmedAt = new Date('2026-10-05T12:00:00.000Z');
    shopFindUniqueOrThrow.mockImplementation(async () => ({
      googleBookingLinkConfirmedAt: confirmedAt,
      googleBookingLinkConfirmedUrl: 'https://kersivo.test/book/fade-studio',
    }));

    const res = await POST(ctx('POST', { action: 'confirm' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(shopUpdate).toHaveBeenCalledWith({
      where: { id: 'shop-1' },
      data: {
        googleBookingLinkConfirmedAt: expect.any(Date),
        googleBookingLinkConfirmedUrl: 'https://kersivo.test/book/fade-studio',
      },
    });
    expect(body).toMatchObject({
      bookingUrl: 'https://kersivo.test/book/fade-studio',
      confirmed: true,
      confirmedAt: confirmedAt.toISOString(),
    });
  });

  it('stops at PUBLIC_BOOKING capability before reading or mutating Google setup', async () => {
    requireAdminProductCapability.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'KERSIVO_UPGRADE_REQUIRED',
          requiredCapability: 'PUBLIC_BOOKING',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = await GET(ctx('GET'));

    expect(res.status).toBe(403);
    expect(shopFindUnique).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects preview/demo style access from mutating a real Google setup', async () => {
    requireAdminContext.mockResolvedValue({ ...access, via: 'preview' });

    const res = await POST(ctx('POST', { action: 'confirm' }));

    expect(res.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('requires shop.settings permission', async () => {
    requireAnyPermission.mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );

    const res = await GET(ctx('GET'));

    expect(res.status).toBe(403);
    expect(requireAdminProductCapability).not.toHaveBeenCalled();
  });
});
