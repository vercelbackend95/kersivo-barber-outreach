import { describe, expect, it } from 'vitest';

import { isSentryServerEnabled } from './sentryEnabled';

const DSN = 'https://key@o0.ingest.sentry.io/1';

describe('isSentryServerEnabled', () => {
  it.each(['production', 'preview', 'Production'])('is on for VERCEL_ENV=%s with a DSN', (vercelEnv) => {
    expect(isSentryServerEnabled({ dsn: DSN, vercelEnv, enableLocal: undefined })).toBe(true);
  });

  it.each([undefined, '', 'development'])('is off locally (VERCEL_ENV=%s) even with a DSN', (vercelEnv) => {
    expect(isSentryServerEnabled({ dsn: DSN, vercelEnv, enableLocal: undefined })).toBe(false);
  });

  it('is on locally only with an explicit SENTRY_ENABLE_LOCAL=true', () => {
    expect(isSentryServerEnabled({ dsn: DSN, vercelEnv: undefined, enableLocal: 'true' })).toBe(true);
    expect(isSentryServerEnabled({ dsn: DSN, vercelEnv: 'development', enableLocal: 'TRUE' })).toBe(true);
    expect(isSentryServerEnabled({ dsn: DSN, vercelEnv: undefined, enableLocal: '1' })).toBe(false);
    expect(isSentryServerEnabled({ dsn: DSN, vercelEnv: undefined, enableLocal: 'false' })).toBe(false);
  });

  it('is always off without a DSN', () => {
    expect(isSentryServerEnabled({ dsn: undefined, vercelEnv: 'production', enableLocal: 'true' })).toBe(false);
    expect(isSentryServerEnabled({ dsn: '  ', vercelEnv: 'preview', enableLocal: undefined })).toBe(false);
  });
});
