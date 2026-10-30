import { normalizeAndValidateDomainInput } from '@/lib/domains/hostname';
import { isAllowedKersivoRegisterHostname, isDisallowedKersivoRegisterTld } from './tldPolicy';

export type PreviewDomainMode = 'EXISTING' | 'KERSIVO_REGISTER';

export type DomainChoiceInput = {
  domainMode: PreviewDomainMode;
  domain: string;
  domainRegistrationAuthorised?: boolean;
};

export type DomainChoiceResult =
  | { ok: true; hostname: string; domainMode: PreviewDomainMode; authorised: boolean }
  | { ok: false; error: string };

export function validateDomainChoice(input: DomainChoiceInput): DomainChoiceResult {
  const parsed = normalizeAndValidateDomainInput(input.domain);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (!parsed.value) return { ok: false, error: 'Choose a domain before continuing.' };

  if (input.domainMode === 'EXISTING') {
    return { ok: true, hostname: parsed.value, domainMode: 'EXISTING', authorised: false };
  }

  if (isDisallowedKersivoRegisterTld(parsed.value)) {
    return {
      ok: false,
      error: 'That ending is not a UK domain we can register. Try a .co.uk, .uk or .com name.',
    };
  }
  if (!isAllowedKersivoRegisterHostname(parsed.value)) {
    return {
      ok: false,
      error: 'Choose a standard domain we can register (.co.uk, .uk or .com).',
    };
  }
  if (input.domainRegistrationAuthorised !== true) {
    return {
      ok: false,
      error: 'Authorise KERSIVO to register and manage the selected domain before continuing.',
    };
  }

  return {
    ok: true,
    hostname: parsed.value,
    domainMode: 'KERSIVO_REGISTER',
    authorised: true,
  };
}
