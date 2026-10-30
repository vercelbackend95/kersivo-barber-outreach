/** Normalize domain-ish input for storage / comparison (no registrar passwords). */
export function normalizeDomainInput(value: string | null | undefined): string | null {
  if (value == null) return null;
  let t = value.trim().toLowerCase();
  if (!t) return null;
  t = t.replace(/^https?:\/\//, '');
  t = t.replace(/\/+$/, '');
  t = t.split('/')[0] ?? t;
  t = t.split('?')[0] ?? t;
  t = t.split('#')[0] ?? t;
  t = t.replace(/:\d+$/, '');
  return t.length ? t : null;
}

const DNS_LABEL = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/i;

/**
 * Public hostname validation after normalizeDomainInput.
 * Accepts ASCII DNS labels and already-punycode (xn--) labels only.
 */
export function isValidPublicHostname(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  if (!h || h.length > 253) return false;
  if (h.includes(' ') || h.includes('/') || h.includes(':')) return false;
  if (!h.includes('.')) return false;
  if (h.startsWith('.') || h.endsWith('.')) return false;
  if (h === 'localhost' || h.endsWith('.localhost')) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return false;

  const labels = h.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (label.includes('_')) return false;
    if (/[^\x00-\x7f]/.test(label)) return false;
    if (label.startsWith('xn--')) {
      if (!/^xn--[a-z0-9-]{1,59}$/i.test(label)) return false;
      continue;
    }
    if (!DNS_LABEL.test(label)) return false;
  }
  const tld = labels[labels.length - 1] ?? '';
  if (tld.length < 2) return false;
  return true;
}

export function normalizeAndValidateDomainInput(
  value: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    return { ok: true, value: null };
  }
  const normalized = normalizeDomainInput(value);
  if (!normalized || !isValidPublicHostname(normalized)) {
    return { ok: false, error: 'Enter a valid domain name (e.g. example.com).' };
  }
  return { ok: true, value: normalized };
}
