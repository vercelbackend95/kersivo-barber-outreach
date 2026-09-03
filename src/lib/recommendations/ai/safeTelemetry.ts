import type { OpenAiUsageTelemetry, TelemetrySink } from './telemetry';

export function emitTelemetrySafe(
  sink: TelemetrySink | undefined,
  event: OpenAiUsageTelemetry,
): void {
  if (!sink) return;
  try {
    sink(event);
  } catch {
    // Telemetry must never affect classifier outcomes.
  }
}
