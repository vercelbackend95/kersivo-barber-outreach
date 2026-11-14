export const INTERNAL_TRAFFIC_COOKIE = 'kersivo_internal';
export const INTERNAL_TRAFFIC_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type InternalTrafficParamAction = 'set' | 'clear' | 'none';

/** `?internal=1` sets the cookie, `?internal=0` clears it, then the parameter is removed. */
export function internalTrafficParamAction(search: string): InternalTrafficParamAction {
  const flag = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('internal');
  if (flag === '1') return 'set';
  if (flag === '0') return 'clear';
  return 'none';
}

/** Address bar after the parameter is removed. Other query parameters stay. */
export function urlWithoutInternalParam(href: string): string {
  const url = new URL(href, 'https://kersivo.co.uk');
  url.searchParams.delete('internal');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isInternalTrafficCookie(value: string | null | undefined): boolean {
  return value === '1';
}

export function gaConfig(options: { siteSection?: string; internal?: boolean } = {}): {
  anonymize_ip: true;
  site_section?: string;
  traffic_type?: 'internal';
} {
  const config: {
    anonymize_ip: true;
    site_section?: string;
    traffic_type?: 'internal';
  } = { anonymize_ip: true };
  const siteSection = options.siteSection?.trim();
  if (siteSection) config.site_section = siteSection;
  if (options.internal) config.traffic_type = 'internal';
  return config;
}

/** Hosts that serve the real site. Anything else (localhost, Vercel previews) is tagged internal. */
export const PRODUCTION_HOSTNAMES: readonly string[] = ['kersivo.co.uk', 'www.kersivo.co.uk'];

export function isProductionHostname(hostname: string | null | undefined): boolean {
  return PRODUCTION_HOSTNAMES.includes((hostname ?? '').trim().toLowerCase());
}

/**
 * True when this browser's hits must carry traffic_type=internal: the device was marked with
 * `?internal=1`, or the page is not served from the production host.
 */
export function isInternalTraffic(input: { cookieValue: string | null | undefined; hostname: string | null | undefined }): boolean {
  return isInternalTrafficCookie(input.cookieValue) || !isProductionHostname(input.hostname);
}

/**
 * `gtag('set', …)` applies to every later hit from this page, including GA4 enhanced-measurement
 * page views after a ClientRouter navigation and events from trackConsentedEvent. Config params alone
 * would miss a tag that was configured before the device was marked. Mirrored in GoogleAnalytics.astro.
 */
export function applyInternalTrafficTag(gtag: (...args: unknown[]) => void, internal: boolean): boolean {
  if (!internal) return false;
  gtag('set', { traffic_type: 'internal' });
  return true;
}

/** Reads the internal cookie from `document.cookie` (browser only). */
export function readInternalTrafficCookie(cookieString: string): string | null {
  for (const part of cookieString.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${INTERNAL_TRAFFIC_COOKIE}=`)) {
      return decodeURIComponent(trimmed.slice(INTERNAL_TRAFFIC_COOKIE.length + 1));
    }
  }
  return null;
}
