export const prerender = false;

import type { APIRoute } from 'astro';
import { SetupDepositStatus, SetupPlan } from '@prisma/client';
import { resolveAdminAccess } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';
import { buildSetupDepositStripeMetadata, getSetupPlan, isSetupPlanId } from '../../../lib/setup/plans';
import { getPublicSiteUrl } from '../../../lib/setup/siteUrl';
import { createCheckoutSession } from '../../../lib/shop/stripe';

type LaunchDepositCheckoutInput = {
  plan: string;
  attribution?: Record<string, string>;
};

const ATTRIBUTION_KEYS = [
  'gclid',
  'gbraid',
  'wbraid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'ga_client_id',
] as const;

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 400 });
}

function pickAttribution(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const record = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = record[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().slice(0, 200);
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

function shopSizeFromBarberCount(count: number): string {
  if (count <= 2) return '1-2';
  if (count <= 4) return '3-4';
  if (count <= 6) return '5-6';
  if (count <= 8) return '7-8';
  return '9+';
}

/**
 * Authenticated setup-deposit checkout for Launch Wizard (session owner only).
 */
export const POST: APIRoute = async (context) => {
  try {
    const access = await resolveAdminAccess(context);
    if (!access || access.via !== 'session') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    let body: LaunchDepositCheckoutInput;
    try {
      body = (await context.request.json()) as LaunchDepositCheckoutInput;
    } catch {
      return badRequest('Invalid request body.');
    }

    const planRaw = String(body.plan ?? '').trim();
    if (!isSetupPlanId(planRaw)) {
      return badRequest('Valid plan is required.');
    }
    const planId = planRaw;

    const shop = await prisma.shopSettings.findUnique({
      where: { id: access.shopId },
      select: {
        onboardingCompleted: true,
        name: true,
        _count: { select: { barbers: true } },
      },
    });

    if (!shop?.onboardingCompleted) {
      return badRequest('Complete workspace setup before launching.');
    }

    const name = (access.userName ?? '').trim();
    if (name.length < 2) {
      return badRequest('Account name is required.');
    }

    const email = (access.userEmail ?? '').trim().toLowerCase();
    if (!email) {
      return badRequest('Account email is required.');
    }

    const shopName = shop.name.trim();
    if (shopName.length < 2) {
      return badRequest('Shop name is required.');
    }

    const pendingDeposit = await prisma.setupDeposit.findFirst({
      where: {
        customerEmail: { equals: email, mode: 'insensitive' },
        status: SetupDepositStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        shopSize: true,
        currentStack: true,
      },
    });

    const shopSize = pendingDeposit?.shopSize?.trim() || shopSizeFromBarberCount(shop._count.barbers);
    const currentStack = pendingDeposit?.currentStack?.trim() || 'kersivo-preview';

    const planConfig = getSetupPlan(planId);
    const baseUrl = getPublicSiteUrl();
    const attribution = pickAttribution(body.attribution);
    const metadata = buildSetupDepositStripeMetadata(
      planId,
      {
        customerName: name,
        email,
        shopName,
        shopSize,
        currentStack,
      },
      attribution,
    );
    metadata.shopId = access.shopId;

    const session = await createCheckoutSession({
      customerEmail: email,
      successUrl: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/setup/cancel`,
      lineItems: [
        {
          productId: `setup-deposit-${planId}`,
          name: `Kersivo ${planConfig.name} — 50% setup deposit`,
          unitAmount: planConfig.depositPence,
          quantity: 1,
        },
      ],
      metadata,
    });

    try {
      await prisma.setupDeposit.create({
        data: {
          stripeSessionId: session.id,
          plan: planId === 'priority' ? SetupPlan.PRIORITY : SetupPlan.LAUNCH,
          status: SetupDepositStatus.PENDING,
          customerName: name,
          customerEmail: email,
          shopName,
          shopSize,
          currentStack,
          depositPence: planConfig.depositPence,
          paidAt: null,
        },
      });
    } catch (error) {
      console.error('Launch deposit PENDING record create failed', {
        stripeSessionId: session.id,
        error,
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('Launch deposit checkout session creation failed', error);
    return new Response(JSON.stringify({ error: 'Unable to create checkout session.' }), { status: 500 });
  }
};
