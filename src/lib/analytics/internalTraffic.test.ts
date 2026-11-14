import { describe, expect, it, vi } from 'vitest';
import {
  applyInternalTrafficTag,
  gaConfig,
  isInternalTraffic,
  isProductionHostname,
  readInternalTrafficCookie,
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

describe('internal traffic detection', () => {
  it('treats only the production hosts as real traffic', () => {
    expect(isProductionHostname('kersivo.co.uk')).toBe(true);
    expect(isProductionHostname('www.kersivo.co.uk')).toBe(true);
    expect(isProductionHostname('localhost')).toBe(false);
    expect(isProductionHostname('kersivo-barber-outreach-git-x.vercel.app')).toBe(false);
  });

  it('is internal when the device is marked or the host is not production', () => {
    expect(isInternalTraffic({ cookieValue: '1', hostname: 'kersivo.co.uk' })).toBe(true);
    expect(isInternalTraffic({ cookieValue: null, hostname: 'localhost' })).toBe(true);
    expect(isInternalTraffic({ cookieValue: null, hostname: 'kersivo.co.uk' })).toBe(false);
  });

  it('reads the cookie from document.cookie', () => {
    expect(readInternalTrafficCookie('a=1; kersivo_internal=1; b=2')).toBe('1');
    expect(readInternalTrafficCookie('a=1')).toBeNull();
  });

  it('sets traffic_type for every later hit only when internal', () => {
    const gtag = vi.fn();
    expect(applyInternalTrafficTag(gtag, false)).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
    expect(applyInternalTrafficTag(gtag, true)).toBe(true);
    expect(gtag).toHaveBeenCalledWith('set', { traffic_type: 'internal' });
  });
});
