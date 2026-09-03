const SECRET_VALUE_PATTERNS = [
  /sk-proj-[\w-]+/gi,
  /sk-[\w-]+/gi,
  /Bearer\s+[\w._-]+/gi,
  /Authorization:\s*\S+/gi,
  /OPENAI_API_KEY\s*=\s*\S+/gi,
];

const SECRET_PROPERTY_NAMES = new Set([
  'apikey',
  'api_key',
  'authorization',
  'openai_api_key',
]);

const REDACTED_BODY_KEYS = new Set([
  'stack',
  'stacktrace',
  'rawbody',
  'providerbody',
  'responsebody',
  'message',
]);

export function containsSecretLikeContent(input: string): boolean {
  for (const pattern of SECRET_VALUE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) return true;
  }
  return false;
}

export function sanitizeString(input: string): string {
  let result = input;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function shouldRedactProperty(key: string): boolean {
  return SECRET_PROPERTY_NAMES.has(key.toLowerCase());
}

function shouldRedactBodyKey(key: string): boolean {
  return REDACTED_BODY_KEYS.has(key.toLowerCase());
}

export function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[TRUNCATED]';
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item, depth + 1));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (shouldRedactProperty(key)) {
        result[key] = '[REDACTED]';
        continue;
      }
      if (shouldRedactBodyKey(key)) {
        result[key] =
          key.toLowerCase() === 'message' && typeof child === 'string' && containsSecretLikeContent(child)
            ? '[REDACTED_MESSAGE]'
            : key.toLowerCase() === 'stack' || key.toLowerCase() === 'stacktrace'
              ? '[REDACTED_STACK]'
              : '[REDACTED_PROVIDER_BODY]';
        continue;
      }
      if (key.toLowerCase() === 'headers' && child && typeof child === 'object') {
        const headers: Record<string, unknown> = {};
        for (const [headerKey, headerValue] of Object.entries(child as Record<string, unknown>)) {
          headers[headerKey] =
            headerKey.toLowerCase() === 'authorization' ? '[REDACTED]' : sanitizeUnknown(headerValue, depth + 1);
        }
        result[key] = headers;
        continue;
      }
      result[key] = sanitizeUnknown(child, depth + 1);
    }
    return result;
  }
  return String(value);
}

export function sanitizeReport<T>(report: T): T {
  return sanitizeUnknown(report) as T;
}

export function sanitizePayloadForCache(payload: unknown): unknown {
  return sanitizeUnknown(payload);
}
