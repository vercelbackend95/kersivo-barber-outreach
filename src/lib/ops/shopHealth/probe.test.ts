import { describe, expect, it, vi } from 'vitest';
import {
  isBlockedAddress,
  probeUrl,
  registrableDomain,
  type ProbeLookup,
  type ProbeTransport,
  type ResolvedAddress,
} from './probe';

const PUBLIC: ResolvedAddress = { address: '93.184.216.34', family: 4 };

function body(text: string): AsyncIterable<Uint8Array> {
  return (async function* () {
    yield new TextEncoder().encode(text);
  })();
}

function reply(status: number, text = '', headers: Record<string, string> = {}) {
  return { status, headers, body: body(text), certValidTo: null, abort: vi.fn() };
}

const lookupTo = (...addresses: ResolvedAddress[]): ProbeLookup => vi.fn(async () => addresses);

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.5.4', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '224.0.0.1', '198.18.0.1', '::1', '::', 'fe80::1', 'fc00::1', 'fd00:ec2::254', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
    '64:ff9b::a9fe:a9fe', '2001:db8::1', 'ff02::1', 'not-an-ip',
  ])('blocks %s', (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(['93.184.216.34', '76.76.21.21', '172.32.0.1', '2606:4700::6810:85e5', '::ffff:93.184.216.34'])('allows %s', (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe('registrableDomain', () => {
  it('handles .co.uk and plain TLDs', () => {
    expect(registrableDomain('www.fade-room.co.uk')).toBe('fade-room.co.uk');
    expect(registrableDomain('book.fade.barber')).toBe('fade.barber');
    expect(registrableDomain('shop-abc.vercel.app')).toBe('shop-abc.vercel.app');
  });
});

describe('probeUrl SSRF guard', () => {
  it('refuses http, credentials, odd ports and internal names without any DNS or request', async () => {
    const lookup = lookupTo(PUBLIC);
    const transport = vi.fn() as unknown as ProbeTransport;
    for (const url of ['http://fade.co.uk', 'https://user:pw@fade.co.uk', 'https://fade.co.uk:8443/', 'https://localhost/', 'https://db.internal/']) {
      const r = await probeUrl(url, { lookup, transport });
      expect(r).toMatchObject({ ok: false, code: 'blocked' });
    }
    expect(lookup).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it('refuses a host that resolves to a private address (any of its addresses)', async () => {
    const transport = vi.fn() as unknown as ProbeTransport;
    const r = await probeUrl('https://evil.example.com/', { lookup: lookupTo(PUBLIC, { address: '10.0.0.5', family: 4 }), transport });
    expect(r).toMatchObject({ ok: false, code: 'blocked' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('refuses IPv6 loopback and IPv4-mapped metadata', async () => {
    const transport = vi.fn() as unknown as ProbeTransport;
    expect(await probeUrl('https://a.example.com/', { lookup: lookupTo({ address: '::1', family: 6 }), transport })).toMatchObject({ code: 'blocked' });
    expect(
      await probeUrl('https://a.example.com/', { lookup: lookupTo({ address: '::ffff:169.254.169.254', family: 6 }), transport }),
    ).toMatchObject({ code: 'blocked' });
    expect(await probeUrl('https://[::1]/', { transport })).toMatchObject({ code: 'blocked' });
  });

  it('DNS rebinding: resolves once per hop and connects to that resolved IP', async () => {
    // A rebinding resolver: first answer public, every later answer private.
    let calls = 0;
    const lookup: ProbeLookup = vi.fn(async () => (calls++ === 0 ? [PUBLIC] : [{ address: '127.0.0.1', family: 4 as const }]));
    const transport = vi.fn(async () => reply(200, 'ok')) as unknown as ProbeTransport;
    const r = await probeUrl('https://rebind.example.com/', { lookup, transport });
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect((transport as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual(PUBLIC);
  });

  it('follows a same-site redirect but refuses one to another host', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(reply(301, '', { location: 'https://www.fade-room.co.uk/' }))
      .mockResolvedValueOnce(reply(200, '<html>ok</html>'));
    const ok = await probeUrl('https://fade-room.co.uk/', { lookup: lookupTo(PUBLIC), transport: transport as never });
    expect(ok).toMatchObject({ ok: true, redirects: 1, finalUrl: 'https://www.fade-room.co.uk/' });

    const cross = vi.fn().mockResolvedValueOnce(reply(302, '', { location: 'https://169.254.169.254/latest/meta-data' }));
    expect(await probeUrl('https://fade-room.co.uk/', { lookup: lookupTo(PUBLIC), transport: cross as never })).toMatchObject({
      ok: false,
      code: 'redirect',
    });
    const other = vi.fn().mockResolvedValueOnce(reply(302, '', { location: 'https://attacker.example/' }));
    expect(await probeUrl('https://fade-room.co.uk/', { lookup: lookupTo(PUBLIC), transport: other as never })).toMatchObject({
      ok: false,
      code: 'redirect',
    });
    const downgrade = vi.fn().mockResolvedValueOnce(reply(302, '', { location: 'http://fade-room.co.uk/' }));
    expect(await probeUrl('https://fade-room.co.uk/', { lookup: lookupTo(PUBLIC), transport: downgrade as never })).toMatchObject({
      ok: false,
      code: 'redirect',
    });
  });

  it('re-checks DNS on every redirect hop', async () => {
    const lookup: ProbeLookup = vi
      .fn()
      .mockResolvedValueOnce([PUBLIC])
      .mockResolvedValueOnce([{ address: '192.168.0.10', family: 4 }]);
    const transport = vi.fn().mockResolvedValueOnce(reply(301, '', { location: 'https://internal.fade-room.co.uk/' }));
    expect(await probeUrl('https://fade-room.co.uk/', { lookup, transport: transport as never })).toMatchObject({ ok: false, code: 'blocked' });
  });

  it('stops after 3 redirects', async () => {
    const transport = vi.fn(async () => reply(302, '', { location: 'https://fade-room.co.uk/loop' }));
    const r = await probeUrl('https://fade-room.co.uk/', { lookup: lookupTo(PUBLIC), transport: transport as never });
    expect(r).toMatchObject({ ok: false, code: 'redirect' });
    expect(transport).toHaveBeenCalledTimes(4);
  });

  it('caps the body at 2 MB (declared or streamed)', async () => {
    const declared = vi.fn(async () => reply(200, 'x', { 'content-length': String(3 * 1024 * 1024) }));
    expect(await probeUrl('https://fade-room.co.uk/', { lookup: lookupTo(PUBLIC), transport: declared as never })).toMatchObject({
      code: 'too_large',
    });
    const abort = vi.fn();
    const streamed = vi.fn(async () => ({
      status: 200,
      headers: {},
      certValidTo: null,
      abort,
      body: (async function* () {
        for (let i = 0; i < 5; i += 1) yield new Uint8Array(600 * 1024);
      })(),
    }));
    expect(await probeUrl('https://fade-room.co.uk/', { lookup: lookupTo(PUBLIC), transport: streamed as never })).toMatchObject({
      code: 'too_large',
    });
    expect(abort).toHaveBeenCalled();
  });

  it('times out even when the transport never answers', async () => {
    const transport = vi.fn(() => new Promise(() => {}));
    const r = await probeUrl('https://slow.example.com/', { lookup: lookupTo(PUBLIC), transport: transport as never, timeoutMs: 30 });
    expect(r).toMatchObject({ ok: false, code: 'timeout' });
  });

  it('sends the health headers, and the secret only to kersivo.co.uk', async () => {
    const env = { KERSIVO_HEALTH_PROBE_SECRET: 'a'.repeat(32) };
    const transport = vi.fn(async () => reply(200, 'ok'));
    await probeUrl('https://kersivo.co.uk/book/fade', { lookup: lookupTo(PUBLIC), transport: transport as never, env });
    await probeUrl('https://fade-room.co.uk/', { lookup: lookupTo(PUBLIC), transport: transport as never, env });
    const [own, tenant] = transport.mock.calls.map((c) => (c as unknown as [URL, ResolvedAddress, { headers: Record<string, string> }])[2].headers);
    expect(own).toMatchObject({ 'User-Agent': 'KERSIVO-HealthCheck/1.0', 'X-Kersivo-Health': '1', 'X-Kersivo-Health-Secret': 'a'.repeat(32) });
    expect(tenant['X-Kersivo-Health']).toBe('1');
    expect(tenant).not.toHaveProperty('X-Kersivo-Health-Secret');
  });
});
