import { EmailOutboundPurpose, Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { TERMS_ACCEPTANCE_PURPOSES } from '../legal/termsVersion';
import { opsLog, opsLogError } from '../ops/opsLog';
import { captureOpsException } from '../ops/sentry';
import { getPublicSiteUrl } from '../setup/siteUrl';
import { countActiveBookableBarbers } from '../shop/freeBookableBarbers';
import { resolvePublicBookingDestination } from '../shop/publicBookingDestination';
import {
  resolveDeploymentEnvironment,
  resolveInternalNotificationTarget,
  type InternalNotificationTarget,
} from './internalNotificationRecipient';
import { enqueueEmailOnce, tryDeliverOutboxEmail } from './outbox';

type Db = typeof prisma;

export const INTERNAL_NOTIFICATION_ROLLOUT_KEY = 'INTERNAL_SIGNUP_STARTER_NOTIFICATIONS';
export const RECONCILE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** Leave fresh events to the post-commit fast path before reconciliation steps in. */
export const RECONCILE_GRACE_MS = 5 * 60 * 1000;
export const RECONCILE_DEFAULT_LIMIT = 50;
const RECONCILE_CANDIDATE_SCAN = 200;

export function registrationNotificationDedupeKey(userId: string): string {
  return `internal:user-registration:${userId}`;
}

export function starterActivationNotificationDedupeKey(shopId: string): string {
  return `internal:starter-activation:${shopId}`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LONDON_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
});

export function formatLondonDateTime(date: Date): string {
  return LONDON_FORMAT.format(date);
}

type Row = [label: string, value: string | number | null | undefined, href?: string | null];

function renderSection(title: string, rows: Row[]): string {
  const visible = rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (visible.length === 0) return '';
  const body = visible
    .map(([label, value, href]) => {
      const text = escapeHtml(String(value));
      const cell = href ? `<a href="${escapeHtml(href)}">${text}</a>` : text;
      return `<tr><th align="left" style="padding:4px 16px 4px 0;font-weight:600;vertical-align:top">${escapeHtml(label)}</th><td style="padding:4px 0">${cell}</td></tr>`;
    })
    .join('');
  return `<h3 style="margin:20px 0 8px;font-size:15px">${escapeHtml(title)}</h3><table cellspacing="0" cellpadding="0">${body}</table>`;
}

function renderEmail(intro: string, sections: string[]): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5">
<p>${intro}</p>
${sections.filter(Boolean).join('\n')}
<p style="margin-top:24px;color:#666;font-size:12px">Internal KERSIVO operational notification. Do not forward.</p>
</div>`;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export type RegistrationNotificationData = {
  userId: string;
  name: string | null;
  email: string;
  registeredAt: Date;
  /** Only set when derived from the user's Account rows. */
  method: string | null;
  shop: { id: string; name: string } | null;
};

const PROVIDER_LABELS: Record<string, string> = {
  credential: 'Email and password',
  google: 'Google',
};

export function registrationMethodFromProviders(providerIds: string[]): string | null {
  const labels = [...new Set(providerIds.map((id) => PROVIDER_LABELS[id]).filter(Boolean))];
  return labels.length > 0 ? labels.join(' + ') : null;
}

export async function loadRegistrationNotificationData(
  userId: string,
  db: Db = prisma,
): Promise<RegistrationNotificationData | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      accounts: { select: { providerId: true } },
      ownedShop: { select: { id: true, name: true } },
      shopMembers: {
        select: { shop: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!user) return null;
  const shop = user.ownedShop ?? user.shopMembers[0]?.shop ?? null;
  return {
    userId: user.id,
    name: user.name?.trim() || null,
    email: user.email,
    registeredAt: user.createdAt,
    method: registrationMethodFromProviders(user.accounts.map((a) => a.providerId)),
    shop: shop ? { id: shop.id, name: shop.name } : null,
  };
}

export function buildRegistrationNotificationEmail(
  data: RegistrationNotificationData,
  target: InternalNotificationTarget,
): { to: string; subject: string; html: string } {
  const html = renderEmail('A new user account has been registered on KERSIVO.', [
    renderSection('Registration', [
      ['Event', 'New user registration'],
      ['Registered at', `${formatLondonDateTime(data.registeredAt)} (Europe/London)`],
      ['Registration method', data.method],
    ]),
    renderSection('User', [
      ['Name', data.name],
      ['Email', data.email],
      ['User ID', data.userId],
    ]),
    renderSection(
      'Shop',
      data.shop
        ? [
            ['Shop name', data.shop.name],
            ['Shop ID', data.shop.id],
          ]
        : [['Shop', 'Not provisioned yet (for example an invited team member)']],
    ),
  ]);
  return {
    to: target.to,
    subject: `${target.subjectPrefix}New KERSIVO registration — ${data.email}`,
    html,
  };
}

// ---------------------------------------------------------------------------
// Starter activation
// ---------------------------------------------------------------------------

export type StarterActivationNotificationData = {
  shopId: string;
  shopName: string;
  bookingSlug: string | null;
  townCity: string | null;
  activatedAt: Date;
  onboardingCompletedAt: Date | null;
  owner: { userId: string | null; name: string | null; email: string | null; source: 'owner' | 'activator' } | null;
  activeBookableBarbers: number;
  activeServices: number;
};

export async function loadStarterActivationNotificationData(
  shopId: string,
  db: Db = prisma,
): Promise<StarterActivationNotificationData | null> {
  const shop = await db.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      bookingSlug: true,
      townCity: true,
      freeBookingActivatedAt: true,
      onboardingCompletedAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!shop?.freeBookingActivatedAt) return null;

  let owner: StarterActivationNotificationData['owner'] = shop.owner
    ? {
        userId: shop.owner.id,
        name: shop.owner.name?.trim() || null,
        email: shop.owner.email,
        source: 'owner',
      }
    : null;

  if (!owner) {
    const acceptance = await db.legalAcceptance.findFirst({
      where: { shopId, purpose: TERMS_ACCEPTANCE_PURPOSES.FREE_BOOKING_ACTIVATION },
      orderBy: { acceptedAt: 'asc' },
      select: { userId: true, email: true },
    });
    if (acceptance) {
      const activator = acceptance.userId
        ? await db.user.findUnique({ where: { id: acceptance.userId }, select: { name: true } })
        : null;
      owner = {
        userId: acceptance.userId,
        name: activator?.name?.trim() || null,
        email: acceptance.email,
        source: 'activator',
      };
    }
  }

  const [activeBookableBarbers, activeServices] = await Promise.all([
    countActiveBookableBarbers(shopId, db),
    db.service.count({ where: { shopId, isActive: true } }),
  ]);

  return {
    shopId: shop.id,
    shopName: shop.name,
    bookingSlug: shop.bookingSlug,
    townCity: shop.townCity?.trim() || null,
    activatedAt: shop.freeBookingActivatedAt,
    onboardingCompletedAt: shop.onboardingCompletedAt,
    owner,
    activeBookableBarbers,
    activeServices,
  };
}

/** Absolute Starter booking URL, only when the shop has a stable slug and the base URL is valid. */
export function starterPublicBookingUrl(
  shop: { id: string; bookingSlug: string | null },
  siteUrl: string = getPublicSiteUrl(),
): string | null {
  if (!shop.bookingSlug) return null;
  const destination = resolvePublicBookingDestination({ state: 'FREE_BOOKING', shop });
  if (destination.kind !== 'hosted') return null;
  try {
    const url = new URL(destination.path, `${siteUrl.replace(/\/$/, '')}/`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildStarterActivationNotificationEmail(
  data: StarterActivationNotificationData,
  target: InternalNotificationTarget,
  options: { siteUrl?: string } = {},
): { to: string; subject: string; html: string; replyTo?: string } {
  const bookingUrl = starterPublicBookingUrl(
    { id: data.shopId, bookingSlug: data.bookingSlug },
    options.siteUrl,
  );
  const ownerLabel = data.owner?.source === 'activator' ? 'Activated by' : 'Owner';

  const html = renderEmail(
    `<strong>${escapeHtml(data.shopName)}</strong> has activated KERSIVO Starter.`,
    [
      renderSection('Plan', [
        ['Plan', 'KERSIVO Starter'],
        ['Price', '£0/month'],
        ['Activated at', `${formatLondonDateTime(data.activatedAt)} (Europe/London)`],
        ['Activation status', 'Successfully activated'],
      ]),
      renderSection('Barbershop', [
        ['Barbershop name', data.shopName],
        ['Shop ID', data.shopId],
        ['Booking slug', data.bookingSlug],
        ['Public booking page', bookingUrl, bookingUrl],
        ['Town / city', data.townCity],
      ]),
      renderSection(
        ownerLabel,
        data.owner
          ? [
              [`${ownerLabel} name`, data.owner.name],
              [`${ownerLabel} email`, data.owner.email],
              ['User ID', data.owner.userId],
            ]
          : [[ownerLabel, 'Not available']],
      ),
      renderSection('Setup', [
        ['Active bookable barbers', data.activeBookableBarbers],
        ['Active services', data.activeServices],
        [
          'Onboarding completed at',
          data.onboardingCompletedAt
            ? `${formatLondonDateTime(data.onboardingCompletedAt)} (Europe/London)`
            : null,
        ],
      ]),
    ],
  );

  return {
    to: target.to,
    subject: `${target.subjectPrefix}New KERSIVO Starter activation — ${data.shopName}`,
    html,
    ...(data.owner?.email ? { replyTo: data.owner.email } : {}),
  };
}

// ---------------------------------------------------------------------------
// Enqueue (post-commit, never throws)
// ---------------------------------------------------------------------------

export type InternalNotificationEnqueueResult =
  | { status: 'enqueued' | 'suppressed'; outboxId: string }
  | { status: 'exists'; outboxId: string }
  | { status: 'skipped'; reason: 'NOT_FOUND' | 'NOT_ACTIVATED' }
  | { status: 'error' };

type EnqueueOptions = {
  db?: Db;
  /** Best-effort immediate send after enqueue. Reconciliation leaves delivery to the cron drain. */
  deliver?: boolean;
};

async function enqueueInternal(params: {
  kind: 'registration' | 'starter';
  ids: Record<string, string>;
  shopId: string | null;
  purpose: EmailOutboundPurpose;
  dedupeKey: string;
  target: InternalNotificationTarget;
  email: { to: string; subject: string; html: string; replyTo?: string };
  options: EnqueueOptions;
}): Promise<InternalNotificationEnqueueResult> {
  const suppressed = params.target.mode === 'suppressed';
  const { row, created } = await enqueueEmailOnce(
    {
      shopId: params.shopId,
      purpose: params.purpose,
      to: params.email.to,
      subject: params.email.subject,
      html: params.email.html,
      replyTo: params.email.replyTo,
      dedupeKey: params.dedupeKey,
      suppressed,
    },
    params.options.db ?? prisma,
  );

  if (!created) return { status: 'exists', outboxId: row.id };

  opsLog('email.internal', `${params.kind}_notification_enqueued`, {
    ...params.ids,
    emailOutboundId: row.id,
    mode: params.target.mode,
  });

  if (suppressed) return { status: 'suppressed', outboxId: row.id };
  if (params.options.deliver !== false) await tryDeliverOutboxEmail(row.id);
  return { status: 'enqueued', outboxId: row.id };
}

function reportEnqueueFailure(kind: 'registration' | 'starter', ids: Record<string, string>, error: unknown) {
  opsLogError('email.internal', `${kind}_notification_enqueue_failed`, error, ids);
  captureOpsException(error, {
    route: `email.internal.${kind}`,
    shopId: ids.shopId,
    opsAlert: true,
    tags: ids,
  });
}

/** Queue the internal "new registration" email for a newly created user. Never throws. */
export async function enqueueRegistrationNotification(
  userId: string,
  options: EnqueueOptions = {},
): Promise<InternalNotificationEnqueueResult> {
  const ids = { userId };
  try {
    const data = await loadRegistrationNotificationData(userId, options.db);
    if (!data) {
      opsLog('email.internal', 'registration_notification_skipped', { ...ids, reason: 'NOT_FOUND' });
      return { status: 'skipped', reason: 'NOT_FOUND' };
    }
    const target = resolveInternalNotificationTarget();
    const result = await enqueueInternal({
      kind: 'registration',
      ids,
      // Not tied to a shop: invitees may have none, and shop purge must not drop this row.
      shopId: null,
      purpose: EmailOutboundPurpose.USER_REGISTRATION_INTERNAL,
      dedupeKey: registrationNotificationDedupeKey(userId),
      target,
      email: buildRegistrationNotificationEmail(data, target),
      options,
    });
    await clearRegistrationOrigin(data.email, options.db ?? prisma);
    return result;
  } catch (error) {
    reportEnqueueFailure('registration', ids, error);
    return { status: 'error' };
  }
}

// ---------------------------------------------------------------------------
// Production-origin markers (shared Production/Preview database)
// ---------------------------------------------------------------------------

export const REGISTRATION_ORIGIN_KIND = 'USER_REGISTRATION';

export function normaliseRegistrationEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Better Auth `user.create.before`: record that THIS Production runtime is about to create a user
 * with this email. Old or new Preview deployments never write it, so reconciliation can recover a
 * missed registration only when Production positively created it. Never throws, never blocks sign-up.
 */
export async function recordProductionRegistrationOrigin(
  email: string | null | undefined,
  db: Db = prisma,
): Promise<void> {
  if (resolveDeploymentEnvironment() !== 'production') return;
  const subjectKey = email ? normaliseRegistrationEmail(email) : '';
  if (!subjectKey) return;
  const now = new Date();
  try {
    await db.internalNotificationOrigin.upsert({
      where: { kind_subjectKey: { kind: REGISTRATION_ORIGIN_KIND, subjectKey } },
      create: { kind: REGISTRATION_ORIGIN_KIND, subjectKey, createdAt: now },
      update: { createdAt: now },
    });
  } catch (error) {
    opsLogError('email.internal', 'registration_origin_record_failed', error);
    captureOpsException(error, { route: 'email.internal.registration_origin', opsAlert: true });
  }
}

async function clearRegistrationOrigin(email: string, db: Db): Promise<void> {
  try {
    await db.internalNotificationOrigin.deleteMany({
      where: { kind: REGISTRATION_ORIGIN_KIND, subjectKey: normaliseRegistrationEmail(email) },
    });
  } catch (error) {
    // Missing table before the migration (Preview) is expected; the purge removes leftovers.
    if (!isMissingTable(error)) {
      opsLogError('email.internal', 'registration_origin_clear_failed', error);
    }
  }
}

/** Queue the internal "new Starter activation" email for a shop. Never throws. */
export async function enqueueStarterActivationNotification(
  shopId: string,
  options: EnqueueOptions = {},
): Promise<InternalNotificationEnqueueResult> {
  const ids = { shopId };
  try {
    const data = await loadStarterActivationNotificationData(shopId, options.db);
    if (!data) {
      opsLog('email.internal', 'starter_notification_skipped', { ...ids, reason: 'NOT_ACTIVATED' });
      return { status: 'skipped', reason: 'NOT_ACTIVATED' };
    }
    const target = resolveInternalNotificationTarget();
    return await enqueueInternal({
      kind: 'starter',
      ids,
      shopId,
      purpose: EmailOutboundPurpose.STARTER_ACTIVATION_INTERNAL,
      dedupeKey: starterActivationNotificationDedupeKey(shopId),
      target,
      email: buildStarterActivationNotificationEmail(data, target),
      options,
    });
  } catch (error) {
    reportEnqueueFailure('starter', ids, error);
    return { status: 'error' };
  }
}

// ---------------------------------------------------------------------------
// Reconciliation (cron safety net)
// ---------------------------------------------------------------------------

export type ReconcileInternalNotificationsResult = {
  enabled: boolean;
  registrations: { candidates: number; enqueued: number; errors: number };
  starterActivations: { candidates: number; enqueued: number; errors: number };
};

function isMissingTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

async function loadRolloutCutoff(db: Db): Promise<Date | null> {
  try {
    const row = await db.internalNotificationRollout.findUnique({
      where: { key: INTERNAL_NOTIFICATION_ROLLOUT_KEY },
      select: { enabledAt: true },
    });
    return row?.enabledAt ?? null;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

async function missingDedupeKeys(db: Db, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const existing = await db.emailOutbound.findMany({
    where: { dedupeKey: { in: keys } },
    select: { dedupeKey: true },
  });
  const present = new Set(existing.map((row) => row.dedupeKey));
  return new Set(keys.filter((key) => !present.has(key)));
}

/** A Production origin marker is written immediately before the user insert. */
const ORIGIN_MATCH_BEFORE_MS = 60 * 1000;
const ORIGIN_MATCH_AFTER_MS = 10 * 60 * 1000;
const RECONCILE_MAX_PAGES = 20;
const RECONCILE_MAX_ERRORS_PER_KIND = 10;

/**
 * Production-origin registrations in the window that still have no outbox row, oldest first.
 * Users without a Production marker (any Preview deployment, old or new) are never candidates.
 */
async function missingProductionRegistrations(
  db: Db,
  since: Date,
  until: Date,
  needed: number,
): Promise<string[]> {
  const out: string[] = [];
  for (let page = 0; page < RECONCILE_MAX_PAGES && out.length < needed; page += 1) {
    const markers = await db.internalNotificationOrigin.findMany({
      where: {
        kind: REGISTRATION_ORIGIN_KIND,
        createdAt: { gte: new Date(since.getTime() - ORIGIN_MATCH_AFTER_MS), lte: until },
      },
      orderBy: { createdAt: 'asc' },
      skip: page * RECONCILE_CANDIDATE_SCAN,
      take: RECONCILE_CANDIDATE_SCAN,
      select: { subjectKey: true, createdAt: true },
    });
    if (markers.length === 0) break;

    const users = await db.user.findMany({
      where: {
        email: { in: markers.map((m) => m.subjectKey) },
        createdAt: { gte: since, lte: until },
      },
      select: { id: true, email: true, createdAt: true },
    });
    const byEmail = new Map(users.map((u) => [normaliseRegistrationEmail(u.email), u]));
    const matched = markers
      .map((marker) => {
        const user = byEmail.get(marker.subjectKey);
        if (!user) return null;
        const delta = user.createdAt.getTime() - marker.createdAt.getTime();
        return delta >= -ORIGIN_MATCH_BEFORE_MS && delta <= ORIGIN_MATCH_AFTER_MS ? user.id : null;
      })
      .filter((id): id is string => Boolean(id));

    const missing = await missingDedupeKeys(db, matched.map(registrationNotificationDedupeKey));
    for (const id of matched) {
      if (missing.has(registrationNotificationDedupeKey(id)) && !out.includes(id)) out.push(id);
    }
    if (markers.length < RECONCILE_CANDIDATE_SCAN) break;
  }
  return out;
}

/**
 * Production-origin Starter activations in the window that still have no outbox row, oldest first.
 * The marker is the FREE_BOOKING_ACTIVATION legal record written in the activation transaction with
 * meta.deploymentEnvironment = 'production'. Older code and Preview never write that value.
 */
async function missingProductionStarterActivations(
  db: Db,
  since: Date,
  until: Date,
  needed: number,
): Promise<string[]> {
  const out: string[] = [];
  for (let page = 0; page < RECONCILE_MAX_PAGES && out.length < needed; page += 1) {
    const acceptances = await db.legalAcceptance.findMany({
      where: {
        purpose: TERMS_ACCEPTANCE_PURPOSES.FREE_BOOKING_ACTIVATION,
        acceptedAt: { gte: since, lte: until },
        shopId: { not: null },
        meta: { path: ['deploymentEnvironment'], equals: 'production' },
      },
      orderBy: { acceptedAt: 'asc' },
      skip: page * RECONCILE_CANDIDATE_SCAN,
      take: RECONCILE_CANDIDATE_SCAN,
      select: { shopId: true },
    });
    if (acceptances.length === 0) break;

    const shopIds = [...new Set(acceptances.map((a) => a.shopId).filter((id): id is string => Boolean(id)))];
    const missing = await missingDedupeKeys(db, shopIds.map(starterActivationNotificationDedupeKey));
    for (const id of shopIds) {
      if (missing.has(starterActivationNotificationDedupeKey(id)) && !out.includes(id)) out.push(id);
    }
    if (acceptances.length < RECONCILE_CANDIDATE_SCAN) break;
  }
  return out;
}

async function purgeStaleRegistrationOrigins(db: Db, now: Date): Promise<void> {
  await db.internalNotificationOrigin.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - RECONCILE_LOOKBACK_MS - 24 * 60 * 60 * 1000) } },
  });
}

async function enqueueBatch(
  ids: string[],
  limit: number,
  enqueue: (id: string) => Promise<InternalNotificationEnqueueResult>,
  bucket: { candidates: number; enqueued: number; errors: number },
): Promise<void> {
  bucket.candidates = ids.length;
  for (const id of ids) {
    if (bucket.enqueued >= limit) break;
    // A systemic failure (e.g. DB down) stops the run; isolated failures don't block newer items.
    if (bucket.errors >= RECONCILE_MAX_ERRORS_PER_KIND) break;
    const outcome = await enqueue(id);
    if (outcome.status === 'enqueued' || outcome.status === 'suppressed') bucket.enqueued += 1;
    else if (outcome.status === 'error') bucket.errors += 1;
  }
}

/**
 * Recover notifications whose post-commit enqueue never happened (crash, transient DB error).
 *
 * Production and Preview share one database, so a missing outbox row never implies a Production
 * event. Only events carrying a positive Production-origin marker are recovered, and only by the
 * Production runtime. Bounded by the migration-stamped rollout cutoff, a lookback window and a
 * per-run limit, so historical registrations/activations are never backfilled.
 */
export async function reconcileInternalSignupNotifications(
  now: Date = new Date(),
  options: { db?: Db; limit?: number } = {},
): Promise<ReconcileInternalNotificationsResult> {
  const db = options.db ?? prisma;
  const limit = Math.max(1, Math.min(options.limit ?? RECONCILE_DEFAULT_LIMIT, 200));
  const result: ReconcileInternalNotificationsResult = {
    enabled: false,
    registrations: { candidates: 0, enqueued: 0, errors: 0 },
    starterActivations: { candidates: 0, enqueued: 0, errors: 0 },
  };

  if (resolveDeploymentEnvironment() !== 'production') {
    // A Preview/dev runtime must never write rows (even SUPPRESSED ones) for Production events.
    opsLog('email.internal', 'reconcile_disabled', { reason: 'NOT_PRODUCTION_RUNTIME' });
    return result;
  }

  const cutoff = await loadRolloutCutoff(db);
  if (!cutoff) {
    opsLog('email.internal', 'reconcile_disabled', { reason: 'ROLLOUT_CUTOFF_MISSING' });
    return result;
  }
  result.enabled = true;

  await purgeStaleRegistrationOrigins(db, now);

  const since = new Date(Math.max(cutoff.getTime(), now.getTime() - RECONCILE_LOOKBACK_MS));
  const until = new Date(now.getTime() - RECONCILE_GRACE_MS);
  if (since >= until) return result;

  const needed = limit + RECONCILE_MAX_ERRORS_PER_KIND;
  const userIds = await missingProductionRegistrations(db, since, until, needed);
  await enqueueBatch(
    userIds,
    limit,
    (id) => enqueueRegistrationNotification(id, { db, deliver: false }),
    result.registrations,
  );

  const shopIds = await missingProductionStarterActivations(db, since, until, needed);
  await enqueueBatch(
    shopIds,
    limit,
    (id) => enqueueStarterActivationNotification(id, { db, deliver: false }),
    result.starterActivations,
  );

  if (result.registrations.candidates > 0 || result.starterActivations.candidates > 0) {
    opsLog('email.internal', 'reconcile_recovered', {
      registrations: result.registrations.enqueued,
      registrationErrors: result.registrations.errors,
      starterActivations: result.starterActivations.enqueued,
      starterErrors: result.starterActivations.errors,
    });
  }

  return result;
}
