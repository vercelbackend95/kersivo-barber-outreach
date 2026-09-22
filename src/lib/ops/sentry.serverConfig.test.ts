import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const init = vi.fn();
const isInitialized = vi.fn();

vi.mock('@sentry/astro', () => ({
  init: (...args: unknown[]) => init(...args),
  isInitialized: (...args: unknown[]) => isInitialized(...args),
}));

vi.mock('@/lib/ops/sentryPiiScrub', () => ({
  scrubSentryEvent: (event: unknown) => event,
}));

describe('ensureSentryServerInitialized', () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockReset();
    isInitialized.mockReset();
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_ENVIRONMENT;
    delete process.env.VERCEL_ENV;
  });

  it('initializes when no client exists', async () => {
    isInitialized.mockReturnValue(false);
    process.env.SENTRY_DSN = 'https://example.invalid/1';
    process.env.VERCEL_ENV = 'production';

    const { ensureSentryServerInitialized } = await import('../../../sentry.server.config');
    init.mockClear();
    ensureSentryServerInitialized();

    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0.05);
    expect(options.enabled).toBe(true);
    expect(options.environment).toBe('production');
    expect(typeof options.beforeSend).toBe('function');
  });

  it('does not initialize again when already initialized', async () => {
    isInitialized.mockReturnValue(true);

    const { ensureSentryServerInitialized } = await import('../../../sentry.server.config');
    init.mockClear();
    ensureSentryServerInitialized();
    ensureSentryServerInitialized();

    expect(init).not.toHaveBeenCalled();
  });

  it('keeps beforeSend wired to scrubSentryEvent in source', () => {
    const src = readFileSync(resolve(process.cwd(), 'sentry.server.config.ts'), 'utf8');
    expect(src).toContain('sendDefaultPii: false');
    expect(src).toContain('tracesSampleRate: 0.05');
    expect(src).toContain('scrubSentryEvent');
    expect(src).toContain('isInitialized()');
  });
});

describe('middleware server Sentry wiring', () => {
  it('loads sentry.server.config as a side-effect import', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/middleware.ts'), 'utf8');
    expect(src).toMatch(/import\s+['"]\.\.\/sentry\.server\.config['"]/);
  });
});
