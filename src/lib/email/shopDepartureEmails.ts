import { getClientOnboardingContactInboxEmail } from '@/lib/email/clientOnboardingEmails';
import { KERSIVO_SUPPORT_EMAIL, SHOP_DEPARTURE_EMAIL_SUBJECT } from '@/lib/shop/shopDepartureCopy';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Owner confirmation for a "Leave KERSIVO" request. Never promises a deletion date. */
export function buildShopDepartureConfirmationEmail(input: {
  shopName: string;
  futureAppointments: number;
}): { subject: string; html: string; replyTo: string } {
  const shopName = escapeHtml(input.shopName.trim() || 'your shop');
  const appointments =
    input.futureAppointments > 0
      ? `<p>You still have ${input.futureAppointments} future ${
          input.futureAppointments === 1 ? 'appointment' : 'appointments'
        } in your KERSIVO dashboard. They have not been cancelled. You can still reschedule, cancel or refund them there, and clients keep getting the usual emails about them.</p>`
      : '<p>You have no future appointments left in KERSIVO.</p>';

  return {
    subject: SHOP_DEPARTURE_EMAIL_SUBJECT,
    replyTo: getClientOnboardingContactInboxEmail(),
    html: `<p>Hi,</p>
<p>We've received your request to leave KERSIVO for <strong>${shopName}</strong>.</p>
<p>New online bookings are now off. Your booking page and QR codes no longer take new bookings.</p>
${appointments}
<p>If your Google Business Profile links to your KERSIVO booking page, remove or replace that link in Google. KERSIVO cannot change your Google profile for you.</p>
<p>Need a copy of your client and booking data? Reply to this email or contact <a href="mailto:${KERSIVO_SUPPORT_EMAIL}">${KERSIVO_SUPPORT_EMAIL}</a> while your data is still retained.</p>
<p>This does not delete your login, close your Stripe account or affect any other shop.</p>
<p>KERSIVO</p>`,
  };
}
