export const prerender = false;

import type { APIRoute } from 'astro';
import {
  reconcileInternalSignupNotifications,
  type ReconcileInternalNotificationsResult,
} from '@/lib/email/internalSignupNotifications';
import { processDueEmailOutbox } from '@/lib/email/outbox';
import { authorizeCronRequest } from '@/lib/ops/cronAuth';
import { opsLogError } from '@/lib/ops/opsLog';
import { captureOpsException } from '@/lib/ops/sentry';

async function handle(request: Request): Promise<Response> {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const now = new Date();

  // Isolated: a reconciliation failure must never block delivery of already-queued email.
  let reconcile: ReconcileInternalNotificationsResult | { error: string } | null = null;
  try {
    reconcile = await reconcileInternalSignupNotifications(now);
  } catch (error) {
    opsLogError('email.internal', 'reconcile_failed', error);
    captureOpsException(error, { route: 'cron.email-outbox.reconcile', opsAlert: true });
    reconcile = { error: 'reconcile_failed' };
  }

  try {
    const summary = await processDueEmailOutbox(now);
    return new Response(JSON.stringify({ ok: true, ...summary, reconcile }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    opsLogError('email.outbox', 'cron_failed', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'email-outbox failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
