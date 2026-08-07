import { sendRenderedEmail } from '@/lib/email/sender';
import type { ClientOnboarding } from '@prisma/client';
import type { WorkspaceCompletionSnapshot } from '@/lib/admin/clientOnboarding/schema';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getClientOnboardingContactInboxEmail(): string {
  return (
    import.meta.env.CONTACT_INBOX_EMAIL ??
    process.env.CONTACT_INBOX_EMAIL ??
    import.meta.env.FROM_EMAIL ??
    process.env.FROM_EMAIL ??
    'hello@kersivo.co.uk'
  );
}

function line(label: string, value: string | null | undefined | boolean | number) {
  if (value === null || value === undefined || value === '') {
    return `<li><strong>${escapeHtml(label)}:</strong> —</li>`;
  }
  const text = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
  return `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}</li>`;
}

function section(title: string, items: string[]) {
  return `<h3>${escapeHtml(title)}</h3><ul>${items.join('')}</ul>`;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function buildClientOnboardingCustomerConfirmationEmail(input: {
  contactName: string;
}): { subject: string; html: string; replyTo: string } {
  return {
    subject: 'We’ve received your KERSIVO onboarding',
    replyTo: getClientOnboardingContactInboxEmail(),
    html: `<p>Hi ${escapeHtml(input.contactName)},</p>
<p>Thanks — we’ve received the information for your KERSIVO setup. We’ll review it and contact you if anything is missing. Nothing goes live without your approval.</p>
<p>KERSIVO<br/>Your domain. Your brand. Your client relationship.</p>`,
  };
}

export function buildClientOnboardingInternalNotificationEmail(input: {
  shopName: string;
  shopId: string;
  onboardingId: string;
  submittedAtIso: string;
  onboarding: ClientOnboarding;
  barbers: Array<{ name: string }>;
  services: Array<{ name: string; pricePence: number; durationMinutes: number }>;
  openingHours: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }>;
  assets: Array<{ kind: string; originalFileName: string; storagePath: string }>;
  workspace: WorkspaceCompletionSnapshot;
  ownerEmail: string | null;
  ownerName: string | null;
}): { subject: string; html: string; replyTo?: string; to: string } {
  const o = input.onboarding;
  const inbox = getClientOnboardingContactInboxEmail();

  const html = [
    `<p>Client onboarding submitted for <strong>${escapeHtml(input.shopName)}</strong>.</p>`,
    section('Client', [
      line('Owner name', input.ownerName),
      line('Owner email', input.ownerEmail),
      line('Shop name', input.shopName),
      line('shopId', input.shopId),
      line('onboardingId', input.onboardingId),
      line('submittedAt', input.submittedAtIso),
    ]),
    section('Business', [
      line('Legal business name', o.legalBusinessName),
      line('Business type', o.businessType),
      line('Company number', o.companyNumber),
      line('Address line 1', o.addressLine1),
      line('Address line 2', o.addressLine2),
      line('Town / city', o.townCity),
      line('Postcode', o.postcode),
    ]),
    section('Contact', [
      line('Primary contact name', o.primaryContactName),
      line('Primary contact email', o.primaryContactEmail),
      line('Public email', o.publicEmail),
      line('Public phone', o.publicPhone),
      line('Notification reply-to', o.notificationReplyToEmail),
    ]),
    section('Brand', [
      line('Tagline', o.tagline),
      line('Description', o.shopDescription),
      line('Brand notes', o.brandNotes),
      line('Primary colour', o.preferredPrimaryColour),
      line('Secondary colour', o.preferredSecondaryColour),
    ]),
    section('Website', [
      line('Current website', o.currentWebsiteUrl),
      line('Website notes', o.websiteNotes),
      line('Instagram', o.instagramUrl),
      line('Facebook', o.facebookUrl),
      line('TikTok', o.tiktokUrl),
      line('Other social', o.otherSocialUrl),
    ]),
    section(
      'Team summary',
      input.barbers.length
        ? input.barbers.map((b) => `<li>${escapeHtml(b.name)}</li>`)
        : ['<li>—</li>'],
    ),
    section(
      'Services summary',
      input.services.length
        ? input.services.map(
            (s) =>
              `<li>${escapeHtml(s.name)} — £${(s.pricePence / 100).toFixed(2)} / ${s.durationMinutes}m</li>`,
          )
        : ['<li>—</li>'],
    ),
    section(
      'Opening hours summary',
      input.openingHours.length
        ? input.openingHours.map((h) => {
            const day = DAY_NAMES[h.dayOfWeek - 1] ?? `Day ${h.dayOfWeek}`;
            return `<li>${escapeHtml(day)}: ${formatMinutes(h.startMinutes)}–${formatMinutes(h.endMinutes)}</li>`;
          })
        : ['<li>—</li>'],
    ),
    section('Domain', [
      line('Mode', o.domainMode),
      line('Existing domain', o.existingDomain),
      line('Registrar', o.domainRegistrar),
      line('Preferred 1', o.preferredDomain1),
      line('Preferred 2', o.preferredDomain2),
      line('Preferred 3', o.preferredDomain3),
      line('Registration authorised', o.domainRegistrationAuthorised),
    ]),
    section('Migration', [
      line('Requested', o.migrationRequested),
      line('Source', o.migrationSource),
      line('Source other', o.migrationSourceOther),
      line('Notes', o.migrationNotes),
      line('Lawful data confirmed', o.migrationDataConfirmedLawful),
      ...input.assets.map(
        (a) =>
          `<li><strong>File:</strong> ${escapeHtml(a.kind)} — ${escapeHtml(a.originalFileName)} — pathname ${escapeHtml(a.storagePath)}</li>`,
      ),
    ]),
    section('Retail', [
      line('Launch retail', o.launchRetail),
      line('Products deferred', o.retailProductsDeferred),
      line('Product count', input.workspace.productCount),
    ]),
    section('Deposits', [line('Launch deposits', o.launchDeposits)]),
    section('Communications', [
      line('Notification reply-to', o.notificationReplyToEmail),
    ]),
    section('Optional permissions', [
      line('Portfolio', o.portfolioConsent),
      line('Social media', o.socialMediaConsent),
      line('Advertising', o.advertisingConsent),
      line('Case study', o.caseStudyConsent),
    ]),
    section('Additional notes', [line('Notes', o.additionalNotes)]),
    section('Meta', [
      line('submittedAt', input.submittedAtIso),
      line('shopId', input.shopId),
      line('onboardingId', input.onboardingId),
      line('Content rights confirmed', o.contentRightsConfirmed),
      line('Information accuracy confirmed', o.informationAccuracyConfirmed),
    ]),
  ].join('\n');

  return {
    to: inbox,
    subject: `KERSIVO onboarding submitted — ${input.shopName}`,
    replyTo: o.primaryContactEmail || input.ownerEmail || undefined,
    html,
  };
}

/** @deprecated Prefer durable outbox enqueue; kept for direct/dev use. */
export async function sendClientOnboardingCustomerConfirmationEmail(input: {
  to: string;
  shopName: string;
  contactName: string;
}) {
  const built = buildClientOnboardingCustomerConfirmationEmail(input);
  return sendRenderedEmail({
    to: input.to,
    subject: built.subject,
    replyTo: built.replyTo,
    html: built.html,
    devLogLabel: '[DEV EMAIL] Client onboarding customer confirmation',
  });
}

/** @deprecated Prefer durable outbox enqueue; kept for direct/dev use. */
export async function sendClientOnboardingInternalNotificationEmail(
  input: Parameters<typeof buildClientOnboardingInternalNotificationEmail>[0],
) {
  const built = buildClientOnboardingInternalNotificationEmail(input);
  return sendRenderedEmail({
    to: built.to,
    subject: built.subject,
    replyTo: built.replyTo,
    html: built.html,
    devLogLabel: '[DEV EMAIL] Client onboarding internal notification',
  });
}
