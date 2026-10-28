import { describe, expect, it } from 'vitest';
import {
  gaConfig,
  internalTrafficParamAction,
  isInternalTrafficCookie,
  urlWithoutInternalParam,
} from './internalTraffic';

describe('internal traffic cookie', () => {
  it('sets the cookie for ?internal=1 and clears it for ?internal=0', () => {
    expect(internalTrafficParamAction('?internal=1')).toBe('set');
    expect(internalTrafficParamAction('internal=0')).toBe('clear');
    expect(internalTrafficParamAction('?ref=ads')).toBe('none');
    expect(isInternalTrafficCookie('1')).toBe(true);
    expect(isInternalTrafficCookie('0')).toBe(false);
    expect(isInternalTrafficCookie(null)).toBe(false);
  });

  it('removes only the internal parameter from the address', () => {
    expect(urlWithoutInternalParam('https://kersivo.co.uk/?internal=1')).toBe('/');
    expect(urlWithoutInternalParam('https://kersivo.co.uk/pricing?plan=full&internal=1#plan')).toBe(
      '/pricing?plan=full#plan',
    );
  });

  it('adds traffic_type only when the cookie is present', () => {
    expect(gaConfig()).toEqual({ anonymize_ip: true });
    expect(gaConfig({ siteSection: 'marketing', internal: false })).toEqual({
      anonymize_ip: true,
      site_section: 'marketing',
    });
    expect(gaConfig({ internal: true })).toEqual({
      anonymize_ip: true,
      traffic_type: 'internal',
    });
  });
});