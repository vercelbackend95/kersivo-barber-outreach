export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { assertBookingAccessible } from '@/lib/admin/rbac/scope';
import { retryDepositRefundForOperator } from '@/lib/booking/depositMoney';

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  // Owner/manager only — do not include bookings.self (barbers).
  const denied = requireAnyPermission(access, ['bookings.manage']);
  if (denied) return denied;

  const bookingId = (ctx.params.id ?? '').trim();
  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Missing booking id.' }), { status: 400 });
  }

  const scoped = await assertBookingAccessible(access, bookingId);
  if (scoped instanceof Response) return scoped;

  try {
    const result = await retryDepositRefundForOperator(bookingId);
    const message =
      result.outcome === 'refunded'
        ? 'Deposit refund confirmed.'
        : result.outcome === 'pending'
          ? 'Deposit refund is being processed.'
          : result.outcome === 'failed'
            ? 'Deposit refund failed again. Check Stripe Connect or try later.'
            : result.outcome === 'skipped_unpaid'
              ? 'No paid deposit to refund on this booking.'
              : result.outcome === 'skipped_forfeited'
                ? 'Deposit was forfeited — not eligible for refund.'
                : result.outcome === 'skipped_already'
                  ? 'Deposit already refunded.'
                  : 'Retry completed.';

    return new Response(
      JSON.stringify({
        outcome: result.outcome,
        refund: result.refund
          ? {
              id: result.refund.id,
              status: result.refund.status,
              amountPence: result.refund.amountPence,
              stripeRefundId: result.refund.stripeRefundId,
              attempts: result.refund.attempts,
              lastError: result.refund.lastError,
            }
          : null,
        message,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unhandled error while retrying deposit refund.', error);
    return new Response(
      JSON.stringify({ error: 'Unable to retry deposit refund right now. Please try again.' }),
      { status: 500 },
    );
  }
};
