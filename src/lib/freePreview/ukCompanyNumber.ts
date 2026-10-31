/** UK company number: 8 digits, or SC / NI / OC plus 6 digits (Companies House). */
const UK_COMPANY_NUMBER = /^(?:\d{8}|SC\d{6}|NI\d{6}|OC\d{6})$/;

export function normalizeUkCompanyNumber(raw: string): string {
  return raw.replace(/[\s-]+/g, '').toUpperCase();
}

export function isValidUkCompanyNumber(raw: string): boolean {
  return UK_COMPANY_NUMBER.test(normalizeUkCompanyNumber(raw));
}
