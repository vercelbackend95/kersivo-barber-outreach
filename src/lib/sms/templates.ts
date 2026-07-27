import { formatInTimeZone } from 'date-fns-tz';

export type AppointmentReminderTemplateInput = {
  shopName: string;
  serviceName: string;
  startAt: Date;
  timezone?: string;
};

/**
 * Keep under ~160 chars for a single GSM segment when possible.
 */
export function buildAppointmentReminderBody(input: AppointmentReminderTemplateInput): string {
  const tz = input.timezone?.trim() || 'Europe/London';
  const when = formatInTimeZone(input.startAt, tz, 'EEE d MMM, HH:mm');
  const shop = input.shopName.trim() || 'your barbershop';
  const service = input.serviceName.trim() || 'appointment';
  return `${shop}: reminder — ${service} on ${when} (UK). Reply STOP to opt out.`;
}
