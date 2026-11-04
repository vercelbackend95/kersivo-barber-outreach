/** Test fixtures: a healthy live Full KERSIVO shop context, overridable per test. */
import type { ShopHealthContext } from './types';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<unknown> ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function healthyContext(overrides: DeepPartial<ShopHealthContext> = {}): ShopHealthContext {
  const base: ShopHealthContext = {
    now: new Date('2026-11-04T12:00:00Z'),
    mode: 'LIVE',
    shop: {
      id: 'shop_1',
      name: 'Fade Room',
      bookingSlug: 'fade-room',
      timezone: 'Europe/London',
      shopPaidAt: new Date('2026-10-01T00:00:00Z'),
      smsRemindersEnabled: true,
      goLiveAt: new Date('2026-10-02T00:00:00Z'),
      sitePreviewUrl: 'https://fade-room.example.co.uk',
      depositsEnabled: false,
      bookingPaymentMode: 'NONE',
      retailEnabled: true,
      retailTestOrderCompletedAt: new Date('2026-10-03T00:00:00Z'),
      stripeConnectAccountId: 'acct_1',
      stripeConnectAccountType: 'STANDARD',
      stripeConnectChargesEnabled: true,
      stripeConnectDetailsSubmitted: true,
      stripeConnectDisconnectedAt: null,
      pendingConfirmationMins: 15,
      publicActivityPaused: false,
      publicActivityPausedAt: null,
      publicActivityPauseFrom: null,
      publicActivityPauseUntil: null,
      publicActivityPauseReason: null,
    },
    access: { state: 'FULL_KERSIVO', capabilities: ['PUBLIC_BOOKING', 'BRANDED_SITE', 'RETAIL', 'SMS_REMINDERS'] },
    intake: { accepting: true, reason: 'ok', starterReadiness: null },
    destination: { kind: 'hosted', path: '/book/fade-room', source: 'full_hosted_fallback' },
    verifiedDestinationUrl: null,
    openDays: 6,
    services: [{ id: 'svc_1', name: 'Skin fade', pricePence: 2500, durationMinutes: 30, barberIds: ['barber_1'] }],
    barbers: [{ id: 'barber_1', name: 'Alex', serviceIds: ['svc_1'], activeRuleCount: 5 }],
    products: [{ id: 'prod_1', name: 'Matt clay', pricePence: 1200, hasImage: true, hasDescription: true }],
    profile: { hasAddressOrPostcode: true, hasPhone: true },
    stuckPendingPayments: 0,
    messaging: { smsRecent: ['SENT', 'SENT'], emailFailed7d: 0, emailStuck7d: 0 },
  };
  return {
    ...base,
    ...overrides,
    shop: { ...base.shop, ...(overrides.shop ?? {}) },
    messaging: { ...base.messaging, ...(overrides.messaging ?? {}) },
  } as ShopHealthContext;
}
