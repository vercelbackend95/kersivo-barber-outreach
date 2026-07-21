import { getSetupPlan, isSetupPlanId } from '@/lib/setup/plans';
import { SAAS_MONTHLY_GBP, SAAS_MONTHLY_PENCE } from '@/lib/seo/defaults';
import { SAAS_SUBSCRIPTION_METADATA_TYPE } from '@/lib/setup/saasSubscription';
import { formatGbp } from '@/lib/shop/money';
import {
  getCheckoutPaymentIntentId,
  getCheckoutSubscriptionId,
  retrieveCheckoutSession,
  type StripeSession,
} from '@/lib/shop/stripe';

export type VerifiedSaasSubscriptionView = {
  status: 'verified';
  kind: 'saas_subscription';
  sessionId: string;
  shortReference: string;
  customerEmail: string;
  monthlyFormatted: string;
  monthlyValueGbp: number;
  transactionId: string;
};

export type VerifiedSetupDepositView = {
  status: 'verified';
  kind: 'setup_deposit';
  sessionId: string;
  shortReference: string;
  planId: string;
  packageSlug: string;
  packageName: string;
  customerEmail: string;
  depositFormatted: string;
  remainingFormatted: string;
  depositValueGbp: number;
  transactionId: string;
};

export type SetupSuccessViewResult =
  | VerifiedSaasSubscriptionView
  | VerifiedSetupDepositView
  | { status: 'missing_session' }
  | { status: 'unpaid' }
  | { status: 'invalid' }
  | { status: 'error'; message: string };

function shortRef(sessionId: string): string {
  const cleaned = sessionId.replace(/^cs_(test|live)_/i, '');
  return cleaned.slice(-8).toUpperCase();
}

export async function resolveSetupSuccessView(
  sessionIdRaw: string | null,
): Promise<SetupSuccessViewResult> {
  const sessionId = (sessionIdRaw ?? '').trim();
  if (!sessionId) return { status: 'missing_session' };

  let session: StripeSession;
  try {
    session = await retrieveCheckoutSession(sessionId);
  } catch (error) {
    console.error('[setup/success] Stripe session lookup failed', error);
    return { status: 'error', message: 'Stripe session lookup failed' };
  }

  const metadata = session.metadata ?? {};
  const type = (metadata.type ?? '').trim();

  if (type === SAAS_SUBSCRIPTION_METADATA_TYPE) {
    if ((session.payment_status ?? '').toLowerCase() !== 'paid') {
      return { status: 'unpaid' };
    }

    const customerEmail = (metadata.email ?? session.customer_email ?? '').trim().toLowerCase();
    if (!customerEmail) {
      return { status: 'invalid' };
    }

    const monthlyPence =
      typeof session.amount_total === 'number' ? session.amount_total : SAAS_MONTHLY_PENCE;
    const subscriptionId = getCheckoutSubscriptionId(session);
    const transactionId = subscriptionId || session.id;

    return {
      status: 'verified',
      kind: 'saas_subscription',
      sessionId: session.id,
      shortReference: shortRef(session.id),
      customerEmail,
      monthlyFormatted: formatGbp(monthlyPence),
      monthlyValueGbp: monthlyPence / 100 || SAAS_MONTHLY_GBP,
      transactionId,
    };
  }

  if (type === 'setup_deposit') {
    if ((session.payment_status ?? '').toLowerCase() !== 'paid') {
      return { status: 'unpaid' };
    }

    const planRaw = (metadata.plan ?? '').trim();
    if (!isSetupPlanId(planRaw)) {
      return { status: 'invalid' };
    }

    const plan = getSetupPlan(planRaw);
    const customerEmail = (metadata.email ?? session.customer_email ?? '').trim().toLowerCase();
    if (!customerEmail) {
      return { status: 'invalid' };
    }

    const depositPence =
      typeof session.amount_total === 'number' ? session.amount_total : plan.depositPence;
    const paymentIntentId = getCheckoutPaymentIntentId(session);
    const transactionId = paymentIntentId || session.id;

    return {
      status: 'verified',
      kind: 'setup_deposit',
      sessionId: session.id,
      shortReference: shortRef(session.id),
      planId: planRaw,
      packageSlug: plan.packageSlug,
      packageName: plan.name,
      customerEmail,
      depositFormatted: formatGbp(depositPence),
      remainingFormatted: formatGbp(plan.remainingPence),
      depositValueGbp: depositPence / 100,
      transactionId,
    };
  }

  return { status: 'invalid' };
}
