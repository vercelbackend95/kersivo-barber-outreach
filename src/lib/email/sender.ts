const RESEND_API_KEY = import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
const FROM_EMAIL = import.meta.env.FROM_EMAIL ?? process.env.FROM_EMAIL ?? 'onboarding@resend.dev';

export async function sendBookingMagicLinkEmail(input: {
  to: string;
  fullName: string;
  confirmUrl: string;
  cancelUrl: string;
  rescheduleUrl: string;
}) {
  const html = `<p>Hi ${input.fullName},</p>
  <p>Please confirm your booking using this magic link:</p>
  <p><a href="${input.confirmUrl}">Confirm booking</a></p>
  <p>Manage links:</p>
  <ul>
    <li><a href="${input.rescheduleUrl}">Reschedule</a></li>
    <li><a href="${input.cancelUrl}">Cancel</a></li>
  </ul>`;

  if (!RESEND_API_KEY) {
    console.log('[DEV EMAIL] Booking link', { ...input });
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_EMAIL,
    to: input.to,
    subject: 'Confirm your booking',
    html
  });
}
