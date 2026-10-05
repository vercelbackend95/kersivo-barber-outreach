import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminPermissionAndCapability = vi.fn();
const shopFindUnique = vi.fn();
const shopUpdate = vi.fn();
const prismaTransaction = vi.fn();
const ensureShopBookingSlug = vi.fn();
const loadKersivoAccess = vi.fn();

vi.mock('@/lib/admin/productCapability', () => ({
  requireAdminPermissionAndCapability: (...args: unknown[]) =>
    requireAdminPermissionAndCapability(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => shopFindUnique(...args),
      update: (...args: unknown[]) => shopUpdate(...args),
    },
    $transaction: (...args: unknown[]) => prismaTransaction(...args),
  },
}));

vi.mock('@/lib/booking/bookingSlug', () => ({
  ensureShopBookingSlug: (...args: unknown[]) => ensureShopBookingSlug(...args),
}));

vi.mock('@/lib/shop/kersivoAccess', () => ({
  loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.test',
}));

const loadFullBookingDestinationForState = vi.fn();
vi.mock('@/lib/shop/fullBookingDestination', () => ({
  loadFullBookingDestinationForState: (...args: unknown[]) =>
    loadFullBookingDestinationForState(...args),
}));

import { GET, PATCH } from './google-booking';

const access = {
  shopId: 'shop-1',
  userId: 'owner-1',
  via: 'session' as const,
  role: 'OWNER' as const,
};

let shop = {
  id: 'shop-1',
  bookingSlug: 'fade-room' as string | null,
  googleBookingLinkStatus: 'NOT_SET',
  googleBookingConfirmedUrl: null as string | null,
  googleBookingStatusUpdatedAt: null as Date | null,
};

const OWN_DOMAIN = 'https://fade-room.co.uk/book';
const HOSTED = 'https://kersivo.test/book/fade-room';
let destination: { shopId: string; status: string; url: string } | null = null;

function onFull() {
  loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO', capabilities: ['GOOGLE_BOOKING_SETUP'] });
}

function ctx(method = 'GET', body?: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/barbershop-settings/google-booking', {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
    url: new URL('http://localhost/api/admin/barbershop-settings/google-booking'),
  } as unknown as APIContext;
}

describe('Google booking settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shop = {
      id: 'shop-1',
      bookingSlug: 'fade-room',
      googleBookingLinkStatus: 'NOT_SET',
      googleBookingConfirmedUrl: null,
      googleBookingStatusUpdatedAt: null,
    };
    destination = null;
    loadFullBookingDestinationForState.mockImplementation(async (shopId: string, state: string) =>
      state === 'FULL_KERSIVO' && destination?.shopId === shopId ? { ...destination } : null,
    );
    requireAdminPermissionAndCapability.mockResolvedValue(access);
    loadKersivoAccess.mockResolvedValue({
      state: 'FREE_BOOKING',
      capabilities: ['GOOGLE_BOOKING_SETUP'],
    });
    shopFindUnique.mockImplementation(async () => ({ ...shop }));
    ensureShopBookingSlug.mockResolvedValue('allocated-slug');
    prismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ __tx: true }),
    );
    shopUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      shop = { ...shop, ...data } as typeof shop;
      return { ...shop };
    });
  });

  it('requires shop.settings plus GOOGLE_BOOKING_SETUP', async () => {
    const res = await GET(ctx());

    expect(res.status).toBe(200);
    expect(requireAdminPermissionAndCapability).toHaveBeenCalledWith(
      expect.anything(),
      'shop.settings',
      'GOOGLE_BOOKING_SETUP',
    );
  });

  it('returns the authoritative Starter booking URL and Not set status', async () => {
    const res = await GET(ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      bookingUrl: 'https://kersivo.test/book/fade-room',
      destinationSource: 'starter_hosted',
      status: 'NOT_SET',
      requiresUpdate: false,
      googleBusinessProfileUrl: 'https://business.google.com/',
    });
    expect(body.bookingUrl).not.toContain('/q/');
  });

  it('allocates a stable booking slug for an older active shop before exposing Google setup', async () => {
    shop.bookingSlug = null;

    const res = await GET(ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(prismaTransaction).toHaveBeenCalledTimes(1);
    expect(ensureShopBookingSlug).toHaveBeenCalledWith(
      expect.objectContaining({ __tx: true }),
      'shop-1',
    );
    expect(body.bookingUrl).toBe('https://kersivo.test/book/allocated-slug');
    expect(body.bookingUrl).not.toContain('/q/');
  });

  it('marks setup started without claiming Google was updated', async () => {
    const res = await PATCH(ctx('PATCH', { action: 'START_SETUP' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(shop.googleBookingLinkStatus).toBe('SETUP_STARTED');
    expect(shop.googleBookingConfirmedUrl).toBeNull();
    expect(body.status).toBe('SETUP_STARTED');
  });

  it('confirms only the current authoritative URL', async () => {
    const res = await PATCH(ctx('PATCH', { action: 'CONFIRM_CURRENT_URL' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(shop.googleBookingLinkStatus).toBe('MERCHANT_CONFIRMED');
    expect(shop.googleBookingConfirmedUrl).toBe('https://kersivo.test/book/fade-room');
    expect(body.status).toBe('MERCHANT_CONFIRMED');
    expect(body.requiresUpdate).toBe(false);
  });

  it('surfaces update required after the authoritative URL changes', async () => {
    shop.googleBookingLinkStatus = 'MERCHANT_CONFIRMED';
    shop.googleBookingConfirmedUrl = 'https://kersivo.test/book/old-link';

    const res = await GET(ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('UPDATE_REQUIRED');
    expect(body.requiresUpdate).toBe(true);
    expect(body.confirmedUrl).toBe('https://kersivo.test/book/old-link');
    expect(body.bookingUrl).toBe('https://kersivo.test/book/fade-room');
  });

  it('does not expose setup before a product with the capability is active', async () => {
    requireAdminPermissionAndCapability.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'KERSIVO_UPGRADE_REQUIRED',
          requiredCapability: 'GOOGLE_BOOKING_SETUP',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = await GET(ctx());

    expect(res.status).toBe(403);
    expect(shopFindUnique).not.toHaveBeenCalled();
  });

  it('37: Full without a verified destination exposes the hosted fallback', async () => {
    onFull();
    const body = await (await GET(ctx())).json();
    expect(body).toMatchObject({ bookingUrl: HOSTED, destinationSource: 'full_hosted_fallback' });
  });

  it('38 + 39: Full with a verified destination exposes the exact own-domain URL, never /q/', async () => {
    onFull();
    destination = { shopId: 'shop-1', status: 'VERIFIED_LIVE', url: OWN_DOMAIN };
    const body = await (await GET(ctx())).json();
    expect(body).toMatchObject({ bookingUrl: OWN_DOMAIN, destinationSource: 'full_verified_own_domain' });
    expect(body.bookingUrl).not.toContain('/q/');
  });

  it('40 + 43: merchant-confirmed hosted URL + newly verified Full destination → UPDATE_REQUIRED, Google untouched', async () => {
    onFull();
    shop.googleBookingLinkStatus = 'MERCHANT_CONFIRMED';
    shop.googleBookingConfirmedUrl = HOSTED;
    expect((await (await GET(ctx())).json()).status).toBe('MERCHANT_CONFIRMED');

    destination = { shopId: 'shop-1', status: 'VERIFIED_LIVE', url: OWN_DOMAIN };
    const body = await (await GET(ctx())).json();
    expect(body).toMatchObject({
      status: 'UPDATE_REQUIRED',
      requiresUpdate: true,
      confirmedUrl: HOSTED,
      bookingUrl: OWN_DOMAIN,
    });
    // Nothing is written on read: KERSIVO never claims it changed Google.
    expect(shopUpdate).not.toHaveBeenCalled();
    expect(shop.googleBookingConfirmedUrl).toBe(HOSTED);
  });

  it('41: merchant-confirmed own-domain URL + Full → Starter → UPDATE_REQUIRED (hosted again)', async () => {
    destination = { shopId: 'shop-1', status: 'VERIFIED_LIVE', url: OWN_DOMAIN };
    shop.googleBookingLinkStatus = 'MERCHANT_CONFIRMED';
    shop.googleBookingConfirmedUrl = OWN_DOMAIN;
    const body = await (await GET(ctx())).json();
    expect(body).toMatchObject({
      status: 'UPDATE_REQUIRED',
      bookingUrl: HOSTED,
      destinationSource: 'starter_hosted',
    });
  });

  it('42: invalidated Full destination → hosted fallback and UPDATE_REQUIRED for the old own-domain confirmation', async () => {
    onFull();
    destination = { shopId: 'shop-1', status: 'INVALIDATED', url: OWN_DOMAIN };
    shop.googleBookingLinkStatus = 'MERCHANT_CONFIRMED';
    shop.googleBookingConfirmedUrl = OWN_DOMAIN;
    const body = await (await GET(ctx())).json();
    expect(body).toMatchObject({
      status: 'UPDATE_REQUIRED',
      bookingUrl: HOSTED,
      destinationSource: 'full_hosted_fallback',
    });
  });

  it('confirming after verification stores exactly the own-domain URL the merchant pasted', async () => {
    onFull();
    destination = { shopId: 'shop-1', status: 'VERIFIED_LIVE', url: OWN_DOMAIN };
    const body = await (await PATCH(ctx('PATCH', { action: 'CONFIRM_CURRENT_URL' }))).json();
    expect(shop.googleBookingConfirmedUrl).toBe(OWN_DOMAIN);
    expect(body.status).toBe('MERCHANT_CONFIRMED');
  });

  it('a departed shop (SETUP) exposes no Google booking destination even with a stored record', async () => {
    loadKersivoAccess.mockResolvedValue({ state: 'SETUP', capabilities: [], departure: 'WINDING_DOWN' });
    destination = { shopId: 'shop-1', status: 'VERIFIED_LIVE', url: OWN_DOMAIN };
    const res = await GET(ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('GOOGLE_BOOKING_NOT_AVAILABLE');
  });

  it('rejects arbitrary status payloads', async () => {
    const res = await PATCH(ctx('PATCH', { action: 'MERCHANT_CONFIRMED' }));

    expect(res.status).toBe(400);
    expect(shopUpdate).not.toHaveBeenCalled();
  });
});
