export type OpsSeverity = 'info' | 'warning' | 'critical';

export type OpsAlertInput = {
  severity: OpsSeverity;
  title: string;
  body: string;
  /** Idempotency key — same key within cooldown suppresses duplicate Slack posts. */
  dedupeKey: string;
  fields?: Record<string, string | number | boolean | null | undefined>;
  /** Override default cooldown (ms). Default 15 minutes. */
  cooldownMs?: number;
};

export type OpsAlertResult = {
  sent: boolean;
  skippedReason?: 'no_webhook' | 'deduped' | 'send_failed';
};

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;

/** In-process cooldown (best-effort on serverless — DB dedupe is preferred when available). */
const memoryCooldown = new Map<string, number>();

function slackWebhookUrl(): string {
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.OPS_SLACK_WEBHOOK_URL) ||
    process.env.OPS_SLACK_WEBHOOK_URL ||
    ''
  )
    .toString()
    .trim();
}

function formatSlackPayload(input: OpsAlertInput): Record<string, unknown> {
  const emoji = input.severity === 'critical' ? ':rotating_light:' : input.severity === 'warning' ? ':warning:' : ':information_source:';
  const fieldLines = Object.entries(input.fields ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `• *${key}:* ${String(value)}`)
    .join('\n');

  const text = [
    `${emoji} *${input.title}*`,
    input.body,
    fieldLines,
    `_dedupe: ${input.dedupeKey}_`,
  ]
    .filter(Boolean)
    .join('\n');

  return { text };
}

function isMemoryDeduped(dedupeKey: string, cooldownMs: number, nowMs: number): boolean {
  const last = memoryCooldown.get(dedupeKey);
  if (last != null && nowMs - last < cooldownMs) return true;
  memoryCooldown.set(dedupeKey, nowMs);
  return false;
}

export type AlertSinkDeps = {
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  webhookUrl?: string;
  /** Optional durable cooldown check — return true if alert should be suppressed. */
  isDeduped?: (dedupeKey: string, cooldownMs: number) => Promise<boolean>;
  /** Called after a successful send when durable dedupe is used. */
  markSent?: (dedupeKey: string) => Promise<void>;
};

/**
 * Notify ops (Slack Incoming Webhook by default).
 * No-op when `OPS_SLACK_WEBHOOK_URL` is unset (local/dev).
 */
export async function notifyOps(
  input: OpsAlertInput,
  deps: AlertSinkDeps = {},
): Promise<OpsAlertResult> {
  const webhookUrl = (deps.webhookUrl ?? slackWebhookUrl()).trim();
  if (!webhookUrl) {
    return { sent: false, skippedReason: 'no_webhook' };
  }

  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const nowMs = (deps.nowMs ?? Date.now)();

  if (deps.isDeduped) {
    if (await deps.isDeduped(input.dedupeKey, cooldownMs)) {
      return { sent: false, skippedReason: 'deduped' };
    }
  } else if (isMemoryDeduped(input.dedupeKey, cooldownMs, nowMs)) {
    return { sent: false, skippedReason: 'deduped' };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatSlackPayload(input)),
    });
    if (!response.ok) {
      console.error('[ops/alertSink] Slack webhook failed', {
        status: response.status,
        dedupeKey: input.dedupeKey,
      });
      return { sent: false, skippedReason: 'send_failed' };
    }
    if (deps.markSent) {
      await deps.markSent(input.dedupeKey);
    }
    return { sent: true };
  } catch (error) {
    console.error('[ops/alertSink] Slack webhook error', error);
    return { sent: false, skippedReason: 'send_failed' };
  }
}

/** Test helper — clear in-memory cooldown map. */
export function resetOpsAlertMemoryCooldown(): void {
  memoryCooldown.clear();
}
