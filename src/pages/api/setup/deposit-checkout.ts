export const prerender = false;

import type { APIRoute } from 'astro';
import { SetupPlan, SetupDepositStatus } from '@prisma/client';
import { prisma } from '../../../lib/db/client';
import {
  parseTermsAccepted,
  recordTermsAcceptance,
  termsAcceptanceStripeMetadata,
  termsAcceptedErrorResponse,
} from '../../../lib/legal/requireTermsAcceptance';
import { TERMS_ACCEPTANCE_PURPOSES } from '../../../lib/legal/termsVersion';
import { buildSetupDepositStripeMetadata, getSetupPlan, isSetupPlanId } from '../../../lib/setup/plans';
import { getPublicSiteUrl } from '../../../lib/setup/siteUrl';
import { createCheckoutSession } from '../../../lib/shop/stripe';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

type DepositCheckoutInput = {
  plan: string;
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
    const limited = await enforceIpRateLimit(request, 'setup_checkout', 10, 15 * 60 * 1000);
    if (limited) return limited;

    let body: DepositCheckoutInput;
    try {
      body = (await request.json()) as DepositCheckoutInput;
    } catch {
      return badRequest('Invalid request body.');
    }

    if (!parseTermsAccepted(body)) {
      return termsAcceptedErrorResponse();
    }

    const planRaw = String(body.plan ?? '').trim();
    if (!isSetupPlanId(planRaw)) {
      return badRequest('Valid plan is required.');
    }
    const planId = planRaw;

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

    const planConfig = getSetupPlan(planId);
    const baseUrl = getPublicSiteUrl();
    const attribution = pickAttribution(body.attribution);
    const townCity = typeof body.townCity === 'string' ? body.townCity.trim().slice(0, 200) : '';
    const barbers = typeof body.barbers === 'string' ? body.barbers.trim().slice(0, 500) : '';

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
      metadata: {
        ...buildSetupDepositStripeMetadata(
          planId,
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
      console.error('Setup deposit PENDING record create failed', {
        stripeSessionId: session.id,
        error,
      });
    }

    await recordTermsAcceptance({
      purpose: TERMS_ACCEPTANCE_PURPOSES.SETUP_DEPOSIT_CHECKOUT,
      email,
      stripeSessionId: session.id,
      request,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('Setup deposit checkout session creation failed', error);
    return new Response(JSON.stringify({ error: 'Unable to create checkout session.' }), { status: 500 });
  }
};
