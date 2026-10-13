import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailOutboundPurpose, EmailOutboundStatus, Prisma } from '@prisma/client';

const { tryDeliverOutboxEmail, captureOpsException } = vi.hoisted(() => ({
  tryDeliverOutboxEmail: vi.fn(async () => undefined),
  captureOpsException: vi.fn(),
}));

vi.mock('../db/client', () => ({ prisma: {} }));
vi.mock('../ops/sentry', () => ({ captureOpsException }));
vi.mock('./sender', () => ({
  isEmailDeliveryConfigured: () => true,
  sendRenderedEmail: vi.fn(),
}));
vi.mock('./outbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./outbox')>();
  return { ...actual, tryDeliverOutboxEmail };
});

import {
  INTERNAL_NOTIFICATION_ROLLOUT_KEY,
  RECONCILE_GRACE_MS,
  REGISTRATION_ORIGIN_KIND,
  recordProductionRegistrationOrigin,
  buildRegistrationNotificationEmail,
  buildStarterActivationNotificationEmail,
  enqueueRegistrationNotification,
  enqueueStarterActivationNotification,
  formatLondonDateTime,
  reconcileInternalSignupNotifications,
  registrationNotificationDedupeKey,
  starterActivationNotificationDedupeKey,
  starterPublicBookingUrl,
  type StarterActivationNotificationData,
} from './internalSignupNotifications';
import {
  KERSIVO_INTERNAL_NOTIFICATIONS_EMAIL,
  resolveInternalNotificationTarget,
} from './internalNotificationRecipient';

type UserRow = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  providers: string[];
  ownedShopId?: string | null;
  memberShopId?: string | null;
};
type ShopRow = {
  id: string;
  name: string;
  bookingSlug: string | null;
  townCity: string | null;
  freeBookingActivatedAt: Date | null;
  onboardingCompletedAt: Date | null;
  ownerUserId: string | null;
  barbers: number;
  services: number;
};
type OutboxRow = Record<string, unknown> & { id: string; dedupeKey: string | null };

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

function missingTable() {
  return new Prisma.PrismaClientKnownRequestError('Table does not exist', {
    code: 'P2021',
    clientVersion: '5.22.0',
  });
}

type LegalRow = {
  shopId: string;
  purpose: string;
  userId: string | null;
  email: string;
  acceptedAt: Date;
  meta?: Record<string, unknown> | null;
};
type OriginRow = { kind: string; subjectKey: string; createdAt: Date };

/** In-memory DB honouring the EmailOutbound.dedupeKey UNIQUE constraint. */
function fakeDb(
  options: { cutoff?: Date | null; rolloutTableMissing?: boolean; originTableMissing?: boolean } = {},
) {
  const users: UserRow[] = [];
  const shops: ShopRow[] = [];
  const legal: LegalRow[] = [];
  const origins: OriginRow[] = [];
  const emails: OutboxRow[] = [];
  const inRange = (value: Date, range?: { gte?: Date; lte?: Date; lt?: Date }) =>
    !range ||
    ((!range.gte || value >= range.gte) && (!range.lte || value <= range.lte) && (!range.lt || value < range.lt));
  const originGuard = () => {
    if (options.originTableMissing) throw missingTable();
  };
  let seq = 0;
  let raceOnNextCreate: OutboxRow | null = null;

  const shopById = (id: string | null | undefined) => shops.find((s) => s.id === id) ?? null;

  const insert = (data: Record<string, unknown>) => {
    if (raceOnNextCreate) {
      emails.push(raceOnNextCreate);
      raceOnNextCreate = null;
      throw uniqueViolation();
    }
    if (data.dedupeKey && emails.some((e) => e.dedupeKey === data.dedupeKey)) throw uniqueViolation();
    const row = { id: `out_${++seq}`, ...data } as OutboxRow;
    emails.push(row);
    return row;
  };

  const db = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const u = users.find((x) => x.id === where.id);
        if (!u) return null;
        const owned = shopById(u.ownedShopId);
        const member = shopById(u.memberShopId);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          createdAt: u.createdAt,
          accounts: u.providers.map((providerId) => ({ providerId })),
          ownedShop: owned ? { id: owned.id, name: owned.name } : null,
          shopMembers: member ? [{ shop: { id: member.id, name: member.name } }] : [],
        };
      }),
      findMany: vi.fn(
        async ({ where }: { where: { email?: { in: string[] }; createdAt?: { gte: Date; lte: Date } } }) =>
          users
            .filter((u) => (!where.email || where.email.in.includes(u.email)) && inRange(u.createdAt, where.createdAt))
            .map((u) => ({ id: u.id, email: u.email, createdAt: u.createdAt })),
      ),
    },
    internalNotificationOrigin: {
      findMany: vi.fn(
        async ({
          where,
          skip = 0,
          take,
        }: {
          where: { kind: string; createdAt: { gte: Date; lte: Date } };
          skip?: number;
          take: number;
        }) => {
          originGuard();
          return origins
            .filter((o) => o.kind === where.kind && inRange(o.createdAt, where.createdAt))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .slice(skip, skip + take)
            .map((o) => ({ subjectKey: o.subjectKey, createdAt: o.createdAt }));
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { kind_subjectKey: { kind: string; subjectKey: string } };
          create: OriginRow;
          update: Partial<OriginRow>;
        }) => {
          originGuard();
          const existing = origins.find(
            (o) => o.kind === where.kind_subjectKey.kind && o.subjectKey === where.kind_subjectKey.subjectKey,
          );
          if (existing) return Object.assign(existing, update);
          origins.push({ ...create });
          return create;
        },
      ),
      deleteMany: vi.fn(
        async ({ where }: { where: { kind?: string; subjectKey?: string; createdAt?: { lt: Date } } }) => {
          originGuard();
          const before = origins.length;
          for (let i = origins.length - 1; i >= 0; i -= 1) {
            const o = origins[i]!;
            const match =
              (!where.kind || o.kind === where.kind) &&
              (!where.subjectKey || o.subjectKey === where.subjectKey) &&
              inRange(o.createdAt, where.createdAt);
            if (match) origins.splice(i, 1);
          }
          return { count: before - origins.length };
        },
      ),
    },
    shopSettings: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const s = shopById(where.id);
        if (!s) return null;
        const owner = users.find((u) => u.id === s.ownerUserId);
        return {
          ...s,
          owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
        };
      }),
      findMany: vi.fn(
        async ({ where, take }: { where: { freeBookingActivatedAt: { gte: Date; lte: Date } }; take: number }) =>
          shops
            .filter(
              (s) =>
                s.freeBookingActivatedAt &&
                s.freeBookingActivatedAt >= where.freeBookingActivatedAt.gte &&
                s.freeBookingActivatedAt <= where.freeBookingActivatedAt.lte,
            )
            .slice(0, take)
            .map((s) => ({ id: s.id })),
      ),
    },
    legalAcceptance: {
      findFirst: vi.fn(async ({ where }: { where: { shopId: string; purpose: string } }) => {
        const row = legal.find((l) => l.shopId === where.shopId && l.purpose === where.purpose);
        return row ? { userId: row.userId, email: row.email } : null;
      }),
      findMany: vi.fn(
        async ({
          where,
          skip = 0,
          take,
        }: {
          where: {
            purpose: string;
            acceptedAt: { gte: Date; lte: Date };
            meta: { path: string[]; equals: string };
          };
          skip?: number;
          take: number;
        }) =>
          legal
            .filter(
              (l) =>
                l.purpose === where.purpose &&
                inRange(l.acceptedAt, where.acceptedAt) &&
                l.meta?.[where.meta.path[0]!] === where.meta.equals,
            )
            .sort((a, b) => a.acceptedAt.getTime() - b.acceptedAt.getTime())
            .slice(skip, skip + take)
            .map((l) => ({ shopId: l.shopId })),
      ),
    },
    barber: {
      count: vi.fn(async ({ where }: { where: { shopId: string } }) => shopById(where.shopId)?.barbers ?? 0),
    },
    service: {
      count: vi.fn(async ({ where }: { where: { shopId: string } }) => shopById(where.shopId)?.services ?? 0),
    },
    emailOutbound: {
      findUnique: vi.fn(async ({ where }: { where: { dedupeKey: string } }) =>
        emails.find((e) => e.dedupeKey === where.dedupeKey) ?? null,
      ),
      findMany: vi.fn(async ({ where }: { where: { dedupeKey: { in: string[] } } }) =>
        emails
          .filter((e) => e.dedupeKey && where.dedupeKey.in.includes(e.dedupeKey))
          .map((e) => ({ dedupeKey: e.dedupeKey })),
      ),
      upsert: vi.fn(async ({ where, create }: { where: { dedupeKey: string }; create: Record<string, unknown> }) => {
        const existing = emails.find((e) => e.dedupeKey === where.dedupeKey);
        if (existing && !raceOnNextCreate) return existing;
        return insert(create);
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => insert(data)),
    },
    internalNotificationRollout: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
        if (options.rolloutTableMissing) throw missingTable();
        if (where.key !== INTERNAL_NOTIFICATION_ROLLOUT_KEY || !options.cutoff) return null;
        return { enabledAt: options.cutoff };
      }),
    },
  };

  return {
    db: db as never,
    raw: db,
    users,
    shops,
    legal,
    origins,
    emails,
    raceNextCreate(row: OutboxRow) {
      raceOnNextCreate = row;
    },
  };
}

function setProduction() {
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('INTERNAL_NOTIFICATIONS_TEST_EMAIL', '');
}

const SAMPLE_SHOP: ShopRow = {
  id: 'shop_1',
  name: 'Fade Lab',
  bookingSlug: 'fade-lab',
  townCity: 'Leeds',
  freeBookingActivatedAt: new Date('2026-07-14T13:05:00.000Z'),
  onboardingCompletedAt: new Date('2026-07-14T12:50:00.000Z'),
  ownerUserId: 'user_1',
  barbers: 2,
  services: 5,
};

const SAMPLE_USER: UserRow = {
  id: 'user_1',
  name: 'Sam Owner',
  email: 'sam@example.co.uk',
  createdAt: new Date('2026-07-14T09:00:00.000Z'),
  providers: ['credential'],
  ownedShopId: 'shop_1',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PUBLIC_SITE_URL', 'https://kersivo.co.uk');
});

describe('resolveInternalNotificationTarget', () => {
  it('production always targets hello@kersivo.co.uk, never FROM_EMAIL or CONTACT_INBOX_EMAIL', () => {
    setProduction();
    vi.stubEnv('FROM_EMAIL', 'onboarding@resend.dev');
    vi.stubEnv('CONTACT_INBOX_EMAIL', 'someone@else.test');
    vi.stubEnv('INTERNAL_NOTIFICATIONS_TEST_EMAIL', 'dev@example.com');
    expect(resolveInternalNotificationTarget()).toEqual({
      mode: 'production',
      to: 'hello@kersivo.co.uk',
      subjectPrefix: '',
    });
    expect(KERSIVO_INTERNAL_NOTIFICATIONS_EMAIL).toBe('hello@kersivo.co.uk');
  });

  it('preview without a test inbox is suppressed', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('INTERNAL_NOTIFICATIONS_TEST_EMAIL', '');
    expect(resolveInternalNotificationTarget().mode).toBe('suppressed');
  });

  it('preview with a valid test inbox goes there with a [Preview] prefix; invalid values are ignored', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('INTERNAL_NOTIFICATIONS_TEST_EMAIL', 'Dev@Example.com');
    expect(resolveInternalNotificationTarget()).toEqual({
      mode: 'test',
      to: 'dev@example.com',
      subjectPrefix: '[Preview] ',
    });
    for (const bad of ['not-an-email', 'a@b.com, c@d.com', 'hello@kersivo.co.uk']) {
      vi.stubEnv('INTERNAL_NOTIFICATIONS_TEST_EMAIL', bad);
      expect(resolveInternalNotificationTarget().mode).toBe('suppressed');
    }
  });

  it('local development (no VERCEL_ENV) never reaches the production inbox', () => {
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('INTERNAL_NOTIFICATIONS_TEST_EMAIL', '');
    expect(resolveInternalNotificationTarget().mode).toBe('suppressed');
  });
});

describe('formatLondonDateTime', () => {
  it('renders BST in summer and GMT in winter', () => {
    const summer = formatLondonDateTime(new Date('2026-07-14T13:05:00.000Z'));
    expect(summer).toContain('14:05');
    expect(summer).toContain('BST');
    expect(summer).toContain('July 2026');
    const winter = formatLondonDateTime(new Date('2026-12-01T09:30:00.000Z'));
    expect(winter).toContain('09:30');
    expect(winter).toContain('GMT');
  });
});

describe('email builders', () => {
  const production = { mode: 'production', to: 'hello@kersivo.co.uk', subjectPrefix: '' } as const;

  it('registration email: exact subject, real fields, escaped content, no secrets', () => {
    const email = buildRegistrationNotificationEmail(
      {
        userId: 'user_1',
        name: '<script>alert(1)</script>',
        email: 'sam@example.co.uk',
        registeredAt: new Date('2026-07-14T13:05:00.000Z'),
        method: 'Email and password',
        shop: { id: 'shop_1', name: "Sam's <Barbershop>" },
      },
      production,
    );
    expect(email.to).toBe('hello@kersivo.co.uk');
    expect(email.subject).toBe('New KERSIVO registration — sam@example.co.uk');
    expect(email.html).toContain('New user registration');
    expect(email.html).toContain('Email and password');
    expect(email.html).toContain('user_1');
    expect(email.html).toContain('shop_1');
    expect(email.html).toContain('14:05');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('Sam&#39;s &lt;Barbershop&gt;');
    expect(email.html).not.toMatch(/password:|token|secret/i);
  });

  it('registration email omits unknown method/name and labels a missing shop', () => {
    const email = buildRegistrationNotificationEmail(
      {
        userId: 'user_2',
        name: null,
        email: 'invitee@example.com',
        registeredAt: new Date('2026-07-14T13:05:00.000Z'),
        method: null,
        shop: null,
      },
      production,
    );
    expect(email.html).not.toContain('Registration method');
    expect(email.html).not.toContain('>Name<');
    expect(email.html).toContain('Not provisioned yet');
  });

  const starterData: StarterActivationNotificationData = {
    shopId: 'shop_1',
    shopName: 'Fade & Co',
    bookingSlug: 'fade-co',
    townCity: 'Leeds',
    activatedAt: new Date('2026-07-14T13:05:00.000Z'),
    onboardingCompletedAt: null,
    owner: { userId: 'user_1', name: 'Sam Owner', email: 'sam@example.co.uk', source: 'owner' },
    activeBookableBarbers: 2,
    activeServices: 5,
  };

  it('starter email: exact subject, plan, owner, setup counts and the booking link', () => {
    const email = buildStarterActivationNotificationEmail(starterData, production, {
      siteUrl: 'https://kersivo.co.uk',
    });
    expect(email.to).toBe('hello@kersivo.co.uk');
    expect(email.subject).toBe('New KERSIVO Starter activation — Fade & Co');
    expect(email.replyTo).toBe('sam@example.co.uk');
    for (const text of [
      'KERSIVO Starter',
      '£0/month',
      'Successfully activated',
      'Fade &amp; Co',
      'shop_1',
      'Leeds',
      'Sam Owner',
      'sam@example.co.uk',
      'user_1',
      'Active bookable barbers',
      '14:05',
    ]) {
      expect(email.html).toContain(text);
    }
    expect(email.html).toContain('<a href="https://kersivo.co.uk/book/fade-co">https://kersivo.co.uk/book/fade-co</a>');
    expect(email.html).not.toContain('Onboarding completed at');
  });

  it('starter email without a slug renders no booking link', () => {
    const email = buildStarterActivationNotificationEmail({ ...starterData, bookingSlug: null }, production, {
      siteUrl: 'https://kersivo.co.uk',
    });
    expect(email.html).not.toContain('<a href=');
    expect(email.html).not.toContain('Public booking page');
  });

  it('starterPublicBookingUrl only returns a valid hosted URL', () => {
    expect(starterPublicBookingUrl({ id: 'shop_1', bookingSlug: 'fade-lab' }, 'https://kersivo.co.uk/')).toBe(
      'https://kersivo.co.uk/book/fade-lab',
    );
    expect(starterPublicBookingUrl({ id: 'shop_1', bookingSlug: null }, 'https://kersivo.co.uk')).toBeNull();
    expect(starterPublicBookingUrl({ id: 'shop_1', bookingSlug: 'x' }, 'not a url')).toBeNull();
  });
});

describe('enqueueRegistrationNotification', () => {
  it('new email/password user → one QUEUED row to hello@kersivo.co.uk, then best-effort delivery', async () => {
    setProduction();
    const f = fakeDb();
    f.shops.push({ ...SAMPLE_SHOP });
    f.users.push({ ...SAMPLE_USER });

    const result = await enqueueRegistrationNotification('user_1', { db: f.db });

    expect(result.status).toBe('enqueued');
    expect(f.emails).toHaveLength(1);
    const row = f.emails[0]!;
    expect(row).toMatchObject({
      shopId: null,
      purpose: EmailOutboundPurpose.USER_REGISTRATION_INTERNAL,
      status: EmailOutboundStatus.QUEUED,
      toEmail: 'hello@kersivo.co.uk',
      subject: 'New KERSIVO registration — sam@example.co.uk',
      dedupeKey: registrationNotificationDedupeKey('user_1'),
      nextAttemptAt: expect.any(Date),
    });
    expect((row.payload as { html: string }).html).toContain('Email and password');
    expect((row.payload as { html: string }).html).toContain('Fade Lab');
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith(row.id);
  });

  it('new Google OAuth user → one row labelled Google', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER, id: 'user_g', email: 'g@example.com', providers: ['google'], ownedShopId: null });

    await enqueueRegistrationNotification('user_g', { db: f.db });

    expect(f.emails).toHaveLength(1);
    expect((f.emails[0]!.payload as { html: string }).html).toContain('Google');
  });

  it('invited user without an owned shop is still notified, with no shop attached', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER, id: 'user_inv', email: 'invitee@example.com', ownedShopId: null });

    const result = await enqueueRegistrationNotification('user_inv', { db: f.db });

    expect(result.status).toBe('enqueued');
    expect(f.emails[0]).toMatchObject({ shopId: null });
    expect((f.emails[0]!.payload as { html: string }).html).toContain('Not provisioned yet');
  });

  it('repeated processing never creates a second row or a second send', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER });

    const first = await enqueueRegistrationNotification('user_1', { db: f.db });
    const second = await enqueueRegistrationNotification('user_1', { db: f.db });

    expect(first.status).toBe('enqueued');
    expect(second.status).toBe('exists');
    expect(f.emails).toHaveLength(1);
    expect(tryDeliverOutboxEmail).toHaveBeenCalledTimes(1);
  });

  it('concurrent processing: the racing loser resolves to the winner row (P2002), no duplicate', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER });
    f.raceNextCreate({ id: 'out_winner', dedupeKey: registrationNotificationDedupeKey('user_1') });

    const result = await enqueueRegistrationNotification('user_1', { db: f.db });

    expect(result).toEqual({ status: 'exists', outboxId: 'out_winner' });
    expect(f.emails).toHaveLength(1);
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
  });

  it('a send failure leaves the row QUEUED with its payload, ready for the cron retry', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER });
    tryDeliverOutboxEmail.mockResolvedValueOnce(undefined);

    const result = await enqueueRegistrationNotification('user_1', { db: f.db });

    expect(result.status).toBe('enqueued');
    expect(f.emails[0]).toMatchObject({ status: EmailOutboundStatus.QUEUED, attempts: 0 });
    expect(f.emails[0]!.payload).toBeTruthy();
  });

  it('enqueue failures (e.g. migration not yet applied) never throw and are reported safely', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER });
    f.raw.emailOutbound.create.mockRejectedValueOnce(new Error('invalid input value for enum'));

    const result = await enqueueRegistrationNotification('user_1', { db: f.db });

    expect(result).toEqual({ status: 'error' });
    expect(captureOpsException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ route: 'email.internal.registration', tags: { userId: 'user_1' } }),
    );
  });

  it('preview records a SUPPRESSED row (no payload, never sent) so production never re-sends it', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('INTERNAL_NOTIFICATIONS_TEST_EMAIL', '');
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER });

    const result = await enqueueRegistrationNotification('user_1', { db: f.db });

    expect(result.status).toBe('suppressed');
    expect(f.emails[0]).toMatchObject({
      status: EmailOutboundStatus.SUPPRESSED,
      payload: Prisma.DbNull,
      nextAttemptAt: null,
      provider: 'suppressed',
    });
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
  });

  it('unknown user is skipped without a row', async () => {
    setProduction();
    const f = fakeDb();
    expect(await enqueueRegistrationNotification('ghost', { db: f.db })).toEqual({
      status: 'skipped',
      reason: 'NOT_FOUND',
    });
    expect(f.emails).toHaveLength(0);
  });
});

describe('enqueueStarterActivationNotification', () => {
  it('activated shop → one row with owner email, shop info, activation time and booking URL', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER });
    f.shops.push({ ...SAMPLE_SHOP });

    const result = await enqueueStarterActivationNotification('shop_1', { db: f.db });

    expect(result.status).toBe('enqueued');
    expect(f.emails).toHaveLength(1);
    const row = f.emails[0]!;
    expect(row).toMatchObject({
      shopId: 'shop_1',
      purpose: EmailOutboundPurpose.STARTER_ACTIVATION_INTERNAL,
      toEmail: 'hello@kersivo.co.uk',
      subject: 'New KERSIVO Starter activation — Fade Lab',
      dedupeKey: starterActivationNotificationDedupeKey('shop_1'),
    });
    const html = (row.payload as { html: string }).html;
    expect(html).toContain('sam@example.co.uk');
    expect(html).toContain('Sam Owner');
    expect(html).toContain('https://kersivo.co.uk/book/fade-lab');
    expect(html).toContain('Leeds');
    expect(html).toContain('14:05');
    expect(html).toMatch(/Active bookable barbers<\/th><td[^>]*>2</);
    expect(html).toMatch(/Active services<\/th><td[^>]*>5</);
  });

  it('a shop that never activated Starter gets no notification', async () => {
    setProduction();
    const f = fakeDb();
    f.shops.push({ ...SAMPLE_SHOP, freeBookingActivatedAt: null });
    expect(await enqueueStarterActivationNotification('shop_1', { db: f.db })).toEqual({
      status: 'skipped',
      reason: 'NOT_ACTIVATED',
    });
    expect(f.emails).toHaveLength(0);
  });

  it('falls back to the activating user from the Terms record when the shop has no owner', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER, id: 'user_act', name: 'Alex Activator', email: 'alex@example.com' });
    f.shops.push({ ...SAMPLE_SHOP, ownerUserId: null });
    f.legal.push({
      shopId: 'shop_1',
      purpose: 'FREE_BOOKING_ACTIVATION',
      userId: 'user_act',
      email: 'alex@example.com',
      acceptedAt: new Date(),
    });

    await enqueueStarterActivationNotification('shop_1', { db: f.db });

    const html = (f.emails[0]!.payload as { html: string }).html;
    expect(html).toContain('Activated by');
    expect(html).toContain('alex@example.com');
  });

  it('duplicate or concurrent calls create one row only', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER });
    f.shops.push({ ...SAMPLE_SHOP });

    const results = await Promise.all([
      enqueueStarterActivationNotification('shop_1', { db: f.db }),
      enqueueStarterActivationNotification('shop_1', { db: f.db }),
    ]);

    expect(f.emails).toHaveLength(1);
    expect(results.map((r) => r.status).sort()).toEqual(['enqueued', 'exists']);
  });
});

describe('Production-origin registration markers', () => {
  it('only the Production runtime writes a marker (normalised email); Preview and dev never do', async () => {
    const f = fakeDb();
    vi.stubEnv('VERCEL_ENV', 'preview');
    await recordProductionRegistrationOrigin('Sam@Example.co.uk', f.db);
    vi.stubEnv('VERCEL_ENV', '');
    await recordProductionRegistrationOrigin('Sam@Example.co.uk', f.db);
    expect(f.origins).toHaveLength(0);

    setProduction();
    await recordProductionRegistrationOrigin(' Sam@Example.co.uk ', f.db);
    expect(f.origins).toEqual([
      { kind: REGISTRATION_ORIGIN_KIND, subjectKey: 'sam@example.co.uk', createdAt: expect.any(Date) },
    ]);
  });

  it('a marker write failure never throws (sign-up is never blocked) and is reported', async () => {
    setProduction();
    const f = fakeDb({ originTableMissing: true });
    await expect(recordProductionRegistrationOrigin('sam@example.co.uk', f.db)).resolves.toBeUndefined();
    expect(captureOpsException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ route: 'email.internal.registration_origin' }),
    );
  });

  it('the marker is cleared once the registration notification is queued', async () => {
    setProduction();
    const f = fakeDb();
    f.users.push({ ...SAMPLE_USER });
    f.origins.push({ kind: REGISTRATION_ORIGIN_KIND, subjectKey: 'sam@example.co.uk', createdAt: new Date() });

    await enqueueRegistrationNotification('user_1', { db: f.db });

    expect(f.origins).toHaveLength(0);
  });

  it('Preview before the migration: missing marker table does not break the notification path', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('INTERNAL_NOTIFICATIONS_TEST_EMAIL', '');
    const f = fakeDb({ originTableMissing: true });
    f.users.push({ ...SAMPLE_USER });

    const result = await enqueueRegistrationNotification('user_1', { db: f.db });

    expect(result.status).toBe('suppressed');
  });
});

describe('reconcileInternalSignupNotifications', () => {
  const now = new Date('2026-07-20T12:00:00.000Z');
  const cutoff = new Date('2026-07-01T00:00:00.000Z');

  /** A registration made by the Production runtime (marker written just before the insert). */
  function prodUser(f: ReturnType<typeof fakeDb>, id: string, createdAt: Date) {
    const email = `${id}@example.com`;
    f.users.push({ ...SAMPLE_USER, id, email, ownedShopId: null, createdAt });
    f.origins.push({ kind: REGISTRATION_ORIGIN_KIND, subjectKey: email, createdAt: new Date(createdAt.getTime() - 500) });
  }

  /** A Starter activation; `env` is what the activation transaction stamped in the legal record meta. */
  function starter(f: ReturnType<typeof fakeDb>, id: string, at: Date, env: string | null) {
    f.shops.push({ ...SAMPLE_SHOP, id, ownerUserId: null, freeBookingActivatedAt: at });
    f.legal.push({
      shopId: id,
      purpose: 'FREE_BOOKING_ACTIVATION',
      userId: null,
      email: `${id}@example.com`,
      acceptedAt: at,
      meta: env === null ? { bookingSlug: 'x' } : { bookingSlug: 'x', deploymentEnvironment: env },
    });
  }

  it('never runs outside the Production runtime (a Preview cron must not write rows for Production events)', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const f = fakeDb({ cutoff });
    prodUser(f, 'u1', new Date('2026-07-20T10:00:00.000Z'));
    starter(f, 's1', new Date('2026-07-20T10:00:00.000Z'), 'production');

    const result = await reconcileInternalSignupNotifications(now, { db: f.db });

    expect(result.enabled).toBe(false);
    expect(f.emails).toHaveLength(0);
  });

  it('is disabled (no-op) before the migration: missing rollout table or row', async () => {
    setProduction();
    for (const f of [fakeDb({ rolloutTableMissing: true }), fakeDb({ cutoff: null })]) {
      prodUser(f, 'u1', new Date('2026-07-20T10:00:00.000Z'));
      const result = await reconcileInternalSignupNotifications(now, { db: f.db });
      expect(result.enabled).toBe(false);
      expect(f.emails).toHaveLength(0);
    }
  });

  it('SHARED DB: Preview-origin events with no outbox row are NEVER notified', async () => {
    setProduction();
    const f = fakeDb({ cutoff });
    const at = new Date('2026-07-20T10:00:00.000Z');
    // Old Preview deployment: user row only, no marker, no outbox row.
    f.users.push({ ...SAMPLE_USER, id: 'preview_user', email: 'preview@example.com', ownedShopId: null, createdAt: at });
    // Old Preview deployment (legacy meta), new Preview deployment ('preview'), and no legal record at all.
    starter(f, 'old_preview_shop', at, null);
    starter(f, 'new_preview_shop', at, 'preview');
    f.shops.push({ ...SAMPLE_SHOP, id: 'no_legal_shop', freeBookingActivatedAt: at });

    const result = await reconcileInternalSignupNotifications(now, { db: f.db });

    expect(result.enabled).toBe(true);
    expect(result.registrations.candidates).toBe(0);
    expect(result.starterActivations.candidates).toBe(0);
    expect(f.emails).toHaveLength(0);
  });

  it('a marker only vouches for a user created right after it (no cross-environment email reuse)', async () => {
    setProduction();
    const f = fakeDb({ cutoff });
    f.users.push({
      ...SAMPLE_USER,
      id: 'late_user',
      email: 'late@example.com',
      ownedShopId: null,
      createdAt: new Date('2026-07-20T11:00:00.000Z'),
    });
    f.origins.push({ kind: REGISTRATION_ORIGIN_KIND, subjectKey: 'late@example.com', createdAt: new Date('2026-07-20T09:00:00.000Z') });

    await reconcileInternalSignupNotifications(now, { db: f.db });

    expect(f.emails).toHaveLength(0);
  });

  it('recovers missing Production-origin events, skips existing ones, leaves delivery to the drain, idempotently', async () => {
    setProduction();
    const f = fakeDb({ cutoff });
    prodUser(f, 'u1', new Date('2026-07-20T09:00:00.000Z'));
    prodUser(f, 'u2', new Date('2026-07-20T10:00:00.000Z'));
    starter(f, 's1', new Date('2026-07-20T11:00:00.000Z'), 'production');
    f.emails.push({ id: 'out_existing', dedupeKey: registrationNotificationDedupeKey('u1') });

    const result = await reconcileInternalSignupNotifications(now, { db: f.db });

    expect(result.registrations).toEqual({ candidates: 1, enqueued: 1, errors: 0 });
    expect(result.starterActivations).toEqual({ candidates: 1, enqueued: 1, errors: 0 });
    expect(f.emails.map((e) => e.dedupeKey).sort()).toEqual(
      [
        registrationNotificationDedupeKey('u1'),
        registrationNotificationDedupeKey('u2'),
        starterActivationNotificationDedupeKey('s1'),
      ].sort(),
    );
    expect(f.emails.find((e) => e.dedupeKey === registrationNotificationDedupeKey('u2'))).toMatchObject({
      toEmail: 'hello@kersivo.co.uk',
      status: EmailOutboundStatus.QUEUED,
    });
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();

    const again = await reconcileInternalSignupNotifications(now, { db: f.db });
    expect(again.registrations.candidates).toBe(0);
    expect(again.starterActivations.candidates).toBe(0);
    expect(f.emails).toHaveLength(3);
  });

  it('never backfills events from before the rollout cutoff', async () => {
    setProduction();
    const f = fakeDb({ cutoff: new Date('2026-07-19T00:00:00.000Z') });
    prodUser(f, 'u_old', new Date('2026-07-18T23:59:00.000Z'));
    starter(f, 's_old', new Date('2026-07-18T10:00:00.000Z'), 'production');

    await reconcileInternalSignupNotifications(now, { db: f.db });

    expect(f.emails).toHaveLength(0);
  });

  it('respects the grace period, the 7-day lookback and the per-run limit', async () => {
    setProduction();
    const f = fakeDb({ cutoff: new Date('2026-01-01T00:00:00.000Z') });
    prodUser(f, 'fresh', new Date(now.getTime() - RECONCILE_GRACE_MS + 1000));
    prodUser(f, 'too_old', new Date('2026-07-10T00:00:00.000Z'));
    prodUser(f, 'a', new Date('2026-07-19T00:00:00.000Z'));
    prodUser(f, 'b', new Date('2026-07-19T01:00:00.000Z'));

    const result = await reconcileInternalSignupNotifications(now, { db: f.db, limit: 1 });

    expect(result.registrations.enqueued).toBe(1);
    expect(f.emails.map((e) => e.dedupeKey)).toEqual([registrationNotificationDedupeKey('a')]);

    await reconcileInternalSignupNotifications(now, { db: f.db, limit: 1 });
    expect(f.emails.map((e) => e.dedupeKey)).toEqual([
      registrationNotificationDedupeKey('a'),
      registrationNotificationDedupeKey('b'),
    ]);
  });

  it('hundreds of already-notified records never hide a newer missing one (paged scan)', async () => {
    setProduction();
    const f = fakeDb({ cutoff });
    const base = new Date('2026-07-15T00:00:00.000Z').getTime();
    for (let i = 0; i < 450; i += 1) {
      const id = `done_${i}`;
      starter(f, id, new Date(base + i * 60_000), 'production');
      f.emails.push({ id: `out_${id}`, dedupeKey: starterActivationNotificationDedupeKey(id) });
    }
    starter(f, 'newest_missing', new Date('2026-07-20T11:00:00.000Z'), 'production');

    const result = await reconcileInternalSignupNotifications(now, { db: f.db });

    expect(result.starterActivations).toEqual({ candidates: 1, enqueued: 1, errors: 0 });
    expect(f.emails.some((e) => e.dedupeKey === starterActivationNotificationDedupeKey('newest_missing'))).toBe(true);
  });

  it('an item that keeps failing does not block newer missing ones', async () => {
    setProduction();
    const f = fakeDb({ cutoff });
    starter(f, 'broken', new Date('2026-07-19T00:00:00.000Z'), 'production');
    starter(f, 'healthy', new Date('2026-07-19T01:00:00.000Z'), 'production');
    const original = f.raw.shopSettings.findUnique.getMockImplementation()!;
    f.raw.shopSettings.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === 'broken') throw new Error('transient');
      return original(args);
    });

    const result = await reconcileInternalSignupNotifications(now, { db: f.db });

    expect(result.starterActivations).toEqual({ candidates: 2, enqueued: 1, errors: 1 });
    expect(f.emails.map((e) => e.dedupeKey)).toEqual([starterActivationNotificationDedupeKey('healthy')]);
  });

  it('purges registration markers older than the reconciliation window (bounded PII retention)', async () => {
    setProduction();
    const f = fakeDb({ cutoff });
    f.origins.push(
      { kind: REGISTRATION_ORIGIN_KIND, subjectKey: 'stale@example.com', createdAt: new Date('2026-07-01T00:00:00.000Z') },
      { kind: REGISTRATION_ORIGIN_KIND, subjectKey: 'recent@example.com', createdAt: new Date('2026-07-19T00:00:00.000Z') },
    );

    await reconcileInternalSignupNotifications(now, { db: f.db });

    expect(f.origins.map((o) => o.subjectKey)).toEqual(['recent@example.com']);
  });
});

