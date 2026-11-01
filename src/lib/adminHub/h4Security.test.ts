import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateOriginGate, parseAllowedOrigins } from '@/lib/security/origin';
import {
  HUB_ADMIN_API_ALLOWLIST,
  isHubAdminApiAllowed,
} from './hubAdminAccess';
import {
  deniedAdminApiEndpoints,
  formatAdminApiAllowlistTable,
  listAdminApiEndpoints,
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
