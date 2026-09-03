export type OpenAiErrorCode =
  | 'OPENAI_AUTH_ERROR'
  | 'OPENAI_BILLING_ERROR'
  | 'OPENAI_RATE_LIMIT'
  | 'OPENAI_TIMEOUT'
  | 'OPENAI_BAD_REQUEST'
  | 'OPENAI_CONNECTION_ERROR'
  | 'OPENAI_SERVER_ERROR'
  | 'OPENAI_SDK_ERROR';

const API_KEY_PATTERN = /sk-[a-zA-Z0-9]/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumberProperty(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function readStringProperty(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function containsApiKeyPattern(value: string): boolean {
  return API_KEY_PATTERN.test(value);
}

function recordContainsApiKeyPattern(record: Record<string, unknown>): boolean {
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && containsApiKeyPattern(value)) {
      return true;
    }
  }
  const message = readStringProperty(record, 'message');
  if (message !== undefined && containsApiKeyPattern(message)) {
    return true;
  }
  return false;
}

function isBillingSignal(
  status: number | undefined,
  code: string | undefined,
  name: string | undefined,
): boolean {
  if (status === 402) return true;
  if (code === 'insufficient_quota' || code === 'credit_balance_exhausted') return true;
  if (name === 'InsufficientQuotaError') return true;
  return false;
}

function isAuthSignal(status: number | undefined, code: string | undefined, name: string | undefined): boolean {
  if (status === 401) return true;
  if (code === 'invalid_api_key' || code === 'authentication_error') return true;
  if (name === 'AuthenticationError') return true;
  return false;
}

function isRateLimitSignal(
  status: number | undefined,
  code: string | undefined,
  name: string | undefined,
): boolean {
  if (status === 429) return true;
  if (code === 'rate_limit_exceeded') return true;
  if (name === 'RateLimitError') return true;
  return false;
}

function isTimeoutSignal(code: string | undefined, name: string | undefined): boolean {
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'ABORT_ERR') return true;
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  return false;
}

function isBadRequestSignal(status: number | undefined, name: string | undefined): boolean {
  if (status === 400) return true;
  if (name === 'BadRequestError') return true;
  return false;
}

function isConnectionSignal(code: string | undefined, name: string | undefined): boolean {
  if (
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN'
  ) {
    return true;
  }
  if (name === 'APIConnectionError') return true;
  return false;
}

function isServerErrorSignal(status: number | undefined, name: string | undefined): boolean {
  if (status !== undefined && status >= 500 && status <= 599) return true;
  if (name === 'InternalServerError') return true;
  return false;
}

export function mapOpenAiSdkError(error: unknown): OpenAiErrorCode {
  if (!isRecord(error)) {
    return 'OPENAI_SDK_ERROR';
  }

  if (recordContainsApiKeyPattern(error)) {
    return 'OPENAI_AUTH_ERROR';
  }

  const status = readNumberProperty(error, 'status');
  const code = readStringProperty(error, 'code');
  const name = readStringProperty(error, 'name');

  if (isAuthSignal(status, code, name)) return 'OPENAI_AUTH_ERROR';
  if (isBillingSignal(status, code, name)) return 'OPENAI_BILLING_ERROR';
  if (isRateLimitSignal(status, code, name)) return 'OPENAI_RATE_LIMIT';
  if (isTimeoutSignal(code, name)) return 'OPENAI_TIMEOUT';
  if (isBadRequestSignal(status, name)) return 'OPENAI_BAD_REQUEST';
  if (isConnectionSignal(code, name)) return 'OPENAI_CONNECTION_ERROR';
  if (isServerErrorSignal(status, name)) return 'OPENAI_SERVER_ERROR';

  return 'OPENAI_SDK_ERROR';
}
