import { getPublicSiteUrl } from '../setup/siteUrl';

export const FULL_BOOKING_DESTINATION_MAX_URL_LENGTH = 500;

export type FullBookingDestinationUrlError =
  | 'INVALID_URL'
  | 'TOO_LONG'
  | 'HTTPS_REQUIRED'
  | 'CREDENTIALS_NOT_ALLOWED'
  | 'FRAGMENT_NOT_ALLOWED'
  | 'QUERY_NOT_ALLOWED'
  | 'PORT_NOT_ALLOWED'
  | 'LOCAL_HOST_NOT_ALLOWED'
  | 'IP_HOST_NOT_ALLOWED'
  | 'PREVIEW_HOST_NOT_ALLOWED'
  | 'KERSIVO_HOST_NOT_ALLOWED'
  | 'QR_PATH_NOT_ALLOWED';

const KERSIVO_HOSTS = ['kersivo.co.uk', 'kersivo.com'];

/** Hosting-preview / tunnel suffixes that are never a shop's own production domain. */
const PREVIEW_HOST_SUFFIXES = [
  'vercel.app',
  'vercel.sh',
  'now.sh',
  'netlify.app',
  'pages.dev',
  'ngrok.io',
  'ngrok-free.app',
  'ngrok.app',
];

const LOCAL_HOST_SUFFIXES = [
  'localhost',
  'local',
  'localdomain',
  'internal',
  'intranet',
  'lan',
  'home',
  'corp',
  'home.arpa',
  'arpa',
  'test',
  'example',
  'invalid',
];

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOSTNAME_RE = new RegExp(`^(?=.{1,253}$)${LABEL}(?:\\.${LABEL})+$`);
const TLD_RE = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;

function hostMatches(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

function configuredKersivoHost(): string | null {
  try {
    return new URL(getPublicSiteUrl()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isQrPath(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return /^\/+q(?:\/|$)/i.test(decoded);
}

/**
 * Strict validation + normalization of an authoritative Full own-domain booking URL.
 * Pure string checks only — never resolves DNS or fetches the URL (no SSRF surface).
 * The exact path is kept (it is the booking destination); query strings and fragments are refused.
 */
export function normalizeFullBookingDestinationUrl(
  raw: unknown,
  options: { extraKersivoHosts?: readonly string[] } = {},
):
  | { ok: true; url: string; hostname: string }
  | { ok: false; code: FullBookingDestinationUrlError } {
  if (typeof raw !== 'string') return { ok: false, code: 'INVALID_URL' };
  const input = raw.trim();
  if (!input) return { ok: false, code: 'INVALID_URL' };
  if (input.length > FULL_BOOKING_DESTINATION_MAX_URL_LENGTH) return { ok: false, code: 'TOO_LONG' };
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f\\]/.test(input)) return { ok: false, code: 'INVALID_URL' };
  if (input.includes('#')) return { ok: false, code: 'FRAGMENT_NOT_ALLOWED' };
  if (input.includes('?')) return { ok: false, code: 'QUERY_NOT_ALLOWED' };

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, code: 'INVALID_URL' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, code: 'HTTPS_REQUIRED' };
  if (parsed.username || parsed.password || /^https:\/\/[^/]*@/i.test(input)) {
    return { ok: false, code: 'CREDENTIALS_NOT_ALLOWED' };
  }
  if (parsed.port) return { ok: false, code: 'PORT_NOT_ALLOWED' };

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) return { ok: false, code: 'INVALID_URL' };
  if (hostname.startsWith('[') || hostname.includes(':') || /^[0-9.]+$/.test(hostname)) {
    return { ok: false, code: 'IP_HOST_NOT_ALLOWED' };
  }
  if (LOCAL_HOST_SUFFIXES.some((suffix) => hostMatches(hostname, suffix))) {
    return { ok: false, code: 'LOCAL_HOST_NOT_ALLOWED' };
  }
  if (!HOSTNAME_RE.test(hostname) || !TLD_RE.test(hostname.split('.').pop() ?? '')) {
    return { ok: false, code: 'INVALID_URL' };
  }
  if (PREVIEW_HOST_SUFFIXES.some((suffix) => hostMatches(hostname, suffix))) {
    return { ok: false, code: 'PREVIEW_HOST_NOT_ALLOWED' };
  }
  const kersivoHosts = [
    ...KERSIVO_HOSTS,
    configuredKersivoHost(),
    ...(options.extraKersivoHosts ?? []),
  ].filter((host): host is string => Boolean(host));
  if (kersivoHosts.some((suffix) => hostMatches(hostname, suffix.toLowerCase()))) {
    return { ok: false, code: 'KERSIVO_HOST_NOT_ALLOWED' };
  }
  if (isQrPath(parsed.pathname)) return { ok: false, code: 'QR_PATH_NOT_ALLOWED' };

  return { ok: true, url: `https://${hostname}${parsed.pathname}`, hostname };
}
