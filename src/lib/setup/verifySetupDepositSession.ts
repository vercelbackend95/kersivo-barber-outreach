import { getSetupPlan, isSetupPlanId, type SetupPlanId } from '@/lib/setup/plans';
import { formatGbp } from '@/lib/shop/money';
import {
  getCheckoutPaymentIntentId,
  retrieveCheckoutSession,
  type StripeSession,
} from '@/lib/shop/stripe';

export type VerifiedSetupDepositView = {
  status: 'verified';
  sessionId: string;
  shortReference: string;
  planId: SetupPlanId;
  packageSlug: string;
  packageName: string;
  customerEmail: string;
  depositFormatted: string;
  remainingFormatted: string;
  depositValueGbp: number;
  transactionId: string;
};

export type SetupDepositViewResult =
  | VerifiedSetupDepositView
  | { status: 'missing_session' }
  | { status: 'unpaid' }
  | { status: 'invalid' }
  | { status: 'error'; message: string };

function shortRef(sessionId: string): string {
  const cleaned = sessionId.replace(/^cs_(test|live)_/i, '');
  return cleaned.slice(-8).toUpperCase();
}

export async function resolveSetupDepositSuccessView(
  sessionIdRaw: string | null,
): Promise<SetupDepositViewResult> {
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
  if ((metadata.type ?? '').trim() !== 'setup_deposit') {
    return { status: 'invalid' };
  }

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
