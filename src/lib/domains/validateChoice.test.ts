import { describe, expect, it } from 'vitest';
import { validateDomainChoice } from './validateChoice';

describe('validateDomainChoice', () => {
  it('accepts an existing public hostname of any TLD', () => {
    expect(
      validateDomainChoice({ domainMode: 'EXISTING', domain: 'https://www.MyShop.london/' }),
    ).toEqual({
      ok: true,
      hostname: 'www.myshop.london',
      domainMode: 'EXISTING',
      authorised: false,
    });
  });

  it('requires a decision, a standard TLD and the auth checkbox for KERSIVO_REGISTER', () => {
    expect(validateDomainChoice({ domainMode: 'KERSIVO_REGISTER', domain: '' })).toMatchObject({
      ok: false,
    });
    expect(
      validateDomainChoice({
        domainMode: 'KERSIVO_REGISTER',
        domain: 'faderoom.uk.com',
        domainRegistrationAuthorised: true,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateDomainChoice({
        domainMode: 'KERSIVO_REGISTER',
        domain: 'faderoom.co.uk',
        domainRegistrationAuthorised: false,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateDomainChoice({
        domainMode: 'KERSIVO_REGISTER',
        domain: 'FadeRoom.co.uk',
        domainRegistrationAuthorised: true,
      }),
    ).toEqual({
      ok: true,
      hostname: 'faderoom.co.uk',
      domainMode: 'KERSIVO_REGISTER',
      authorised: true,
    });
  });
});
