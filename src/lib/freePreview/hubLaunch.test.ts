import { describe, expect, it } from 'vitest';
import {
  businessDetailsComplete,
  businessDetailsErrors,
  hubLaunchProgressFrom,
  launchChecklistPatchSchema,
  liveSiteUrl,
} from './hubLaunch';

const completeSole = {
  publicEmail: 'shop@example.com',
  publicPhone: '01234 567890',
  addressLine1: '12 High Street',
  townCity: 'Leeds',
  postcode: 'LS1 1AA',
  primaryContactName: 'Alex',
  primaryContactEmail: 'alex@example.com',
  isLimitedCompany: false,
  legalBusinessName: null,
  companyNumber: null,
  registeredOfficeAddress: null,
};

const completeLtd = {
  ...completeSole,
  isLimitedCompany: true,
  legalBusinessName: 'Fade Studio Ltd',
  companyNumber: 'SC123456',
  registeredOfficeAddress: '1 Queen Street, Edinburgh',
};

describe('businessDetailsComplete', () => {
  it('lets a sole trader finish without legal name or company number', () => {
    expect(businessDetailsComplete(completeSole)).toBe(true);
    expect(businessDetailsErrors(completeSole)).toEqual([]);
  });

  it('requires the three Ltd fields when Yes', () => {
    expect(businessDetailsComplete({ ...completeLtd, companyNumber: null })).toBe(false);
    expect(businessDetailsComplete({ ...completeLtd, legalBusinessName: '' })).toBe(false);
    expect(businessDetailsComplete({ ...completeLtd, registeredOfficeAddress: '  ' })).toBe(false);
    expect(businessDetailsComplete({ ...completeLtd, companyNumber: '123' })).toBe(false);
    expect(businessDetailsComplete(completeLtd)).toBe(true);
  });

  it('is incomplete until the Ltd question is answered', () => {
    expect(businessDetailsComplete({ ...completeSole, isLimitedCompany: null })).toBe(false);
  });
});

describe('launchChecklistPatchSchema', () => {
  it('rejects an unknown item', () => {
    expect(launchChecklistPatchSchema.safeParse({ item: 'retail' }).success).toBe(false);
  });

  it('accepts skip payments and skip migration', () => {
    expect(launchChecklistPatchSchema.safeParse({ item: 'payments', skip: true }).success).toBe(true);
    expect(launchChecklistPatchSchema.safeParse({ item: 'migration', skip: true }).success).toBe(true);
  });
});

describe('hubLaunchProgressFrom', () => {
  it('exposes states only — no addresses or numbers', () => {
    const progress = hubLaunchProgressFrom({
      businessComplete: true,
      domainOwnerDone: false,
      paymentsDone: true,
      migrationDone: false,
      launchApprovedAt: null,
      ourStepDomainAt: new Date('2026-10-31T12:00:00Z'),
      ourStepSslAt: null,
      liveAt: null,
      liveHostname: 'fadestudio.co.uk',
    });
    expect(progress.yourSteps.map((item) => [item.id, item.done])).toEqual([
      ['business', true],
      ['domain', false],
      ['payments', true],
      ['migration', false],
      ['approve', false],
    ]);
    expect(progress.ourSteps).toEqual([
      { id: 'domain', status: 'done' },
      { id: 'ssl', status: 'pending' },
      { id: 'live', status: 'pending' },
    ]);
    expect(JSON.stringify(progress)).not.toContain('fadestudio');
    expect(progress.liveUrl).toBeNull();
  });

  it('returns the live URL only after liveAt', () => {
    const progress = hubLaunchProgressFrom({
      businessComplete: true,
      domainOwnerDone: true,
      paymentsDone: true,
      migrationDone: true,
      launchApprovedAt: new Date(),
      ourStepDomainAt: new Date(),
      ourStepSslAt: new Date(),
      liveAt: new Date(),
      liveHostname: 'fadestudio.co.uk',
    });
    expect(progress.liveUrl).toBe('https://fadestudio.co.uk');
  });
});

describe('liveSiteUrl', () => {
  it('builds https from a hostname', () => {
    expect(liveSiteUrl('www.fadestudio.co.uk')).toBe('https://www.fadestudio.co.uk');
    expect(liveSiteUrl('')).toBeNull();
  });
});
