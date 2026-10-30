import {
  extractTld,
  isDisallowedKersivoRegisterTld,
  isNominetTld,
  isPrimarySuggestionTld,
  isSecondarySuggestionTld,
  isVercelSearchTld,
  isWithinInternalAllowance,
  usdPriceToPence,
  type DomainAvailabilityStatus,
} from './tldPolicy';
import type { DomainCandidate } from './suggest';

export type DomainSuggestionResult = {
  domain: string;
  tld: string;
  status: DomainAvailabilityStatus;
  included: boolean;
  pricePence: number | null;
};

export type AvailabilityLookup = 'available' | 'taken' | 'unknown';

type CacheEntry = { expiresAt: number; result: DomainSuggestionResult };

const CACHE_TTL_MS = 10 * 60 * 1000;
const NOMINET_TIMEOUT_MS = 1_200;
const VERCEL_TIMEOUT_MS = 2_500;
const DNS_TIMEOUT_MS = 1_200;
const NOMINET_CONCURRENCY = 3;

const cache = new Map<string, CacheEntry>();

export type AvailabilityDeps = {
  fetchImpl?: typeof fetch;
  dnsLookup?: (hostname: string) => Promise<AvailabilityLookup>;
  now?: () => number;
  vercelToken?: string | undefined;
  vercelTeamId?: string | undefined;
};

export function clearAvailabilityCache(): void {
  cache.clear();
}

export function mapNominetRdapStatus(httpStatus: number | 'timeout' | 'error'): AvailabilityLookup {
  if (httpStatus === 404) return 'available';
  if (httpStatus === 200) return 'taken';
  return 'unknown';
}

export function classifySuggestion(input: {
  domain: string;
  tld: string;
  availability: AvailabilityLookup;
  pricePence?: number | null;
  premium?: boolean;
}): DomainSuggestionResult {
  const { domain, tld, availability } = input;
  const pricePence = input.pricePence ?? null;
  const premium = input.premium === true;

  if (isDisallowedKersivoRegisterTld(domain) || isDisallowedKersivoRegisterTld(tld)) {
    return { domain, tld, status: 'not_included', included: false, pricePence };
  }

  if (availability === 'taken') {
    return { domain, tld, status: 'taken', included: false, pricePence };
  }

  if (premium || (pricePence != null && !isWithinInternalAllowance(pricePence))) {
    return { domain, tld, status: 'not_included', included: false, pricePence };
  }

  if (isSecondarySuggestionTld(tld)) {
    if (pricePence == null || !isWithinInternalAllowance(pricePence)) {
      return { domain, tld, status: 'not_included', included: false, pricePence };
    }
    if (availability === 'unknown') {
      return { domain, tld, status: 'unknown', included: false, pricePence };
    }
    return { domain, tld, status: 'available', included: true, pricePence };
  }

  if (availability === 'unknown') {
    return {
      domain,
      tld,
      status: 'unknown',
      included: isPrimarySuggestionTld(tld),
      pricePence,
    };
  }

  return { domain, tld, status: 'available', included: isPrimarySuggestionTld(tld) || isNominetTld(tld), pricePence };
}

function cached(domain: string, now: number): DomainSuggestionResult | null {
  const hit = cache.get(domain);
  if (!hit || hit.expiresAt <= now) {
    if (hit) cache.delete(domain);
    return null;
  }
  return hit.result;
}

function store(result: DomainSuggestionResult, now: number): DomainSuggestionResult {
  cache.set(result.domain, { result, expiresAt: now + CACHE_TTL_MS });
  return result;
}

async function mapPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

async function nominetLookup(domain: string, fetchImpl: typeof fetch): Promise<AvailabilityLookup> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOMINET_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`https://rdap.nominet.uk/domain/${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: { Accept: 'application/rdap+json, application/json' },
      signal: controller.signal,
    });
    return mapNominetRdapStatus(response.status);
  } catch {
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}

type VercelSearchRow = {
  domain: string;
  available?: boolean;
  price?: number;
  renewalPrice?: number;
  premium?: boolean;
  years?: number;
};

async function vercelSearch(
  domains: string[],
  deps: AvailabilityDeps,
): Promise<Map<string, VercelSearchRow>> {
  const out = new Map<string, VercelSearchRow>();
  if (!domains.length) return out;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const token = deps.vercelToken ?? process.env.VERCEL_TOKEN;
  const teamId = deps.vercelTeamId ?? process.env.VERCEL_TEAM_ID;
  const url = new URL('https://api.vercel.com/v1/registrar/domains/search');
  if (teamId) url.searchParams.set('teamId', teamId);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERCEL_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ domains }),
      signal: controller.signal,
    });
    if (!response.ok) return out;
    const body = (await response.json()) as { results?: VercelSearchRow[] };
    for (const row of body.results ?? []) {
      if (row?.domain) out.set(row.domain.toLowerCase(), row);
    }
  } catch {
    return out;
  } finally {
    clearTimeout(timer);
  }
  return out;
}

async function defaultDnsLookup(hostname: string): Promise<AvailabilityLookup> {
  try {
    const dns = await import('node:dns/promises');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS);
    try {
      await Promise.race([
        dns.resolveNs(hostname),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('timeout')));
        }),
      ]);
      return 'taken';
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : '';
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN') return 'available';
    return 'unknown';
  }
}

/**
 * Batch availability for already-generated candidates. Nominet for .co.uk/.uk;
 * Vercel search (price when returned) for allowlisted Vercel TLDs; DNS if Vercel is silent.
 * Never invents a price.
 */
export async function checkAvailability(
  candidates: DomainCandidate[],
  deps: AvailabilityDeps = {},
): Promise<DomainSuggestionResult[]> {
  const now = deps.now?.() ?? Date.now();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const dnsLookup = deps.dnsLookup ?? defaultDnsLookup;

  const results = new Map<string, DomainSuggestionResult>();
  const pending: DomainCandidate[] = [];

  for (const candidate of candidates) {
    const hit = cached(candidate.domain, now);
    if (hit) results.set(candidate.domain, hit);
    else pending.push(candidate);
  }

  const nominet = pending.filter((item) => isNominetTld(item.tld));
  const vercel = pending.filter((item) => isVercelSearchTld(item.tld));
  const other = pending.filter((item) => !isNominetTld(item.tld) && !isVercelSearchTld(item.tld));

  const nominetLookups = await mapPool(nominet, NOMINET_CONCURRENCY, async (item) => ({
    item,
    availability: await nominetLookup(item.domain, fetchImpl),
  }));
  for (const { item, availability } of nominetLookups) {
    results.set(
      item.domain,
      store(
        classifySuggestion({
          domain: item.domain,
          tld: item.tld,
          availability,
          pricePence: null,
        }),
        now,
      ),
    );
  }

  const vercelRows = await vercelSearch(
    vercel.map((item) => item.domain),
    deps,
  );
  for (const item of vercel) {
    const row = vercelRows.get(item.domain);
    if (row) {
      const available = row.available === true ? 'available' : row.available === false ? 'taken' : 'unknown';
      const pricePence = typeof row.price === 'number' ? usdPriceToPence(row.price) : null;
      results.set(
        item.domain,
        store(
          classifySuggestion({
            domain: item.domain,
            tld: item.tld,
            availability: available,
            pricePence,
            premium: row.premium === true,
          }),
          now,
        ),
      );
      continue;
    }
    const availability = await dnsLookup(item.domain);
    results.set(
      item.domain,
      store(
        classifySuggestion({
          domain: item.domain,
          tld: item.tld,
          availability,
          pricePence: null,
        }),
        now,
      ),
    );
  }

  for (const item of other) {
    const availability: AvailabilityLookup = isDisallowedKersivoRegisterTld(item.domain)
      ? 'unknown'
      : await dnsLookup(item.domain);
    results.set(
      item.domain,
      store(
        classifySuggestion({
          domain: item.domain,
          tld: item.tld,
          availability,
          pricePence: null,
        }),
        now,
      ),
    );
  }

  return candidates.map((item) => {
    const result = results.get(item.domain);
    if (result) return result;
    const tld = item.tld || extractTld(item.domain) || '';
    return classifySuggestion({ domain: item.domain, tld, availability: 'unknown', pricePence: null });
  });
}

export function canSelectForRegister(result: DomainSuggestionResult): boolean {
  if (isDisallowedKersivoRegisterTld(result.domain)) return false;
  if (result.status === 'taken' || result.status === 'not_included') return false;
  return result.included || (result.status === 'unknown' && isPrimarySuggestionTld(result.tld));
}
