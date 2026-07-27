/**
 * Normalize a phone number to E.164.
 * Defaults bare UK national numbers (07… / 7…) to +44.
 * Returns null when the value cannot be a valid mobile/landline E.164.
 */
export function normalizePhoneToE164(
  raw: string | null | undefined,
  defaultCountry: 'GB' = 'GB',
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digitsAndPlus = trimmed.replace(/[^\d+]/g, '');
  if (!digitsAndPlus) return null;

  let candidate = digitsAndPlus;
  if (candidate.startsWith('00')) {
    candidate = `+${candidate.slice(2)}`;
  }

  if (candidate.startsWith('+')) {
    const intl = candidate.replace(/\D/g, '');
    if (intl.length < 10 || intl.length > 15) return null;
    return `+${intl}`;
  }

  const national = candidate.replace(/\D/g, '');
  if (defaultCountry === 'GB') {
    // 07XXXXXXXXX or 7XXXXXXXXX → +447XXXXXXXXX
    if (/^07\d{9}$/.test(national)) {
      return `+44${national.slice(1)}`;
    }
    if (/^7\d{9}$/.test(national)) {
      return `+44${national}`;
    }
    // Already country-coded without +: 447XXXXXXXXX
    if (/^44\d{9,10}$/.test(national)) {
      return `+${national}`;
    }
  }

  return null;
}
