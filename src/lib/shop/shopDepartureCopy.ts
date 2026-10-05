/** Client-safe constants for the "Leave KERSIVO" shop departure lifecycle. */

export const SHOP_DEPARTURE_CONFIRMATION_PHRASE = 'LEAVE KERSIVO';

export const SHOP_DEPARTURE_IN_PROGRESS = 'SHOP_DEPARTURE_IN_PROGRESS';

export const KERSIVO_SUPPORT_EMAIL = 'hello@kersivo.co.uk';

export const SHOP_DEPARTURE_IN_PROGRESS_MESSAGE = `This shop is leaving KERSIVO, so it cannot be activated or upgraded here. Contact ${KERSIVO_SUPPORT_EMAIL} if you want to come back.`;

export const SHOP_DEPARTURE_EMAIL_SUBJECT = 'Your KERSIVO departure request';

export function shopDepartureWindDownMessage(futureAppointments: number): string {
  const noun = futureAppointments === 1 ? 'future appointment' : 'future appointments';
  return `KERSIVO is closing for this shop. New online bookings are off. You still have ${futureAppointments} ${noun} to handle.`;
}
