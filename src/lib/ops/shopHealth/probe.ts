/**
 * HTTP probe for shop health. Only URLs derived from the shop's own records are fetched (see
 * checks/probes.ts), and every request goes through this SSRF guard:
 *   - https only, default port, no credentials in the URL;
 *   - DNS is resolved ONCE per hop and every address is checked against private, loopback, link-local,
 *     CGNAT, documentation, multicast and metadata ranges (IPv4 + IPv6, incl. IPv4-mapped and NAT64);
 *     the connection then goes to that resolved IP (pinned lookup), so DNS rebinding cannot swap it;
 *   - redirects are followed manually: at most 3, https only, same registrable domain;
 *   - 10 s timeout for the whole probe, 2 MB body cap;
 *   - User-Agent KERSIVO-HealthCheck/1.0 and X-Kersivo-Health: 1 (secret only to kersivo.co.uk).
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';
import type { TLSSocket } from 'node:tls';
import { healthProbeHeaders } from '@/lib/ops/healthProbeAuth';

export const PROBE_TIMEOUT_MS = 10_000;
export const PROBE_MAX_BYTES = 2 * 1024 * 1024;
export const PROBE_MAX_REDIRECTS = 3;

export type ResolvedAddress = { address: string; family: 4 | 6 };

export type ProbeTransportResponse = {
  status: number;
  headers: Record<string, string>;
  body: AsyncIterable<Uint8Array>;
  /** Certificate expiry (TLS valid_to), when the transport can read it. */
  certValidTo: Date | null;
  abort(): void;
};

/** One HTTPS request to `url`, connecting to `pinned` (never re-resolving the hostname). */
export type ProbeTransport = (
  url: URL,
  pinned: ResolvedAddress,
  options: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<ProbeTransportResponse>;

export type ProbeLookup = (hostname: string) => Promise<ResolvedAddress[]>;

export type ProbeOk = {
  ok: true;
  status: number;
  headers: Record<string, string>;
  body: string;
  finalUrl: string;
  redirects: number;
  durationMs: number;
  certValidTo: Date | null;
};

export type ProbeFailureCode = 'blocked' | 'dns' | 'redirect' | 'timeout' | 'too_large' | 'network';
export type ProbeFail = { ok: false; code: ProbeFailureCode; reason: string; durationMs: number; finalUrl: string };
export type ProbeResult = ProbeOk | ProbeFail;

// ---------------------------------------------------------------------------------------------------
// Address checks

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, incl. 169.254.169.254 metadata
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

export function isBlockedIpv4(ip: string): boolean {
  if (isIP(ip) !== 4) return true;
  const value = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

/** Expands an IPv6 address to 8 hextets (handles "::" and a trailing dotted IPv4). */
function expandIpv6(ip: string): number[] | null {
  let text = ip.toLowerCase().split('%')[0];
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    text = text.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = text.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined ? (tail ? tail.split(':') : []) : [];
  const fill = text.includes('::') ? 8 - headParts.length - tailParts.length : 0;
  const parts = [...headParts, ...Array(Math.max(0, fill)).fill('0'), ...tailParts];
  if (parts.length !== 8) return null;
  const out = parts.map((p) => parseInt(p, 16));
  return out.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? out : null;
}

export function isBlockedIpv6(ip: string): boolean {
  if (isIP(ip) !== 6) return true;
  const h = expandIpv6(ip);
  if (!h) return true;
  if (h.every((x) => x === 0)) return true; // ::
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true; // ::1
  const embeddedV4 = () => `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return isBlockedIpv4(embeddedV4()); // ::ffff:a.b.c.d
  if (h.slice(0, 6).every((x) => x === 0)) return true; // deprecated IPv4-compatible
  if (h[0] === 0x64 && h[1] === 0xff9b) return isBlockedIpv4(embeddedV4()); // NAT64
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local (incl. fd00:ec2::254 metadata)
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
  if ((h[0] & 0xff00) === 0xff00) return true; // multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true; // documentation
  if (h[0] === 0x2002) return isBlockedIpv4(`${h[1] >> 8}.${h[1] & 0xff}.${h[2] >> 8}.${h[2] & 0xff}`); // 6to4
  return false;
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

// ---------------------------------------------------------------------------------------------------
// Registrable domain (eTLD+1) — enough for the UK + common gTLD hosts shops use.

const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au', 'co.nz', 'co.ie', 'com.cy',
  'vercel.app', 'netlify.app', 'pages.dev', 'github.io', 'web.app', 'firebaseapp.com',
]);

export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return MULTI_LABEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

// ---------------------------------------------------------------------------------------------------

export function validateProbeUrl(raw: string | URL): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(String(raw));
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'only https URLs are checked' };
  if (url.username || url.password) return { ok: false, reason: 'URL contains credentials' };
  if (url.port && url.port !== '443') return { ok: false, reason: 'non-standard port' };
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return { ok: false, reason: 'internal host name' };
  }
  return { ok: true, url };
}

const defaultLookup: ProbeLookup = async (hostname) => {
  const bare = hostname.replace(/^\[|\]$/g, '');
  if (isIP(bare)) return [{ address: bare, family: isIP(bare) as 4 | 6 }];
  const rows = await dnsLookup(bare, { all: true, verbatim: true });
  return rows.map((r) => ({ address: r.address, family: r.family as 4 | 6 }));
};

const defaultTransport: ProbeTransport = (url, pinned, { headers, signal }) =>
  new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: 'https:',
        hostname: url.hostname,
        servername: isIP(url.hostname) ? undefined : url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
        signal,
        agent: false,
        // Pinned: the socket connects to the address checked above, never a fresh DNS answer.
        lookup: ((_host: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
          if (options?.all) callback(null, [{ address: pinned.address, family: pinned.family }]);
          else callback(null, pinned.address, pinned.family);
        }) as never,
      },
      (response) => {
        let certValidTo: Date | null = null;
        try {
          const cert = (response.socket as TLSSocket).getPeerCertificate?.();
          if (cert?.valid_to) certValidTo = new Date(cert.valid_to);
        } catch {
          certValidTo = null;
        }
        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers)) {
          if (value != null) out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
        }
        resolve({ status: response.statusCode ?? 0, headers: out, body: response, certValidTo, abort: () => response.destroy() });
      },
    );
    request.on('error', reject);
    request.end();
  });

export type ProbeOptions = {
  lookup?: ProbeLookup;
  transport?: ProbeTransport;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  env?: Record<string, string | undefined>;
};

/** GET one URL under the SSRF guard. Never throws. */
export async function probeUrl(target: string | URL, options: ProbeOptions = {}): Promise<ProbeResult> {
  const started = Date.now();
  const lookup = options.lookup ?? defaultLookup;
  const transport = options.transport ?? defaultTransport;
  const maxBytes = options.maxBytes ?? PROBE_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? PROBE_MAX_REDIRECTS;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_MS;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The deadline does not depend on the transport honouring the abort signal.
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
  });

  const first = validateProbeUrl(target);
  let current = first.ok ? first.url : null;
  const fail = (code: ProbeFailureCode, reason: string): ProbeFail => ({
    ok: false,
    code,
    reason,
    durationMs: Date.now() - started,
    finalUrl: current?.toString() ?? String(target),
  });

  const attempt = async (): Promise<ProbeResult> => {
    if (!first.ok || !current) return fail('blocked', first.ok ? 'invalid URL' : first.reason);
    const originDomain = registrableDomain(current.hostname);

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      let addresses: ResolvedAddress[];
      try {
        addresses = await lookup(current.hostname);
      } catch {
        return fail('dns', `could not resolve ${current.hostname}`);
      }
      if (!addresses.length) return fail('dns', `no address for ${current.hostname}`);
      const blocked = addresses.find((a) => isBlockedAddress(a.address));
      if (blocked) return fail('blocked', `${current.hostname} resolves to a private or reserved address`);
      const pinned = addresses[0];

      const response = await transport(current, pinned, { headers: healthProbeHeaders(current, options.env), signal: controller.signal });

      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        response.abort();
        if (hop === maxRedirects) return fail('redirect', `more than ${maxRedirects} redirects`);
        const next = validateProbeUrl(new URL(response.headers.location, current));
        if (!next.ok) return fail('redirect', `redirect refused: ${next.reason}`);
        if (registrableDomain(next.url.hostname) !== originDomain) {
          return fail('redirect', `redirect to another site (${next.url.hostname})`);
        }
        current = next.url;
        continue;
      }

      const declared = Number(response.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        response.abort();
        return fail('too_large', `response larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      for await (const chunk of response.body) {
        total += chunk.byteLength;
        if (total > maxBytes) {
          response.abort();
          return fail('too_large', `response larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
        }
        chunks.push(chunk);
      }
      return {
        ok: true,
        status: response.status,
        headers: response.headers,
        body: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8'),
        finalUrl: current.toString(),
        redirects: hop,
        durationMs: Date.now() - started,
        certValidTo: response.certValidTo,
      };
    }
    return fail('redirect', 'too many redirects');
  };

  try {
    return await Promise.race([attempt(), deadline]);
  } catch (error) {
    if (timedOut) return fail('timeout', `no response within ${timeoutMs / 1000} s`);
    return fail('network', error instanceof Error ? error.message : 'network error');
  } finally {
    clearTimeout(timer);
  }
}
