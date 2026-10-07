import {
  EmailOutboundPurpose,
  Prisma,
  QrKitFulfilmentStatus,
  ShopQrPlacement,
  type QrKitFulfilment,
} from '@prisma/client';
import { prisma } from '../db/client';
import { ensureShopBookingSlug } from '../booking/bookingSlug';
import { enqueueEmail } from '../email/outbox';
import {
  buildQrKitRequestAcknowledgementEmail,
  buildQrKitRequestInternalEmail,
} from '../email/qrKitEmails';
import { TERMS_ACCEPTANCE_PURPOSES } from '../legal/termsVersion';
import { hasKersivoCapability, loadKersivoAccess, type KersivoProductState } from '../shop/kersivoAccess';
import { ensureShopQrCodesInTx, type ShopQrCodeRow } from './shopQrCodes';

type Db = typeof prisma;
type Tx = Prisma.TransactionClient;

export const QR_KIT_REQUEST_RECEIVED_MESSAGE =
  "Your QR Kit request has been received. We'll verify the shop details before it goes to print.";

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type QrKitShopFacts = {
  productState: KersivoProductState;
  publicBookingCapable: boolean;
  shopName: string;
  bookingSlug: string | null;
  emailVerified: boolean;
  activeBookableBarbers: number;
  activeServices: number;
  hasWorkingHours: boolean;
  termsAccepted: boolean;
};

export type QrKitShopBlocker =
  | 'NOT_STARTER'
  | 'SHOP_NAME_MISSING'
  | 'EMAIL_NOT_VERIFIED'
  | 'NO_BOOKABLE_BARBER'
  | 'NO_ACTIVE_SERVICE'
  | 'NO_WORKING_HOURS'
  | 'PUBLIC_BOOKING_UNAVAILABLE'
  | 'TERMS_NOT_ACCEPTED';

export const QR_KIT_BLOCKER_MESSAGES: Record<QrKitShopBlocker, string> = {
  NOT_STARTER: 'The QR Kit is available to shops on KERSIVO Starter.',
  SHOP_NAME_MISSING: 'Add your shop name in settings.',
  EMAIL_NOT_VERIFIED: 'Verify your email address first.',
  NO_BOOKABLE_BARBER: 'Add at least one barber taking online bookings.',
  NO_ACTIVE_SERVICE: 'Add at least one active service.',
  NO_WORKING_HOURS: 'Set your opening hours and barber working hours.',
  PUBLIC_BOOKING_UNAVAILABLE: 'Your public booking page is not live yet.',
  TERMS_NOT_ACCEPTED: 'Accept the KERSIVO Terms first.',
};

/** Server-side shop eligibility. Deliberately no Stripe, Companies House, reviews or first booking. */
export function evaluateQrKitShopEligibility(facts: QrKitShopFacts): QrKitShopBlocker[] {
  const blockers: QrKitShopBlocker[] = [];
  if (facts.productState !== 'FREE_BOOKING') blockers.push('NOT_STARTER');
  if (!facts.shopName.trim()) blockers.push('SHOP_NAME_MISSING');
  if (!facts.emailVerified) blockers.push('EMAIL_NOT_VERIFIED');
  if (facts.activeBookableBarbers < 1) blockers.push('NO_BOOKABLE_BARBER');
  if (facts.activeServices < 1) blockers.push('NO_ACTIVE_SERVICE');
  if (!facts.hasWorkingHours) blockers.push('NO_WORKING_HOURS');
  if (!facts.publicBookingCapable) blockers.push('PUBLIC_BOOKING_UNAVAILABLE');
  if (!facts.termsAccepted) blockers.push('TERMS_NOT_ACCEPTED');
  return blockers;
}

export async function loadQrKitShopFacts(
  shopId: string,
  options: { emailVerified: boolean; db?: Db },
): Promise<QrKitShopFacts> {
  const db = options.db ?? prisma;
  const [access, shop, activeBookableBarbers, activeServices, openDays, barberRules, terms] =
    await Promise.all([
      loadKersivoAccess(shopId, new Date(), db),
      db.shopSettings.findUnique({ where: { id: shopId }, select: { name: true, bookingSlug: true } }),
      db.barber.count({ where: { shopId, active: true } }),
      db.service.count({ where: { shopId, isActive: true } }),
      db.shopOpeningHours.count({ where: { shopId, active: true } }),
      db.availabilityRule.findMany({
        where: { active: true, barber: { shopId, active: true } },
        select: { startMinutes: true, endMinutes: true },
      }),
      // Any recorded Starter acceptance qualifies: a later Terms bump must not strand existing
      // Starter shops, which have no re-accept path. Shops that never accepted stay blocked.
      db.legalAcceptance.count({
        where: {
          shopId,
          purpose: {
            in: [
              TERMS_ACCEPTANCE_PURPOSES.FREE_BOOKING_ACTIVATION,
              TERMS_ACCEPTANCE_PURPOSES.FULL_TO_STARTER,
            ],
          },
        },
      }),
    ]);

  return {
    productState: access.state,
    publicBookingCapable: hasKersivoCapability(access, 'PUBLIC_BOOKING'),
    shopName: shop?.name ?? '',
    bookingSlug: shop?.bookingSlug ?? null,
    emailVerified: options.emailVerified,
    activeBookableBarbers,
    activeServices,
    hasWorkingHours: openDays > 0 && barberRules.some((r) => r.startMinutes < r.endMinutes),
    termsAccepted: terms > 0,
  };
}

// ---------------------------------------------------------------------------
// Contact / delivery details
// ---------------------------------------------------------------------------

export type QrKitRequestDetails = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  townCity: string;
  postcode: string;
  countryCode: 'GB';
};

export type QrKitDetailsError =
  | 'CONTACT_NAME_MISSING'
  | 'CONTACT_EMAIL_INVALID'
  | 'CONTACT_PHONE_INVALID'
  | 'ADDRESS_MISSING'
  | 'TOWN_MISSING'
  | 'POSTCODE_INVALID'
  | 'COUNTRY_NOT_UK';

const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/;
const UK_PHONE = /^(?:\+44|0)\d{9,10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normaliseUkPostcode(raw: string): string | null {
  const match = raw.trim().toUpperCase().match(UK_POSTCODE);
  return match ? `${match[1]} ${match[2]}` : null;
}

export function validateQrKitRequestDetails(
  input: unknown,
): { ok: true; details: QrKitRequestDetails } | { ok: false; errors: QrKitDetailsError[] } {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const errors: QrKitDetailsError[] = [];

  const contactName = str(body.contactName, 120);
  const contactEmail = str(body.contactEmail, 254).toLowerCase();
  const contactPhoneRaw = str(body.contactPhone, 40);
  const contactPhone = contactPhoneRaw.replace(/[\s().-]/g, '');
  const addressLine1 = str(body.addressLine1);
  const addressLine2 = str(body.addressLine2) || null;
  const townCity = str(body.townCity, 120);
  const postcode = normaliseUkPostcode(str(body.postcode, 12));
  const countryCode = (str(body.countryCode, 4) || 'GB').toUpperCase();

  if (contactName.length < 2) errors.push('CONTACT_NAME_MISSING');
  if (!EMAIL.test(contactEmail)) errors.push('CONTACT_EMAIL_INVALID');
  if (!UK_PHONE.test(contactPhone)) errors.push('CONTACT_PHONE_INVALID');
  if (addressLine1.length < 3) errors.push('ADDRESS_MISSING');
  if (townCity.length < 2) errors.push('TOWN_MISSING');
  if (!postcode) errors.push('POSTCODE_INVALID');
  if (countryCode !== 'GB' && countryCode !== 'UK') errors.push('COUNTRY_NOT_UK');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    details: {
      contactName,
      contactEmail,
      contactPhone,
      addressLine1,
      addressLine2,
      townCity,
      postcode: postcode!,
      countryCode: 'GB',
    },
  };
}

// ---------------------------------------------------------------------------
// Customer request (idempotent, one canonical kit per shop)
// ---------------------------------------------------------------------------

export type RequestQrKitResult =
  | { ok: true; created: boolean; fulfilmentId: string; outboxId: string | null; internalOutboxId: string | null }
  | { ok: false; reason: 'INELIGIBLE'; blockers: QrKitShopBlocker[] }
  | { ok: false; reason: 'INVALID_DETAILS'; errors: QrKitDetailsError[] };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function requestInitialQrKit(
  params: { shopId: string; userId: string | null; facts: QrKitShopFacts; input: unknown },
  options: { db?: Db } = {},
): Promise<RequestQrKitResult> {
  const db = options.db ?? prisma;
  const { shopId } = params;

  const existing = await db.qrKitFulfilment.findUnique({ where: { shopId }, select: { id: true } });
  if (existing) return { ok: true, created: false, fulfilmentId: existing.id, outboxId: null, internalOutboxId: null };

  const blockers = evaluateQrKitShopEligibility(params.facts);
  if (blockers.length > 0) return { ok: false, reason: 'INELIGIBLE', blockers };

  const validated = validateQrKitRequestDetails(params.input);
  if (!validated.ok) return { ok: false, reason: 'INVALID_DETAILS', errors: validated.errors };
  const details = validated.details;

  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${shopId} FOR UPDATE`);
      const raced = await tx.qrKitFulfilment.findUnique({ where: { shopId }, select: { id: true } });
      if (raced) {
        return { ok: true as const, created: false, fulfilmentId: raced.id, outboxId: null, internalOutboxId: null };
      }
      if (!params.facts.bookingSlug) await ensureShopBookingSlug(tx, shopId);

      const row = await tx.qrKitFulfilment.create({
        data: {
          shopId,
          status: QrKitFulfilmentStatus.REQUESTED,
          requestedByUserId: params.userId,
          shopNameSnapshot: params.facts.shopName.trim(),
          ...details,
        },
        select: { id: true },
      });
      await tx.qrKitFulfilmentEvent.create({
        data: {
          fulfilmentId: row.id,
          shopId,
          fromStatus: null,
          toStatus: QrKitFulfilmentStatus.REQUESTED,
          actorUserId: params.userId,
          actorEmail: details.contactEmail,
        },
      });
      const email = buildQrKitRequestAcknowledgementEmail({ contactName: details.contactName });
      const outbox = await enqueueEmail(tx, {
        shopId,
        purpose: EmailOutboundPurpose.QR_KIT_REQUEST_ACKNOWLEDGEMENT,
        to: details.contactEmail,
        subject: email.subject,
        html: email.html,
        replyTo: email.replyTo,
        dedupeKey: `qr-kit:ack:${shopId}`,
      });
      const internal = buildQrKitRequestInternalEmail({
        ...details,
        shopName: params.facts.shopName.trim(),
        shopId,
        fulfilmentId: row.id,
        requestedAt: new Date(),
      });
      const internalOutbox = await enqueueEmail(tx, {
        shopId,
        purpose: EmailOutboundPurpose.QR_KIT_REQUEST_INTERNAL,
        to: internal.to,
        subject: internal.subject,
        html: internal.html,
        replyTo: internal.replyTo,
        dedupeKey: `qr-kit:internal:${shopId}`,
      });
      return {
        ok: true as const,
        created: true,
        fulfilmentId: row.id,
        outboxId: outbox.id,
        internalOutboxId: internalOutbox.id,
      };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await db.qrKitFulfilment.findUnique({ where: { shopId }, select: { id: true } });
    if (!winner) throw error;
    return { ok: true, created: false, fulfilmentId: winner.id, outboxId: null, internalOutboxId: null };
  }
}

// ---------------------------------------------------------------------------
// Internal ops: state machine
// ---------------------------------------------------------------------------

const S = QrKitFulfilmentStatus;

export const QR_KIT_ALLOWED_TRANSITIONS: Readonly<
  Record<QrKitFulfilmentStatus, readonly QrKitFulfilmentStatus[]>
> = {
  REQUESTED: [S.VERIFYING],
  VERIFYING: [S.APPROVED, S.NEEDS_REVIEW, S.REJECTED],
  NEEDS_REVIEW: [S.VERIFYING, S.APPROVED],
  APPROVED: [S.PRINT_QUEUED],
  PRINT_QUEUED: [S.DISPATCHED],
  DISPATCHED: [],
  REJECTED: [],
};

const STATUS_TIMESTAMP_FIELD: Partial<Record<QrKitFulfilmentStatus, keyof QrKitFulfilment>> = {
  VERIFYING: 'verifyingAt',
  APPROVED: 'approvedAt',
  PRINT_QUEUED: 'printQueuedAt',
  DISPATCHED: 'dispatchedAt',
  NEEDS_REVIEW: 'needsReviewAt',
  REJECTED: 'rejectedAt',
};

/** Statuses at which the physical QR identities must exist (printed artwork needs them). */
const QR_CODES_REQUIRED_AT: ReadonlySet<QrKitFulfilmentStatus> = new Set([S.APPROVED, S.PRINT_QUEUED]);

export function isAllowedQrKitTransition(
  from: QrKitFulfilmentStatus,
  to: QrKitFulfilmentStatus,
): boolean {
  return QR_KIT_ALLOWED_TRANSITIONS[from].includes(to);
}

export type QrKitInternalFields = {
  verificationNote?: string | null;
  printReference?: string | null;
  dispatchCarrier?: string | null;
  dispatchReference?: string | null;
  printCostPence?: number | null;
  packagingCostPence?: number | null;
  postageCostPence?: number | null;
  otherCostPence?: number | null;
};

const TEXT_FIELDS = ['verificationNote', 'printReference', 'dispatchCarrier', 'dispatchReference'] as const;
const COST_FIELDS = ['printCostPence', 'packagingCostPence', 'postageCostPence', 'otherCostPence'] as const;

/** Parses optional internal fields from an ops payload; undefined keys are left untouched. */
export function parseQrKitInternalFields(
  input: unknown,
): { ok: true; fields: QrKitInternalFields } | { ok: false; error: string } {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const fields: QrKitInternalFields = {};
  for (const key of TEXT_FIELDS) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value === null || value === '') fields[key] = null;
    else if (typeof value === 'string') fields[key] = value.trim().slice(0, key === 'verificationNote' ? 4000 : 200);
    else return { ok: false, error: `${key} must be a string` };
  }
  for (const key of COST_FIELDS) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value === null) fields[key] = null;
    else if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000) {
      fields[key] = value;
    } else return { ok: false, error: `${key} must be a non-negative integer (pence)` };
  }
  return { ok: true, fields };
}

export type QrKitActor = { userId: string | null; email: string | null };

export type TransitionQrKitResult =
  | { ok: true; fulfilment: QrKitFulfilment; qrCodes: ShopQrCodeRow[] | null }
  | { ok: false; reason: 'NOT_FOUND' }
  | { ok: false; reason: 'INVALID_TRANSITION'; from: QrKitFulfilmentStatus; to: QrKitFulfilmentStatus }
  | { ok: false; reason: 'CONFLICT' };

const MAX_TRANSITION_ATTEMPTS = 3;

export async function transitionQrKitFulfilment(
  params: {
    fulfilmentId: string;
    toStatus: QrKitFulfilmentStatus;
    actor: QrKitActor;
    note?: string | null;
    fields?: QrKitInternalFields;
  },
  options: { db?: Db; now?: Date } = {},
): Promise<TransitionQrKitResult> {
  const db = options.db ?? prisma;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_TRANSITION_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction((tx) => transitionInTx(tx, params, options.now ?? new Date()));
    } catch (error) {
      // A random QR-code collision aborts the transaction; retry the whole transition.
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

async function transitionInTx(
  tx: Tx,
  params: {
    fulfilmentId: string;
    toStatus: QrKitFulfilmentStatus;
    actor: QrKitActor;
    note?: string | null;
    fields?: QrKitInternalFields;
  },
  now: Date,
): Promise<TransitionQrKitResult> {
  const current = await tx.qrKitFulfilment.findUnique({ where: { id: params.fulfilmentId } });
  if (!current) return { ok: false, reason: 'NOT_FOUND' };
  const from = current.status;
  const to = params.toStatus;
  if (!isAllowedQrKitTransition(from, to)) {
    return { ok: false, reason: 'INVALID_TRANSITION', from, to };
  }

  const qrCodes = QR_CODES_REQUIRED_AT.has(to)
    ? await ensureShopQrCodesInTx(tx, current.shopId)
    : null;

  const fields = { ...(params.fields ?? {}) };
  if (to !== S.DISPATCHED) {
    delete fields.dispatchCarrier;
    delete fields.dispatchReference;
  }
  const timestampField = STATUS_TIMESTAMP_FIELD[to];

  // Compare-and-set on the status read above so concurrent operators cannot double-apply.
  const updated = await tx.qrKitFulfilment.updateMany({
    where: { id: current.id, status: from },
    data: {
      ...fields,
      status: to,
      ...(timestampField ? { [timestampField]: now } : {}),
    },
  });
  if (updated.count !== 1) return { ok: false, reason: 'CONFLICT' };

  await tx.qrKitFulfilmentEvent.create({
    data: {
      fulfilmentId: current.id,
      shopId: current.shopId,
      fromStatus: from,
      toStatus: to,
      actorUserId: params.actor.userId,
      actorEmail: params.actor.email,
      note: params.note?.trim() || null,
    },
  });

  const fulfilment = await tx.qrKitFulfilment.findUniqueOrThrow({ where: { id: current.id } });
  return { ok: true, fulfilment, qrCodes };
}

/** Internal-only edits (notes, references, costs) without a status change; audited. */
export async function updateQrKitInternalFields(
  params: { fulfilmentId: string; actor: QrKitActor; fields: QrKitInternalFields; note?: string | null },
  options: { db?: Db } = {},
): Promise<{ ok: true; fulfilment: QrKitFulfilment } | { ok: false; reason: 'NOT_FOUND' }> {
  const db = options.db ?? prisma;
  return db.$transaction(async (tx) => {
    const current = await tx.qrKitFulfilment.findUnique({ where: { id: params.fulfilmentId } });
    if (!current) return { ok: false as const, reason: 'NOT_FOUND' as const };
    const fulfilment = await tx.qrKitFulfilment.update({
      where: { id: current.id },
      data: params.fields,
    });
    await tx.qrKitFulfilmentEvent.create({
      data: {
        fulfilmentId: current.id,
        shopId: current.shopId,
        fromStatus: current.status,
        toStatus: current.status,
        actorUserId: params.actor.userId,
        actorEmail: params.actor.email,
        note: params.note?.trim() || `Updated: ${Object.keys(params.fields).join(', ') || 'nothing'}`,
      },
    });
    return { ok: true as const, fulfilment };
  });
}

// ---------------------------------------------------------------------------
// Internal print manifest
// ---------------------------------------------------------------------------

export const QR_KIT_PRINT_SPECS: Readonly<
  Record<ShopQrPlacement, { widthMm: number; heightMm: number; headline: string; subline: string; placementNote: string }>
> = {
  WINDOW: {
    widthMm: 150,
    heightMm: 170,
    headline: 'BOOK ONLINE',
    subline: 'Scan to book',
    placementNote: 'Inside the shop glass, facing the street.',
  },
  REBOOK: {
    widthMm: 100,
    heightMm: 100,
    headline: 'REBOOK BEFORE YOU LEAVE',
    subline: 'Scan to book',
    placementNote: 'At the counter / mirror station.',
  },
};

export const QR_KIT_POWERED_BY = 'Powered by KERSIVO';

/** Requirements the print supplier/material must meet. Recorded only — not verified here. */
export const QR_KIT_MATERIAL_REQUIREMENTS: readonly string[] = [
  'WINDOW: use an inside-glass / face-adhesive or equivalent method that presents the artwork correctly from outside (untested).',
  'WINDOW: confirm correct print orientation through the glass before supplier approval (untested).',
  'WINDOW: determine whether white backing / white ink is required for contrast through real shop glass (untested).',
  'Use durable removable self-adhesive vinyl or equivalent professional material; confirm removability without unnecessary residue or damage (untested).',
  'Confirm UV/fade resistance suitable for prolonged window exposure (untested).',
  'Confirm resistance to normal glass cleaning and condensation (untested).',
  'Preserve a readable QR quiet zone and high contrast; do not sacrifice scanability for branding aesthetics (untested).',
  'Confirm production bleed and cut tolerance with the print supplier (untested).',
  'Test WINDOW scanning through representative glass in daylight and indoor/outdoor reflection conditions (untested).',
  'Test WINDOW scanning at oblique viewing angles and realistic customer distances (untested).',
  'Test on clean and lightly marked glass with representative modern iOS and Android devices before supplier approval (untested).',
  'REBOOK: use durable removable professional self-adhesive material appropriate for mirror, station or reception placement (untested).',
  'No acrylic stand or customer-assembled physical hardware is required for V1.',
];

export type QrKitPrintManifest = {
  fulfilmentId: string;
  shopId: string;
  shopName: string;
  status: QrKitFulfilmentStatus;
  recipient: {
    name: string;
    phone: string;
    email: string;
    addressLine1: string;
    addressLine2: string | null;
    townCity: string;
    postcode: string;
    countryCode: string;
  };
  items: Array<{
    placement: ShopQrPlacement;
    code: string;
    targetUrl: string;
    widthMm: number;
    heightMm: number;
    headline: string;
    subline: string;
    poweredBy: string | null;
    placementNote: string;
  }>;
  materialRequirements: readonly string[];
  artworkStatus: 'NOT_FINAL';
};

export function qrScanUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, '')}/q/${encodeURIComponent(code)}`;
}

export function buildQrKitPrintManifest(params: {
  fulfilment: Pick<
    QrKitFulfilment,
    | 'id'
    | 'shopId'
    | 'status'
    | 'shopNameSnapshot'
    | 'contactName'
    | 'contactPhone'
    | 'contactEmail'
    | 'addressLine1'
    | 'addressLine2'
    | 'townCity'
    | 'postcode'
    | 'countryCode'
  >;
  qrCodes: readonly ShopQrCodeRow[];
  baseUrl: string;
  includePoweredBy?: boolean;
}): QrKitPrintManifest {
  const { fulfilment: f } = params;
  const byPlacement = new Map(
    params.qrCodes.filter((row) => row.shopId === f.shopId).map((row) => [row.placement, row]),
  );
  const items = (Object.keys(QR_KIT_PRINT_SPECS) as ShopQrPlacement[]).map((placement) => {
    const row = byPlacement.get(placement);
    if (!row) throw new Error(`Missing ${placement} QR code for shop ${f.shopId}`);
    const spec = QR_KIT_PRINT_SPECS[placement];
    return {
      placement,
      code: row.code,
      targetUrl: qrScanUrl(params.baseUrl, row.code),
      widthMm: spec.widthMm,
      heightMm: spec.heightMm,
      headline: spec.headline,
      subline: spec.subline,
      poweredBy: params.includePoweredBy === false ? null : QR_KIT_POWERED_BY,
      placementNote: spec.placementNote,
    };
  });
  return {
    fulfilmentId: f.id,
    shopId: f.shopId,
    shopName: f.shopNameSnapshot,
    status: f.status,
    recipient: {
      name: f.contactName,
      phone: f.contactPhone,
      email: f.contactEmail,
      addressLine1: f.addressLine1,
      addressLine2: f.addressLine2,
      townCity: f.townCity,
      postcode: f.postcode,
      countryCode: f.countryCode,
    },
    items,
    materialRequirements: QR_KIT_MATERIAL_REQUIREMENTS,
    artworkStatus: 'NOT_FINAL',
  };
}

export const QR_KIT_MANIFEST_STATUSES: ReadonlySet<QrKitFulfilmentStatus> = new Set([
  S.APPROVED,
  S.PRINT_QUEUED,
  S.DISPATCHED,
]);
