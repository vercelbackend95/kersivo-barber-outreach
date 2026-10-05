import { describe, expect, it } from 'vitest';
import { normalizeFullBookingDestinationUrl } from './fullBookingDestinationUrl';

const reject = (raw: unknown) => {
  const result = normalizeFullBookingDestinationUrl(raw);
  return result.ok ? null : result.code;
};

describe('normalizeFullBookingDestinationUrl', () => {
  it('12: accepts an exact HTTPS own-domain booking URL and keeps its path', () => {
    expect(normalizeFullBookingDestinationUrl('  https://ExampleBarbers.co.uk/book  ')).toEqual({
      ok: true,
      url: 'https://examplebarbers.co.uk/book',
      hostname: 'examplebarbers.co.uk',
    });
    expect(normalizeFullBookingDestinationUrl('https://www.examplebarbers.co.uk/')).toMatchObject({
      ok: true,
      url: 'https://www.examplebarbers.co.uk/',
    });
  });

  it('never appends /book to a bare hostname', () => {
    expect(normalizeFullBookingDestinationUrl('https://examplebarbers.co.uk')).toMatchObject({
      url: 'https://examplebarbers.co.uk/',
    });
  });

  it('13: http:// and other schemes are rejected', () => {
    expect(reject('http://examplebarbers.co.uk/book')).toBe('HTTPS_REQUIRED');
    expect(reject('javascript:alert(1)')).toBe('HTTPS_REQUIRED');
    expect(reject('//examplebarbers.co.uk/book')).toBe('INVALID_URL');
  });

  it('14: localhost and local-only names are rejected', () => {
    for (const url of ['https://localhost/book', 'https://shop.localhost/book', 'https://nas.local/book', 'https://app.internal/book']) {
      expect(reject(url)).toBe('LOCAL_HOST_NOT_ALLOWED');
    }
  });

  it('15: loopback / private / IP-literal hosts are rejected without any network lookup', () => {
    for (const url of [
      'https://127.0.0.1/book',
      'https://10.0.0.5/book',
      'https://192.168.1.10/book',
      'https://169.254.169.254/latest',
      'https://0x7f.0.0.1/book',
      'https://2130706433/book',
      'https://[::1]/book',
    ]) {
      expect(reject(url)).toBe('IP_HOST_NOT_ALLOWED');
    }
  });

  it('16: URL credentials are rejected', () => {
    expect(reject('https://user:pass@examplebarbers.co.uk/book')).toBe('CREDENTIALS_NOT_ALLOWED');
    expect(reject('https://user@examplebarbers.co.uk/book')).toBe('CREDENTIALS_NOT_ALLOWED');
  });

  it('17: fragments are rejected; query strings are not kept as canonical', () => {
    expect(reject('https://examplebarbers.co.uk/book#top')).toBe('FRAGMENT_NOT_ALLOWED');
    expect(reject('https://examplebarbers.co.uk/book#')).toBe('FRAGMENT_NOT_ALLOWED');
    expect(reject('https://examplebarbers.co.uk/book?utm_source=x')).toBe('QUERY_NOT_ALLOWED');
  });

  it('18: /q/{code} QR destinations are rejected (incl. encoded)', () => {
    expect(reject('https://examplebarbers.co.uk/q/H7K3PX9M2QAB')).toBe('QR_PATH_NOT_ALLOWED');
    expect(reject('https://examplebarbers.co.uk/%71/H7K3PX9M2QAB')).toBe('QR_PATH_NOT_ALLOWED');
    expect(reject('https://examplebarbers.co.uk/Q')).toBe('QR_PATH_NOT_ALLOWED');
  });

  it('19: obvious preview / tunnel hosts are rejected', () => {
    for (const url of [
      'https://kersivo-barber-outreach-git-main-team.vercel.app/book',
      'https://examplebarbers.vercel.app/book',
      'https://examplebarbers.netlify.app/book',
      'https://abc.ngrok-free.app/book',
    ]) {
      expect(reject(url)).toBe('PREVIEW_HOST_NOT_ALLOWED');
    }
  });

  it('20: the KERSIVO-hosted Starter URL cannot pose as an own-domain destination', () => {
    expect(reject('https://kersivo.co.uk/book/example')).toBe('KERSIVO_HOST_NOT_ALLOWED');
    expect(reject('https://www.kersivo.co.uk/book/example')).toBe('KERSIVO_HOST_NOT_ALLOWED');
    expect(
      normalizeFullBookingDestinationUrl('https://app.kersivo.example.com/book', {
        extraKersivoHosts: ['kersivo.example.com'],
      }),
    ).toEqual({ ok: false, code: 'KERSIVO_HOST_NOT_ALLOWED' });
  });

  it('rejects ports, oversize URLs, malformed hosts and non-strings', () => {
    expect(reject('https://examplebarbers.co.uk:8443/book')).toBe('PORT_NOT_ALLOWED');
    expect(reject(`https://examplebarbers.co.uk/${'a'.repeat(600)}`)).toBe('TOO_LONG');
    expect(reject('https://examplebarbers/book')).toBe('INVALID_URL');
    expect(reject('https://exa mple.co.uk/book')).toBe('INVALID_URL');
    expect(reject(null)).toBe('INVALID_URL');
    expect(reject('')).toBe('INVALID_URL');
  });
});
