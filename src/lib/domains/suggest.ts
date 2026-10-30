import { normalizeDomainInput } from '@/lib/domains/hostname';
import {
  DISALLOWED_KERSIVO_REGISTER_TLDS,
  PRIMARY_SUGGESTION_TLDS,
  SECONDARY_SUGGESTION_TLDS,
  extractTld,
  isDisallowedKersivoRegisterTld,
} from './tldPolicy';

export const EMPTY_QUERY_SUGGESTION_COUNT = 6;
export const MAX_SUGGESTIONS = 8;

export type DomainCandidate = {
  domain: string;
  tld: string;
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'a',
  'an',
  'of',
  'barber',
  'barbers',
  'barbershop',
  'shop',
  'salon',
]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function joinLabel(parts: string[], separator: string): string {
  const raw = parts.join(separator).replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  if (!raw || raw.length > 63) return '';
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(raw) && raw.length > 1) return '';
  if (raw.length === 1 && !/^[a-z0-9]$/.test(raw)) return '';
  return raw;
}

function meaningfulWords(all: string[]): string[] {
  const kept = all.filter((word) => !STOP_WORDS.has(word));
  return kept.length ? kept : all;
}

function labelsFromName(name: string): string[] {
  const all = words(name);
  if (!all.length) return [];
  const meaningful = meaningfulWords(all);
  const out: string[] = [];
  const push = (label: string) => {
    if (label && !out.includes(label)) out.push(label);
  };
  push(joinLabel(meaningful, ''));
  push(joinLabel(meaningful, '-'));
  if (all.length !== meaningful.length) {
    push(joinLabel(all, ''));
    push(joinLabel(all, '-'));
  }
  return out;
}

function labelsFromShopAndTown(shopName: string, townCity: string): string[] {
  const shop = labelsFromName(shopName);
  const townWords = words(townCity);
  const town = joinLabel(townWords, '') || joinLabel(townWords, '-');
  const out: string[] = [...shop];
  const shopCore = shop[0] ?? '';
  const shopHyphen = shop.find((label) => label.includes('-')) ?? shopCore;
  if (shopCore && town) {
    for (const label of [
      joinLabel([shopCore, town], ''),
      joinLabel([shopHyphen, town], '-'),
      joinLabel([town, shopCore], ''),
      joinLabel([shopCore, town], '-'),
    ]) {
      if (label && !out.includes(label)) out.push(label);
    }
  }
  return out.filter(Boolean);
}

function withTlds(labels: string[], tlds: readonly string[], preferFirstTld = false): DomainCandidate[] {
  const out: DomainCandidate[] = [];
  const seen = new Set<string>();
  const push = (label: string, tld: string) => {
    if ((DISALLOWED_KERSIVO_REGISTER_TLDS as readonly string[]).includes(tld)) return;
    const domain = `${label}${tld}`;
    if (seen.has(domain)) return;
    seen.add(domain);
    out.push({ domain, tld });
  };
  if (preferFirstTld && tlds[0]) {
    for (const label of labels) push(label, tlds[0]);
    for (const tld of tlds.slice(1)) {
      for (const label of labels) push(label, tld);
    }
    return out;
  }
  for (const label of labels) {
    for (const tld of tlds) push(label, tld);
  }
  return out;
}

function isExplicitHostname(query: string): boolean {
  const normalized = normalizeDomainInput(query);
  if (!normalized || !normalized.includes('.')) return false;
  return Boolean(extractTld(normalized));
}

/**
 * Instant local candidates from shop name + town (and an optional typeahead query).
 * Never recommends .uk.com / .uk.net. An explicit typed hostname on those TLDs is
 * returned only so the UI can mark it “Not included”.
 */
export function suggestDomains(input: {
  shopName: string;
  townCity: string;
  query?: string;
  tlds?: readonly string[];
  limit?: number;
}): DomainCandidate[] {
  const limit = input.limit ?? (input.query?.trim() ? MAX_SUGGESTIONS : EMPTY_QUERY_SUGGESTION_COUNT);
  const tlds = input.tlds ?? PRIMARY_SUGGESTION_TLDS;
  const query = input.query?.trim() ?? '';
  const out: DomainCandidate[] = [];
  const seen = new Set<string>();

  const push = (candidate: DomainCandidate | null) => {
    if (!candidate || seen.has(candidate.domain)) return;
    if (out.length >= limit) return;
    seen.add(candidate.domain);
    out.push(candidate);
  };

  if (query && isExplicitHostname(query)) {
    const hostname = normalizeDomainInput(query);
    if (hostname) {
      const tld = extractTld(hostname);
      if (tld) push({ domain: hostname, tld });
      const label = tld && hostname.endsWith(tld) ? hostname.slice(0, -tld.length) : hostname.split('.')[0] ?? '';
      if (label && !isDisallowedKersivoRegisterTld(hostname)) {
        for (const candidate of withTlds([label], PRIMARY_SUGGESTION_TLDS)) push(candidate);
      } else if (label) {
        // Typed a disallowed TLD: still offer real UK / .com alternatives on the same label.
        for (const candidate of withTlds([label], PRIMARY_SUGGESTION_TLDS)) push(candidate);
      }
    }
  } else {
    const typedLabel = query ? joinLabel(words(query), '') : '';
    const typedHyphen = query ? joinLabel(words(query), '-') : '';
    const shopLabels = labelsFromShopAndTown(input.shopName, input.townCity);
    const labels: string[] = [];
    if (typedLabel) labels.push(typedLabel);
    if (typedHyphen && typedHyphen !== typedLabel) labels.push(typedHyphen);
    if (typedLabel) {
      const town = joinLabel(words(input.townCity), '');
      if (town) {
        labels.push(joinLabel([typedLabel, town], ''));
        labels.push(joinLabel([typedLabel, town], '-'));
      }
    }
    labels.push(...shopLabels);
    const uniqueLabels = labels.filter(Boolean);
    if (!query && tlds === PRIMARY_SUGGESTION_TLDS) {
      const first = uniqueLabels[0];
      const hyphen = uniqueLabels.find((label) => label.includes('-')) ?? uniqueLabels[1];
      const townSlug = joinLabel(words(input.townCity), '');
      const withTown =
        uniqueLabels.find((label) => townSlug && label.includes(townSlug) && label !== first) ??
        uniqueLabels.find((label) => label !== first && label !== hyphen) ??
        uniqueLabels[2];
      if (first) {
        push({ domain: `${first}.co.uk`, tld: '.co.uk' });
        if (hyphen) push({ domain: `${hyphen}.co.uk`, tld: '.co.uk' });
        if (withTown) push({ domain: `${withTown}.co.uk`, tld: '.co.uk' });
        push({ domain: `${first}.uk`, tld: '.uk' });
        push({ domain: `${first}.com`, tld: '.com' });
        if (hyphen) push({ domain: `${hyphen}.uk`, tld: '.uk' });
      }
    }
    for (const candidate of withTlds(uniqueLabels, tlds, !query)) push(candidate);
  }

  return out;
}

export function suggestSecondaryDomains(input: {
  shopName: string;
  townCity: string;
  query?: string;
  limit?: number;
}): DomainCandidate[] {
  return suggestDomains({
    ...input,
    tlds: SECONDARY_SUGGESTION_TLDS,
    limit: input.limit ?? 6,
  });
}
