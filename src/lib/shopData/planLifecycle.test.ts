/**
 * Proof for the site data contract (docs/site-data-contract.md):
 * 1. The Starter/preview hub and the paid dashboard write the SAME canonical records.
 * 2. Data entered on Starter is complete after upgrading to Full — no copy, no re-entry.
 * 3. Downgrading or lapsing never deletes data; the plan only changes what is published.
 *
 * Uses an in-memory Prisma stand-in so the real write helpers and the real loader run end to end.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KersivoProductState } from '@/lib/shop/kersivoAccess';

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let idSeq = 0;

function table(name: string): Row[] {
  tables[name] ??= [];
  return tables[name];
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const v = value as Row;
      if ('in' in v) return (v.in as unknown[]).includes(row[key]);
      return true; // relation filters are not needed by the code under test
    }
    return row[key] === value;
  });
}

function sortRows(rows: Row[], orderBy?: Row | Row[]): Row[] {
  const orders = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  return [...rows].sort((a, b) => {
    for (const o of orders) {
      const [field, dir] = Object.entries(o)[0] as [string, 'asc' | 'desc'];
      const av = a[field] as number | string;
      const bv = b[field] as number | string;
      if (av === bv) continue;
      return (av < bv ? -1 : 1) * (dir === 'desc' ? -1 : 1);
    }
    return 0;
  });
}

function withRelations(name: string, row: Row): Row {
  if (name === 'shopSettings') {
    return {
      ...row,
      publicProfile: table('shopPublicProfile').find((p) => p.shopId === row.id) ?? null,
      fullBookingDestination: null,
    };
  }
  if (name === 'barber') {
    return { ...row, barberServices: table('barberService').filter((bs) => bs.barberId === row.id) };
  }
  return row;
}

function model(name: string) {
  const now = () => new Date(Date.UTC(2026, 10, 4, 10, 0, idSeq++));
  return {
    findUnique: async ({ where }: { where: Row }) => {
      const row = table(name).find((r) => matches(r, where));
      return row ? withRelations(name, row) : null;
    },
    findFirst: async ({ where }: { where?: Row } = {}) => table(name).find((r) => matches(r, where)) ?? null,
    findMany: async ({ where, orderBy }: { where?: Row; orderBy?: Row | Row[] } = {}) =>
      sortRows(table(name).filter((r) => matches(r, where)), orderBy).map((r) => withRelations(name, r)),
    count: async ({ where }: { where?: Row } = {}) => table(name).filter((r) => matches(r, where)).length,
    create: async ({ data }: { data: Row }) => {
      const row = { id: `${name}_${idSeq++}`, createdAt: now(), updatedAt: now(), ...data };
      table(name).push(row);
      return row;
    },
    createMany: async ({ data }: { data: Row[] }) => {
      for (const d of data) table(name).push({ id: `${name}_${idSeq++}`, createdAt: now(), updatedAt: now(), ...d });
      return { count: data.length };
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = table(name).find((r) => matches(r, where));
      if (!row) throw new Error(`${name} not found`);
      const { events: _events, ...rest } = data;
      Object.assign(row, rest, { updatedAt: now() });
      return row;
    },
    upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
      const row = table(name).find((r) => matches(r, where));
      if (row) {
        Object.assign(row, update, { updatedAt: now() });
        return row;
      }
      const created = { id: `${name}_${idSeq++}`, status: 'DRAFT', createdAt: now(), updatedAt: now(), ...create };
      table(name).push(created);
      return created;
    },
    deleteMany: async ({ where }: { where: Row }) => {
      const keep = table(name).filter((r) => !matches(r, where));
      const count = table(name).length - keep.length;
      tables[name] = keep;
      return { count };
    },
  };
}

const MODELS = [
  'shopSettings',
  'shopPublicProfile',
  'shopOpeningHours',
  'shopOpeningException',
  'barber',
  'barberService',
  'service',
  'product',
  'clientOnboarding',
  'previewRequest',
  'previewRequestEvent',
] as const;

const fakePrisma: Record<string, unknown> = Object.fromEntries(MODELS.map((m) => [m, model(m)]));
fakePrisma.$transaction = async (fn: (tx: unknown) => unknown) => fn(fakePrisma);
fakePrisma.$executeRaw = async () => 0;
fakePrisma.$queryRaw = async () => [];

vi.mock('@/lib/db/client', () => ({ prisma: fakePrisma }));

const plan = { state: 'FREE_BOOKING' as KersivoProductState };
vi.mock('@/lib/shop/kersivoAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shop/kersivoAccess')>();
  return { ...actual, loadKersivoAccess: async () => actual.accessForState(plan.state) };
});
vi.mock('@/lib/setup/shopPublicBookingGate', () => ({
  shopAcceptsPublicBookings: async () => plan.state !== 'SETUP',
}));
vi.mock('@/lib/adminHub/ownerEditEvents', () => ({ recordDebouncedPreviewRequestEvent: async () => undefined }));
vi.mock('@/lib/freePreview/hubFilesNotify', () => ({ maybeNotifyOpsOfHubFiles: async () => undefined }));
// The hub "Add to your website" endpoints run for real; only the cookie/session lookup is stubbed.
vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    enforceHubDetailsRate: async () => null,
    resolveHubApiContext: async () => ({
      ok: true,
      ctx: {
        request: { id: 'req_1', draftShopId: 'shop_lifecycle' },
        state: { stage: 'designing', capabilities: { canEditDetails: true } },
        isOperator: false,
      },
    }),
  };
});

const { saveClientOnboardingDraft } = await import('@/lib/admin/clientOnboarding/service');
const { saveHubDetails } = await import('@/lib/freePreview/hubDetails');
const { replaceShopOpeningHours } = await import('@/lib/admin/shopOpeningHours');
const { loadSiteDataForShop } = await import('@/lib/siteData/getSiteData');
const { handlePublicSiteData } = await import('@/lib/siteData/api');
const { HUB_ADMIN_API_ALLOWLIST } = await import('@/lib/adminHub/hubAdminAccess');
const { createHubOpeningHoursHandlers, createHubProfileHandlers } = await import('@/lib/previewHub/handlers/shopSetup');
const { cookieSourceOf } = await import('@/lib/freePreview/hubApi');
const { defaultOpeningWeek } = await import('@/lib/shopData/openingHours');

const SHOP_ID = 'shop_lifecycle';

function seedShop() {
  for (const m of MODELS) tables[m] = [];
  table('shopSettings').push({
    id: SHOP_ID,
    name: 'Lifecycle Barbers',
    townCity: null,
    logoUrl: null,
    timezone: 'Europe/London',
    bookingSlug: 'lifecycle-barbers',
    purgeStartedAt: null,
    publicActivityPaused: false,
    shopPaidAt: new Date('2026-11-01T00:00:00Z'),
    smsRemindersEnabled: true,
    retailEnabled: true,
    stripeConnectAccountId: 'acct_test',
    stripeConnectChargesEnabled: true,
  });
  table('previewRequest').push({
    id: 'req_1',
    draftShopId: SHOP_ID,
    shopName: 'Lifecycle Barbers',
    brandColoursSentAt: null,
  });
}

/** What an owner enters on Starter, through the same handlers the dashboard uses. */
async function enterStarterData() {
  await replaceShopOpeningHours(SHOP_ID, [
    { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 2, active: true, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 3, active: false, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 4, active: true, startTime: '10:00', endTime: '20:00' },
    { dayOfWeek: 5, active: true, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 6, active: true, startTime: '08:00', endTime: '16:00' },
    { dayOfWeek: 7, active: false, startTime: '09:00', endTime: '18:00' },
  ]);
  table('service').push(
    { id: 'svc_cut', shopId: SHOP_ID, name: 'Haircut', category: 'Haircuts', description: null, durationMinutes: 30, pricePence: 2000, priceFrom: false, isActive: true, featured: false, displayOrder: 0, createdAt: new Date(1) },
    { id: 'svc_beard', shopId: SHOP_ID, name: 'Beard trim', category: 'Beards', description: null, durationMinutes: 15, pricePence: 1000, priceFrom: true, isActive: true, featured: false, displayOrder: 1, createdAt: new Date(2) },
  );
  table('barber').push({ id: 'bar_1', shopId: SHOP_ID, name: 'Jo', title: 'Barber', bio: 'Classic cuts.', avatarUrl: null, active: true, showOnWebsite: true, sortOrder: 0, createdAt: new Date(1) });
  table('barberService').push({ barberId: 'bar_1', serviceId: 'svc_cut' }, { barberId: 'bar_1', serviceId: 'svc_beard' });
  table('product').push({ id: 'prd_1', shopId: SHOP_ID, name: 'Clay', description: null, imageUrl: null, pricePence: 1500, inStock: true, active: true, sortOrder: 0, createdAt: new Date(1) });
}

function snapshotStoredData() {
  return JSON.stringify(
    ['shopPublicProfile', 'shopOpeningHours', 'barber', 'barberService', 'service', 'product'].map((t) =>
      table(t).map(({ updatedAt: _u, ...rest }) => rest),
    ),
  );
}

describe('hub and dashboard share one canonical record', () => {
  beforeEach(seedShop);

  it('hub details and the launch wizard write the same ShopPublicProfile row', async () => {
    await saveHubDetails({
      requestId: 'req_1',
      patch: { aboutText: 'Written in the hub.', instagramUrl: 'https://www.instagram.com/lifecycle/' },
      recordOwnerEvent: false,
    });
    expect(table('shopPublicProfile')).toHaveLength(1);

    const wizard = await saveClientOnboardingDraft(SHOP_ID, {
      shopDescription: 'Edited in the dashboard wizard.',
      addressLine1: '2 Example Road',
      postcode: 'm1 1ae',
      publicPhone: '0161 000 0000',
      townCity: 'Manchester',
    } as never);
    expect(wizard).toMatchObject({ ok: true });

    expect(table('shopPublicProfile')).toHaveLength(1);
    const site = await loadSiteDataForShop(SHOP_ID);
    expect(site?.business.description).toBe('Edited in the dashboard wizard.');
    expect(site?.business.socialLinks.map((l) => l.url)).toEqual(['https://www.instagram.com/lifecycle/']);
    expect(site?.location.address.formatted).toBe('2 Example Road, Manchester, M1 1AE');
  });

  it('the hub is routed to the same admin handlers as the paid dashboard for team and services', () => {
    const paths = HUB_ADMIN_API_ALLOWLIST.map((e: { method: string; path: string }) => `${e.method} ${e.path}`);
    expect(paths).toEqual(
      expect.arrayContaining(['POST /api/admin/services', 'PATCH /api/admin/services/:id', 'POST /api/admin/barbers']),
    );
  });
});

describe('hub setup flow (Add to your website) writes the canonical records', () => {
  beforeEach(seedShop);

  function hubCall(method: 'PUT' | 'PATCH', path: string, body: unknown) {
    return {
      request: new Request(`http://localhost/api/admin-hub/${path}`, {
        method,
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      params: {},
    } as never;
  }

  it('hours and business details saved in the hub are what the Full site and dashboard read after upgrade', async () => {
    plan.state = 'FREE_BOOKING';
    const hours = createHubOpeningHoursHandlers(cookieSourceOf);
    const profile = createHubProfileHandlers(cookieSourceOf);

    const week = defaultOpeningWeek().map((day) => (day.dayOfWeek === 6 ? { ...day, opens: '08:00', closes: '16:00' } : day));
    const putRes = await hours.PUT(hubCall('PUT', 'opening-hours', { days: week }));
    expect(putRes.status).toBe(200);
    expect(await putRes.json()).toMatchObject({ ok: true, saved: true });

    const patchRes = await profile.PATCH(
      hubCall('PATCH', 'profile', { addressLine1: '2 Example Road', postcode: 'M1 1AE', phone: '0161 496 0000' }),
    );
    expect(patchRes.status).toBe(200);

    // Same rows the dashboard's settings page edits (ShopOpeningHours) and the launch wizard edits (ShopPublicProfile).
    expect(table('shopOpeningHours').filter((r) => r.shopId === SHOP_ID)).toHaveLength(7);
    expect(table('shopPublicProfile')).toHaveLength(1);
    const stored = snapshotStoredData();

    const starter = (await loadSiteDataForShop(SHOP_ID))!;
    plan.state = 'FULL_KERSIVO';
    const full = (await loadSiteDataForShop(SHOP_ID))!;
    expect(full.openingHours).toEqual(starter.openingHours);
    expect(full.location.address.formatted).toContain('2 Example Road');
    expect(JSON.stringify(full)).toContain('0161 496 0000');
    expect(JSON.stringify(full.openingHours)).toContain('16:00');
    expect(snapshotStoredData()).toBe(stored);
  });

  it('refuses to save a week with every day closed', async () => {
    const hours = createHubOpeningHoursHandlers(cookieSourceOf);
    const closed = defaultOpeningWeek().map((day) => ({ ...day, isOpen: false }));
    const res = await hours.PUT(hubCall('PUT', 'opening-hours', { days: closed }));
    expect(res.status).toBe(400);
    expect(table('shopOpeningHours')).toHaveLength(0);
  });

  it('rejects fields the hub does not edit', async () => {
    const profile = createHubProfileHandlers(cookieSourceOf);
    const res = await profile.PATCH(hubCall('PATCH', 'profile', { description: 'Not via this route.' }));
    expect(res.status).toBe(400);
    expect(table('shopPublicProfile')).toHaveLength(0);
  });
});

describe('plan changes never change stored data', () => {
  beforeEach(seedShop);

  it('Starter → Full → Starter → lapsed keeps every record; only publishing changes', async () => {
    plan.state = 'FREE_BOOKING';
    await enterStarterData();
    await saveHubDetails({ requestId: 'req_1', patch: { aboutText: 'Est. 2020.' }, recordOwnerEvent: false });
    const stored = snapshotStoredData();

    // Starter: data complete, branded site not published, retail hidden.
    const starter = (await loadSiteDataForShop(SHOP_ID))!;
    expect(starter.planFeatures).toMatchObject({ plan: 'starter', brandedSite: false, retail: false });
    expect(starter.services.all).toHaveLength(2);
    expect(starter.team).toHaveLength(1);
    expect(starter.products).toEqual([]);
    const starterRes = await handlePublicSiteData('lifecycle-barbers', new URL('https://x.test'), {
      getSiteData: async () => starter,
    });
    expect(starterRes.status).toBe(404);

    // Upgrade: nothing re-entered, nothing copied.
    plan.state = 'FULL_KERSIVO';
    const full = (await loadSiteDataForShop(SHOP_ID))!;
    expect(full.planFeatures).toMatchObject({ plan: 'full', brandedSite: true, retail: true });
    expect(full.services).toEqual(starter.services);
    expect(full.team).toEqual(starter.team);
    expect(full.openingHours).toEqual(starter.openingHours);
    expect(full.business.description).toBe('Est. 2020.');
    expect(full.products.map((p) => p.name)).toEqual(['Clay']);
    const fullRes = await handlePublicSiteData('lifecycle-barbers', new URL('https://x.test'), {
      getSiteData: async () => full,
    });
    expect(fullRes.status).toBe(200);
    expect(snapshotStoredData()).toBe(stored);

    // Downgrade to Starter, then lapse entirely: data still in the store.
    plan.state = 'FREE_BOOKING';
    const back = (await loadSiteDataForShop(SHOP_ID))!;
    expect(back.products).toEqual([]);
    plan.state = 'SETUP';
    const lapsed = (await loadSiteDataForShop(SHOP_ID))!;
    expect(lapsed.planFeatures.brandedSite).toBe(false);
    expect(snapshotStoredData()).toBe(stored);
    expect(table('product')).toHaveLength(1);

    // Re-subscribe: everything is back exactly as it was.
    plan.state = 'FULL_KERSIVO';
    const again = (await loadSiteDataForShop(SHOP_ID))!;
    expect({ ...again, generatedAt: '' }).toEqual({ ...full, generatedAt: '' });
  });
});
