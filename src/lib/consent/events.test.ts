import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { trackConsentedEvent } from './events';

function stubDocumentCookie(value: string) {
  const doc = {
    cookie: value,
  };
  Object.defineProperty(doc, 'cookie', {
    configurable: true,
    get: () => value,
    set: () => undefined,
  });
  vi.stubGlobal('document', doc);
}

describe('trackConsentedEvent', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      gtag: vi.fn(),
    });
    stubDocumentCookie('');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not fire without a consent decision', () => {
    const ok = trackConsentedEvent('setup_enquiry_submit');
    expect(ok).toBe(false);
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('fires analytics events when analytics consent is granted', () => {
    const prefs = {
      version: 1,
      necessary: true,
      analytics: true,
      advertisingMeasurement: false,
      personalisedAdvertising: false,
      timestamp: new Date().toISOString(),
    };
    stubDocumentCookie(`kersivo_consent=${encodeURIComponent(JSON.stringify(prefs))}`);

    const ok = trackConsentedEvent('setup_enquiry_submit', { foo: 'bar' }, 'analytics');
    expect(ok).toBe(true);
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'setup_enquiry_submit',
      expect.objectContaining({ transport_type: 'beacon', foo: 'bar' }),
    );
  });

  it('blocks analytics events when only advertising measurement is granted', () => {
    const prefs = {
      version: 1,
      necessary: true,
      analytics: false,
      advertisingMeasurement: true,
      personalisedAdvertising: false,
      timestamp: new Date().toISOString(),
    };
    stubDocumentCookie(`kersivo_consent=${encodeURIComponent(JSON.stringify(prefs))}`);

    const ok = trackConsentedEvent('page_view_custom', undefined, 'analytics');
    expect(ok).toBe(false);
    expect(window.gtag).not.toHaveBeenCalled();
  });
});
