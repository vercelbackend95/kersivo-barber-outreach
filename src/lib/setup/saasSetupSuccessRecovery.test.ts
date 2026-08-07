import { describe, expect, it } from 'vitest';
import {
  buildSetupSuccessCallbackUrl,
  buildSetupSuccessRecoveryUrl,
  isStripeCheckoutSessionId,
  mapClaimHttpError,
} from './saasSetupSuccessRecovery';

describe('saasSetupSuccessRecovery', () => {
  it('accepts Stripe checkout session ids', () => {
    expect(isStripeCheckoutSessionId('cs_test_abc123')).toBe(true);
    expect(isStripeCheckoutSessionId('cs_live_XYZ_9')).toBe(true);
    expect(isStripeCheckoutSessionId('pi_abc')).toBe(false);
    expect(isStripeCheckoutSessionId('https://evil.example/cs_test')).toBe(false);
  });

  it('builds relative callbackURL that preserves session_id', () => {
    expect(buildSetupSuccessCallbackUrl('cs_test_abc123')).toBe(
      '/setup/success?session_id=cs_test_abc123',
    );
  });

  it('rejects unsafe session ids in callbackURL', () => {
    expect(buildSetupSuccessCallbackUrl('https://evil.example')).toBe('/setup/success');
    expect(buildSetupSuccessCallbackUrl('../../admin')).toBe('/setup/success');
  });

  it('builds absolute recovery URL from canonical site URL', () => {
    expect(buildSetupSuccessRecoveryUrl('https://kersivo.co.uk/', 'cs_test_abc123')).toBe(
      'https://kersivo.co.uk/setup/success?session_id=cs_test_abc123',
    );
  });

  it('maps EMAIL_MISMATCH to customer-friendly copy', () => {
    const ux = mapClaimHttpError(403, 'EMAIL_MISMATCH');
    expect(ux).toEqual({
      kind: 'error',
      message: 'Please sign in with the same email address you used when purchasing KERSIVO.',
      retryable: true,
    });
  });

  it('maps 401 to need_auth', () => {
    expect(mapClaimHttpError(401)).toEqual({ kind: 'need_auth' });
  });

  it('maps temporary failures as retryable', () => {
    const ux = mapClaimHttpError(503);
    expect(ux.kind).toBe('error');
    if (ux.kind === 'error') {
      expect(ux.retryable).toBe(true);
    }
  });

  it('maps ALREADY_OWNED as non-retryable', () => {
    const ux = mapClaimHttpError(409, 'ALREADY_OWNED');
    expect(ux.kind).toBe('error');
    if (ux.kind === 'error') {
      expect(ux.retryable).toBe(false);
    }
  });
});
