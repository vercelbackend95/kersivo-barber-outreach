import { describe, it, expect } from 'vitest';
import {
  parseTermsAccepted,
  TERMS_ACCEPTANCE_REQUIRED_MESSAGE,
  termsAcceptedErrorResponse,
} from './requireTermsAcceptance';

describe('parseTermsAccepted', () => {
  it('returns true only for boolean true', () => {
    expect(parseTermsAccepted({ termsAccepted: true })).toBe(true);
  });

  it('returns false when missing', () => {
    expect(parseTermsAccepted({})).toBe(false);
    expect(parseTermsAccepted(null)).toBe(false);
    expect(parseTermsAccepted(undefined)).toBe(false);
  });

  it('returns false for string "true" and other truthy non-booleans', () => {
    expect(parseTermsAccepted({ termsAccepted: 'true' })).toBe(false);
    expect(parseTermsAccepted({ termsAccepted: 1 })).toBe(false);
    expect(parseTermsAccepted({ termsAccepted: '1' })).toBe(false);
  });

  it('returns false for false', () => {
    expect(parseTermsAccepted({ termsAccepted: false })).toBe(false);
  });
});

describe('termsAcceptedErrorResponse', () => {
  it('returns 400 with required message', async () => {
    const res = termsAcceptedErrorResponse();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
  });
});
