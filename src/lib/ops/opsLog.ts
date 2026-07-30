export type OpsLogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * Structured JSON-line ops log (queryable in Vercel logs).
 * Never pass raw email/phone — use redacted ids only.
 */
export function opsLog(
  scope: string,
  event: string,
  fields: OpsLogFields = {},
): void {
  const payload = {
    scope,
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  console.info(JSON.stringify(payload));
}

export function opsLogError(
  scope: string,
  event: string,
  error: unknown,
  fields: OpsLogFields = {},
): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      scope,
      event,
      ts: new Date().toISOString(),
      error: message,
      ...fields,
    }),
  );
}
