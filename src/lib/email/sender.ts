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
export class EmailDeliveryError extends Error {
  response: unknown;

  constructor(message: string, response: unknown, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EmailDeliveryError';
    this.response = response;
  }
}


function renderBookingSummary(input: BookingEmailBaseInput): string {
  const londonDateTime = formatInTimeZone(input.startAt, 'Europe/London', "EEEE d MMMM yyyy 'at' HH:mm");

  return `<p><strong>Shop:</strong> ${input.shopName}</p>
  <p><strong>Service:</strong> ${input.serviceName}</p>
  <p><strong>Barber:</strong> ${input.barberName}</p>
  <p><strong>Date & time (Europe/London):</strong> ${londonDateTime}</p>`;
}
async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  devLogLabel: string;
  devPayload: Record<string, string>;
}): Promise<{ messageId: string | null }> {

  if (!RESEND_API_KEY) {
    console.log(input.devLogLabel, input.devPayload);
    return { messageId: null };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_API_KEY);

    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html
    });

    const responseWithData = response as { data?: { id?: string | null }; error?: unknown };
    const messageId = responseWithData?.data?.id ?? null;

    if (responseWithData?.error) {
      throw new EmailDeliveryError('Resend returned an error response.', responseWithData.error);
    }

    console.info('[EMAIL] Sent', { to: input.to, subject: input.subject, messageId });
    return { messageId };

  } catch (error) {
        if (error instanceof EmailDeliveryError) {
      console.error('[EMAIL] Failed to send', { to: input.to, subject: input.subject, error, resendResponse: error.response });
      throw error;
    }


    console.error('[EMAIL] Failed to send', { to: input.to, subject: input.subject, error });
    throw new EmailDeliveryError('Failed to send email through Resend.', null, { cause: error });
  }
}

export async function sendInstantBookingConfirmationEmail(input: BookingEmailBaseInput & { cancelUrl: string; rescheduleUrl: string }) {
  const summaryHtml = renderBookingSummary(input);
  const html = `<p>Hi ${input.fullName},</p>
  <h2>Your booking is confirmed</h2>
  <p>Your appointment has been booked successfully.</p>
  <p>Need to make a change? You can reschedule or cancel your booking using the links below.</p>

  ${summaryHtml}
  <p><strong><a href="${input.rescheduleUrl}">Reschedule booking</a></strong></p>
  <p><strong><a href="${input.cancelUrl}">Cancel booking</a></strong></p>`;


  return sendEmail({
    to: input.to,
    subject: 'Your booking is confirmed',
    html,
    devLogLabel: '[DEV EMAIL] Instant booking confirmation',
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
export async function sendShopCancelledBookingEmail(
  input: BookingEmailBaseInput & {
    reason?: string;
  }
) {
  const summaryHtml = renderBookingSummary(input);
  const reasonHtml = input.reason ? `<p><strong>Reason:</strong> ${input.reason}</p>` : '';

  const html = `<p>Hi ${input.fullName},</p>
  <p>Your booking has been cancelled by the shop.</p>
  ${summaryHtml}
  ${reasonHtml}`;

  await sendEmail({
    to: input.to,
    subject: 'Your booking has been cancelled',
    html,
    devLogLabel: '[DEV EMAIL] Booking cancelled by shop',
    devPayload: {
      to: input.to,
      fullName: input.fullName,
      reason: input.reason ?? '',
      shopName: input.shopName,
      serviceName: input.serviceName,
      barberName: input.barberName,
      startAt: input.startAt.toISOString()
    }
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSetupOnboardingFormUrl(): string {
  const configured = (
    import.meta.env.SETUP_ONBOARDING_FORM_URL ??
    process.env.SETUP_ONBOARDING_FORM_URL ??
    ''
  ).trim();

  if (configured) return configured;

  if (import.meta.env.DEV) {
    console.warn('[EMAIL] SETUP_ONBOARDING_FORM_URL is not set; using placeholder onboarding link.');
  }

  return '#';
}

function getContactInboxEmail(): string {
  return (
    import.meta.env.CONTACT_INBOX_EMAIL ??
    process.env.CONTACT_INBOX_EMAIL ??
    FROM_EMAIL
  );
}

export async function sendSetupDepositConfirmationEmail(input: {
  to: string;
  customerName: string;
  shopName: string;
  planName: string;
  depositFormatted: string;
  remainingFormatted: string;
}) {
  const onboardingFormUrl = getSetupOnboardingFormUrl();

  const html = `<p>Hi ${escapeHtml(input.customerName)},</p>
  <h2>Thanks for your deposit</h2>
  <p>Your setup deposit for <strong>${escapeHtml(input.planName)}</strong> is confirmed for <strong>${escapeHtml(input.shopName)}</strong>.</p>
  <p><strong>Deposit paid:</strong> ${escapeHtml(input.depositFormatted)}</p>
  <p><strong>Remaining on go-live:</strong> ${escapeHtml(input.remainingFormatted)} (due after you sign off the system)</p>
  <p><a href="${escapeHtml(onboardingFormUrl)}"><strong>Complete your onboarding form</strong></a></p>
  <p><strong>What to prepare:</strong></p>
  <ul>
    <li>Booksy/Fresha export (or your current booking data)</li>
    <li>Services list and prices</li>
    <li>Barber names and roles</li>
    <li>Logo and shop photos</li>
    <li>Domain or DNS details (if you already have one)</li>
  </ul>
  <p>Please complete the onboarding form within <strong>5 working days</strong> to hold your launch slot.</p>
  <p>Questions? Email <a href="mailto:hello@kersivo.co.uk">hello@kersivo.co.uk</a>.</p>`;

  return sendEmail({
    to: input.to,
    subject: 'Your Kersivo setup deposit is confirmed',
    html,
    devLogLabel: '[DEV EMAIL] Setup deposit confirmation',
    devPayload: {
      to: input.to,
      customerName: input.customerName,
      shopName: input.shopName,
      planName: input.planName,
      depositFormatted: input.depositFormatted,
      remainingFormatted: input.remainingFormatted,
      onboardingFormUrl
    }
  });
}

export async function sendSetupDepositInternalNotificationEmail(input: {
  customerName: string;
  customerEmail: string;
  shopName: string;
  shopSize: string;
  currentStack: string;
  planName: string;
  depositFormatted: string;
  stripeSessionId: string;
}) {
  const inbox = getContactInboxEmail();

  const html = `<p><strong>New setup deposit</strong></p>
  <p><strong>Customer:</strong> ${escapeHtml(input.customerName)}</p>
  <p><strong>Email:</strong> ${escapeHtml(input.customerEmail)}</p>
  <p><strong>Shop:</strong> ${escapeHtml(input.shopName)}</p>
  <p><strong>Shop size:</strong> ${escapeHtml(input.shopSize)}</p>
  <p><strong>Current stack:</strong> ${escapeHtml(input.currentStack)}</p>
  <p><strong>Plan:</strong> ${escapeHtml(input.planName)}</p>
  <p><strong>Deposit:</strong> ${escapeHtml(input.depositFormatted)}</p>
  <p><strong>Stripe session:</strong> ${escapeHtml(input.stripeSessionId)}</p>`;

  return sendEmail({
    to: inbox,
    subject: `New setup deposit — ${input.shopName} (${input.planName})`,
    html,
    devLogLabel: '[DEV EMAIL] Setup deposit internal notification',
    devPayload: {
      to: inbox,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      shopName: input.shopName,
      shopSize: input.shopSize,
      currentStack: input.currentStack,
      planName: input.planName,
      depositFormatted: input.depositFormatted,
      stripeSessionId: input.stripeSessionId
    }
  });
}

export async function sendContactInquiryEmail(input: {
  name: string;
  email: string;
  message: string;
  intent?: string;
  shopSize: string;
  currentStack: string;
}) {
  const inbox = getContactInboxEmail();

  const html = `<p><strong>New landing page inquiry</strong></p>
  <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
  <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
  <p><strong>Shop size:</strong> ${escapeHtml(input.shopSize)}</p>
  <p><strong>Current stack:</strong> ${escapeHtml(input.currentStack)}</p>
  ${input.intent ? `<p><strong>Intent:</strong> ${escapeHtml(input.intent)}</p>` : ''}
  <p><strong>Message:</strong></p><p>${escapeHtml(input.message).replace(/\n/g, '<br/>')}</p>`;

  return sendEmail({
    to: inbox,
    subject: `Kersivo setup inquiry — ${input.name}`,
    html,
    devLogLabel: '[DEV EMAIL] Contact inquiry',
    devPayload: {
      to: inbox,
      name: input.name,
      email: input.email,
      shopSize: input.shopSize,
      currentStack: input.currentStack,
      intent: input.intent ?? '',
      message: input.message
    }
  });
}

export async function sendDemoCaptureLeadEmail(input: {
  email: string;
  shopName: string;
  currentSystem?: string;
}) {
  const inbox = getContactInboxEmail();

  const html = `<p><strong>New demo &amp; pricing request</strong> (review-later capture)</p>
  <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
  <p><strong>Barbershop:</strong> ${escapeHtml(input.shopName)}</p>
  ${input.currentSystem ? `<p><strong>Current system:</strong> ${escapeHtml(input.currentSystem)}</p>` : ''}
  <p><strong>Source:</strong> /barbershop-booking-system review-later capture</p>`;

  return sendEmail({
    to: inbox,
    subject: `Demo & pricing request — ${input.shopName}`,
    html,
    devLogLabel: '[DEV EMAIL] Demo & pricing capture',
    devPayload: {
      to: inbox,
      email: input.email,
      shopName: input.shopName,
      currentSystem: input.currentSystem ?? ''
    }
  });
}

export async function sendShopOrderConfirmationEmail(input: {
  to: string;
  itemLines: string[];
  totalFormatted: string;
}) {
  const listHtml = input.itemLines.map((line) => `<li>${line}</li>`).join('');
  const html = `<p>Thank you for your order.</p>
  <p>Your payment was successful and your order is ready for in-store pickup.</p>
  <ul>${listHtml}</ul>
  <p><strong>Total paid:</strong> ${input.totalFormatted}</p>
  <p>Please bring your confirmation email when collecting.</p>`;

  await sendEmail({
    to: input.to,
    subject: 'Order confirmed — pick up in store',
    html,
    devLogLabel: '[DEV EMAIL] Shop order confirmation',
    devPayload: {
      to: input.to,
      totalFormatted: input.totalFormatted,
      items: input.itemLines.join(' | ')
    }
  });
}

