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
