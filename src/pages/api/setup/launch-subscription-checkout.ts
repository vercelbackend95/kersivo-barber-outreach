export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '../../../lib/admin/auth';
import { requirePermission } from '../../../lib/admin/rbac/can';
import { prisma } from '../../../lib/db/client';
import {
  parseTermsAccepted,
  recordTermsAcceptance,
  termsAcceptanceStripeMetadata,
  termsAcceptedErrorResponse,
} from '../../../lib/legal/requireTermsAcceptance';
import { TERMS_ACCEPTANCE_PURPOSES } from '../../../lib/legal/termsVersion';
import { SAAS_MONTHLY_PENCE } from '../../../lib/seo/defaults';
import { buildSaasSubscriptionStripeMetadata } from '../../../lib/setup/saasSubscription';
import { getPublicSiteUrl } from '../../../lib/setup/siteUrl';
import { createSubscriptionCheckoutSession } from '../../../lib/shop/stripe';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

type LaunchSubscriptionCheckoutInput = {
  attribution?: Record<string, string>;
  termsAccepted?: boolean;
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
 * Authenticated subscription checkout for Launch Wizard (Owner / billing.manage only).
 */
export const POST: APIRoute = async (context) => {
  try {
    const limited = await enforceIpRateLimit(context.request, 'setup_checkout', 10, 15 * 60 * 1000);
    if (limited) return limited;

    const access = await resolveAdminAccess(context);
    if (!access || access.via !== 'session') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const denied = requirePermission(access, 'billing.manage');
    if (denied) return denied;

    let body: LaunchSubscriptionCheckoutInput;
    try {
      body = (await context.request.json()) as LaunchSubscriptionCheckoutInput;
    } catch {
      return badRequest('Invalid request body.');
    }

    if (!parseTermsAccepted(body)) {
      return termsAcceptedErrorResponse();
    }

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

    const pendingSub = await prisma.saasSubscription.findFirst({
      where: {
        customerEmail: { equals: email, mode: 'insensitive' },
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        shopSize: true,
        currentStack: true,
      },
    });

    const shopSize = pendingSub?.shopSize?.trim() || shopSizeFromBarberCount(shop._count.barbers);
    const currentStack = pendingSub?.currentStack?.trim() || 'kersivo-preview';

    const baseUrl = getPublicSiteUrl();
    const attribution = pickAttribution(body.attribution);
    const metadata = {
      ...buildSaasSubscriptionStripeMetadata(
        {
          customerName: name,
          email,
          shopName,
          shopSize,
          currentStack,
          shopId: access.shopId,
        },
        attribution,
      ),
      ...termsAcceptanceStripeMetadata(),
    };

    const session = await createSubscriptionCheckoutSession({
      customerEmail: email,
      successUrl: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/setup/cancel`,
      productId: 'saas-subscription',
      name: 'Kersivo — monthly subscription',
      unitAmount: SAAS_MONTHLY_PENCE,
      metadata,
    });

    try {
      await prisma.saasSubscription.create({
        data: {
          stripeSessionId: session.id,
          status: 'PENDING',
          customerName: name,
          customerEmail: email,
          shopName,
          shopSize,
          currentStack,
          monthlyPence: SAAS_MONTHLY_PENCE,
          activatedAt: null,
        },
      });
    } catch (error) {
      console.error('Launch subscription PENDING record create failed', {
        stripeSessionId: session.id,
        error,
      });
    }

    await recordTermsAcceptance({
      purpose: TERMS_ACCEPTANCE_PURPOSES.SAAS_CHECKOUT,
      email,
      userId: access.userId,
      shopId: access.shopId,
      stripeSessionId: session.id,
      request: context.request,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('Launch subscription checkout session creation failed', error);
    const detail =
      import.meta.env.DEV && error instanceof Error ? error.message : 'Unable to create checkout session.';
    return new Response(JSON.stringify({ error: detail }), { status: 500 });
  }
};
