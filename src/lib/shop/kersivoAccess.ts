import type { Prisma, SaasPostFullPlan } from '@prisma/client';
import { prisma } from '../db/client';
import type { SaasSubscriptionAccessFields } from '../setup/saasEntitlement';
import { isDemoShopId } from './cardPaymentsGate';
import { isPaidShop, type PaidShopFields } from './paidShop';

/**
 * KERSIVO product entitlement: what features the shop's product state includes.
 * Independent of RBAC (who the user is / what they may do inside the shop);
 * gated features must require both an RBAC permission and a product capability.
 */
export type KersivoProductState = 'SETUP' | 'FREE_BOOKING' | 'FULL_KERSIVO';

export const KERSIVO_CAPABILITIES = [
  'BOOKING_CORE',
  'PUBLIC_BOOKING',
  'BOOKING_PAYMENTS',
  'TEAM',
  'SERVICES',
  'REPORTS',
  'CLIENTS_CORE',
  'CLIENTS',
  'RECENT_BOOKING_HISTORY',
  'FULL_BOOKING_HISTORY',
  'RETAIL',
  'ASSISTANT',
  'SMS_REMINDERS',
  'AUTOMATED_EMAIL_REMINDERS',
  'BRANDED_SITE',
  'MANUAL_BOOKINGS',
  'GOOGLE_BOOKING_SETUP',
] as const;

export type KersivoCapability = (typeof KERSIVO_CAPABILITIES)[number];

const FREE_BOOKING_CAPABILITIES: readonly KersivoCapability[] = [
  'BOOKING_CORE',
  'PUBLIC_BOOKING',
  'BOOKING_PAYMENTS',
  'TEAM',
  'SERVICES',
  'AUTOMATED_EMAIL_REMINDERS',
  'RECENT_BOOKING_HISTORY',
  'CLIENTS_CORE',
  'MANUAL_BOOKINGS',
  'GOOGLE_BOOKING_SETUP',
];

const FULL_KERSIVO_CAPABILITIES: readonly KersivoCapability[] = [
  ...FREE_BOOKING_CAPABILITIES,
  'REPORTS',
  'CLIENTS',
  'FULL_BOOKING_HISTORY',
  'RETAIL',
  'ASSISTANT',
  'SMS_REMINDERS',
  'AUTOMATED_EMAIL_REMINDERS',
  'BRANDED_SITE',
  'MANUAL_BOOKINGS',
];

export const PRODUCT_STATE_CAPABILITIES: Readonly<
  Record<KersivoProductState, readonly KersivoCapability[]>
> = {
  SETUP: [],
  FREE_BOOKING: FREE_BOOKING_CAPABILITIES,
  FULL_KERSIVO: FULL_KERSIVO_CAPABILITIES,
};

export type KersivoAccessShopFields = PaidShopFields & {
  freeBookingActivatedAt: Date | null;
};

/** Latest non-PENDING SaaS subscription incl. its explicit post-Full plan choice. */
export type KersivoSubscriptionFields = SaasSubscriptionAccessFields & {
  postFullPlan?: SaasPostFullPlan | string | null;
};

export type KersivoAccess = {
  state: KersivoProductState;
  capabilities: readonly KersivoCapability[];
};

/**
 * FULL_KERSIVO > KERSIVO Starter (internal FREE_BOOKING) > SETUP. Demo shops always resolve to SETUP.
 * - Full derives from the paid entitlement (isPaidShop).
 * - A shop that has had Full (any non-PENDING subscription) and lost it is Starter ONLY when that
 *   subscription records an explicit postFullPlan = STARTER. The legacy freeBookingActivatedAt marker
 *   never revives Starter after Full, and billing recovery (PAST_DUE after grace / SUSPENDED),
 *   an undecided cancellation or LEAVE all resolve to SETUP (no active service).
 * - A shop that never had Full is Starter when it activated Starter (freeBookingActivatedAt).
 */
export function resolveKersivoProductState(
  shop: KersivoAccessShopFields,
  subscription?: KersivoSubscriptionFields | null,
  now: Date = new Date(),
): KersivoProductState {
  if (isDemoShopId(shop.id)) return 'SETUP';
  if (isPaidShop(shop, subscription, now)) return 'FULL_KERSIVO';
  if (subscription && String(subscription.status) !== 'PENDING') {
    return String(subscription.postFullPlan ?? '') === 'STARTER' ? 'FREE_BOOKING' : 'SETUP';
  }
  if (shop.freeBookingActivatedAt != null) return 'FREE_BOOKING';
  return 'SETUP';
}

export function accessForState(state: KersivoProductState): KersivoAccess {
  return { state, capabilities: PRODUCT_STATE_CAPABILITIES[state] };
}

export function resolveKersivoAccess(
  shop: KersivoAccessShopFields,
  subscription?: KersivoSubscriptionFields | null,
  now: Date = new Date(),
): KersivoAccess {
  return accessForState(resolveKersivoProductState(shop, subscription, now));
}

export function hasKersivoCapability(
  access: KersivoAccess,
  capability: KersivoCapability,
): boolean {
  return access.capabilities.includes(capability);
}

export type SerializedKersivoCapabilities = {
  bookingCore: boolean;
  publicBooking: boolean;
  bookingPayments: boolean;
  team: boolean;
  services: boolean;
  reports: boolean;
  clientsCore: boolean;
  clients: boolean;
  recentBookingHistory: boolean;
  fullBookingHistory: boolean;
  retail: boolean;
  assistant: boolean;
  smsReminders: boolean;
  automatedEmailReminders: boolean;
  brandedSite: boolean;
  manualBookings: boolean;
  googleBookingSetup: boolean;
};

const CAPABILITY_KEYS: Readonly<Record<KersivoCapability, keyof SerializedKersivoCapabilities>> = {
  BOOKING_CORE: 'bookingCore',
  PUBLIC_BOOKING: 'publicBooking',
  BOOKING_PAYMENTS: 'bookingPayments',
  TEAM: 'team',
  SERVICES: 'services',
  REPORTS: 'reports',
  CLIENTS_CORE: 'clientsCore',
  CLIENTS: 'clients',
  RECENT_BOOKING_HISTORY: 'recentBookingHistory',
  FULL_BOOKING_HISTORY: 'fullBookingHistory',
  RETAIL: 'retail',
  ASSISTANT: 'assistant',
  SMS_REMINDERS: 'smsReminders',
  AUTOMATED_EMAIL_REMINDERS: 'automatedEmailReminders',
  BRANDED_SITE: 'brandedSite',
  MANUAL_BOOKINGS: 'manualBookings',
  GOOGLE_BOOKING_SETUP: 'googleBookingSetup',
};

export type SerializedKersivoAccess = {
  state: KersivoProductState;
  capabilities: SerializedKersivoCapabilities;
};

export function serializeKersivoAccess(access: KersivoAccess): SerializedKersivoAccess {
  const capabilities = {} as SerializedKersivoCapabilities;
  for (const capability of KERSIVO_CAPABILITIES) {
    capabilities[CAPABILITY_KEYS[capability]] = access.capabilities.includes(capability);
  }
  return { state: access.state, capabilities };
}

export type KersivoAccessDb = Prisma.TransactionClient | typeof prisma;

/**
 * Loads ShopSettings entitlement fields + latest non-PENDING SaaS subscription and resolves
 * product access. Missing / demo shops resolve to SETUP.
 * Pass a transaction client to read state inside a transaction that holds the shop lock.
 */
export async function loadKersivoAccess(
  shopId: string,
  now: Date = new Date(),
  db: KersivoAccessDb = prisma,
): Promise<KersivoAccess> {
  const id = shopId.trim();
  if (!id || isDemoShopId(id)) return accessForState('SETUP');

  const shop = await db.shopSettings.findUnique({
    where: { id },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      freeBookingActivatedAt: true,
    },
  });
  if (!shop) return accessForState('SETUP');

  const subscription = await db.saasSubscription.findFirst({
    where: { shopId: id, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      cancelAtPeriodEnd: true,
      postFullPlan: true,
    },
  });

  return resolveKersivoAccess(shop, subscription, now);
}

/**
 * Per-run memo for batch jobs (e.g. reminder crons) that must respect each shop's current
 * product capability rather than stale stored booleans.
 */
export function shopCapabilityChecker(
  capability: KersivoCapability,
  now: Date = new Date(),
): (shopId: string) => Promise<boolean> {
  const cache = new Map<string, Promise<boolean>>();
  return (shopId) => {
    let entitled = cache.get(shopId);
    if (!entitled) {
      entitled = loadKersivoAccess(shopId, now).then((access) => hasKersivoCapability(access, capability));
      cache.set(shopId, entitled);
    }
    return entitled;
  };
}
