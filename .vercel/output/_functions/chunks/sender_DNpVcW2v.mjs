import { formatInTimeZone } from 'date-fns-tz';

const RESEND_API_KEY = "re_XSoN2Fvp_LWo86PPvfRq51fTwHmnSBd5n";
const FROM_EMAIL = "hello@kersivo.co.uk";
function renderBookingSummary(input) {
  const londonDateTime = formatInTimeZone(input.startAt, "Europe/London", "EEEE d MMMM yyyy 'at' HH:mm");
  return `<p><strong>Shop:</strong> ${input.shopName}</p>
  <p><strong>Service:</strong> ${input.serviceName}</p>
  <p><strong>Barber:</strong> ${input.barberName}</p>
  <p><strong>Date & time (Europe/London):</strong> ${londonDateTime}</p>`;
}
async function sendEmail(input) {
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html
    });
    console.info("[EMAIL] Sent", { to: input.to, subject: input.subject });
  } catch (error) {
    console.error("[EMAIL] Failed to send", { to: input.to, subject: input.subject, error });
    throw error;
  }
}
async function sendBookingConfirmationEmail(input) {
  const summaryHtml = renderBookingSummary(input);
  const html = `<p>Hi ${input.fullName},</p>
  <p>Please confirm your booking by clicking the link below:</p>
  <p><a href="${input.confirmUrl}">Confirm booking</a></p>
  ${summaryHtml}`;
  await sendEmail({
    to: input.to,
    subject: "Confirm your booking",
    html,
    devLogLabel: "[DEV EMAIL] Confirm booking link",
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
async function sendManageBookingEmail(input) {
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
    subject: "Manage your booking",
    html,
    devLogLabel: "[DEV EMAIL] Manage booking links",
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
async function sendRescheduledBookingEmail(input) {
  const summaryHtml = renderBookingSummary(input);
  const previousDateTime = input.previousStartAt && input.previousEndAt ? formatInTimeZone(input.previousStartAt, "Europe/London", "EEEE d MMMM yyyy 'at' HH:mm") : null;
  const previousSummaryHtml = previousDateTime ? `<p><strong>Previous:</strong> ${previousDateTime} (Europe/London)</p>` : "";
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
    subject: "Your booking has been rescheduled",
    html,
    devLogLabel: "[DEV EMAIL] Rescheduled booking",
    devPayload: {
      to: input.to,
      fullName: input.fullName,
      cancelUrl: input.cancelUrl,
      rescheduleUrl: input.rescheduleUrl,
      shopName: input.shopName,
      serviceName: input.serviceName,
      barberName: input.barberName,
      startAt: input.startAt.toISOString(),
      previousStartAt: input.previousStartAt?.toISOString() ?? "",
      previousEndAt: input.previousEndAt?.toISOString() ?? ""
    }
  });
}
async function sendShopCancelledBookingEmail(input) {
  const summaryHtml = renderBookingSummary(input);
  const reasonHtml = input.reason ? `<p><strong>Reason:</strong> ${input.reason}</p>` : "";
  const html = `<p>Hi ${input.fullName},</p>
  <p>Your booking has been cancelled by the shop.</p>
  ${summaryHtml}
  ${reasonHtml}`;
  await sendEmail({
    to: input.to,
    subject: "Your booking has been cancelled",
    html,
    devLogLabel: "[DEV EMAIL] Booking cancelled by shop",
    devPayload: {
      to: input.to,
      fullName: input.fullName,
      reason: input.reason ?? "",
      shopName: input.shopName,
      serviceName: input.serviceName,
      barberName: input.barberName,
      startAt: input.startAt.toISOString()
    }
  });
}
async function sendShopOrderConfirmationEmail(input) {
  const listHtml = input.itemLines.map((line) => `<li>${line}</li>`).join("");
  const html = `<p>Thank you for your order.</p>
  <p>Your payment was successful and your order is ready for in-store pickup.</p>
  <ul>${listHtml}</ul>
  <p><strong>Total paid:</strong> ${input.totalFormatted}</p>
  <p>Please bring your confirmation email when collecting.</p>`;
  await sendEmail({
    to: input.to,
    subject: "Order confirmed — pick up in store",
    html,
    devLogLabel: "[DEV EMAIL] Shop order confirmation",
    devPayload: {
      to: input.to,
      totalFormatted: input.totalFormatted,
      items: input.itemLines.join(" | ")
    }
  });
}

export { sendManageBookingEmail as a, sendBookingConfirmationEmail as b, sendRescheduledBookingEmail as c, sendShopOrderConfirmationEmail as d, sendShopCancelledBookingEmail as s };
