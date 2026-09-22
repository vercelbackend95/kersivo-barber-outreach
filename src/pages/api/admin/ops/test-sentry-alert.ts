export const prerender = false;

/**
 * TEMPORARY OWNER-only endpoint to emit one production Sentry ops-alert
 * routing test via captureOpsMessage. Remove after a successful alert-rule check.
 * Does not call Slack / notifyOps.
 *
 * Awaits Sentry.flush so the short-lived serverless response does not return
 * before the transport has a chance to deliver the test event.
 */
import type { APIRoute } from 'astro';
import * as Sentry from '@sentry/astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { captureOpsMessage } from '@/lib/ops/sentry';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  if (access.role !== 'OWNER') {
    return json({ code: 'FORBIDDEN', error: 'Only the Owner can trigger this ops test.' }, 403);
  }

  captureOpsMessage('KERSIVO ops alert routing test', {
    level: 'warning',
    route: 'ops.sentryAlertRoutingTest',
    tags: {
      testEvent: 'true',
    },
  });

  try {
    const flushed = await Sentry.flush(3000);
    return json({ ok: true, flushed });
  } catch {
    return json({ ok: false, flushed: false }, 500);
  }
};
