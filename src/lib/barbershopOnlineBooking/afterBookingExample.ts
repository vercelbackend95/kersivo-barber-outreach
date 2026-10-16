/**
 * Section 06 presentation data for /barbershop-online-booking — post-visit retention story.
 *
 * Focus: thank-you, Google review invite, and rebook after the visit (Planned Full illustrations).
 * Pre-visit confirmation/reminders are not the hero of this section.
 */
import {
  buildAppointmentReminderEmail,
  buildInstantBookingConfirmationEmail,
} from '@/lib/email/sender';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_DEFAULT_SERVICE_SLUG, DEMO_SERVICES } from '@/lib/demo/services';
import { DEMO_SHOP_NAME } from '@/lib/demo/site';

/** Fixed appointment used only for claim-safe builder fixtures. */
export const AFTER_BOOKING_EXAMPLE_START = new Date('2027-01-14T11:00:00.000Z');
export const AFTER_BOOKING_EXAMPLE_CLIENT = 'Jordan Ellis';
export const AFTER_BOOKING_EXAMPLE_TIMEZONE = 'Europe/London';

/** Display-only placeholders — never navigate to live manage tokens. */
export const AFTER_BOOKING_PREVIEW_RESCHEDULE_HREF = '#preview-reschedule';
export const AFTER_BOOKING_PREVIEW_CANCEL_HREF = '#preview-cancel';

/** Section-level status for the three planned post-visit concepts. */
export const AFTER_BOOKING_CONCEPT_STATUS = 'CONCEPT PREVIEW · PLANNED FOR FULL KERSIVO' as const;

/** @deprecated Prefer AFTER_BOOKING_CONCEPT_STATUS — kept for claim-language continuity in tests. */
export const AFTER_BOOKING_PLANNED_STATUS = AFTER_BOOKING_CONCEPT_STATUS;

export const AFTER_BOOKING_GOOGLE_MARK_SRC = '/images/starter/google-g-192.webp';

export type AfterBookingMomentId = 'thanks' | 'review' | 'rebook';

export type AfterBookingThanksPreview = {
  fromLabel: string;
  from: string;
  subjectLabel: string;
  subject: string;
  message: string;
};

export type AfterBookingReviewPreview = {
  heading: string;
  body: string;
  ctaLabel: string;
};

export type AfterBookingRebookPreview = {
  shopName: string;
  heading: string;
  ctaLabel: string;
};

export type AfterBookingMoment = {
  id: AfterBookingMomentId;
  index: string;
  stageLabel: string | null;
  display: string;
  support: string | null;
  ctaLabel: string | null;
  thanksPreview: AfterBookingThanksPreview | null;
  reviewPreview: AfterBookingReviewPreview | null;
  rebookPreview: AfterBookingRebookPreview | null;
};

export type AfterBookingExample = {
  shopName: string;
  clientName: string;
  conceptStatus: typeof AFTER_BOOKING_CONCEPT_STATUS;
  confirmationSubject: string;
  reminderSubject: string;
  googleMarkSrc: string;
  moments: AfterBookingMoment[];
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

export const AFTER_BOOKING_DISCLOSURE =
  'These thank-you, Google review and rebooking messages are illustrative ideas for Full KERSIVO. None of these post-visit automations is live.';

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

  const moments: AfterBookingMoment[] = [
    {
      id: 'thanks',
      index: '01',
      stageLabel: null,
      display: 'THANKS FOR COMING IN.',
      support: 'Planned concept: a thank-you message after the visit.',
      ctaLabel: null,
      thanksPreview: {
        fromLabel: 'From',
        from: DEMO_SHOP_NAME,
        subjectLabel: 'Subject',
        subject: 'Thanks for coming in.',
        message: `Thanks for visiting ${DEMO_SHOP_NAME}. We hope you enjoyed your cut.`,
      },
      reviewPreview: null,
      rebookPreview: null,
    },
    {
      id: 'review',
      index: '02',
      stageLabel: '02 / PLANNED REVIEW INVITATION',
      display: 'A GREAT CUT DESERVES AN HONEST REVIEW.',
      support: null,
      ctaLabel: 'Leave a Google Review',
      thanksPreview: null,
      reviewPreview: {
        heading: 'How was your visit?',
        body: `We’d appreciate an honest review of your experience at ${DEMO_SHOP_NAME}.`,
        ctaLabel: 'Leave a Google Review',
      },
      rebookPreview: null,
    },
    {
      id: 'rebook',
      index: '03',
      stageLabel: null,
      display: 'READY FOR YOUR NEXT CUT?',
      support: `Planned concept: a message linking back to ${DEMO_SHOP_NAME}'s booking page.`,
      ctaLabel: 'BOOK AGAIN',
      thanksPreview: null,
      reviewPreview: null,
      rebookPreview: {
        shopName: DEMO_SHOP_NAME,
        heading: 'Time for your next cut?',
        ctaLabel: 'BOOK AGAIN',
      },
    },
  ];

  return {
    shopName: base.shopName,
    clientName: base.fullName,
    conceptStatus: AFTER_BOOKING_CONCEPT_STATUS,
    confirmationSubject: confirmationBuilt.subject,
    reminderSubject: reminderBuilt.subject,
    googleMarkSrc: AFTER_BOOKING_GOOGLE_MARK_SRC,
    moments,
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
