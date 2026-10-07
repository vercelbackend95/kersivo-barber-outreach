import { getClientOnboardingContactInboxEmail } from '@/lib/email/clientOnboardingEmails';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const QR_KIT_ACK_EMAIL_SUBJECT = 'Your KERSIVO QR Kit request';
export const QR_KIT_ACK_EMAIL_BODY =
  "We've received your QR Kit request and will verify the shop details before it goes to print. We'll contact you if we need anything else.";

export function buildQrKitRequestAcknowledgementEmail(input: {
  contactName: string;
}): { subject: string; html: string; replyTo: string } {
  return {
    subject: QR_KIT_ACK_EMAIL_SUBJECT,
    replyTo: getClientOnboardingContactInboxEmail(),
    html: `<p>Hi ${escapeHtml(input.contactName || 'there')},</p>
<p>${escapeHtml(QR_KIT_ACK_EMAIL_BODY)}</p>
<p>KERSIVO</p>`,
  };
}

export type QrKitInternalEmailInput = {
  shopName: string;
  shopId: string;
  fulfilmentId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  townCity: string;
  postcode: string;
  countryCode: string;
  requestedAt: Date;
};

export function buildQrKitRequestInternalEmail(input: QrKitInternalEmailInput): {
  to: string;
  subject: string;
  html: string;
  replyTo: string;
} {
  const rows: Array<[string, string]> = [
    ['Shop', input.shopName],
    ['Shop ID', input.shopId],
    ['Fulfilment ID', input.fulfilmentId],
    ['Contact name', input.contactName],
    ['Contact email', input.contactEmail],
    ['Contact phone', input.contactPhone],
    ['Address line 1', input.addressLine1],
    ['Address line 2', input.addressLine2 ?? '—'],
    ['Town / city', input.townCity],
    ['Postcode', input.postcode],
    ['Country', input.countryCode],
    ['Requested at', input.requestedAt.toISOString()],
  ];
  return {
    to: getClientOnboardingContactInboxEmail(),
    subject: `New QR Kit request — ${input.shopName}`,
    replyTo: input.contactEmail,
    html: `<p>A new QR Kit request has been received.</p>
<table>${rows
      .map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
      .join('')}</table>`,
  };
}
