/**
 * Owner-facing Shop Hub copy (docs/preview-hub/HUB_SPEC.md §9). British English.
 * New prospect-facing strings must be added here and listed in the batch report.
 */
import { PREVIEW_TURNAROUND_TEXT } from './config';

export const HUB_PRIVATE_LABEL = 'Private · hidden from search engines';

export const HUB_NAV = {
  overview: 'Overview',
  website: 'Website',
  details: 'Your shop',
  changes: 'Changes',
  messages: 'Messages',
} as const;

export const HUB_LOCKED_REASON_PREVIEW = 'Available when your preview is ready';
export const HUB_COMING_SOON = 'Coming soon';
export const HUB_AVAILABLE_SOON = 'Available soon';
export const HUB_QUESTIONS_FOOTER = 'Questions? Message us';

export const HUB_STAGE_PILL: Record<
  'requested' | 'designing' | 'review' | 'launch' | 'live' | 'declined' | 'expired',
  string
> = {
  requested: 'Requested',
  designing: 'Designing',
  review: 'Review',
  launch: 'Launch',
  live: 'Live',
  declined: 'Closed',
  expired: 'Expired',
};

export const HUB_STEPPER_LABELS = ['Requested', 'Designing', 'Review', 'Launch', 'Live'] as const;

export type HubHeaderCopy = { h1: string; sub: string };
export type HubHeaderKind = keyof typeof HUB_HEADERS;

/** HUB_SPEC.md §9.2. `{shopName}` is substituted by hubHeaderCopy(). */
export const HUB_HEADERS = {
  requested: {
    h1: "We've got your request",
    sub: "We'll start designing {shopName}'s website soon. Add anything that helps — it's all optional.",
  },
  designing: {
    h1: "We're designing your website",
    sub: "Your preview is being built individually for {shopName}. We'll email you when it's ready.",
  },
  review: {
    h1: 'Your preview is ready',
    sub: 'Have a look, check your details and tell us what to change.',
  },
  reviewChangesSent: {
    h1: "We're updating your preview",
    sub: "We've got your changes and we'll email you when they're done.",
  },
  launch: {
    h1: "Let's put {shopName} live",
    sub: 'A few details from you, then we connect your domain and publish.',
  },
  live: {
    h1: '{shopName} is live',
    sub: 'Your website and booking page are open to clients.',
  },
  declined: {
    h1: "You've closed this preview",
    sub: 'Changed your mind? Send us a message.',
  },
  expired: {
    h1: 'This preview has expired',
    sub: "Ask us to reopen it and we'll get back to you.",
  },
} as const;

export function hubHeaderCopy(
  kind: keyof typeof HUB_HEADERS,
  shopName: string,
): HubHeaderCopy {
  const row = HUB_HEADERS[kind];
  return {
    h1: row.h1.replaceAll('{shopName}', shopName),
    sub: row.sub.replaceAll('{shopName}', shopName),
  };
}

/** HUB_SPEC.md §9.1 acknowledgement (flag on). Over-cap keeps PREVIEW_OVER_CAP_MESSAGE in paragraph 2. */
export const HUB_ACK_SUBJECT = (shopName: string) => `We're designing your ${shopName} website`;
export const HUB_ACK_BUTTON = 'Open your shop hub';
export const HUB_ACK_INTRO = (shopName: string) =>
  `Thanks for requesting a free website preview for ${shopName}. We design every preview individually, ${PREVIEW_TURNAROUND_TEXT}.`;
export const HUB_ACK_HUB_READY = 'Your private shop hub is ready now:';
export const HUB_ACK_HUB_USES =
  'Use it to see where your preview is up to, add your logo, photos or a photo of your price list, and message us. Everything is optional — we can work from your links.';
export const HUB_ACK_WHEN_READY =
  "When your preview is ready, it appears in the same place and we'll email you.";
export const HUB_ACK_NO_PAY =
  "There's nothing to pay and no card needed. You only pay if you decide to launch.";

export const HUB_OPS_OPEN_HUB = 'Open hub as KERSIVO';
export const HUB_OPS_OPEN_OPS = 'Open it in KERSIVO Ops';

export const HUB_UPLOAD_HINT = 'Phone photos are perfect. JPG, PNG, WEBP or PDF.';
export const HUB_FILES_PRIVACY =
  "Your files are private. If you don't launch, we delete them with your preview.";
export const HUB_REVIEW_CARD_FOOTER =
  "Corrections to your details don't use your round of design changes.";
export const HUB_ROUND_USED =
  "You've used your included round of changes. Message us if something isn't right.";
export const HUB_MESSAGES_EMPTY =
  'Got a question or something we should know? Send us a message — we reply by email and here.';
export const HUB_LAUNCH_LTD_QUESTION = 'Is your shop a limited company?';
export const HUB_LAUNCH_LTD_HELPER =
  "Limited companies must show their registered name, number and office address on their website. We'll add them to your footer.";
export const HUB_PAYMENTS_OPTIONAL =
  "Clients pay at the shop by default. Connect Stripe if you'd like deposits or online payment — you can also do this later in your dashboard.";

export const HUB_HELP_TITLE = 'Need a hand?';
export const HUB_HELP_MESSAGE = 'Message KERSIVO';
export const HUB_HELP_EMAIL = 'hello@kersivo.co.uk';
export const HUB_HELP_EMAIL_HREF = 'mailto:hello@kersivo.co.uk';

export const HUB_NOW_LABEL_DOING = "What we're doing";
export const HUB_NOW_LABEL_NEED = 'What we need from you';
export const HUB_NOW_NOTHING = "Nothing — we'll email you";

export const HUB_NOW = {
  requested: {
    doing: "We've got your request and we'll start designing soon.",
    need: 'Add anything that helps — logo, photos or a photo of your price list. It is all optional.',
  },
  designing: {
    doing: "We're designing your website from the links you sent.",
    need: HUB_NOW_NOTHING,
  },
  review: {
    doing: 'Your preview is ready for you to review.',
    need: 'Have a look, check your details and tell us what to change.',
  },
  reviewChangesSent: {
    doing: "We've got your changes and we're updating your preview.",
    need: HUB_NOW_NOTHING,
  },
  launch: {
    doing: "We'll connect your domain and publish when the launch checklist is done.",
    need: 'A few details from you in your dashboard.',
  },
  live: {
    doing: 'Your website and booking page are open to clients.',
    need: HUB_NOW_NOTHING,
  },
  declined: {
    doing: 'This preview is closed.',
    need: 'Changed your mind? Send us a message.',
  },
  expired: {
    doing: 'This preview has expired.',
    need: 'Ask us to reopen it and we will get back to you.',
  },
} as const;

export const HUB_PRIMARY = {
  requested: 'Add photos or a logo',
  designing: 'Add photos or a logo',
  review: 'Open your preview',
  reviewChangesSent: 'Open your preview',
  launch: 'Finish in your dashboard',
  live: 'Go to your dashboard',
  declined: 'Send us a message',
  expired: 'Ask us to reopen it',
  subscribe: 'Launch this website — £39/month',
} as const;

export const HUB_PREVIEW_CARD_LOCKED = 'Your preview will appear here';
export const HUB_PREVIEW_OPEN_WEBSITE = 'Open website';
export const HUB_PREVIEW_TRY_BOOKING = 'Try booking';
export const HUB_ACTIVITY_TITLE = 'Activity';
export const HUB_ACTIVITY_EMPTY = 'Nothing here yet.';
export const HUB_ACTIVITY_SHOW_ALL = 'Show all';
export const HUB_WEBSITE_LOCKED_BODY = "We'll email you when it's ready.";
export const HUB_TAB_COMING_SOON_TITLE = 'This part of your shop hub is next';
export const HUB_TAB_COMING_SOON_BODY =
  "You'll be able to use this page from here soon. For now, everything else in your shop hub still works.";

/** /free-preview only while the hub flag is on (Batch 1 item 6). */
export const HUB_FREE_PREVIEW_PHOTOS_LINE =
  "After you send this, you'll get a private link where you can add photos and your logo.";
export const HUB_FREE_PREVIEW_FAQ_PHOTOS_ANSWER =
  'Photos from the links you send us, used only in your private preview and only with your permission. You can also add your own photos in your private shop hub.';

/** Owner-visible PreviewRequestEvent labels (HUB_SPEC.md §4.1). Ops-only actions are omitted from the feed. */
export const HUB_ACTIVITY_LABELS: Readonly<Record<string, string>> = {
  CREATED: 'Request received',
  DETAILS_UPDATED: 'Details added',
  MARKED_READY: 'Preview ready',
  CHANGES_REQUESTED: 'Changes sent',
  CONVERTED: 'Subscribed',
  DECLINED: 'Preview closed',
  EXPIRED: 'Preview expired',
  hub_viewed: 'Shop hub opened',
  hub_live: 'Site live',
};

export const HUB_OWNER_ACTIVITY_ACTIONS = new Set(Object.keys(HUB_ACTIVITY_LABELS));
