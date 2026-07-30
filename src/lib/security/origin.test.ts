import { describe, it, expect } from 'vitest';
import {
  evaluateOriginGate,
  isOriginExemptPath,
  parseAllowedOrigins,
  requiresOriginCheck,
} from './origin';

describe('origin security helpers', () => {
  it('exempts webhook, cron, ops, auth', () => {
    expect(isOriginExemptPath('/api/shop/webhook')).toBe(true);
    expect(isOriginExemptPath('/api/shop/webhook/')).toBe(true);
    expect(isOriginExemptPath('/api/cron/email-reminders')).toBe(true);
    expect(isOriginExemptPath('/api/ops/site-preview')).toBe(true);
    expect(isOriginExemptPath('/api/auth/callback/google')).toBe(true);
    expect(isOriginExemptPath('/api/contact')).toBe(false);
    expect(isOriginExemptPath('/api/admin/login')).toBe(false);
  });

  it('requires origin only for mutating /api paths that are not exempt', () => {
    expect(requiresOriginCheck('POST', '/api/contact')).toBe(true);
    expect(requiresOriginCheck('GET', '/api/contact')).toBe(false);
    expect(requiresOriginCheck('POST', '/api/shop/webhook')).toBe(false);
    expect(requiresOriginCheck('POST', '/page')).toBe(false);
  });

  it('allows same-host origin', () => {
    const result = evaluateOriginGate({
      method: 'POST',
      pathname: '/api/contact',
      request: new Request('http://localhost:4321/api/contact', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:4321',
          host: 'localhost:4321',
          'x-forwarded-proto': 'http',
        },
      }),
      allowlist: parseAllowedOrigins({}),
      allowVercelPreview: false,
      isProd: false,
    });
    expect(result.allowed).toBe(true);
  });

  it('denies missing origin on mutating api', () => {
    const result = evaluateOriginGate({
      method: 'POST',
      pathname: '/api/contact',
      request: new Request('http://localhost:4321/api/contact', {
        method: 'POST',
        headers: { host: 'localhost:4321' },
      }),
      allowlist: parseAllowedOrigins({}),
      allowVercelPreview: false,
      isProd: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing_origin');
  });

  it('allows allowlisted origin', () => {
    const result = evaluateOriginGate({
      method: 'POST',
      pathname: '/api/setup/subscription-checkout',
      request: new Request('https://kersivo.co.uk/api/setup/subscription-checkout', {
        method: 'POST',
        headers: {
          origin: 'https://kersivo.co.uk',
          host: 'other-host.example',
          'x-forwarded-proto': 'https',
        },
      }),
      allowlist: parseAllowedOrigins({}),
      allowVercelPreview: false,
      isProd: true,
    });
    expect(result.allowed).toBe(true);
  });
});
