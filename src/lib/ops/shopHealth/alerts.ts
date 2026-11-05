/**
 * Ops alerts for LIVE shops (no owner emails):
 *   - RED on two consecutive runs (anti-flap) → Sentry message (tag shopId) + an email to every address in
 *     KERSIVO_OPS_EMAILS; ShopSettings.healthAlertedAt is stamped.
 *   - Still RED: no repeat, except one reminder per 24 h.
 *   - No longer RED after an alert → one "Back to green" email; healthAlertedAt is cleared.
 * Emails go through the outbox with shopId null (internal), so they never count against the shop's own
 * messaging.email check. Outside Production they are recorded as SUPPRESSED and never sent.
 */
import { EmailOutboundPurpose } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { enqueueEmailOnce, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { resolveDeploymentEnvironment } from '@/lib/email/internalNotificationRecipient';
import { KERSIVO_ORIGIN } from '@/lib/ops/healthProbeAuth';
import { readOpsEmailAllowlistFromEnv } from '@/lib/ops/operatorAuth';
import { captureOpsMessage } from '@/lib/ops/sentry';
import type { ShopHealthCheckResult, ShopHealthMode, ShopHealthOverall } from './types';

export const ALERT_REMINDER_MS = 24 * 60 * 60 * 1000;

export type ShopHealthAlertAction = 'alert' | 'reminder' | 'recovery' | 'none';

export function decideShopHealthAlert(input: {
  mode: ShopHealthMode;
  overall: ShopHealthOverall;
  previousOverall: ShopHealthOverall | null;
  alertedAt: Date | null;
  now: Date;
}): ShopHealthAlertAction {
  if (input.mode !== 'LIVE') return 'none';
  if (input.overall === 'RED') {
    if (input.previousOverall !== 'RED') return 'none';
    if (!input.alertedAt) return 'alert';
    return input.now.getTime() - input.alertedAt.getTime() >= ALERT_REMINDER_MS ? 'reminder' : 'none';
  }
  return input.alertedAt ? 'recovery' : 'none';
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function shopHealthOpsUrl(shopId: string): string {
  return `${KERSIVO_ORIGIN}/ops/shops/${encodeURIComponent(shopId)}`;
}

export function buildShopHealthAlertEmail(input: {
  action: Exclude<ShopHealthAlertAction, 'none'>;
  shopId: string;
  shopName: string;
  overall: ShopHealthOverall;
  failing: ShopHealthCheckResult[];
  preview?: boolean;
}): { subject: string; html: string } {
  const prefix = input.preview ? '[Preview] ' : '';
  const first = input.failing[0]?.title ?? 'a critical check';
  const link = shopHealthOpsUrl(input.shopId);
  if (input.action === 'recovery') {
    const subject =
      input.overall === 'GREEN'
        ? `${prefix}[KERSIVO] Back to green: ${input.shopName}`
        : `${prefix}[KERSIVO] No longer red: ${input.shopName} (amber)`;
    const html = `<p>${escape(input.shopName)} is no longer red${input.overall === 'GREEN' ? ': every check passed' : ', but some checks still need attention (amber)'}.</p>
<p><a href="${escape(link)}">Open the health report</a></p>`;
    return { subject, html };
  }
  const subject = `${prefix}[KERSIVO] ${input.action === 'reminder' ? 'Still red' : 'Red'}: ${input.shopName} — ${first}`;
  const items = input.failing
    .map(
      (r) =>
        `<li><strong>${escape(r.title)}</strong>: ${escape(r.message)}${r.fix ? `<br><em>Fix:</em> ${escape(r.fix)}` : ''}</li>`,
    )
    .join('\n');
  const html = `<p>${escape(input.shopName)} has been red on two health checks in a row${input.action === 'reminder' ? ' and is still red' : ''}. Customers may not be able to book, pay or buy.</p>
<ul>
${items}
</ul>
<p><a href="${escape(link)}">Open the health report</a></p>
<p style="color:#666">Checks run every hour and on demand. Not covered: real card payments, SMS delivery to the handset (only the provider’s status), and how the site looks on each device.</p>`;
  return { subject, html };
}

export async function applyShopHealthAlert(input: {
  shopId: string;
  shopName: string;
  runId: string;
  mode: ShopHealthMode;
  overall: ShopHealthOverall;
  previousOverall: ShopHealthOverall | null;
  alertedAt: Date | null;
  failing: ShopHealthCheckResult[];
  now: Date;
}): Promise<ShopHealthAlertAction> {
  const action = decideShopHealthAlert(input);
  if (action === 'none') return action;

  if (action !== 'recovery') {
    captureOpsMessage(`Shop health red: ${input.shopName} — ${input.failing[0]?.title ?? 'critical check failed'}`, {
      route: 'shop-health',
      shopId: input.shopId,
      level: 'error',
      tags: { shopHealthAction: action, shopHealthCheck: input.failing[0]?.id ?? 'unknown' },
    });
  }

  const production = resolveDeploymentEnvironment() === 'production';
  const email = buildShopHealthAlertEmail({ ...input, action, preview: !production });
  for (const to of readOpsEmailAllowlistFromEnv()) {
    const { row, created } = await enqueueEmailOnce({
      shopId: null,
      purpose: EmailOutboundPurpose.SHOP_HEALTH_ALERT_INTERNAL,
      to,
      subject: email.subject,
      html: email.html,
      dedupeKey: `shop-health:${input.shopId}:${action}:${input.runId}:${to}`,
      suppressed: !production,
    });
    if (created) await tryDeliverOutboxEmail(row.id);
  }

  await prisma.shopSettings.update({
    where: { id: input.shopId },
    data: { healthAlertedAt: action === 'recovery' ? null : input.now },
  });
  return action;
}
