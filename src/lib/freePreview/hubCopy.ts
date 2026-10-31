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
export const HUB_UPLOAD_HINT_PHOTOS = 'Phone photos are perfect. Landscape works best for the top of your website.';
export const HUB_UPLOAD_HINT_PRICE = "We'll copy your services and prices from it.";
export const HUB_FILES_PRIVACY =
  "Your files are private. If you don't launch, we delete them with your preview.";
export const HUB_UPLOAD_DROP = 'Drop files here, or tap to choose';
export const HUB_UPLOAD_CHOOSE = 'Choose files';
export const HUB_UPLOAD_CAMERA = 'Take a photo';
export const HUB_UPLOAD_RETRY = 'Try again';
export const HUB_UPLOAD_PROGRESS = (done: number, total: number) =>
  total === 1 ? 'Uploading 1 file' : `Uploading ${done} of ${total} files`;
export const HUB_UPLOAD_ERROR_TYPE = 'Only JPG, PNG, WEBP or PDF.';
export const HUB_UPLOAD_ERROR_TYPE_LOGO = 'Only JPG, PNG, WEBP, SVG or PDF.';
export const HUB_UPLOAD_ERROR_TYPE_PHOTO = 'Only JPG, PNG or WEBP.';
export const HUB_UPLOAD_ERROR_TOO_LARGE = 'This file is over 4 MB. Try a smaller photo.';
export const HUB_UPLOAD_ERROR_TOO_LARGE_BODY = 'This upload is over 4 MB. Try one smaller file at a time.';
export const HUB_UPLOAD_ERROR_EMPTY = 'That file is empty.';
export const HUB_UPLOAD_ERROR_REJECTED = 'We could not use that file. Try a JPG, PNG, WEBP or PDF.';
export const HUB_UPLOAD_ERROR_CAP_FILES = 'You can add up to 60 files.';
export const HUB_UPLOAD_ERROR_CAP_BYTES = 'These files would take you over 250 MB.';
export const HUB_UPLOAD_ERROR_CAP_PHOTOS = 'You can add up to 40 shop photos.';
export const HUB_UPLOAD_ERROR_CAP_PRICE = 'You can add up to 5 price list files.';
export const HUB_UPLOAD_ERROR_CAP_TEAM = 'You can add up to 40 team photos.';
export const HUB_UPLOAD_ERROR_CAP_LOGO = 'You can add up to 3 logos.';
export const HUB_UPLOAD_ERROR_GENERIC = 'Upload failed. Try again.';
export const HUB_UPLOAD_ERROR_DENIED = 'You cannot add files at this stage.';
export const HUB_SAVING = 'Saving…';
export const HUB_SAVED = 'Saved';
export const HUB_SAVE_FAILED = 'Could not save. Try again.';
export const HUB_RETRY = 'Try again';
export const HUB_UNDO = 'Undo';
export const HUB_DELETE = 'Delete';
export const HUB_CAPTION_LABEL = 'Caption';
export const HUB_CAPTION_PLACEHOLDER = 'Optional caption';
export const HUB_MOVE_UP = 'Move up';
export const HUB_MOVE_DOWN = 'Move down';
export const HUB_EMPTY_PHOTOS = 'No shop photos yet.';
export const HUB_EMPTY_TEAM_PHOTOS = 'No team photos yet.';
export const HUB_EMPTY_PRICE = 'No price list yet.';
export const HUB_EMPTY_LOGO = 'No logo yet.';

export const HUB_DETAILS_TITLE = 'Your shop';
export const HUB_DETAILS_BRAND_TITLE = 'Brand';
export const HUB_DETAILS_PHOTOS_TITLE = 'Shop photos';
export const HUB_DETAILS_TEAM_PHOTOS_TITLE = 'Team photos';
export const HUB_DETAILS_PRICE_TITLE = 'Price list';
export const HUB_DETAILS_PRICE_HEAD = 'Snap your price list';
export const HUB_DETAILS_ABOUT_TITLE = 'About your shop';
export const HUB_DETAILS_ABOUT_HINT = 'Two or three sentences is enough. Optional.';
export const HUB_DETAILS_STYLE_LABEL = 'Anything about your style?';
export const HUB_DETAILS_STYLE_HINT = 'Optional. Up to 500 characters.';
export const HUB_DETAILS_COLOUR_PRIMARY = 'Primary colour';
export const HUB_DETAILS_COLOUR_SECONDARY = 'Secondary colour';
export const HUB_DETAILS_PICK_FROM_LOGO = 'Pick from my logo';
export const HUB_DETAILS_HEX_LABEL = 'Hex';
export const HUB_DETAILS_SWATCH_DARK = 'On dark';
export const HUB_DETAILS_SWATCH_LIGHT = 'On light';
export const HUB_DETAILS_PLACEHOLDER_LINKS =
  "We'll fill these from your links — you'll confirm them on your preview";
export const HUB_DETAILS_SERVICES_TITLE = 'Services & prices';
export const HUB_DETAILS_TEAM_TITLE = 'Team';
export const HUB_DETAILS_HOURS_TITLE = 'Opening hours';

export const HUB_CHECKLIST_TITLE = 'Your shop';
export const HUB_CHECKLIST_OPTIONAL = 'Optional';
export const HUB_CHECKLIST_ON_PREVIEW = 'On your preview';
export const HUB_CHECKLIST_LOGO = 'Logo';
export const HUB_CHECKLIST_PHOTOS = 'Shop photos';
export const HUB_CHECKLIST_SERVICES = 'Services & prices';
export const HUB_CHECKLIST_TEAM = 'Team';
export const HUB_CHECKLIST_HOURS = 'Opening hours';
export const HUB_CHECKLIST_ABOUT = 'About your shop';
export const HUB_CHECKLIST_PRICE = 'Price list photo';
export const HUB_CHECKLIST_PROGRESS = (done: number, total: number) => `${done} of ${total}`;

export const HUB_ACTIVITY_ADDED = (count: number, kindLabel: string) =>
  count === 1 ? `You added ${kindLabel}` : `You added ${count} ${kindLabel}`;
export const HUB_ACTIVITY_KIND_LOGO = 'a logo';
export const HUB_ACTIVITY_KIND_PHOTO = 'a photo';
export const HUB_ACTIVITY_KIND_PHOTOS = 'photos';
export const HUB_ACTIVITY_KIND_TEAM = 'a team photo';
export const HUB_ACTIVITY_KIND_TEAMS = 'team photos';
export const HUB_ACTIVITY_KIND_PRICE = 'a price list';
export const HUB_ACTIVITY_KIND_PRICES = 'price lists';
export const HUB_ACTIVITY_KIND_FILE = 'a file';
export const HUB_ACTIVITY_KIND_FILES = 'files';

export const HUB_OPS_NEW_FILES = 'New files';
export const HUB_OPS_FILES_TITLE = 'Files';
export const HUB_OPS_FILES_EMPTY = 'No files yet.';
export const HUB_OPS_DOWNLOAD = 'Download original';
export const HUB_OPS_UPLOADED_BY_OWNER = 'Owner';
export const HUB_OPS_UPLOADED_BY_KERSIVO = 'KERSIVO';
export const HUB_OPS_BRAND_COLOURS = 'Brand colours';
export const HUB_OPS_STYLE_NOTES = 'Style notes';
export const HUB_OPS_ABOUT = 'About';

export const HUB_OPS_FILES_EMAIL_SUBJECT = (shopName: string) => `Files added: ${shopName}`;
export const HUB_OPS_FILES_EMAIL_INTRO = (shopName: string) =>
  `${shopName} added files in their shop hub.`;
export const HUB_OPS_FILES_EMAIL_BUTTON = 'Open in KERSIVO Ops';
export const HUB_REVIEW_CARD_FOOTER =
  "Corrections to your details don't use your round of design changes.";
export const HUB_ROUND_USED =
  "You've used your included round of changes. Message us if something isn't right.";
export const HUB_CHECK_DETAILS_TITLE = 'Check your details';
export const HUB_REVIEW_LOOKS_RIGHT = 'Looks right';
export const HUB_REVIEW_SEND_CORRECTIONS = 'Send corrections';
export const HUB_REVIEW_ADD_ROW = 'Add a row';
export const HUB_REVIEW_REMOVE_ROW = 'Remove';
export const HUB_REVIEW_NOT_CHECKED = 'Not checked';
export const HUB_REVIEW_CONFIRMED = 'Confirmed';
export const HUB_REVIEW_CORRECTIONS_SENT = 'Corrections sent';
export const HUB_REVIEW_UPDATED = 'Updated on your preview';
export const HUB_REVIEW_DISMISSED_NOTE = 'KERSIVO left a note';
export const HUB_REVIEW_EMPTY_SERVICES = 'No services on this preview yet.';
export const HUB_REVIEW_EMPTY_TEAM = 'No team on this preview yet.';
export const HUB_REVIEW_EMPTY_HOURS = 'No opening hours on this preview yet.';
export const HUB_REVIEW_NAME = 'Name';
export const HUB_REVIEW_DURATION = 'Duration (minutes)';
export const HUB_REVIEW_PRICE = 'Price';
export const HUB_REVIEW_BIO = 'Short bio';
export const HUB_REVIEW_SHOW_ON_WEBSITE = 'Show on website';
export const HUB_REVIEW_PHOTO = 'Photo';
export const HUB_REVIEW_SENDING = 'Sending…';
export const HUB_REVIEW_SENT = 'Sent';
export const HUB_REVIEW_FAILED = 'Could not save. Try again.';
export const HUB_REVIEW_LOAD_ERROR = 'Could not load your details.';
export const HUB_REVIEW_INVALID_SERVICE_NAME = 'Service name must be 1–80 characters.';
export const HUB_REVIEW_INVALID_DURATION = 'Duration must be between 5 and 480 minutes.';
export const HUB_REVIEW_INVALID_PRICE = 'Price must be between £0 and £999.99.';
export const HUB_REVIEW_INVALID_TEAM_NAME = 'Name must be 1–60 characters.';
export const HUB_REVIEW_INVALID_BIO = 'Bio can be up to 280 characters.';
export const HUB_REVIEW_INVALID_HOURS = 'Opening hours need 7 days, with a start time before the end time.';
export const HUB_REVIEW_INVALID_PHOTO = 'That photo is not a team photo for this preview.';
export const HUB_NOW_REVIEW_NEED_ALL =
  "Check your services, team and hours, then subscribe when you're happy.";
export const HUB_NOW_REVIEW_NEED_SOME = (unchecked: string) =>
  `Check your ${unchecked}, then subscribe when you're happy.`;
export const HUB_NOW_REVIEW_NEED_DONE = "Subscribe when you're happy, or send design changes.";
export const HUB_CHANGES_TITLE = 'Changes';
export const HUB_CHANGES_EMPTY = 'No changes yet. Suggest something from your website preview or add one here.';
export const HUB_CHANGES_ADD = 'Suggest a change';
export const HUB_CHANGES_SEND = 'Send changes to KERSIVO';
export const HUB_CHANGES_SENDING = 'Sending…';
export const HUB_CHANGES_SENT = 'Changes sent';
export const HUB_CHANGES_FAILED = 'Could not send. Try again.';
export const HUB_CHANGES_LOAD_ERROR = 'Could not load your changes.';
export const HUB_CHANGES_DRAFT = 'Draft';
export const HUB_CHANGES_STATUS_SENT = 'Sent';
export const HUB_CHANGES_IN_PROGRESS = 'In progress';
export const HUB_CHANGES_DONE = 'Done';
export const HUB_CHANGES_NOT_POSSIBLE = 'Not possible';
export const HUB_CHANGES_PAGE = 'Page';
export const HUB_CHANGES_BODY = 'What would you like us to change?';
export const HUB_CHANGES_BODY_REQUIRED = 'Write what you would like us to change.';
export const HUB_CHANGES_BODY_TOO_LONG = 'Changes can be up to 2,000 characters.';
export const HUB_CHANGES_ROUND = (used: number, included: number) =>
  `Round ${Math.min(used + 1, included)} of ${included} included`;
export const HUB_CHANGES_ROUND_USED_COUNT = (used: number, included: number) =>
  `${used} of ${included} included rounds used`;
export const HUB_CHANGES_DELETE = 'Delete draft';
export const HUB_CHANGES_SAVE_DRAFT = 'Save draft';
export const HUB_CHANGES_EDIT = 'Edit';
export const HUB_CHANGES_CANCEL = 'Cancel';
export const HUB_CHANGES_ATTACHMENT = 'Add a screenshot (optional)';
export const HUB_CHANGES_DENIED = 'You cannot send changes at this stage.';
export const HUB_CHANGES_NO_DRAFTS = 'Add a draft change before sending.';
export const HUB_CHANGES_PAGES = {
  HOME: 'Home',
  SERVICES: 'Services',
  BARBERS: 'Barbers',
  GALLERY: 'Gallery',
  CONTACT: 'Contact',
  BOOKING: 'Booking',
  OTHER: 'Other',
} as const;
export const HUB_WEBSITE_WEBSITE = 'Website';
export const HUB_WEBSITE_BOOKING = 'Booking';
export const HUB_WEBSITE_PHONE = 'Phone';
export const HUB_WEBSITE_DESKTOP = 'Desktop';
export const HUB_WEBSITE_OPEN_TAB = 'Open in new tab';
export const HUB_WEBSITE_SUGGEST = 'Suggest a change';
export const HUB_WEBSITE_TEST_NOTE = 'Test bookings only — no payments are taken.';
export const HUB_WEBSITE_REQUEST_CHANGES = 'Request changes';
export const HUB_OPS_TAB_CONTENT = 'Content';
export const HUB_OPS_TAB_CHANGES = 'Changes';
export const HUB_OPS_APPLY = 'Apply';
export const HUB_OPS_DISMISS = 'Dismiss with note';
export const HUB_OPS_DISMISS_NOTE = 'Note for the owner';
export const HUB_OPS_DISMISS_NOTE_REQUIRED = 'Add a note before dismissing.';
export const HUB_OPS_APPLIED = 'Applied';
export const HUB_OPS_DISMISSED = 'Dismissed';
export const HUB_OPS_APPLY_FAILED = 'Could not apply. The draft shop may have changed.';
export const HUB_OPS_APPLY_INCOMPATIBLE =
  'The draft shop has changed since this proposal. Refresh and try again.';
export const HUB_OPS_NO_PROPOSAL = 'No proposal to apply.';
export const HUB_OPS_GRANT_ROUND = 'Grant extra round';
export const HUB_OPS_GRANT_ROUND_DONE = 'Extra round granted';
export const HUB_OPS_CHANGE_NOTE = 'Note (required for Not possible)';
export const HUB_OPS_WEBSITE_REMINDER =
  'Applying booking data updates the booking page immediately. The website at the site preview URL is a separate build — update that too.';
export const HUB_OPS_OPEN_CHANGES = (count: number) =>
  count === 1 ? '1 open change' : `${count} open changes`;
export const HUB_ACTIVITY_CONFIRMED = (section: string) => `You confirmed your ${section}`;
export const HUB_ACTIVITY_CORRECTIONS = (section: string) => `You sent corrections to your ${section}`;
export const HUB_ACTIVITY_UPDATED_SECTION = (section: string) => `KERSIVO updated your ${section}`;
export const HUB_ACTIVITY_CHANGE_DONE = 'Change done';
export const HUB_ACTIVITY_CHANGES_SENT = 'Changes sent';
export const HUB_SECTION_SERVICES = 'services';
export const HUB_SECTION_TEAM = 'team';
export const HUB_SECTION_HOURS = 'opening hours';
export const HUB_MESSAGES_EMPTY =
  'Got a question or something we should know? Send us a message — we reply by email and here.';
export const HUB_YOU = 'You';
export const HUB_KERSIVO = 'KERSIVO';
export const HUB_SEEN = 'Seen';
export const HUB_SEND = 'Send';
export const HUB_ATTACH = 'Attach a file';
export const HUB_MESSAGE_PLACEHOLDER = 'Write a message';
export const HUB_MESSAGE_HINT = 'Ctrl or Cmd + Enter to send. Enter starts a new line.';
export const HUB_MESSAGE_CHAR_COUNT = (used: number, max: number) => `${used} / ${max}`;
export const HUB_MESSAGE_TOO_LONG = 'Messages can be up to 2,000 characters.';
export const HUB_MESSAGE_REQUIRED = 'Write a message before sending.';
export const HUB_MESSAGE_SENDING = 'Sending…';
export const HUB_MESSAGE_SENT = 'Sent';
export const HUB_MESSAGE_FAILED = 'Could not send. Try again.';
export const HUB_MESSAGE_LOAD_ERROR = 'Could not load messages.';
export const HUB_MESSAGE_ATTACH_MAX = 'You can attach up to 5 files.';
export const HUB_MESSAGE_ATTACH_DENIED = 'That file is not a message attachment for this preview.';
export const HUB_UNREAD = 'Unread messages';
export const HUB_DRAFT_REOPEN = 'Please reopen this preview.';
export const HUB_DRAFT_DECLINED = "I'd like to continue with this preview.";
export const HUB_ACTIVITY_YOU_SENT = 'You sent a message';
export const HUB_ACTIVITY_KERSIVO_REPLIED = 'KERSIVO replied';
export const HUB_OWNER_MESSAGE_EMAIL_SUBJECT = (shopName: string) =>
  `New message from KERSIVO about ${shopName}`;
export const HUB_OWNER_MESSAGE_EMAIL_INTRO = (shopName: string) =>
  `KERSIVO sent a message about ${shopName}:`;
export const HUB_OWNER_MESSAGE_EMAIL_BUTTON = 'Reply in your shop hub';
export const HUB_OPS_MESSAGES_EMAIL_SUBJECT = (count: number, shopName: string) =>
  count === 1 ? `1 new message from ${shopName}` : `${count} new messages from ${shopName}`;
export const HUB_OPS_MESSAGES_EMAIL_INTRO = (count: number, shopName: string) =>
  count === 1
    ? `${shopName} sent a message in their shop hub.`
    : `${shopName} sent ${count} messages in their shop hub.`;
export const HUB_OPS_MESSAGES_EMAIL_BUTTON = 'Open in KERSIVO Ops';
export const HUB_OPS_MESSAGES_TITLE = 'Messages';
export const HUB_OPS_MESSAGES_EMPTY = 'No messages yet.';
export const HUB_OPS_UNREAD_MESSAGES = (count: number) =>
  count === 1 ? '1 unread' : `${count} unread`;
export const HUB_OPS_TAB_OVERVIEW = 'Overview';
export const HUB_OPS_TAB_FILES = 'Files';
export const HUB_OPS_TAB_MESSAGES = 'Messages';
export const HUB_LAUNCH_LTD_QUESTION = 'Is your shop a limited company?';
export const HUB_LAUNCH_LTD_HELPER =
  "Limited companies must show their registered name, number and office address on their website. We'll add them to your footer.";
export const HUB_PAYMENTS_OPTIONAL =
  "Clients pay at the shop by default. Connect Stripe if you'd like deposits or online payment — you can also do this later in your dashboard.";

export const HUB_LAUNCH_TITLE = 'Launch checklist';
export const HUB_LAUNCH_PROGRESS = (done: number, total: number) => `${done} of ${total} done`;
export const HUB_LAUNCH_YOUR_STEPS = 'Your steps';
export const HUB_LAUNCH_OUR_STEPS = 'Our steps';
export const HUB_LAUNCH_FINISH_DASHBOARD = 'Finish in your dashboard';
export const HUB_LAUNCH_DONE = 'Done';
export const HUB_LAUNCH_TO_DO = 'To do';
export const HUB_LAUNCH_PENDING = 'Pending';
export const HUB_LAUNCH_IN_PROGRESS = 'In progress';
export const HUB_LAUNCH_ITEM_BUSINESS = 'Business details';
export const HUB_LAUNCH_ITEM_DOMAIN = 'Domain';
export const HUB_LAUNCH_ITEM_PAYMENTS = 'Payments (optional)';
export const HUB_LAUNCH_ITEM_MIGRATION = 'Moving your clients (optional)';
export const HUB_LAUNCH_ITEM_APPROVE = 'Approve your website';
export const HUB_LAUNCH_OUR_DOMAIN = 'Connect your domain';
export const HUB_LAUNCH_OUR_SSL = 'Secure it (SSL)';
export const HUB_LAUNCH_OUR_PUBLISH = 'Publish your website';
export const HUB_LAUNCH_NAME_LABEL = 'Name shown on your website';
export const HUB_LAUNCH_PUBLIC_PHONE = 'Public phone';
export const HUB_LAUNCH_PUBLIC_EMAIL = 'Public email';
export const HUB_LAUNCH_ADDRESS = 'Shop address';
export const HUB_LAUNCH_TOWN = 'Town or city';
export const HUB_LAUNCH_POSTCODE = 'Postcode';
export const HUB_LAUNCH_CONTACT_NAME = 'Your name (private)';
export const HUB_LAUNCH_CONTACT_EMAIL = 'Your email (private)';
export const HUB_LAUNCH_CONTACT_HINT = 'Private — for KERSIVO only, not shown on your website.';
export const HUB_LAUNCH_PUBLIC_HINT = 'Shown on your website and to Google.';
export const HUB_LAUNCH_LTD_YES = 'Yes';
export const HUB_LAUNCH_LTD_NO = 'No';
export const HUB_LAUNCH_COMPANY_NAME = 'Registered company name';
export const HUB_LAUNCH_COMPANY_NUMBER = 'Company number';
export const HUB_LAUNCH_COMPANY_NUMBER_HINT =
  'Eight characters. Use the SC, NI or OC prefix when Companies House shows one.';
export const HUB_LAUNCH_OFFICE_ADDRESS = 'Registered office address';
export const HUB_LAUNCH_LTD_REQUIRED = 'Limited companies need a registered name, number and office address.';
export const HUB_LAUNCH_COMPANY_NUMBER_INVALID =
  'Enter a valid UK company number (8 digits, or SC, NI or OC plus 6 digits).';
export const HUB_LAUNCH_BUSINESS_REQUIRED = 'Add your contact details and shop address.';
export const HUB_LAUNCH_DOMAIN_EXISTING_INTRO =
  'Add these DNS records at the company where you bought your domain. The steps are the same for GoDaddy, 123 Reg, Cloudflare, Namecheap and others.';
export const HUB_LAUNCH_DNS_STEP_1 = 'Sign in to your domain registrar and open DNS settings.';
export const HUB_LAUNCH_DNS_STEP_2 =
  'Add an A record for the root (@) and a CNAME record for www, using the values KERSIVO sent you. If you do not have them yet, message us from your shop hub.';
export const HUB_LAUNCH_DNS_STEP_3 = 'Save the records. Changes can take a short while to appear.';
export const HUB_LAUNCH_DNS_DONE = "I've done this";
export const HUB_LAUNCH_DNS_CONFIRMED = "You've told us the DNS records are in place.";
export const HUB_LAUNCH_DOMAIN_KERSIVO = (domain: string) => `We're registering ${domain}.`;
export const HUB_LAUNCH_DOMAIN_CHOSEN = (domain: string) => `Your domain: ${domain}`;
export const HUB_LAUNCH_DOMAIN_UNDECIDED = 'Your domain choice from checkout will appear here.';
export const HUB_LAUNCH_STRIPE_CONNECTED = 'Stripe is connected.';
export const HUB_LAUNCH_CONNECT_STRIPE = 'Connect Stripe';
export const HUB_LAUNCH_SKIP_PAYMENTS = 'Skip for now';
export const HUB_LAUNCH_PAYMENTS_SKIPPED = 'Skipped — you can connect Stripe later in your dashboard.';
export const HUB_LAUNCH_MIGRATION_INTRO = (system: string) =>
  `We can help you move your client list from ${system}.`;
export const HUB_LAUNCH_MIGRATION_NONE = 'You did not tell us you use another booking system. You can still upload a CSV if you want.';
export const HUB_LAUNCH_MIGRATION_CSV = 'Upload a CSV of your clients';
export const HUB_LAUNCH_MIGRATION_LAWFUL =
  'I confirm this client data was collected lawfully and I have the right to share it with KERSIVO.';
export const HUB_LAUNCH_MIGRATION_NOT_NOW = 'Not now';
export const HUB_LAUNCH_MIGRATION_SKIPPED = 'Skipped — you can send a client list later.';
export const HUB_LAUNCH_MIGRATION_UPLOADED = 'CSV uploaded.';
export const HUB_LAUNCH_APPROVE_INTRO = 'Check your website and booking page, then approve when you are happy.';
export const HUB_LAUNCH_OPEN_WEBSITE = 'Open website preview';
export const HUB_LAUNCH_OPEN_BOOKING = 'Open booking preview';
export const HUB_LAUNCH_RIGHTS =
  'I have the right to use the photos, logo and text on my website.';
export const HUB_LAUNCH_ACCURACY = 'The details on my preview and on this page are correct.';
export const HUB_LAUNCH_APPROVE_BUTTON = 'Approve for launch';
export const HUB_LAUNCH_APPROVE_BLOCKED = 'Finish your business details before you approve.';
export const HUB_LAUNCH_APPROVED = (shopName: string) =>
  `Thanks — we'll put ${shopName} live and email you.`;
export const HUB_LAUNCH_LOAD_ERROR = 'Could not load your launch checklist.';
export const HUB_LAUNCH_SAVE_ERROR = 'Could not save. Try again.';
export const HUB_LAUNCH_SIGN_IN = 'Sign in to finish your launch checklist.';
export const HUB_LIVE_OPEN_SITE = 'Open your live website';
export const HUB_LIVE_NEXT_TITLE = 'Next in your dashboard';
export const HUB_LIVE_NEXT_GOOGLE = 'Add your booking link to Google';
export const HUB_LIVE_NEXT_QR = 'Order your QR Kit';
export const HUB_LIVE_NEXT_DEPOSITS = 'Set deposits (optional)';
export const HUB_LIVE_NEXT_RETAIL = 'Start selling products';
export const HUB_LIVE_NEXT_HOURS = "Add your team's working hours";
export const HUB_OPS_APPROVED_BADGE = 'Approved — ready to launch';
export const HUB_OPS_DOMAIN_CONNECTED = 'Domain connected';
export const HUB_OPS_SSL_ACTIVE = 'SSL active';
export const HUB_OPS_MARK_LIVE = 'Mark live';
export const HUB_OPS_DOMAIN_CONFIRM = 'Mark the domain as connected?';
export const HUB_OPS_SSL_CONFIRM = 'Mark SSL as active?';
export const HUB_OPS_LIVE_CONFIRM = 'Mark this website live? The owner will be emailed.';
export const HUB_OPS_LAUNCH_STEPS = 'Launch steps';
export const HUB_SUBSCRIBED_SUBJECT = (shopName: string) => `Let's put ${shopName} live`;
export const HUB_SUBSCRIBED_INTRO = (shopName: string) =>
  `Thanks for subscribing. A few details from you and we'll put ${shopName} live.`;
export const HUB_SUBSCRIBED_BUTTON = 'Open your launch checklist';
export const HUB_LAUNCH_APPROVED_OPS_SUBJECT = (shopName: string) => `Ready to launch: ${shopName}`;
export const HUB_LAUNCH_APPROVED_OPS_INTRO = (shopName: string) =>
  `${shopName} approved their website for launch.`;
export const HUB_LAUNCH_APPROVED_OPS_BUTTON = 'Open in KERSIVO Ops';
export const HUB_SITE_LIVE_SUBJECT = (shopName: string) => `${shopName} is live`;
export const HUB_SITE_LIVE_INTRO = (shopName: string) =>
  `${shopName} is live. Your website and booking page are open to clients.`;
export const HUB_SITE_LIVE_BUTTON = 'Open your live website';
export const HUB_SITE_LIVE_NEXT = 'Next in your dashboard:';
export const HUB_RETAIL_NEEDS_PRODUCT =
  'Add at least one active product before enabling retail checkout.';

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
  hub_asset_uploaded: 'Files added',
  hub_details_saved: 'Shop details saved',
  hub_message_sent: 'You sent a message',
  ops_hub_message_sent: 'KERSIVO replied',
  hub_review_confirmed: 'You confirmed your details',
  hub_review_corrections_sent: 'You sent corrections',
  ops_hub_review_applied: 'Details updated on your preview',
  hub_changes_sent: 'Changes sent',
  ops_hub_change_status: 'Change updated',
  hub_launch_details_saved: 'Business details saved',
  hub_domain_confirmed: 'Domain records confirmed',
  hub_launch_approved: 'Website approved for launch',
  ops_hub_mark_live: 'Site live',
};

export const HUB_OWNER_ACTIVITY_ACTIONS = new Set(Object.keys(HUB_ACTIVITY_LABELS));
