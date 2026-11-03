/**
 * Recipients on reserved / non-deliverable domains (RFC 2606 + RFC 6761). Mail to these can never
 * be delivered: Resend rejects some outright (422 validation_error) and the rest bounce. They come
 * from QA runs, seed data and test submissions, so we record them as SUPPRESSED instead of sending.
 */
const RESERVED_DOMAINS = new Set(['example.com', 'example.org', 'example.net']);
const RESERVED_TLDS = ['.test', '.invalid', '.example', '.localhost'];

export function recipientDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).trim().toLowerCase().replace(/\.$/, '') : '';
}

export function isReservedRecipient(email: string): boolean {
  const domain = recipientDomain(email);
  if (!domain) return false;
  for (const reserved of RESERVED_DOMAINS) {
    if (domain === reserved || domain.endsWith(`.${reserved}`)) return true;
  }
  if (domain === 'localhost') return true;
  return RESERVED_TLDS.some((tld) => domain.endsWith(tld));
}

const loggedSuppressions = new Set<string>();

/** Log a suppressed send once per context + recipient domain per process (domain only, no PII). */
export function logReservedRecipientSuppressed(context: string, email: string): void {
  const domain = recipientDomain(email);
  const key = `${context}:${domain}`;
  if (loggedSuppressions.has(key)) return;
  loggedSuppressions.add(key);
  console.info('[EMAIL] Suppressed send to reserved recipient domain', { context, domain });
}
