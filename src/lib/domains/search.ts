import { suggestDomains, suggestSecondaryDomains, type DomainCandidate } from './suggest';
import { checkAvailability, type AvailabilityDeps, type DomainSuggestionResult } from './availability';
import { isPrimarySuggestionTld } from './tldPolicy';

export type DomainSearchResponse = {
  query: string;
  suggestions: DomainSuggestionResult[];
};

function allPrimaryTaken(results: DomainSuggestionResult[]): boolean {
  const primary = results.filter((row) => isPrimarySuggestionTld(row.tld));
  return primary.length > 0 && primary.every((row) => row.status === 'taken');
}

/**
 * Generate local candidates, then fill availability. If every primary TLD is taken,
 * append secondary TLD rows (priced live — unknown price stays not included).
 */
export async function searchDomains(
  input: { shopName: string; townCity: string; query?: string },
  deps: AvailabilityDeps = {},
): Promise<DomainSearchResponse> {
  const query = input.query?.trim() ?? '';
  const primary = suggestDomains({
    shopName: input.shopName,
    townCity: input.townCity,
    query,
  });
  const primaryResults = await checkAvailability(primary, deps);

  let extra: DomainCandidate[] = [];
  if (allPrimaryTaken(primaryResults)) {
    extra = suggestSecondaryDomains({
      shopName: input.shopName,
      townCity: input.townCity,
      query,
    }).filter((candidate) => !primaryResults.some((row) => row.domain === candidate.domain));
  }
  const extraResults = extra.length ? await checkAvailability(extra, deps) : [];

  return {
    query,
    suggestions: [...primaryResults, ...extraResults],
  };
}
