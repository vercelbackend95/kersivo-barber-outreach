import { formatInTimeZone } from 'date-fns-tz';
const RESEND_API_KEY = import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
const FROM_EMAIL = import.meta.env.FROM_EMAIL ?? process.env.FROM_EMAIL ?? 'onboarding@resend.dev';

type BookingEmailBaseInput = {
  to: string;
  fullName: string;
  shopName: string;
  serviceName: string;
  barberName: string;
  startAt: Date;
};

function renderBookingSummary(input: BookingEmailBaseInput): string {
  const londonDateTime = formatInTimeZone(input.startAt, 'Europe/London', "EEEE d MMMM yyyy 'at' HH:mm");

  return `<p><strong>Shop:</strong> ${input.shopName}</p>
  <p><strong>Service:</strong> ${input.serviceName}</p>
  <p><strong>Barber:</strong> ${input.barberName}</p>
  <p><strong>Date & time (Europe/London):</strong> ${londonDateTime}</p>`;
}

async function sendEmail(input: { to: string; subject: string; html: string; devLogLabel: string; devPayload: Record<string, string> }) {
  if (!RESEND_API_KEY) {
    console.log(input.devLogLabel, input.devPayload);
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_API_KEY);


    await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html
    });

    console.info('[EMAIL] Sent', { to: input.to, subject: input.subject });
  } catch (error) {
    console.error('[EMAIL] Failed to send', { to: input.to, subject: input.subject, error });
    throw error;
  }

}

export async function sendBookingConfirmationEmail(input: BookingEmailBaseInput & { confirmUrl: string }) {
  const summaryHtml = renderBookingSummary(input);
  const html = `<p>Hi ${input.fullName},</p>
  <p>Please confirm your booking by clicking the link below:</p>
  <p><a href="${input.confirmUrl}">Confirm booking</a></p>
  ${summaryHtml}`;

  await sendEmail({
    to: input.to,
    subject: 'Confirm your booking',
    html,
    devLogLabel: '[DEV EMAIL] Confirm booking link',
    devPayload: {
      to: input.to,
      fullName: input.fullName,
      confirmUrl: input.confirmUrl,
      shopName: input.shopName,
      serviceName: input.serviceName,
      barberName: input.barberName,
      startAt: input.startAt.toISOString()
    }
  });
}

export async function sendManageBookingEmail(input: BookingEmailBaseInput & { cancelUrl: string; rescheduleUrl: string }) {
  const summaryHtml = renderBookingSummary(input);
  const html = `<p>Hi ${input.fullName},</p>
  <p>Your booking is confirmed. You can manage it using these links:</p>
  <ul>
    <li><a href="${input.rescheduleUrl}">Reschedule booking</a></li>
    <li><a href="${input.cancelUrl}">Cancel booking</a></li>
  </ul>
  ${summaryHtml}`;

  await sendEmail({
    to: input.to,
    subject: 'Manage your booking',
    html,
    devLogLabel: '[DEV EMAIL] Manage booking links',
    devPayload: {
      to: input.to,
      fullName: input.fullName,
      cancelUrl: input.cancelUrl,
      rescheduleUrl: input.rescheduleUrl,
      shopName: input.shopName,
      serviceName: input.serviceName,
      barberName: input.barberName,
      startAt: input.startAt.toISOString()
    }

  });
}
export async function sendRescheduledBookingEmail(
  input: BookingEmailBaseInput & {
    cancelUrl: string;
    rescheduleUrl: string;
    previousStartAt?: Date | null;
    previousEndAt?: Date | null;
  }
) {
  const summaryHtml = renderBookingSummary(input);
  const previousDateTime =
    input.previousStartAt && input.previousEndAt
      ? formatInTimeZone(input.previousStartAt, 'Europe/London', "EEEE d MMMM yyyy 'at' HH:mm")
      : null;

  const previousSummaryHtml = previousDateTime ? `<p><strong>Previous:</strong> ${previousDateTime} (Europe/London)</p>` : '';

  const html = `<p>Hi ${input.fullName},</p>
  <p>Your booking has been rescheduled.</p>
  <ul>
    <li><a href="${input.rescheduleUrl}">Reschedule booking</a></li>
    <li><a href="${input.cancelUrl}">Cancel booking</a></li>
  </ul>
  ${summaryHtml}
  ${previousSummaryHtml}`;

  await sendEmail({
    to: input.to,
    subject: 'Your booking has been rescheduled',
    html,
    devLogLabel: '[DEV EMAIL] Rescheduled booking',
    devPayload: {
      to: input.to,
      fullName: input.fullName,
      cancelUrl: input.cancelUrl,
      rescheduleUrl: input.rescheduleUrl,
      shopName: input.shopName,
      serviceName: input.serviceName,
      barberName: input.barberName,
      startAt: input.startAt.toISOString(),
      previousStartAt: input.previousStartAt?.toISOString() ?? '',
      previousEndAt: input.previousEndAt?.toISOString() ?? ''
    }

  });
}
