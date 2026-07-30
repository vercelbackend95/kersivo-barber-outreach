export function cronSecret(): string {
  return (import.meta.env.CRON_SECRET ?? process.env.CRON_SECRET ?? '').toString().trim();
}

export function isProductionRuntime(): boolean {
  return (
    import.meta.env.PROD === true ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

/** Shared auth for `/api/cron/*` and `/api/ops/*` (Bearer CRON_SECRET). */
export function authorizeCronRequest(request: Request): Response | null {
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
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (bearer && bearer === expected) return null;

  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
