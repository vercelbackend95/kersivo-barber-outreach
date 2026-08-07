import { describe, it, expect } from 'vitest';
import {
  ClientOnboardingDomainMode,
  MARKETING_CONSENT_DEFAULTS,
  validateClientOnboardingSubmit,
  type SubmitValidationContext,
} from './schema';

function baseCtx(
  overrides: Partial<SubmitValidationContext['draft']> = {},
  workspaceOverrides: Partial<SubmitValidationContext['workspace']> = {},
): SubmitValidationContext {
  return {
    draft: {
      domainMode: ClientOnboardingDomainMode.EXISTING,
      domainRegistrationAuthorised: false,
      migrationRequested: false,
      migrationDataConfirmedLawful: false,
      launchRetail: false,
      retailProductsDeferred: false,
      contentRightsConfirmed: true,
      informationAccuracyConfirmed: true,
      addressLine1: '1 High Street',
      townCity: 'London',
      postcode: 'E1 1AA',
      publicEmail: 'shop@example.com',
      publicPhone: null,
      primaryContactName: 'Alex Owner',
      primaryContactEmail: 'alex@example.com',
      ...overrides,
    },
    workspace: {
      shopName: 'Test Cuts',
      activeBarberCount: 1,
      activeServiceCount: 1,
      activeShopOpenDayCount: 1,
      activeBarberAvailabilityDayCount: 1,
      productCount: 0,
      ...workspaceOverrides,
    },
  };
}

describe('validateClientOnboardingSubmit', () => {
  it('passes a complete valid draft', () => {
    expect(validateClientOnboardingSubmit(baseCtx())).toEqual([]);
  });

  it('fails when required contact / address fields are missing', () => {
    const errors = validateClientOnboardingSubmit(
      baseCtx({
        primaryContactName: null,
        primaryContactEmail: null,
        addressLine1: null,
        townCity: null,
        postcode: null,
        publicEmail: null,
        publicPhone: null,
      }),
    );
    expect(errors.some((e) => e.includes('Primary contact name'))).toBe(true);
    expect(errors.some((e) => e.includes('Primary contact email'))).toBe(true);
    expect(errors.some((e) => e.includes('Street address'))).toBe(true);
    expect(errors.some((e) => e.includes('Town'))).toBe(true);
    expect(errors.some((e) => e.includes('Postcode'))).toBe(true);
    expect(errors.some((e) => e.includes('public contact'))).toBe(true);
  });

  it('accepts public phone without public email', () => {
    expect(
      validateClientOnboardingSubmit(
        baseCtx({ publicEmail: null, publicPhone: '02071234567' }),
      ),
    ).toEqual([]);
  });

  it('fails when workspace team/services/hours are incomplete', () => {
    const errors = validateClientOnboardingSubmit(
      baseCtx(
        {},
        {
          shopName: null,
          activeBarberCount: 0,
          activeServiceCount: 0,
          activeShopOpenDayCount: 0,
          activeBarberAvailabilityDayCount: 0,
        },
      ),
    );
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it('rejects UNDECIDED domain mode', () => {
    const errors = validateClientOnboardingSubmit(
      baseCtx({ domainMode: ClientOnboardingDomainMode.UNDECIDED }),
    );
    expect(errors.some((e) => e.toLowerCase().includes('domain'))).toBe(true);
  });

  it('rejects KERSIVO_REGISTER without domain authorisation', () => {
    const errors = validateClientOnboardingSubmit(
      baseCtx({
        domainMode: ClientOnboardingDomainMode.KERSIVO_REGISTER,
        domainRegistrationAuthorised: false,
      }),
    );
    expect(errors.some((e) => e.toLowerCase().includes('authorise'))).toBe(true);
  });

  it('allows KERSIVO_REGISTER with authorisation', () => {
    expect(
      validateClientOnboardingSubmit(
        baseCtx({
          domainMode: ClientOnboardingDomainMode.KERSIVO_REGISTER,
          domainRegistrationAuthorised: true,
        }),
      ),
    ).toEqual([]);
  });

  it('rejects migration requested without lawful confirmation', () => {
    const errors = validateClientOnboardingSubmit(
      baseCtx({
        migrationRequested: true,
        migrationDataConfirmedLawful: false,
      }),
    );
    expect(errors.some((e) => e.toLowerCase().includes('lawfully'))).toBe(true);
  });

  it('rejects missing content rights / accuracy declarations', () => {
    const errors = validateClientOnboardingSubmit(
      baseCtx({
        contentRightsConfirmed: false,
        informationAccuracyConfirmed: false,
      }),
    );
    expect(errors.some((e) => e.toLowerCase().includes('content rights'))).toBe(true);
    expect(errors.some((e) => e.toLowerCase().includes('accuracy'))).toBe(true);
  });

  it('requires product or deferred flag when launchRetail=true', () => {
    const missing = validateClientOnboardingSubmit(
      baseCtx({ launchRetail: true, retailProductsDeferred: false }, { productCount: 0 }),
    );
    expect(missing.some((e) => e.toLowerCase().includes('retail'))).toBe(true);

    expect(
      validateClientOnboardingSubmit(
        baseCtx({ launchRetail: true, retailProductsDeferred: true }, { productCount: 0 }),
      ),
    ).toEqual([]);

    expect(
      validateClientOnboardingSubmit(
        baseCtx({ launchRetail: true, retailProductsDeferred: false }, { productCount: 1 }),
      ),
    ).toEqual([]);
  });

  it('keeps marketing consents default false', () => {
    expect(MARKETING_CONSENT_DEFAULTS.portfolioConsent).toBe(false);
    expect(MARKETING_CONSENT_DEFAULTS.socialMediaConsent).toBe(false);
    expect(MARKETING_CONSENT_DEFAULTS.advertisingConsent).toBe(false);
    expect(MARKETING_CONSENT_DEFAULTS.caseStudyConsent).toBe(false);
  });
});
