import { notifyOpsDurable } from '@/lib/ops/stripeWebhookLedger';
import { opsLog, opsLogError } from '@/lib/ops/opsLog';
import { addMilliseconds } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { prisma } from '@/lib/db/client';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { isPaidShop } from '@/lib/shop/paidShop';
import { getAvailabilitySlots } from '@/lib/booking/service';

const TZ = 'Europe/London';

function canaryShopId(): string {
  return (
    (import.meta.env.OPS_CANARY_SHOP_ID as string | undefined) ??
    process.env.OPS_CANARY_SHOP_ID ??
    ''
  )
    .toString()
    .trim();
}

function siteBaseUrl(): string {
  return getPublicSiteUrl().replace(/\/$/, '');
}

export type SyntheticBookingResult = {
  ok: boolean;
  steps: Array<{ name: string; ok: boolean; detail?: string }>;
  error?: string;
};

/**
 * Read-mostly synthetic probe: homepage + canary shop availability.
 */
export async function runSyntheticBookingCheck(now = new Date()): Promise<SyntheticBookingResult> {
  const steps: SyntheticBookingResult['steps'] = [];
  const shopId = canaryShopId();

  try {
    const homeUrl = `${siteBaseUrl()}/`;
    const response = await fetch(homeUrl, { method: 'GET', redirect: 'follow' });
    const ok = response.status >= 200 && response.status < 400;
    steps.push({ name: 'homepage', ok, detail: `HTTP ${response.status}` });
    if (!ok) {
      return fail('Homepage check failed', steps);
    }
  } catch (error) {
    steps.push({
      name: 'homepage',
      ok: false,
      detail: error instanceof Error ? error.message : 'fetch failed',
    });
    return fail('Homepage fetch error', steps);
  }

  if (!shopId) {
    steps.push({ name: 'canary_configured', ok: false, detail: 'OPS_CANARY_SHOP_ID unset' });
    const isProd =
      import.meta.env.PROD === true ||
      process.env.VERCEL_ENV === 'production' ||
      process.env.NODE_ENV === 'production';
    if (isProd) {
      return fail('OPS_CANARY_SHOP_ID is required in production', steps);
    }
    opsLog('ops.synthetic', 'skipped_no_canary');
    return { ok: true, steps: [...steps, { name: 'skipped', ok: true, detail: 'no canary in non-prod' }] };
  }

  try {
    const shop = await prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: { id: true, shopPaidAt: true, smsRemindersEnabled: true },
    });
    if (!shop) {
      steps.push({ name: 'canary_shop', ok: false, detail: 'shop not found' });
      return fail('Canary shop not found', steps);
    }
    steps.push({ name: 'canary_shop', ok: true });

    if (!isPaidShop(shop)) {
      steps.push({ name: 'public_booking_gate', ok: false, detail: 'canary shop is not a paid tenant' });
      return fail('Canary shop does not accept public bookings (unpaid)', steps);
    }
    steps.push({ name: 'public_booking_gate', ok: true });

    const service = await prisma.service.findFirst({
      where: { shopId, isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true },
    });
    const barber = await prisma.barber.findFirst({
      where: { shopId, active: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    if (!service || !barber) {
      steps.push({
        name: 'catalog',
        ok: false,
        detail: `service=${Boolean(service)} barber=${Boolean(barber)}`,
      });
      return fail('Canary shop missing active service or barber', steps);
    }
    steps.push({ name: 'catalog', ok: true });

    const tomorrow = formatInTimeZone(addMilliseconds(now, 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd');
    const availability = await getAvailabilitySlots({
      serviceId: service.id,
      barberId: barber.id,
      date: tomorrow,
    });
    const slotCount = Array.isArray(availability.slots) ? availability.slots.length : 0;
    steps.push({
      name: 'availability',
      ok: true,
      detail: `${tomorrow} slots=${slotCount}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'availability failed';
    steps.push({ name: 'availability', ok: false, detail: message });
    return fail(message, steps);
  }

  opsLog('ops.synthetic', 'ok', { shopId, steps: steps.length });
  return { ok: true, steps };
}

async function fail(error: string, steps: SyntheticBookingResult['steps']): Promise<SyntheticBookingResult> {
  opsLogError('ops.synthetic', 'failed', error, { stepCount: steps.length });
  await notifyOpsDurable({
    severity: 'critical',
    title: 'Synthetic booking check failed',
    body: error,
    dedupeKey: 'synthetic:booking',
    fields: {
      failedStep: steps.find((s) => !s.ok)?.name ?? 'unknown',
      detail: steps.find((s) => !s.ok)?.detail ?? null,
    },
  });
  return { ok: false, steps, error };
}
