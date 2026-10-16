/**
 * Section 06 presentation data for /barbershop-online-booking — cinematic scroll story.
 *
 * Live confirmation/reminder subjects come from real email builders. SMS reminder visual is
 * Full-only illustrative (not every booking). Thank-you / review / rebook are Planned Full only.
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

export const AFTER_BOOKING_LIVE_STATUS = 'Live today' as const;
export const AFTER_BOOKING_PLANNED_STATUS = 'Planned for Full KERSIVO · Illustrative experience' as const;

export const AFTER_BOOKING_GOOGLE_MARK_SRC = '/images/starter/google-g-192.webp';

export type AfterBookingSceneId = 'confirmReminder' | 'thanksReview' | 'rebook';

export type AfterBookingScene = {
  id: AfterBookingSceneId;
  /** Short status for the scene (live vs planned). */
  statusLabel: string;
  /** Large editorial display line when used. */
  display: string | null;
  title: string;
  body: string | null;
  ctaLabel: string | null;
  /** Optional micro note under the scene (e.g. Full SMS qualifier). */
  note: string | null;
};

export type AfterBookingExample = {
  shopName: string;
  clientName: string;
  handoffLabel: string;
  confirmationSubject: string;
  reminderSubject: string;
  smsPreviewLine: string;
  smsNote: string;
  emailReminderNote: string;
  googleMarkSrc: string;
  scenes: AfterBookingScene[];
  confirmationLines: { label: string; value: string }[];
  reminderLines: { label: string; value: string }[];
  manageLabels: string[];
  disclosure: string;
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Exported for unit tests — labels/values must never retain double-escaped entities. */
export function extractStrongLines(html: string): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const pattern = /<strong>([^<:]+):<\/strong>\s*([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    lines.push({
      label: decodeHtmlEntities(match[1]).trim(),
      value: decodeHtmlEntities(match[2]).trim(),
    });
  }
  return lines;
}

function extractActions(html: string): { label: string }[] {
  const actions: { label: string }[] = [];
  const pattern = /<a[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const label = decodeHtmlEntities(match[1]).trim();
    if (label) actions.push({ label });
  }
  return actions;
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

export const AFTER_BOOKING_DISCLOSURE = `Fictional ${DEMO_SHOP_NAME} demo. Confirmation and email reminders are live; SMS reminders are Full-only subject to allowance. Thank-you, review and rebook examples are planned Full illustrations. Nothing here sends a message. A booking is not marketing consent.`;

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

  const confirmationSubject = confirmationBuilt.subject;
  const reminderSubject = reminderBuilt.subject;

  const scenes: AfterBookingScene[] = [
    {
      id: 'confirmReminder',
      statusLabel: AFTER_BOOKING_LIVE_STATUS,
      display: null,
      title: 'Your appointment is coming up.',
      body: 'Email reminder about a day before when the booking window allows.',
      ctaLabel: null,
      note: 'SMS appointment reminders: Full KERSIVO only, subject to the plan’s monthly SMS allowance — not every booking.',
    },
    {
      id: 'thanksReview',
      statusLabel: AFTER_BOOKING_PLANNED_STATUS,
      display: 'THANKS FOR COMING IN.',
      title: `Thanks for visiting ${DEMO_SHOP_NAME}`,
      body: 'We’d appreciate an honest review of your visit.',
      ctaLabel: 'Leave a Google Review',
      note: null,
    },
    {
      id: 'rebook',
      statusLabel: AFTER_BOOKING_PLANNED_STATUS,
      display: 'READY FOR YOUR NEXT CUT?',
      title: `Your next appointment at ${DEMO_SHOP_NAME} is just a few clicks away.`,
      body: null,
      ctaLabel: 'Book Again',
      note: null,
    },
  ];

  return {
    shopName: base.shopName,
    clientName: base.fullName,
    handoffLabel: confirmationSubject,
    confirmationSubject,
    reminderSubject,
    smsPreviewLine: 'Your appointment is coming up.',
    smsNote:
      'SMS appointment reminders: Full KERSIVO only, subject to the plan’s monthly SMS allowance — not every booking.',
    emailReminderNote: 'Email reminder about a day before when the booking window allows.',
    googleMarkSrc: AFTER_BOOKING_GOOGLE_MARK_SRC,
    scenes,
    confirmationLines: extractStrongLines(confirmationBuilt.html),
    reminderLines: extractStrongLines(reminderBuilt.html),
    manageLabels: extractActions(confirmationBuilt.html).map((action) => action.label),
    disclosure: AFTER_BOOKING_DISCLOSURE,
  };
}

/** Public copy that must never claim live automation for planned retention. */
export const AFTER_BOOKING_BANNED_CLAIMS = [
  'automatically sends',
  'kersivo automatically',
  'will automatically',
  'thank-you email is sent',
  'rebooking campaign',
  'guaranteed review',
  'reserve with google',
] as const;
