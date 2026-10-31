import { describe, expect, it } from 'vitest';
import {
  HUB_COOKIE_MAX_AGE_SECONDS,
  HUB_EXPIRED_COOKIE_MAX_AGE_SECONDS,
  clearHubCookie,
  hubCookieExpiry,
  readHubCookie,
  serializeHubCookie,
  signHubSession,
  verifyHubSession,
} from './hubSession';

const SECRET = 'test-secret-for-ks-hub-0123456789';
const NOW = new Date('2026-11-01T12:00:00Z');
const IN_A_WEEK = new Date(NOW.getTime() + 7 * 86_400_000);

function sign(input: { id?: string; expiresAt?: Date; operator?: boolean } = {}, secret = SECRET) {
  const value = signHubSession(
    { previewRequestId: input.id ?? 'req_abc123', expiresAt: input.expiresAt ?? IN_A_WEEK, operator: input.operator },
    secret,
  );
  if (!value) throw new Error('sign failed');
  return value;
}

describe('ks_hub signing', () => {
  it('round-trips an owner session as v1.<id>.<exp>.<hmac>', () => {
    const value = sign();
    expect(value).toMatch(/^v1\.req_abc123\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(verifyHubSession(value, NOW, SECRET)).toEqual({
      previewRequestId: 'req_abc123',
      expiresAt: new Date(Math.floor(IN_A_WEEK.getTime() / 1000) * 1000),
      operator: false,
    });
  });

  it('round-trips the operator flag', () => {
    const value = sign({ operator: true });
    expect(value.split('.')[3]).toBe('op');
    expect(verifyHubSession(value, NOW, SECRET)?.operator).toBe(true);
  });

  it('rejects an owner cookie promoted to operator, and an operator cookie demoted to owner', () => {
    const owner = sign().split('.');
    const promoted = [...owner.slice(0, 3), 'op', owner[3]].join('.');
    expect(verifyHubSession(promoted, NOW, SECRET)).toBeNull();

    const operator = sign({ operator: true }).split('.');
    const demoted = [...operator.slice(0, 3), operator[4]].join('.');
    expect(verifyHubSession(demoted, NOW, SECRET)).toBeNull();
  });

  it('rejects tampering with the id, the expiry or the signature', () => {
    const [v, , exp, mac] = sign().split('.');
    expect(verifyHubSession([v, 'req_other', exp, mac].join('.'), NOW, SECRET)).toBeNull();
    expect(verifyHubSession([v, 'req_abc123', String(Number(exp) + 60), mac].join('.'), NOW, SECRET)).toBeNull();
    const flipped = `${mac!.slice(0, -1)}${mac!.endsWith('A') ? 'B' : 'A'}`;
    expect(verifyHubSession([v, 'req_abc123', exp, flipped].join('.'), NOW, SECRET)).toBeNull();
  });

  it('rejects a cookie signed with another secret', () => {
    expect(verifyHubSession(sign({}, 'another-secret-value-0123456789'), NOW, SECRET)).toBeNull();
  });

  it('rejects a wrong version', () => {
    const parts = sign().split('.');
    expect(verifyHubSession(['v2', ...parts.slice(1)].join('.'), NOW, SECRET)).toBeNull();
  });

  it('rejects an expired cookie', () => {
    const value = sign({ expiresAt: new Date(NOW.getTime() + 1000) });
    expect(verifyHubSession(value, NOW, SECRET)).not.toBeNull();
    expect(verifyHubSession(value, new Date(NOW.getTime() + 2000), SECRET)).toBeNull();
  });

  it('rejects a lifetime longer than 30 days even when correctly signed', () => {
    const value = sign({ expiresAt: new Date(NOW.getTime() + 40 * 86_400_000) });
    expect(verifyHubSession(value, NOW, SECRET)).toBeNull();
  });

  it('rejects garbage and refuses to sign or verify without a secret', () => {
    for (const value of ['', 'v1', 'v1.a.b.c', 'v1.req.123.op.x.y', 'x'.repeat(300)]) {
      expect(verifyHubSession(value, NOW, SECRET)).toBeNull();
    }
    expect(signHubSession({ previewRequestId: 'req_1', expiresAt: IN_A_WEEK }, null)).toBeNull();
    expect(verifyHubSession(sign(), NOW, null)).toBeNull();
    expect(signHubSession({ previewRequestId: 'bad id!', expiresAt: IN_A_WEEK }, SECRET)).toBeNull();
  });
});

describe('ks_hub lifetime', () => {
  it('is min(30 days, preview expiry) while the preview can expire', () => {
    expect(hubCookieExpiry({ stage: 'review', previewExpiresAt: IN_A_WEEK }, NOW)).toEqual(IN_A_WEEK);
    const far = new Date(NOW.getTime() + 60 * 86_400_000);
    expect(hubCookieExpiry({ stage: 'requested', previewExpiresAt: far }, NOW).getTime()).toBe(
      NOW.getTime() + HUB_COOKIE_MAX_AGE_SECONDS * 1000,
    );
  });

  it('is 30 days once paid, and 24 hours for an expired preview', () => {
    expect(hubCookieExpiry({ stage: 'launch', previewExpiresAt: IN_A_WEEK }, NOW).getTime()).toBe(
      NOW.getTime() + HUB_COOKIE_MAX_AGE_SECONDS * 1000,
    );
    expect(hubCookieExpiry({ stage: 'expired', previewExpiresAt: new Date(NOW.getTime() - 1000) }, NOW).getTime()).toBe(
      NOW.getTime() + HUB_EXPIRED_COOKIE_MAX_AGE_SECONDS * 1000,
    );
  });
});

describe('ks_hub cookie header', () => {
  it('is HttpOnly, Secure, SameSite=Lax, Path=/ with a Max-Age', () => {
    const header = serializeHubCookie('v1.x.1.y', IN_A_WEEK, NOW);
    expect(header).toBe(`ks_hub=v1.x.1.y; Max-Age=${7 * 86_400}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  });

  it('clears with Max-Age=0 and the same attributes', () => {
    expect(clearHubCookie()).toBe('ks_hub=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  });

  it('reads only the ks_hub cookie', () => {
    const request = new Request('http://localhost/admin', {
      headers: { cookie: 'a=1; ks_hub=v1.req.1.mac; ks_hub_x=2' },
    });
    expect(readHubCookie(request)).toBe('v1.req.1.mac');
    expect(readHubCookie(new Request('http://localhost/admin'))).toBeNull();
  });
});
