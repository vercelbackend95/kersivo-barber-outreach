export const prerender = false;

import type { APIRoute } from 'astro';
import { processDueAppointmentEmailReminders } from '../../../lib/email/reminders';

function cronSecret(): string {
  return (import.meta.env.CRON_SECRET ?? process.env.CRON_SECRET ?? '').toString().trim();
}

function isProductionRuntime(): boolean {
  return import.meta.env.PROD === true || process.env.NODE_ENV === 'production';
}

function authorize(request: Request): Response | null {
  const expected = cronSecret();
  if (!expected) {
    if (isProductionRuntime()) {
      return new Response(JSON.stringify({ error: 'CRON_SECRET is not configured.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return null;
  }

  const header = request.headers.get('authorization') ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured.
  if (bearer && bearer === expected) return null;

  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handle(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const summary = await processDueAppointmentEmailReminders(new Date());
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[cron/email-reminders] failed', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Email reminder cron failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

/** Vercel Cron invokes GET. */
export const GET: APIRoute = async ({ request }) => handle(request);

/** Manual / scripted runs may POST. */
export const POST: APIRoute = async ({ request }) => handle(request);
