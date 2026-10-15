/**
 * Section 05 presentation data for /barbershop-online-booking.
 *
 * Part A previews are derived from the live confirmation and reminder email builders so the
 * marketing page cannot drift from what customers actually receive. Part B concept copy is
 * product-direction only — those automations are not implemented and must stay labelled Concept.
 */
import {
  buildAppointmentReminderEmail,
  buildInstantBookingConfirmationEmail,
} from '@/lib/email/sender';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_DEFAULT_SERVICE_SLUG, DEMO_SERVICES } from '@/lib/demo/services';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';

/** Fixed appointment used only for illustrative email previews. */
export const AFTER_BOOKING_EXAMPLE_START = new Date('2027-01-14T11:00:00.000Z');
export const AFTER_BOOKING_EXAMPLE_CLIENT = 'Jordan Ellis';
export const AFTER_BOOKING_EXAMPLE_TIMEZONE = 'Europe/London';

/** Display-only placeholders — previews never navigate to live manage tokens. */
export const AFTER_BOOKING_PREVIEW_RESCHEDULE_HREF = '#preview-reschedule';
export const AFTER_BOOKING_PREVIEW_CANCEL_HREF = '#preview-cancel';

export type AfterBookingEmailPreview = {
  kind: 'confirmation' | 'reminder';
  fromLabel: string;
  subject: string;
  title: string;
  intro: string;
  lines: { label: string; value: string }[];
  footer: string;
  actions: { label: string }[];
};

export type AfterBookingConceptCard = {
  id: 'thanks' | 'review' | 'rebook';
  stage: string;
  title: string;
  body: string;
  ctaLabel?: string;
};

export type AfterBookingExample = {
  shopName: string;
  clientName: string;
  confirmation: AfterBookingEmailPreview;
  reminder: AfterBookingEmailPreview;
  concepts: AfterBookingConceptCard[];
};

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h2>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStrongLines(html: string): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const pattern = /<strong>([^<:]+):<\/strong>\s*([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    lines.push({ label: match[1].trim(), value: match[2].trim() });
  }
  return lines;
}

function extractActions(html: string): { label: string }[] {
  const actions: { label: string }[] = [];
  const pattern = /<a[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const label = match[1].trim();
    if (label) actions.push({ label });
  }
  return actions;
}

function firstParagraphAfterTitle(html: string, title: string): string {
  const titleIndex = html.indexOf(title);
  if (titleIndex < 0) return '';
  const after = html.slice(titleIndex + title.length);
  const paragraph = after.match(/<p>([\s\S]*?)<\/p>/i);
  return paragraph ? stripTags(paragraph[1]) : '';
}

function paragraphMatching(html: string, needle: string): string {
  const matches = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
  for (const match of matches) {
    const text = stripTags(match[1]);
    if (text.toLowerCase().includes(needle.toLowerCase())) return text;
  }
  return '';
}

function demoFixture() {
  const service = DEMO_SERVICES.find((entry) => entry.slug === DEMO_DEFAULT_SERVICE_SLUG);
  const barber = DEMO_BARBERS.find((entry) => entry.slug === 'marcus-bell') ?? DEMO_BARBERS[0];
  if (!service || !barber) {
    throw new Error('Cutstate demo service or barber missing for after-booking example.');
  }
  return {
    to: 'preview@example.com',
    fullName: AFTER_BOOKING_EXAMPLE_CLIENT,
    shopName: DEMO_SHOP_NAME,
    serviceName: service.name,
    barberName: barber.name,
    startAt: AFTER_BOOKING_EXAMPLE_START,
  };
}

export const AFTER_BOOKING_CONCEPTS: AfterBookingConceptCard[] = [
  {
    id: 'thanks',
    stage: 'After the visit',
    title: 'Thank-you message',
    body: `Thanks for visiting ${DEMO_SHOP_NAME}. We hope you enjoyed your appointment.`,
  },
  {
    id: 'review',
    stage: 'After the visit',
    title: 'Honest Google review invitation',
    body: 'If you have a moment, we would appreciate an honest review of your experience.',
    ctaLabel: 'Leave a Google review',
  },
  {
    id: 'rebook',
    stage: 'Before the next visit',
    title: 'Invitation to book again',
    body: `Ready for your next cut? Book your next appointment directly with ${DEMO_SHOP_NAME}.`,
    ctaLabel: 'Book again',
  },
];

export function buildAfterBookingExample(): AfterBookingExample {
  const base = demoFixture();
  const confirmationBuilt = buildInstantBookingConfirmationEmail({
    ...base,
    cancelUrl: AFTER_BOOKING_PREVIEW_CANCEL_HREF,
    rescheduleUrl: AFTER_BOOKING_PREVIEW_RESCHEDULE_HREF,
  });
  const reminderBuilt = buildAppointmentReminderEmail({
    ...base,
    timezone: AFTER_BOOKING_EXAMPLE_TIMEZONE,
  });

  return {
    shopName: base.shopName,
    clientName: base.fullName,
    confirmation: {
      kind: 'confirmation',
      fromLabel: `${base.shopName} via KERSIVO`,
      subject: confirmationBuilt.subject,
      title: 'Your booking is confirmed',
      intro: firstParagraphAfterTitle(confirmationBuilt.html, 'Your booking is confirmed'),
      lines: extractStrongLines(confirmationBuilt.html),
      footer: paragraphMatching(confirmationBuilt.html, 'reschedule or cancel'),
      actions: extractActions(confirmationBuilt.html),
    },
    reminder: {
      kind: 'reminder',
      fromLabel: `${base.shopName} via KERSIVO`,
      subject: reminderBuilt.subject,
      title: 'Appointment reminder',
      intro: firstParagraphAfterTitle(reminderBuilt.html, 'Appointment reminder'),
      lines: extractStrongLines(reminderBuilt.html),
      footer: paragraphMatching(reminderBuilt.html, 'confirmation email'),
      actions: [],
    },
    concepts: AFTER_BOOKING_CONCEPTS,
  };
}
