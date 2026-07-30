export const prerender = false;

import type { APIRoute } from 'astro';
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

type SubscriptionCheckoutInput = {
  name: string;
  email: string;
  shopName: string;
  shopSize: string;
  currentStack: string;
  townCity?: string | null;
  barbers?: string | null;
  attribution?: Record<string, string>;
  termsAccepted?: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_META = 120;
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

export const POST: APIRoute = async ({ request }) => {
  try {

    let body: SubscriptionCheckoutInput;
    try {
      body = (await request.json()) as SubscriptionCheckoutInput;
    } catch {
      return badRequest('Invalid request body.');
    }

    if (!parseTermsAccepted(body)) {
      return termsAcceptedErrorResponse();
    }

    const name = body.name?.trim() ?? '';
    if (name.length < 2) {
      return badRequest('Name must be at least 2 characters.');
    }

    const email = body.email?.trim().toLowerCase() ?? '';
    if (!email || !EMAIL_REGEX.test(email)) {
      return badRequest('Valid email is required.');
    }

    const shopName = body.shopName?.trim() ?? '';
    if (shopName.length < 2) {
      return badRequest('Shop name must be at least 2 characters.');
    }

    const shopSize = body.shopSize?.trim() ?? '';
    if (!shopSize || shopSize.length > MAX_META) {
      return badRequest('Shop size is required.');
    }

    const currentStack = body.currentStack?.trim() ?? '';
    if (!currentStack || currentStack.length > MAX_META) {
      return badRequest('Current stack is required.');
    }

    const baseUrl = getPublicSiteUrl();
    const attribution = pickAttribution(body.attribution);
    const townCity = typeof body.townCity === 'string' ? body.townCity.trim().slice(0, 200) : '';
    const barbers = typeof body.barbers === 'string' ? body.barbers.trim().slice(0, 500) : '';

    const session = await createSubscriptionCheckoutSession({
      customerEmail: email,
      successUrl: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/setup/cancel`,
      productId: 'saas-subscription',
      name: 'Kersivo — monthly subscription',
      unitAmount: SAAS_MONTHLY_PENCE,
      metadata: {
        ...buildSaasSubscriptionStripeMetadata(
          {
            customerName: name,
            email,
            shopName,
            shopSize,
            currentStack,
            townCity: townCity || null,
            barbers: barbers || null,
          },
          attribution,
        ),
        ...termsAcceptanceStripeMetadata(),
      },
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
      console.error('SaaS subscription PENDING record create failed', {
        stripeSessionId: session.id,
        error,
      });
    }

    await recordTermsAcceptance({
      purpose: TERMS_ACCEPTANCE_PURPOSES.SAAS_CHECKOUT,
      email,
      stripeSessionId: session.id,
      request,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('SaaS subscription checkout session creation failed', error);
    const detail =
      import.meta.env.DEV && error instanceof Error ? error.message : 'Unable to create checkout session.';
    return new Response(JSON.stringify({ error: detail }), { status: 500 });
  }
};
