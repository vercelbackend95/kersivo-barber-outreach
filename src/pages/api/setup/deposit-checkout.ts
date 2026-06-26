export const prerender = false;

import type { APIRoute } from 'astro';
import { getSetupPlan, isSetupPlanId } from '../../../lib/setup/plans';
import { getPublicSiteUrl } from '../../../lib/setup/siteUrl';
import { createCheckoutSession } from '../../../lib/shop/stripe';

type DepositCheckoutInput = {
  plan: string;
  name: string;
  email: string;
  shopName: string;
  shopSize: string;
  currentStack: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_META = 120;

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 400 });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: DepositCheckoutInput;
    try {
      body = (await request.json()) as DepositCheckoutInput;
    } catch {
      return badRequest('Invalid request body.');
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
        type: 'setup_deposit',
        plan: planId,
        customerName: name,
        email,
        shopName,
        shopSize,
        currentStack,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('Setup deposit checkout session creation failed', error);
    return new Response(JSON.stringify({ error: 'Unable to create checkout session.' }), { status: 500 });
  }
};
