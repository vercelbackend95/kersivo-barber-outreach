import { describe, expect, it } from 'vitest';
import {
  DISALLOWED_KERSIVO_REGISTER_TLDS,
  INTERNAL_STANDARD_DOMAIN_ALLOWANCE_PENCE,
  extractTld,
  isAllowedKersivoRegisterHostname,
  isDisallowedKersivoRegisterTld,
  isNominetTld,
  isPrimarySuggestionTld,
  isSecondarySuggestionTld,
  isWithinInternalAllowance,
  usdPriceToPence,
} from './tldPolicy';

describe('tldPolicy', () => {
  it('extracts multi-part UK TLDs before .uk / .com', () => {
    expect(extractTld('fade-room.co.uk')).toBe('.co.uk');
    expect(extractTld('fade-room.uk')).toBe('.uk');
    expect(extractTld('faderoom.com')).toBe('.com');
    expect(extractTld('faderoom.uk.com')).toBe('.uk.com');
    expect(extractTld('faderoom.uk.net')).toBe('.uk.net');
    expect(extractTld('shop.barbershop')).toBe('.barbershop');
  });

  it('never treats .uk.com or .uk.net as a Nominet UK domain', () => {
    expect(isNominetTld('.uk.com')).toBe(false);
    expect(isNominetTld('.uk.net')).toBe(false);
    expect(isNominetTld('.co.uk')).toBe(true);
    expect(isNominetTld('.uk')).toBe(true);
    for (const tld of DISALLOWED_KERSIVO_REGISTER_TLDS) {
      expect(isDisallowedKersivoRegisterTld(`shop${tld}`)).toBe(true);
      expect(isPrimarySuggestionTld(tld)).toBe(false);
      expect(isAllowedKersivoRegisterHostname(`shop${tld}`)).toBe(false);
    }
  });

  it('allowlists primary suggestion TLDs and optional secondary ones', () => {
    expect(isPrimarySuggestionTld('.co.uk')).toBe(true);
    expect(isPrimarySuggestionTld('.uk')).toBe(true);
    expect(isPrimarySuggestionTld('.com')).toBe(true);
    expect(isSecondarySuggestionTld('.net')).toBe(true);
    expect(isSecondarySuggestionTld('.studio')).toBe(true);
    expect(isSecondarySuggestionTld('.barbershop')).toBe(true);
    expect(isAllowedKersivoRegisterHostname('faderoom.co.uk')).toBe(true);
    expect(isAllowedKersivoRegisterHostname('faderoom.xyz')).toBe(false);
  });

  it('compares a live USD price against the internal £30 allowance without inventing one', () => {
    expect(INTERNAL_STANDARD_DOMAIN_ALLOWANCE_PENCE).toBe(3000);
    expect(isWithinInternalAllowance(null)).toBe(false);
    expect(isWithinInternalAllowance(usdPriceToPence(10))).toBe(true);
    expect(isWithinInternalAllowance(usdPriceToPence(40))).toBe(false);
    expect(isWithinInternalAllowance(3000)).toBe(true);
    expect(isWithinInternalAllowance(3001)).toBe(false);
  });
});
