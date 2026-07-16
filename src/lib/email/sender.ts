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
  replyTo?: string;
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
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {})
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

  console.error('[EMAIL] SETUP_ONBOARDING_FORM_URL is not set; onboarding CTA will be unavailable.');
  return '';
}

/** Public helper for success page / webhook — empty string when unset. */
export function getSetupOnboardingFormUrlOrEmpty(): string {
  return getSetupOnboardingFormUrl();
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
  onboardingFormUrl?: string;
}) {
  if (!RESEND_API_KEY) {
    throw new EmailDeliveryError('RESEND_API_KEY is not configured.', null);
  }

  const onboardingFormUrl = (input.onboardingFormUrl ?? getSetupOnboardingFormUrl()).trim();
  const onboardingBlock = onboardingFormUrl
    ? `<p><strong>Next step:</strong><br/>Complete your onboarding form:<br/><a href="${escapeHtml(onboardingFormUrl)}">${escapeHtml(onboardingFormUrl)}</a></p>
  <p>Please send us your services, prices, barbers, opening hours, branding, domain details and any retail products you want included.</p>`
    : `<p><strong>Next step:</strong><br/>Reply to this email or contact <a href="mailto:hello@kersivo.co.uk">hello@kersivo.co.uk</a> for your onboarding form link.</p>`;

  const html = `<p>Hi ${escapeHtml(input.customerName)},</p>
  <p>Your KERSIVO setup deposit has been confirmed.</p>
  <p><strong>Package:</strong> ${escapeHtml(input.planName)}<br/>
  <strong>Deposit paid:</strong> ${escapeHtml(input.depositFormatted)}<br/>
  <strong>Remaining setup balance:</strong> ${escapeHtml(input.remainingFormatted)} — due before go-live.</p>
  ${onboardingBlock}
  <p>Work begins after the deposit, completed onboarding and the start of project delivery. Nothing goes live without your review.</p>
  <p>Questions? Reply to this email or contact <a href="mailto:hello@kersivo.co.uk">hello@kersivo.co.uk</a>.</p>
  <p>KERSIVO<br/>Your domain. Your brand. Your client relationship.</p>`;

  return sendEmail({
    to: input.to,
    subject: 'Your KERSIVO setup deposit is confirmed',
    replyTo: getContactInboxEmail(),
    html,
    devLogLabel: '[DEV EMAIL] Setup deposit confirmation',
    devPayload: {
      to: input.to,
      customerName: input.customerName,
      shopName: input.shopName,
      planName: input.planName,
      depositFormatted: input.depositFormatted,
      remainingFormatted: input.remainingFormatted,
      onboardingFormUrl: onboardingFormUrl || '(missing SETUP_ONBOARDING_FORM_URL)',
    },
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
  totalSetupFormatted: string;
  remainingFormatted: string;
  currency: string;
  stripeSessionId: string;
  paymentIntentId?: string | null;
  paymentStatus: string;
  attributionSummary?: string;
  onboardingEmailStatus: string;
  paidAtIso: string;
}) {
  const inbox = getContactInboxEmail();

  if (!RESEND_API_KEY) {
    throw new EmailDeliveryError('RESEND_API_KEY is not configured.', null);
  }

  const html = `<p><strong>New KERSIVO setup deposit — ${escapeHtml(input.planName)}</strong></p>
  <p><strong>Customer:</strong> ${escapeHtml(input.customerName)}<br/>
  <strong>Email:</strong> ${escapeHtml(input.customerEmail)}<br/>
  <strong>Shop:</strong> ${escapeHtml(input.shopName)}<br/>
  <strong>Shop size:</strong> ${escapeHtml(input.shopSize)}<br/>
  <strong>Current stack:</strong> ${escapeHtml(input.currentStack)}</p>
  <p><strong>Package:</strong> ${escapeHtml(input.planName)}<br/>
  <strong>Deposit paid:</strong> ${escapeHtml(input.depositFormatted)}<br/>
  <strong>Total setup price:</strong> ${escapeHtml(input.totalSetupFormatted)}<br/>
  <strong>Remaining balance:</strong> ${escapeHtml(input.remainingFormatted)}<br/>
  <strong>Currency:</strong> ${escapeHtml(input.currency.toUpperCase())}</p>
  <p><strong>Payment status:</strong> ${escapeHtml(input.paymentStatus)}<br/>
  <strong>Stripe Checkout Session ID:</strong> ${escapeHtml(input.stripeSessionId)}<br/>
  <strong>PaymentIntent ID:</strong> ${escapeHtml(input.paymentIntentId || 'n/a')}<br/>
  <strong>Paid at:</strong> ${escapeHtml(input.paidAtIso)}</p>
  <p><strong>Attribution:</strong> ${escapeHtml(input.attributionSummary || 'n/a')}<br/>
  <strong>Onboarding email status:</strong> ${escapeHtml(input.onboardingEmailStatus)}</p>`;

  return sendEmail({
    to: inbox,
    subject: `New KERSIVO setup deposit — ${input.planName}`,
    replyTo: input.customerEmail,
    html,
    devLogLabel: '[DEV EMAIL] Setup deposit internal notification',
    devPayload: {
      to: inbox,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      shopName: input.shopName,
      planName: input.planName,
      depositFormatted: input.depositFormatted,
      stripeSessionId: input.stripeSessionId,
    },
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
  shopName?: string;
  currentSystem?: string;
}) {
  const inbox = getContactInboxEmail();

  const html = `<p><strong>New demo &amp; pricing request</strong> (review-later capture)</p>
  <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
  ${input.shopName ? `<p><strong>Barbershop:</strong> ${escapeHtml(input.shopName)}</p>` : ''}
  ${input.currentSystem ? `<p><strong>Current system:</strong> ${escapeHtml(input.currentSystem)}</p>` : ''}
  <p><strong>Source:</strong> homepage review-later capture</p>`;

  return sendEmail({
    to: inbox,
    subject: `Demo & pricing request — ${input.email}`,
    html,
    devLogLabel: '[DEV EMAIL] Demo & pricing capture',
    devPayload: {
      to: inbox,
      email: input.email,
      shopName: input.shopName ?? '',
      currentSystem: input.currentSystem ?? ''
    }
  });
}

export async function sendDemoCaptureVisitorEmail(input: { email: string }) {
  const liveDemoUrl = 'https://kersivo.co.uk/';
  const bookingFlowUrl = 'https://kersivo.co.uk/book';
  const adminDemoUrl = 'https://kersivo.co.uk/admin-demo?section=bookings_dashboard';
  const retailDemoUrl = 'https://kersivo.co.uk/shop';
  const pricingUrl = 'https://kersivo.co.uk/#pricing';
  const replyTo = getContactInboxEmail();

  const html = `<p>Hi,</p>
  <p>Here are the KERSIVO demo and pricing details you asked for.</p>
  <p>KERSIVO is built for independent UK barbershops that want their own branded booking website, their own client experience and 0% KERSIVO commission. Standard Stripe payment-processing fees still apply.</p>

  <p><strong>Demo links:</strong></p>
  <p>View the full KERSIVO overview:<br/><a href="${liveDemoUrl}">${liveDemoUrl}</a></p>
  <p>See the client booking flow:<br/><a href="${bookingFlowUrl}">${bookingFlowUrl}</a></p>
  <p>Preview the admin:<br/><a href="${adminDemoUrl}">${adminDemoUrl}</a></p>
  <p>See retail pickup shop:<br/><a href="${retailDemoUrl}">${retailDemoUrl}</a></p>

  <p><strong>Pricing:</strong></p>
  <p><strong>Launch — £199 setup + £39/month Ongoing Care</strong><br/>A complete KERSIVO booking, retail and admin setup on your main site plus pickup shop.</p>
  <p><strong>Priority Growth — £299 setup + £39/month Ongoing Care</strong><br/>Extra dedicated pages (e.g. gallery) and deeper product-catalogue polish during setup — same Care as Launch.</p>
  <p>Prices shown are final. KERSIVO is not currently VAT registered, so no VAT is added.</p>

  <p><strong>Both setups include:</strong></p>
  <ul>
    <li>branded booking website</li>
    <li>admin dashboard</li>
    <li>retail pickup shop</li>
    <li>email appointment confirmations and reminders</li>
    <li>hosting, SSL, domain renewal and support while Care is active</li>
    <li>0% KERSIVO commission. Standard Stripe payment-processing fees still apply.</li>
  </ul>

  <p>You can start with a 50% setup deposit. The remaining 50% is due before go-live. If you cancel before work begins, we refund the deposit. Once work begins, the deposit is non-refundable. If KERSIVO cannot deliver, we refund the deposit.</p>

  <p><strong>Ready to choose a setup?</strong><br/><a href="${pricingUrl}">${pricingUrl}</a></p>

  <p>Not sure yet? Reply to this email with what you&rsquo;re trying to improve — switching from a marketplace profile, launching your first system, reducing no-shows or selling retail pickup.</p>

  <p>KERSIVO<br/>Your domain. Your brand. Your client relationship.<br/><a href="mailto:hello@kersivo.co.uk">hello@kersivo.co.uk</a></p>`;

  return sendEmail({
    to: input.email,
    subject: 'Your KERSIVO demo & pricing details',
    html,
    replyTo,
    devLogLabel: '[DEV EMAIL] Visitor demo & pricing confirmation',
    devPayload: {
      to: input.email,
      replyTo
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

