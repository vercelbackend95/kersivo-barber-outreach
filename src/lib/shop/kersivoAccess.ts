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
  'CLIENTS',
  'FULL_BOOKING_HISTORY',
  'RETAIL',
  'ASSISTANT',
  'SMS_REMINDERS',
  'AUTOMATED_EMAIL_REMINDERS',
  'BRANDED_SITE',
  'MANUAL_BOOKINGS',
] as const;

export type KersivoCapability = (typeof KERSIVO_CAPABILITIES)[number];

const FREE_BOOKING_CAPABILITIES: readonly KersivoCapability[] = [
  'BOOKING_CORE',
  'PUBLIC_BOOKING',
  'BOOKING_PAYMENTS',
  'TEAM',
  'SERVICES',
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

export type KersivoAccess = {
  state: KersivoProductState;
  capabilities: readonly KersivoCapability[];
};

/**
 * FULL_KERSIVO > FREE_BOOKING > SETUP.
 * Full derives from the existing paid entitlement (isPaidShop); Free requires the explicit
 * freeBookingActivatedAt marker. Demo shops always resolve to SETUP.
 */
export function resolveKersivoProductState(
  shop: KersivoAccessShopFields,
  subscription?: SaasSubscriptionAccessFields | null,
  now: Date = new Date(),
): KersivoProductState {
  if (isDemoShopId(shop.id)) return 'SETUP';
  if (isPaidShop(shop, subscription, now)) return 'FULL_KERSIVO';
  if (shop.freeBookingActivatedAt != null) return 'FREE_BOOKING';
  return 'SETUP';
}

export function accessForState(state: KersivoProductState): KersivoAccess {
  return { state, capabilities: PRODUCT_STATE_CAPABILITIES[state] };
}

export function resolveKersivoAccess(
  shop: KersivoAccessShopFields,
  subscription?: SaasSubscriptionAccessFields | null,
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
  clients: boolean;
  fullBookingHistory: boolean;
  retail: boolean;
  assistant: boolean;
  smsReminders: boolean;
  automatedEmailReminders: boolean;
  brandedSite: boolean;
  manualBookings: boolean;
};

const CAPABILITY_KEYS: Readonly<Record<KersivoCapability, keyof SerializedKersivoCapabilities>> = {
  BOOKING_CORE: 'bookingCore',
  PUBLIC_BOOKING: 'publicBooking',
  BOOKING_PAYMENTS: 'bookingPayments',
  TEAM: 'team',
  SERVICES: 'services',
  REPORTS: 'reports',
  CLIENTS: 'clients',
  FULL_BOOKING_HISTORY: 'fullBookingHistory',
  RETAIL: 'retail',
  ASSISTANT: 'assistant',
  SMS_REMINDERS: 'smsReminders',
  AUTOMATED_EMAIL_REMINDERS: 'automatedEmailReminders',
  BRANDED_SITE: 'brandedSite',
  MANUAL_BOOKINGS: 'manualBookings',
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

/**
 * Loads ShopSettings entitlement fields + latest non-PENDING SaaS subscription and resolves
 * product access. Missing / demo shops resolve to SETUP.
 */
export async function loadKersivoAccess(
  shopId: string,
  now: Date = new Date(),
): Promise<KersivoAccess> {
  const id = shopId.trim();
  if (!id || isDemoShopId(id)) return accessForState('SETUP');

  const shop = await prisma.shopSettings.findUnique({
    where: { id },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      freeBookingActivatedAt: true,
    },
  });
  if (!shop) return accessForState('SETUP');

  const subscription = await prisma.saasSubscription.findFirst({
    where: { shopId: id, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      cancelAtPeriodEnd: true,
    },
  });

  return resolveKersivoAccess(shop, subscription, now);
}
