export type OpenAiTelemetryOperation = 'classify_service' | 'classify_product' | 'rerank';

export type OpenAiUsageTelemetryKnown = {
  usageKnown: true;
  operation: OpenAiTelemetryOperation;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  fixtureId?: string;
  outcome: 'success' | 'fallback';
  errorCode?: string;
};

export type OpenAiUsageTelemetryUnknown = {
  usageKnown: false;
  operation: OpenAiTelemetryOperation;
  modelId: string;
  durationMs: number;
  fixtureId?: string;
  outcome: 'success' | 'fallback';
  errorCode?: string;
};

export type OpenAiUsageTelemetry = OpenAiUsageTelemetryKnown | OpenAiUsageTelemetryUnknown;

export type TelemetrySink = (event: OpenAiUsageTelemetry) => void;

export type TelemetryOptions = {
  sink: TelemetrySink;
  operation: OpenAiTelemetryOperation;
  fixtureId?: string;
};
