import { describe, it, expect } from 'vitest';
import { applySecurityHeaders, buildContentSecurityPolicy } from './headers';

describe('applySecurityHeaders', () => {
  it('sets core security headers', () => {
    const res = applySecurityHeaders(new Response('ok'), { isProd: true, isHttps: true });
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('omits HSTS when not https', () => {
    const res = applySecurityHeaders(new Response('ok'), { isProd: false, isHttps: false });
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('CSP allows Stripe scripts', () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain('https://js.stripe.com');
    expect(csp).toContain('frame-ancestors');
  });

  it('CSP allows Google Ads doubleclick collect endpoints', () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain('https://googleads.g.doubleclick.net');
    expect(csp).toContain('https://stats.g.doubleclick.net');
    expect(csp).toContain('https://ad.doubleclick.net');
  });

  it('CSP allows Google Ads remarketing scripts', () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toMatch(
      /script-src[^;]*https:\/\/googleads\.g\.doubleclick\.net/,
    );
    expect(csp).toMatch(/script-src[^;]*https:\/\/www\.googleadservices\.com/);
  });
});
