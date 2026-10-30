/**
 * KERSIVO domain TLD policy — search + choose only (v1).
 *
 * Registrar reality (do not buy or attach DNS in this module):
 * - Cheapest real UK names come from Nominet wholesale (~£3.90/year). Cloudflare Registrar
 *   sells .uk / .co.uk at cost. That is the future purchase path.
 * - Vercel Registrar API CAN search/price/buy many TLDs and is already our host — BUT
 *   Vercel’s supported purchase list includes .com and .uk.com, NOT Nominet .co.uk / .uk.
 *   Never buy or recommend .uk.com as the shop’s UK domain. .uk.com / .uk.net are NOT
 *   Nominet .uk / .co.uk.
 * - Neon is the database only.
 *
 * v1 availability:
 * - .co.uk and .uk → Nominet RDAP (https://rdap.nominet.uk/domain/{name}) — no API key.
 * - .com and other allowlisted Vercel-supported TLDs → Vercel Registrar search (+ price).
 *
 * The £30/year internal standard-domain allowance lives here for inclusion checks.
 * Do not publish that figure on marketing pages (see DOMAIN_LIMIT_CLAIM).
 */

export const DISALLOWED_KERSIVO_REGISTER_TLDS = ['.uk.com', '.uk.net'] as const;

/** Suggestion order for a new KERSIVO-registered name. */
export const PRIMARY_SUGGESTION_TLDS = ['.co.uk', '.uk', '.com'] as const;

/** Only offered when every primary candidate is taken, and only if a live price is within the allowance. */
export const SECONDARY_SUGGESTION_TLDS = ['.net', '.studio', '.barbershop'] as const;

export const NOMINET_TLDS = ['.co.uk', '.uk'] as const;

export const VERCEL_SEARCH_TLDS = ['.com', '.net', '.studio', '.barbershop'] as const;

/** Internal ops allowance (Terms / DOMAIN_LIMIT_CLAIM). Never render this on marketing UI. */
export const INTERNAL_STANDARD_DOMAIN_ALLOWANCE_PENCE = 3000;

/**
 * Conservative internal FX used only to compare a Vercel USD `price` with the £30 allowance.
 * 1 USD → 90 pence over-estimates GBP so a close name is marked not included, never faked as cheap.
 */
export const INTERNAL_USD_TO_PENCE = 90;

export type DomainAvailabilityStatus = 'available' | 'taken' | 'not_included' | 'unknown';

export type KnownTld =
  | (typeof PRIMARY_SUGGESTION_TLDS)[number]
  | (typeof SECONDARY_SUGGESTION_TLDS)[number]
  | (typeof DISALLOWED_KERSIVO_REGISTER_TLDS)[number];

const TLD_BY_LENGTH = [
  ...DISALLOWED_KERSIVO_REGISTER_TLDS,
  ...PRIMARY_SUGGESTION_TLDS,
  ...SECONDARY_SUGGESTION_TLDS,
].slice()
  .sort((a, b) => b.length - a.length);

export function extractTld(hostname: string): string | null {
  const host = hostname.trim().toLowerCase();
  if (!host) return null;
  for (const tld of TLD_BY_LENGTH) {
    if (host === tld.slice(1) || host.endsWith(tld)) return tld;
  }
  const dot = host.lastIndexOf('.');
  if (dot <= 0 || dot === host.length - 1) return null;
  return host.slice(dot);
}

export function isDisallowedKersivoRegisterTld(hostnameOrTld: string): boolean {
  const tld = hostnameOrTld.startsWith('.') ? hostnameOrTld : extractTld(hostnameOrTld);
  return tld === '.uk.com' || tld === '.uk.net';
}

export function isNominetTld(tld: string): boolean {
  return (NOMINET_TLDS as readonly string[]).includes(tld);
}

export function isPrimarySuggestionTld(tld: string): boolean {
  return (PRIMARY_SUGGESTION_TLDS as readonly string[]).includes(tld);
}

export function isSecondarySuggestionTld(tld: string): boolean {
  return (SECONDARY_SUGGESTION_TLDS as readonly string[]).includes(tld);
}

export function isVercelSearchTld(tld: string): boolean {
  return (VERCEL_SEARCH_TLDS as readonly string[]).includes(tld);
}

export function isAllowlistedRegisterTld(tld: string): boolean {
  return isPrimarySuggestionTld(tld) || isSecondarySuggestionTld(tld);
}

export function usdPriceToPence(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(usd * INTERNAL_USD_TO_PENCE);
}

export function isWithinInternalAllowance(pricePence: number | null): boolean {
  if (pricePence == null) return false;
  return pricePence <= INTERNAL_STANDARD_DOMAIN_ALLOWANCE_PENCE;
}

/** True when KERSIVO may offer to register this hostname (syntax + TLD only — not availability). */
export function isAllowedKersivoRegisterHostname(hostname: string): boolean {
  if (isDisallowedKersivoRegisterTld(hostname)) return false;
  const tld = extractTld(hostname);
  return Boolean(tld && isAllowlistedRegisterTld(tld));
}
