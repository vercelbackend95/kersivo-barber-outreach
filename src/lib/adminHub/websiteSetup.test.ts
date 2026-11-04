import { describe, expect, it } from 'vitest';
import {
  BUSINESS_FIELD_SPEC,
  BUSINESS_FIELDS,
  businessComplete,
  businessDirty,
  businessDraftFromApi,
  businessFieldErrors,
  businessPatch,
  emptyBusinessDraft,
  SETUP_COPY,
  SETUP_SECTION_IDS,
  setupCompletion,
  textDirty,
  textDraftFromDetails,
  textPatch,
} from './websiteSetup';

const complete = {
  ...emptyBusinessDraft(),
  shopName: 'Fade Room',
  postcode: 'M1 1AE',
  phone: '0161 496 0000',
};

describe('website setup view-model', () => {
  it('has two sections and British copy with an honest save hint', () => {
    expect(SETUP_SECTION_IDS).toEqual(['business', 'hours']);
    expect(SETUP_COPY.hint).toBe('Saved changes show on your website preview the next time it loads.');
    expect(SETUP_COPY.progress(1, 2)).toBe('1 of 2 sections complete');
    expect(SETUP_COPY.sections.business.description).toBe('The details customers see on your website.');
    expect(Object.values(SETUP_COPY.sections).map((s) => s.title)).toEqual([
      'Business details',
      'Opening hours',
      'Website text',
      'Photos, logo and files',
    ]);
  });

  it('lists the business fields in form order with the agreed labels and limits', () => {
    expect(BUSINESS_FIELDS.map((f) => BUSINESS_FIELD_SPEC[f].label)).toEqual([
      'Barbershop name',
      'Town or city (optional)',
      'Address line 1',
      'Address line 2 (optional)',
      'Postcode',
      'Phone',
      'Email',
    ]);
    expect(BUSINESS_FIELD_SPEC.shopName).toMatchObject({ maxLength: 120, required: true });
    expect(BUSINESS_FIELD_SPEC.addressLine1.autoComplete).toBe('address-line1');
    expect(BUSINESS_FIELD_SPEC.postcode).toMatchObject({ maxLength: 16, autoComplete: 'postal-code' });
    expect(BUSINESS_FIELD_SPEC.phone).toMatchObject({ type: 'tel', maxLength: 40 });
    expect(BUSINESS_FIELD_SPEC.email).toMatchObject({ type: 'email', maxLength: 320 });
  });

  it('completes business details with a name, an address line or postcode, and a phone or email', () => {
    expect(businessComplete(complete)).toBe(true);
    expect(businessComplete({ ...complete, shopName: '  ' })).toBe(false);
    expect(businessComplete({ ...complete, postcode: '' })).toBe(false);
    expect(businessComplete({ ...complete, postcode: '', addressLine1: '1 High St' })).toBe(true);
    expect(businessComplete({ ...complete, phone: '' })).toBe(false);
    expect(businessComplete({ ...complete, phone: '', email: 'hello@fade.co.uk' })).toBe(true);
    // Town and address line 2 are optional and never required.
    expect(businessComplete({ ...complete, townCity: '', addressLine2: '' })).toBe(true);
  });

  it('counts completion from saved data only', () => {
    expect(setupCompletion({ business: null, hoursSaved: false })).toEqual({
      done: 0,
      total: 2,
      label: '0 of 2 sections complete',
    });
    expect(setupCompletion({ business: complete, hoursSaved: false }).label).toBe('1 of 2 sections complete');
    expect(setupCompletion({ business: complete, hoursSaved: true }).done).toBe(2);
  });

  it('maps the profile API to form values', () => {
    expect(businessDraftFromApi({ shopName: 'Fade Room', townCity: null, phone: '0161' })).toEqual({
      ...emptyBusinessDraft(),
      shopName: 'Fade Room',
      phone: '0161',
    });
    expect(businessDraftFromApi(null)).toEqual(emptyBusinessDraft());
  });

  it('sends only changed fields, null for cleared ones, and never an empty name', () => {
    const saved = { ...complete, townCity: 'Leeds' };
    const draft = { ...saved, phone: '  ', townCity: '', addressLine1: '2 Example Road', postcode: 'M1 1AE ' };
    expect(businessPatch(saved, draft)).toEqual({ phone: null, townCity: null, addressLine1: '2 Example Road' });
    expect(businessPatch(saved, { ...saved, shopName: ' Fade Room North ' })).toEqual({ shopName: 'Fade Room North' });
    expect(businessPatch(saved, { ...saved, shopName: '' })).toEqual({});
    expect(businessDirty(saved, { ...saved, postcode: 'M1 1AE ' })).toBe(false);
    expect(businessDirty(saved, { ...saved, email: 'a@b.co.uk' })).toBe(true);
  });

  it('maps and diffs Website text (about, Instagram, anything else)', () => {
    const saved = textDraftFromDetails({ aboutText: 'Family-run since 2009.', instagramUrl: null, websiteExtraText: 'Walk-ins' });
    expect(saved).toEqual({ aboutText: 'Family-run since 2009.', instagramUrl: '', websiteExtraText: 'Walk-ins' });
    expect(textDirty(saved, { ...saved, aboutText: 'Family-run since 2009. ' })).toBe(false);
    const draft = { ...saved, instagramUrl: '@faderoom', websiteExtraText: ' ' };
    expect(textDirty(saved, draft)).toBe(true);
    expect(textPatch(saved, draft)).toEqual({ instagramUrl: '@faderoom', websiteExtraText: null });
  });

  it('flags a missing name and a malformed email before sending', () => {
    expect(businessFieldErrors(complete)).toEqual({});
    expect(businessFieldErrors({ ...complete, shopName: ' ' })).toEqual({ shopName: 'Enter your barbershop name.' });
    expect(businessFieldErrors({ ...complete, email: 'not-an-email' }).email).toMatch(/email address/);
    expect(businessFieldErrors({ ...complete, email: 'hello@fade.co.uk' })).toEqual({});
  });
});
