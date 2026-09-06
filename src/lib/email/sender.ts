import { formatInTimeZone } from 'date-fns-tz';

import {
  BILLING_CYCLE_SHORT,
  INCLUDED_SETUP_SHORT,
  NO_PAUSE_SHORT,
  NO_SETUP_FEE_SHORT,
  OWNER_SELF_CONFIG_SHORT,
  PLAN_SCOPE_SHORT,
  PRICE_VAT_DISCLAIMER,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { BLACKLINE_DEMO_CONTACT_SOURCE } from '@/lib/demo/kersivoContact';

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

/** True when Resend can deliver mail (API key present). */
export function isEmailDeliveryConfigured(): boolean {
  return Boolean(RESEND_API_KEY && String(RESEND_API_KEY).trim());
}

/**
 * Production must have Resend configured. Local/dev may log payloads instead.
 * Astro: import.meta.env.PROD; Node scripts: NODE_ENV === 'production'.
 */
function isProductionRuntime(): boolean {
  return import.meta.env.PROD === true || process.env.NODE_ENV === 'production';
}

export function assertEmailDeliveryConfigured(): void {
  if (!isEmailDeliveryConfigured()) {
    throw new EmailDeliveryError('RESEND_API_KEY is not configured.', null);
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
  if (!isEmailDeliveryConfigured()) {
    // Never fake delivery success in production — forms/Ads conversions depend on real send.
    if (isProductionRuntime()) {
      console.error('[EMAIL] RESEND_API_KEY missing in production; refusing to report success.', {
        to: input.to,
        subject: input.subject,
        label: input.devLogLabel,
      });
      throw new EmailDeliveryError('RESEND_API_KEY is not configured.', null);
    }

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

    if (!messageId) {
      throw new EmailDeliveryError('Resend did not return a message id.', responseWithData);
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

export type InstantBookingConfirmationEmailInput = BookingEmailBaseInput & {
  cancelUrl: string;
  rescheduleUrl: string;
};

/** Pure builder for instant booking confirmation (manage-token links in HTML). */
export function buildInstantBookingConfirmationEmail(input: InstantBookingConfirmationEmailInput): {
  subject: string;
  html: string;
} {
  const summaryHtml = renderBookingSummary(input);
  const subject = 'Your booking is confirmed';
  const html = `<p>Hi ${input.fullName},</p>
  <h2>Your booking is confirmed</h2>
  <p>Your appointment has been booked successfully.</p>
  <p>Need to make a change? You can reschedule or cancel your booking using the links below.</p>

  ${summaryHtml}
  <p><strong><a href="${input.rescheduleUrl}">Reschedule booking</a></strong></p>
  <p><strong><a href="${input.cancelUrl}">Cancel booking</a></strong></p>`;

  return { subject, html };
}

/** Send a pre-rendered email (used by the durable outbox). */
export async function sendRenderedEmail(input: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  devLogLabel?: string;
}): Promise<{ messageId: string | null }> {
  return sendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo,
    devLogLabel: input.devLogLabel ?? '[DEV EMAIL] Rendered outbox send',
    devPayload: {
      to: input.to,
      subject: input.subject,
    },
  });
}

export async function sendInstantBookingConfirmationEmail(input: InstantBookingConfirmationEmailInput) {
  const { subject, html } = buildInstantBookingConfirmationEmail(input);

  return sendEmail({
    to: input.to,
    subject,
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

export type AppointmentReminderEmailInput = BookingEmailBaseInput & {
  timezone?: string;
};

/** Pure builder for scheduled ~24h appointment reminder emails (WP-D). */
export function buildAppointmentReminderEmail(input: AppointmentReminderEmailInput): {
  subject: string;
  html: string;
} {
  const tz = input.timezone?.trim() || 'Europe/London';
  const when = formatInTimeZone(input.startAt, tz, "EEEE d MMMM yyyy 'at' HH:mm");
  const shop = input.shopName.trim() || 'your barbershop';

  const subject = `Reminder: your appointment tomorrow at ${shop}`;
  const html = `<p>Hi ${input.fullName},</p>
  <h2>Appointment reminder</h2>
  <p>This is a reminder that you have an appointment coming up.</p>
  <p><strong>Shop:</strong> ${shop}</p>
  <p><strong>Service:</strong> ${input.serviceName}</p>
  <p><strong>Barber:</strong> ${input.barberName}</p>
  <p><strong>Date &amp; time (${tz}):</strong> ${when}</p>
  <p>To reschedule or cancel, use the links in your confirmation email.</p>`;

  return { subject, html };
}

export async function sendAppointmentReminderEmail(input: AppointmentReminderEmailInput) {
  const { subject, html } = buildAppointmentReminderEmail(input);

  return sendEmail({
    to: input.to,
    subject,
    html,
    devLogLabel: '[DEV EMAIL] Appointment reminder',
    devPayload: {
      to: input.to,
      fullName: input.fullName,
      shopName: input.shopName,
      serviceName: input.serviceName,
      barberName: input.barberName,
      startAt: input.startAt.toISOString(),
      timezone: input.timezone?.trim() || 'Europe/London',
    },
  });
}

export type RescheduledBookingEmailInput = BookingEmailBaseInput & {
  cancelUrl: string;
  rescheduleUrl: string;
  previousStartAt?: Date | null;
  previousEndAt?: Date | null;
};

export type LateDepositRefundEmailInput = BookingEmailBaseInput & {
  depositAmountPence: number;
};

/** Pure builder: late payment after hold release when the slot was taken. */
export function buildLateDepositRefundEmail(input: LateDepositRefundEmailInput): {
  subject: string;
  html: string;
} {
  const summaryHtml = renderBookingSummary(input);
  const pounds = (Math.max(0, Math.trunc(input.depositAmountPence)) / 100).toFixed(2);
  const subject = 'Your deposit is being refunded';
  const html = `<p>Hi ${input.fullName},</p>
  <h2>Deposit refund</h2>
  <p>We received your deposit payment, but the appointment slot was released after the payment window closed and is no longer available.</p>
  <p>Your £${pounds} deposit is being refunded to the original payment method. This usually appears within a few business days.</p>
  ${summaryHtml}
  <p>Please book a new appointment if you still need one.</p>`;

  return { subject, html };
}

/** Pure builder for reschedule confirmation emails. */
export function buildRescheduledBookingEmail(input: RescheduledBookingEmailInput): {
  subject: string;
  html: string;
} {
  const summaryHtml = renderBookingSummary(input);
  const previousDateTime =
    input.previousStartAt && input.previousEndAt
      ? formatInTimeZone(input.previousStartAt, 'Europe/London', "EEEE d MMMM yyyy 'at' HH:mm")
      : null;

  const previousSummaryHtml = previousDateTime
    ? `<p><strong>Previous:</strong> ${previousDateTime} (Europe/London)</p>`
    : '';

  const subject = 'Your booking has been rescheduled';
  const html = `<p>Hi ${input.fullName},</p>
  <p>Your booking has been rescheduled.</p>
  <ul>
    <li><a href="${input.rescheduleUrl}">Reschedule booking</a></li>
    <li><a href="${input.cancelUrl}">Cancel booking</a></li>
  </ul>
  ${summaryHtml}
  ${previousSummaryHtml}`;

  return { subject, html };
}

export async function sendRescheduledBookingEmail(input: RescheduledBookingEmailInput) {
  const { subject, html } = buildRescheduledBookingEmail(input);

  await sendEmail({
    to: input.to,
    subject,
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
    /** When set, only mention a refund if Stripe has confirmed it. */
    depositRefundStatus?: 'refunded' | 'pending' | 'failed' | 'skipped_unpaid' | 'skipped_already' | 'skipped_forfeited' | null;
  }
) {
  const summaryHtml = renderBookingSummary(input);
  const reasonHtml = input.reason ? `<p><strong>Reason:</strong> ${input.reason}</p>` : '';
  const refundHtml =
    input.depositRefundStatus === 'refunded'
      ? '<p>Your booking deposit refund has been confirmed.</p>'
      : input.depositRefundStatus === 'pending'
        ? '<p>Your booking deposit refund is being processed. You will see it on your card statement shortly.</p>'
        : input.depositRefundStatus === 'failed'
          ? '<p>We could not complete your deposit refund automatically. The shop will resolve this shortly.</p>'
          : '';

  const html = `<p>Hi ${input.fullName},</p>
  <p>Your booking has been cancelled by the shop.</p>
  ${summaryHtml}
  ${reasonHtml}
  ${refundHtml}`;

  await sendEmail({
    to: input.to,
    subject: 'Your booking has been cancelled',
    html,
    devLogLabel: '[DEV EMAIL] Booking cancelled by shop',
    devPayload: {
      to: input.to,
      fullName: input.fullName,
      reason: input.reason ?? '',
      depositRefundStatus: input.depositRefundStatus ?? '',
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

export function buildSaasSubscriptionConfirmationEmail(input: {
  customerName: string;
  shopName: string;
  monthlyFormatted: string;
  setupSuccessUrl: string;
}): { subject: string; html: string } {
  const setupSuccessUrl = input.setupSuccessUrl.trim();
  const nextStepBlock = setupSuccessUrl
    ? `<p><strong>Next step:</strong><br/>Complete your setup so we can prepare your barbershop.</p>
  <p><a href="${escapeHtml(setupSuccessUrl)}">Complete Your KERSIVO Setup</a></p>`
    : `<p><strong>Next step:</strong><br/>Reply to this email or contact <a href="mailto:hello@kersivo.co.uk">hello@kersivo.co.uk</a> to continue your setup.</p>`;

  const subject = 'Your KERSIVO subscription is confirmed';
  const html = `<p>Hi ${escapeHtml(input.customerName)},</p>
  <p>Your KERSIVO subscription is confirmed.</p>
  <p><strong>Subscription:</strong> ${escapeHtml(input.monthlyFormatted)}/month<br/>
  <strong>Shop:</strong> ${escapeHtml(input.shopName)}</p>
  ${nextStepBlock}
  <p>We will prepare your booking website, admin dashboard and retail pickup shop. Nothing goes live without your review.</p>
  <p>Questions? Reply to this email or contact <a href="mailto:hello@kersivo.co.uk">hello@kersivo.co.uk</a>.</p>
  <p>KERSIVO<br/>Your domain. Your brand. Your client relationship.</p>`;

  return { subject, html };
}

export async function sendSaasSubscriptionConfirmationEmail(input: {
  to: string;
  customerName: string;
  shopName: string;
  monthlyFormatted: string;
  /** Canonical recovery URL: /setup/success?session_id=cs_… */
  setupSuccessUrl: string;
}) {
  const setupSuccessUrl = input.setupSuccessUrl.trim();
  const { subject, html } = buildSaasSubscriptionConfirmationEmail({
    customerName: input.customerName,
    shopName: input.shopName,
    monthlyFormatted: input.monthlyFormatted,
    setupSuccessUrl,
  });

  return sendEmail({
    to: input.to,
    subject,
    replyTo: getContactInboxEmail(),
    html,
    devLogLabel: '[DEV EMAIL] SaaS subscription confirmation',
    devPayload: {
      to: input.to,
      customerName: input.customerName,
      shopName: input.shopName,
      monthlyFormatted: input.monthlyFormatted,
      setupSuccessUrl: setupSuccessUrl || '(missing setup success URL)',
    },
  });
}

export async function sendSaasSubscriptionInternalNotificationEmail(input: {
  customerName: string;
  customerEmail: string;
  shopName: string;
  shopSize: string;
  currentStack: string;
  monthlyFormatted: string;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId?: string | null;
  paymentStatus: string;
  attributionSummary?: string;
  onboardingEmailStatus: string;
  activatedAtIso: string;
}) {
  const inbox = getContactInboxEmail();

  const html = `<p><strong>New KERSIVO monthly subscription</strong></p>
  <p><strong>Customer:</strong> ${escapeHtml(input.customerName)}<br/>
  <strong>Email:</strong> ${escapeHtml(input.customerEmail)}<br/>
  <strong>Shop:</strong> ${escapeHtml(input.shopName)}<br/>
  <strong>Shop size:</strong> ${escapeHtml(input.shopSize)}<br/>
  <strong>Current stack:</strong> ${escapeHtml(input.currentStack)}</p>
  <p><strong>Subscription:</strong> ${escapeHtml(input.monthlyFormatted)}/month<br/>
  <strong>Currency:</strong> ${escapeHtml(input.currency.toUpperCase())}</p>
  <p><strong>Payment status:</strong> ${escapeHtml(input.paymentStatus)}<br/>
  <strong>Stripe Checkout Session ID:</strong> ${escapeHtml(input.stripeSessionId)}<br/>
  <strong>Subscription ID:</strong> ${escapeHtml(input.stripeSubscriptionId || 'n/a')}<br/>
  <strong>Activated at:</strong> ${escapeHtml(input.activatedAtIso)}</p>
  <p><strong>Attribution:</strong> ${escapeHtml(input.attributionSummary || 'n/a')}<br/>
  <strong>Onboarding email status:</strong> ${escapeHtml(input.onboardingEmailStatus)}</p>`;

  return sendEmail({
    to: inbox,
    subject: `New KERSIVO subscription — ${input.shopName}`,
    replyTo: input.customerEmail,
    html,
    devLogLabel: '[DEV EMAIL] SaaS subscription internal notification',
    devPayload: {
      to: inbox,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      shopName: input.shopName,
      monthlyFormatted: input.monthlyFormatted,
      stripeSessionId: input.stripeSessionId,
    },
  });
}

export async function sendContactInquiryEmail(input: {
  name: string;
  email: string;
  message: string;
  intent?: string;
  shopName: string;
  currentStack: string;
}) {
  const inbox = getContactInboxEmail();

  const stackLabels: Record<string, string> = {
    booksy: 'Booksy',
    fresha: 'Fresha',
    nearcut: 'Nearcut',
    'other-platform': 'Other booking platform',
    'mixed-manual': 'Manual bookings / mixed tools',
    none: 'No booking system',
  };
  const currentStackLabel = stackLabels[input.currentStack] ?? input.currentStack;

  const html = `<p><strong>New landing page enquiry</strong></p>
  <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
  <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
  <p><strong>Barbershop:</strong> ${escapeHtml(input.shopName)}</p>
  <p><strong>Current booking system:</strong> ${escapeHtml(currentStackLabel)}</p>
  ${input.intent ? `<p><strong>Intent:</strong> ${escapeHtml(input.intent)}</p>` : ''}
  <p><strong>Message:</strong></p><p>${escapeHtml(input.message).replace(/\n/g, '<br/>')}</p>`;

  return sendEmail({
    to: inbox,
    subject: `New KERSIVO enquiry — ${input.shopName}`,
    html,
    replyTo: input.email,
    devLogLabel: '[DEV EMAIL] Contact inquiry',
    devPayload: {
      to: inbox,
      name: input.name,
      email: input.email,
      shopName: input.shopName,
      currentStack: input.currentStack,
      intent: input.intent ?? '',
      message: input.message,
    },
  });
}

export async function sendBlacklineDemoContactEmail(input: {
  name: string;
  email: string;
  message: string;
  shopName?: string;
}) {
  const inbox = getContactInboxEmail();
  const shopLabel = input.shopName?.trim() || '—';
  const subjectLabel = input.shopName?.trim() || input.name;
  const timestamp = new Date().toISOString();

  const html = `<p><strong>KERSIVO demo enquiry</strong> (BLACKLINE /demo/contact)</p>
  <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
  <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
  <p><strong>Barbershop name:</strong> ${escapeHtml(shopLabel)}</p>
  <p><strong>Message:</strong></p><p>${escapeHtml(input.message).replace(/\n/g, '<br/>')}</p>
  <p><strong>Source:</strong> ${BLACKLINE_DEMO_CONTACT_SOURCE}</p>
  <p><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>`;

  return sendEmail({
    to: inbox,
    subject: `KERSIVO demo enquiry — ${subjectLabel}`,
    html,
    replyTo: input.email,
    devLogLabel: '[DEV EMAIL] BLACKLINE demo contact',
    devPayload: {
      to: inbox,
      name: input.name,
      email: input.email,
      shopName: input.shopName ?? '',
      message: input.message,
      source: BLACKLINE_DEMO_CONTACT_SOURCE,
      timestamp,
    },
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
  <p><strong>£${SAAS_MONTHLY_GBP}/month subscription</strong><br/>A complete KERSIVO booking, retail and admin setup on your main site plus pickup shop. ${NO_SETUP_FEE_SHORT} ${PLAN_SCOPE_SHORT}</p>
  <p>${INCLUDED_SETUP_SHORT}</p>
  <p>${OWNER_SELF_CONFIG_SHORT}</p>
  <p>${PRICE_VAT_DISCLAIMER}</p>
  <p>${BILLING_CYCLE_SHORT}</p>

  <p><strong>Your subscription includes:</strong></p>
  <ul>
    <li>branded booking website</li>
    <li>admin dashboard</li>
    <li>retail pickup shop</li>
    <li>email appointment confirmations and reminders</li>
    <li>hosting, SSL, domain renewal and support while your subscription is active</li>
    <li>0% KERSIVO commission. Standard Stripe payment-processing fees still apply.</li>
  </ul>

  <p>Subscribe securely for £${SAAS_MONTHLY_GBP}/month. ${NO_PAUSE_SHORT}</p>

  <p><strong>Ready to get started?</strong><br/><a href="${pricingUrl}">${pricingUrl}</a></p>

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

export type ShopOrderConfirmationEmailInput = {
  to: string;
  itemLines: string[];
  totalFormatted: string;
  shopName?: string | null;
  reference?: string | null;
};

/** Pure builder for retail order confirmation emails. */
export function buildShopOrderConfirmationEmail(input: ShopOrderConfirmationEmailInput): {
  subject: string;
  html: string;
} {
  const listHtml = input.itemLines.map((line) => `<li>${line}</li>`).join('');
  const shopName = input.shopName?.trim() || 'the shop';
  const reference = input.reference?.trim() || '';
  const subject = reference
    ? `Order ${reference} confirmed — pick up at ${shopName}`
    : `Order confirmed — pick up at ${shopName}`;
  const referenceHtml = reference
    ? `<p><strong>Pickup reference:</strong> ${reference}</p>`
    : '';
  const html = `<p>Thank you for your order from <strong>${shopName}</strong>.</p>
  <p>Your payment was successful and your order is ready for in-store pickup.</p>
  ${referenceHtml}
  <ul>${listHtml}</ul>
  <p><strong>Total paid:</strong> ${input.totalFormatted}</p>
  <p>Please bring your confirmation email (and reference) when collecting.</p>`;

  return { subject, html };
}

export async function sendShopOrderConfirmationEmail(input: ShopOrderConfirmationEmailInput) {
  const { subject, html } = buildShopOrderConfirmationEmail(input);

  await sendEmail({
    to: input.to,
    subject,
    html,
    devLogLabel: '[DEV EMAIL] Shop order confirmation',
    devPayload: {
      to: input.to,
      totalFormatted: input.totalFormatted,
      items: input.itemLines.join(' | ')
    }
  });
}

export async function sendShopTeamInviteEmail(input: {
  to: string;
  shopName: string;
  role: string;
  acceptUrl: string;
}) {
  const html = `<p>You've been invited as <strong>${input.role}</strong> for <strong>${input.shopName}</strong> on KERSIVO.</p>
  <p><a href="${input.acceptUrl}">Accept invitation</a></p>
  <p>This link expires in 72 hours. The invitation is tied to a specific shop account (not the shop display name).</p>`;

  return sendEmail({
    to: input.to,
    subject: `You're invited to ${input.shopName}`,
    html,
    devLogLabel: '[DEV EMAIL] Shop team invite',
    devPayload: {
      to: input.to,
      shopName: input.shopName,
      role: input.role,
      acceptUrl: input.acceptUrl,
    },
  });
}

/** Better Auth email-verification link (accept invites / billing gates). */
export async function sendEmailVerificationEmail(input: {
  to: string;
  name?: string | null;
  url: string;
}) {
  if (!isEmailDeliveryConfigured()) {
    console.error('[EMAIL] RESEND_API_KEY missing; verification email was not sent.', {
      to: input.to,
      url: input.url,
    });
    if (isProductionRuntime()) {
      throw new EmailDeliveryError('RESEND_API_KEY is not configured.', null);
    }
    console.warn('[DEV EMAIL] Email verification (not sent — Resend not configured)', {
      to: input.to,
      url: input.url,
    });
    return { messageId: null };
  }

  const name = (input.name ?? '').trim() || 'there';
  const html = `<p>Hi ${escapeHtml(name)},</p>
  <h2>Verify your email</h2>
  <p>Confirm this email address to accept shop invitations and manage billing on KERSIVO.</p>
  <p><strong><a href="${escapeHtml(input.url)}">Verify email address</a></strong></p>
  <p>If you did not create a KERSIVO account, you can ignore this message.</p>`;

  return sendEmail({
    to: input.to,
    subject: 'Verify your KERSIVO email',
    html,
    devLogLabel: '[DEV EMAIL] Email verification',
    devPayload: {
      to: input.to,
      name,
      url: input.url,
    },
  });
}

/** Pure builder for Better Auth password-reset emails (escaped HTML). */
export function buildPasswordResetEmail(input: {
  name?: string | null;
  url: string;
}): { subject: string; html: string } {
  const name = (input.name ?? '').trim() || 'there';
  const subject = 'Reset your KERSIVO password';
  const html = `<p>Hi ${escapeHtml(name)},</p>
  <h2>Reset your KERSIVO password</h2>
  <p>We received a request to reset the password for your KERSIVO account.</p>
  <p><strong><a href="${escapeHtml(input.url)}">Choose a new password</a></strong></p>
  <p>If you did not request this, you can ignore this message. The link expires soon.</p>`;
  return { subject, html };
}

/**
 * Better Auth password-reset link.
 * Never logs the reset URL or token (only destination address / subject).
 */
export async function sendPasswordResetEmail(input: {
  to: string;
  name?: string | null;
  url: string;
}) {
  if (!isEmailDeliveryConfigured()) {
    console.error('[EMAIL] RESEND_API_KEY missing; password reset email was not sent.', {
      to: input.to,
    });
    if (isProductionRuntime()) {
      throw new EmailDeliveryError('RESEND_API_KEY is not configured.', null);
    }
    console.warn('[DEV EMAIL] Password reset (not sent — Resend not configured)', {
      to: input.to,
    });
    return { messageId: null };
  }

  const { subject, html } = buildPasswordResetEmail({
    name: input.name,
    url: input.url,
  });

  return sendEmail({
    to: input.to,
    subject,
    html,
    // Omit url/token from logs — only confirm destination.
    devLogLabel: '[DEV EMAIL] Password reset',
    devPayload: {
      to: input.to,
    },
  });
}

