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
