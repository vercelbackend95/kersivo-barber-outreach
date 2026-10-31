import { describe, expect, it } from 'vitest';
import { shouldCreateDirectSubscribeHub } from './directSubscribe';

describe('shouldCreateDirectSubscribeHub', () => {
  it('creates a hub for a brand-new Full shop', () => {
    expect(shouldCreateDirectSubscribeHub({ previewRequestId: null, onboarding: null })).toBe(true);
    expect(
      shouldCreateDirectSubscribeHub({
        previewRequestId: null,
        onboarding: { status: 'DRAFT', currentStep: 0, submittedAt: null },
      }),
    ).toBe(true);
  });

  it('leaves existing preview shops and legacy wizard shops untouched', () => {
    expect(
      shouldCreateDirectSubscribeHub({
        previewRequestId: 'req_1',
        onboarding: { status: 'DRAFT', currentStep: 0, submittedAt: null },
      }),
    ).toBe(false);
    expect(
      shouldCreateDirectSubscribeHub({
        previewRequestId: null,
        onboarding: { status: 'DRAFT', currentStep: 3, submittedAt: null },
      }),
    ).toBe(false);
    expect(
      shouldCreateDirectSubscribeHub({
        previewRequestId: null,
        onboarding: { status: 'SUBMITTED', currentStep: 0, submittedAt: new Date() },
      }),
    ).toBe(false);
  });
});
