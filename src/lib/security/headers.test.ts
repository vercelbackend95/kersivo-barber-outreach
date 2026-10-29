import { describe, it, expect } from 'vitest';
import { EXTRA_FRAME_SRC_HEADER, applySecurityHeaders, buildContentSecurityPolicy } from './headers';

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

  it('lets a route make Referrer-Policy stricter, never looser', () => {
    const strict = applySecurityHeaders(new Response('ok', { headers: { 'Referrer-Policy': 'no-referrer' } }));
    expect(strict.headers.get('Referrer-Policy')).toBe('no-referrer');
    const loose = applySecurityHeaders(new Response('ok', { headers: { 'Referrer-Policy': 'unsafe-url' } }));
    expect(loose.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('adds one validated https origin to frame-src and strips the internal header', () => {
    const res = applySecurityHeaders(
      new Response('ok', { headers: { [EXTRA_FRAME_SRC_HEADER]: 'https://sharp-cuts.vercel.app/some/path' } }),
    );
    expect(res.headers.get('Content-Security-Policy')).toMatch(/frame-src [^;]*https:\/\/sharp-cuts\.vercel\.app(;|$)/);
    expect(res.headers.get(EXTRA_FRAME_SRC_HEADER)).toBeNull();
    for (const bad of ['http://insecure.example', "https://x.example; script-src *", 'javascript:alert(1)']) {
      const csp = applySecurityHeaders(new Response('ok', { headers: { [EXTRA_FRAME_SRC_HEADER]: bad } })).headers.get(
        'Content-Security-Policy',
      )!;
      expect(csp).not.toMatch(/insecure|script-src \*|javascript/);
    }
    expect(buildContentSecurityPolicy()).toContain("frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.google.com;");
  });
});
