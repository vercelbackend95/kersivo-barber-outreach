/**
 * Client-safe part of domain availability: the row shape the domain search returns and whether a row may be
 * picked for KERSIVO to register. The lookups themselves (RDAP, DNS) stay in availability.ts, server only.
 */
import {
  isDisallowedKersivoRegisterTld,
  isPrimarySuggestionTld,
  type DomainAvailabilityStatus,
} from './tldPolicy';

export type DomainSuggestionResult = {
  domain: string;
  tld: string;
  status: DomainAvailabilityStatus;
  included: boolean;
  pricePence: number | null;
};

export function canSelectForRegister(result: DomainSuggestionResult): boolean {
  if (isDisallowedKersivoRegisterTld(result.domain)) return false;
  if (result.status === 'taken' || result.status === 'not_included') return false;
  return result.included || (result.status === 'unknown' && isPrimarySuggestionTld(result.tld));
}
