import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateOriginGate, parseAllowedOrigins } from '@/lib/security/origin';
import { signHubSession } from './hubSession';
import {
  HUB_ADMIN_API_ALLOWLIST,
  HUB_ADMIN_UNAVAILABLE_MESSAGE,
  isAdminApiPath,
  isHubAdminApiAllowed,
} from './hubAdminAccess';
import {
  deniedAdminApiEndpoints,
  formatAdminApiAllowlistTable,
  listAdminApiEndpoints,
  listAdminHubApiEndpoints,
} from './adminApiInventory';

const ALLOWLISTED_OUTBOUND = /from ['"]@\/lib\/(email|sms|mailer|shop\/stripe)['"]|from ['"]stripe['"]/;
const CLIENT_SHOP_ID = /searchParams\.get\(\s*['"]shopId['"]\s*\)|body\.shopId|parsed\.data\.shopId/;

const allowlist = parseAllowedOrigins({
  publicSiteUrl: 'http://127.0.0.1:4397',
  allowedOrigins: 'http://127.0.0.1:4397',
});

function originGate(input: { method: string; path: string; origin?: string | null; referer?: string | null }) {
  const headers = new Headers({ host: '127.0.0.1:4397' });
  if (input.origin) headers.set('origin', input.origin);
  if (input.referer) headers.set('referer', input.referer);
  return evaluateOriginGate({
    method: input.method,
    pathname: input.path,
    request: new Request(`http://127.0.0.1:4397${input.path}`, { method: input.method, headers }),
    allowlist,
    allowVercelPreview: false,
    isProd: false,
  });
}

describe('H4 hub admin API inventory', () => {
  const rows = listAdminApiEndpoints();

  it('discovers every /api/admin route file and classifies the allowlist', () => {
    expect(rows.length).toBeGreaterThan(80);
    const allowed = rows.filter((row) => row.allowlisted);
    expect(allowed.map((row) => `${row.method} ${row.path}`).sort()).toEqual(
      HUB_ADMIN_API_ALLOWLIST.map((entry) => `${entry.method} ${entry.path}`).sort(),
    );
  });

  it('denies every other discovered method+path', () => {
    const denied = deniedAdminApiEndpoints();
    expect(denied.length).toBeGreaterThan(50);
    for (const row of denied) {
      expect(isHubAdminApiAllowed(row.method, row.path.replace(/:[^/]+/g, 'x')), `${row.method} ${row.path}`).toBe(
        false,
      );
    }
  });

  it('never allowlists bookings, clients, reports, invites, billing, settings or AI', () => {
    const banned =
      /(^|\/)(bookings|clients|reports|orders|sales|ai)(\/|$)|invite|subscription|barbershop-settings|retail-onboarding|site-launch|preview-launch/;
    for (const row of rows.filter((entry) => entry.allowlisted)) {
      expect(banned.test(row.path), row.path).toBe(false);
    }
  });

  it('formats a markdown table for the security report', () => {
    const table = formatAdminApiAllowlistTable(rows);
    expect(table).toContain('| Method | Path | Allowlisted |');
    expect(table).toContain('`/api/admin/services`');
    expect(table).toContain('`/api/admin/bookings`');
  });
});

describe('H4 CSRF origin gate on allowlisted mutations', () => {
  it('allows same-origin POST even when Referer is stripped (Referrer-Policy: no-referrer)', () => {
    const result = originGate({
      method: 'POST',
      path: '/api/admin/services',
      origin: 'http://127.0.0.1:4397',
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks missing Origin/Referer and a foreign origin', () => {
    expect(originGate({ method: 'POST', path: '/api/admin/services' }).allowed).toBe(false);
    expect(
      originGate({
        method: 'POST',
        path: '/api/admin/shop/products/create',
        origin: 'https://evil.example',
      }).allowed,
    ).toBe(false);
  });

  it('does not skip the origin gate for hub allowlisted writes', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/middleware.ts'), 'utf8');
    expect(src.indexOf('evaluateOriginGate')).toBeGreaterThan(src.indexOf('isHubAdminApiAllowed'));
  });
});

describe('H4 allowlisted handlers stay tenant-bound and side-effect free', () => {
  it('does not read shopId from the client body or query on allowlisted files', () => {
    const files = new Set(listAdminApiEndpoints().filter((row) => row.allowlisted).map((row) => row.file));
    for (const file of files) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(src, file).toContain('access.shopId');
      expect(src, file).not.toMatch(CLIENT_SHOP_ID);
    }
  });

  it('does not import email, SMS or Stripe clients from allowlisted files', () => {
    const files = new Set(listAdminApiEndpoints().filter((row) => row.allowlisted).map((row) => row.file));
    for (const file of files) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(src, file).not.toMatch(ALLOWLISTED_OUTBOUND);
    }
  });
});

describe('H4 outbound routes stay off the allowlist', () => {
  it.each([
    ['POST', '/api/admin/team/invite'],
    ['POST', '/api/admin/members/invite'],
    ['POST', '/api/admin/team/invitations/x/resend'],
    ['POST', '/api/admin/subscription/upgrade-checkout'],
    ['POST', '/api/admin/bookings/manual'],
    ['POST', '/api/shop/webhook'],
  ] as const)('%s %s is not allowlisted', (method, path) => {
    expect(isHubAdminApiAllowed(method, path)).toBe(false);
  });
});

/**
 * Prefix trap: `pathname.startsWith('/api/admin')` is also true for
 * `/api/admin-hub/assets`. In production that sent every hub-only visitor
 * (valid `ks_hub`, no Better Auth cookie) through HUB_ADMIN_API_ALLOWLIST
 * and returned 403 "Not available in your preview." Uploads, about text,
 * colours, Changes, Messages, checkout, domain-search, event, reviews and
 * draft-shop all broke. Operator/founder QA with a Better Auth cookie never
 * hit the gate. `/api/admin-hub` is a separate surface — do not add it to
 * the allowlist.
 */
describe('H4 prefix trap: /api/admin-hub is not /api/admin', () => {
  const SECRET = 'h4-prefix-trap-test-secret-0123456789ab';
  const ORIGIN = 'http://127.0.0.1:4397';

  beforeEach(() => {
    vi.stubEnv('BETTER_AUTH_SECRET', SECRET);
    vi.stubEnv('PUBLIC_SITE_URL', ORIGIN);
    vi.stubEnv('ALLOWED_ORIGINS', ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock('astro:middleware');
  });

  function hubOnlyCookie(): string {
    return signHubSession(
      { previewRequestId: 'req_prefix', expiresAt: new Date(Date.now() + 7 * 86_400_000) },
      SECRET,
    )!;
  }

  function hubOnlyRequest(path: string, method: string): Request {
    return new Request(`${ORIGIN}${path}`, {
      method,
      headers: {
        cookie: `ks_hub=${hubOnlyCookie()}`,
        origin: ORIGIN,
        host: '127.0.0.1:4397',
        'content-type': 'application/json',
      },
      body: method === 'GET' || method === 'HEAD' || method === 'DELETE' ? undefined : '{}',
    });
  }

  async function loadMiddleware() {
    vi.resetModules();
    vi.doMock('astro:middleware', () => ({
      defineMiddleware: (fn: unknown) => fn,
    }));
    const { onRequest } = await import('../../middleware');
    return onRequest as unknown as (
      context: { request: Request; url: URL; locals: Record<string, unknown>; cookies: { get: () => undefined } },
      next: () => Promise<Response>,
    ) => Promise<Response>;
  }

  async function runMiddleware(
    onRequest: Awaited<ReturnType<typeof loadMiddleware>>,
    path: string,
    method: string,
  ) {
    let reachedHandler = false;
    const request = hubOnlyRequest(path, method);
    const response = await onRequest(
      {
        request,
        url: new URL(request.url),
        locals: {},
        cookies: { get: () => undefined },
      },
      async () => {
        reachedHandler = true;
        return new Response(JSON.stringify({ ok: true, via: 'handler' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );
    return { response, reachedHandler, body: await response.text() };
  }

  it('isAdminApiPath matches /api/admin only', () => {
    expect(isAdminApiPath('/api/admin')).toBe(true);
    expect(isAdminApiPath('/api/admin/')).toBe(true);
    expect(isAdminApiPath('/api/admin/services')).toBe(true);
    expect(isAdminApiPath('/api/admin-hub/assets')).toBe(false);
    expect(isAdminApiPath('/api/admin-demo/x')).toBe(false);
    expect(isAdminApiPath('/api/administrator')).toBe(false);
  });

  it('middleware does not answer /api/admin-hub with the preview-unavailable 403', async () => {
    const onRequest = await loadMiddleware();
    const rows = listAdminHubApiEndpoints();
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(isAdminApiPath(row.path), row.path).toBe(false);
      const { response, reachedHandler, body } = await runMiddleware(onRequest, row.path, row.method);
      expect(body, `${row.method} ${row.path}`).not.toContain(HUB_ADMIN_UNAVAILABLE_MESSAGE);
      expect(reachedHandler, `${row.method} ${row.path} should reach the handler`).toBe(true);
      expect(response.status, `${row.method} ${row.path}`).toBe(200);
    }
  });

  it('non-allowlisted /api/admin/* still 403 for a hub-only cookie', async () => {
    const onRequest = await loadMiddleware();
    const denied = deniedAdminApiEndpoints();
    expect(denied.length).toBeGreaterThan(50);
    const sample = denied.filter((row) =>
      ['/api/admin/bookings', '/api/admin/clients', '/api/admin/reports'].includes(row.path),
    );
    expect(sample.length).toBeGreaterThan(0);
    for (const row of denied) {
      const path = row.path.replace(/:[^/]+/g, 'x');
      expect(isAdminApiPath(path), path).toBe(true);
      expect(isHubAdminApiAllowed(row.method, path), `${row.method} ${path}`).toBe(false);
    }
    for (const row of sample) {
      const { response, reachedHandler, body } = await runMiddleware(onRequest, row.path, row.method);
      expect(reachedHandler, `${row.method} ${row.path}`).toBe(false);
      expect(response.status, `${row.method} ${row.path}`).toBe(403);
      expect(body).toContain(HUB_ADMIN_UNAVAILABLE_MESSAGE);
    }
  });

  it('middleware uses isAdminApiPath, not startsWith("/api/admin")', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/middleware.ts'), 'utf8');
    expect(src).toContain('isAdminApiPath');
    expect(src).not.toMatch(/startsWith\(ADMIN_API_PREFIX\)/);
    expect(src).not.toMatch(/startsWith\(['"]\/api\/admin['"]\)/);
  });
});
