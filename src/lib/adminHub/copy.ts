import type { HubStage } from '@/lib/freePreview/hubStage';
import { HUB_STAGE_PILL } from '@/lib/freePreview/hubCopy';

/** /admin hub-mode shell copy (docs/admin-hub/ADMIN_HUB_SPEC.md §3). British English. */
export const ADMIN_HUB_NAV_GROUP = 'Your website';
export const ADMIN_HUB_LEAVE = 'Leave preview';
export const ADMIN_HUB_OPERATOR = 'Viewing as KERSIVO';
export const ADMIN_HUB_OPERATOR_BANNER =
  'Viewing as KERSIVO. You see what the owner sees; owner actions and view tracking are off.';
export const ADMIN_HUB_STAGE_PILL: Record<HubStage, string> = {
  ...HUB_STAGE_PILL,
  review: 'Preview ready',
};

export type AdminHubPillTone = 'accent' | 'live' | 'neutral';

export function adminHubPillTone(stage: HubStage): AdminHubPillTone {
  if (stage === 'live') return 'live';
  if (stage === 'declined' || stage === 'expired') return 'neutral';
  return 'accent';
}

export const ADMIN_HUB_APP_CLOSE = 'Close';
export const ADMIN_HUB_APP_LOADING = 'Loading…';
export const ADMIN_HUB_APP_RETRY = 'Try again';
export const ADMIN_HUB_APP_ERROR = 'Something went wrong. Try again.';
export const ADMIN_HUB_ACTIVITY_SHOW_ALL = 'Show all';
export const ADMIN_HUB_LAUNCH_READONLY =
  'The owner finishes these steps after they sign in.';

export const ADMIN_HUB_TILE_PROGRESS = 'Your website build';
export const ADMIN_HUB_TILE_PREVIEW = 'Your preview';
export const ADMIN_HUB_TILE_COLOURS = 'Brand colours';
export const ADMIN_HUB_TILE_MESSAGES = 'Messages';
export const ADMIN_HUB_TILE_CHANGES = 'Changes';
export const ADMIN_HUB_TILE_ACTIVITY = 'Activity';
export const ADMIN_HUB_OPEN = 'Open';
export const ADMIN_HUB_STEP_TODAY = 'Today';
export const ADMIN_HUB_STAGE_OF = (current: number, total: number, label: string) =>
  `Stage ${current} of ${total} · ${label}`;

export const ADMIN_HUB_BUILD_STAGES = ['Requested', 'Designing', 'Review', 'Launch', 'Live'] as const;
export const ADMIN_HUB_BUILD_COPY = {
  requested: "We've received your request and will start on your design shortly.",
  designing: "We're building your website by hand.",
  review: 'Your preview is ready. Have a look and tell us what to change.',
  launch: "We're connecting your domain and getting everything ready.",
  live: 'Your website is live.',
} as const;
export const ADMIN_HUB_BUILD_STEP_OF = (current: number, total: number) => `Step ${current} of ${total}`;
export const ADMIN_HUB_BUILD_STEP_SR = (current: number, total: number, label: string) =>
  `Step ${current} of ${total}: ${label}`;

export const ADMIN_HUB_COLOURS_HINT = "We'll find colours in your logo";
export const ADMIN_HUB_COLOURS_EMPTY = "Add your logo and we'll find colours";
export const ADMIN_HUB_COLOURS_NONE =
  "No brand colours yet. Add your logo and we'll pick colours that match.";
export const ADMIN_HUB_ADD_TILE = 'Add photos or logo';
export const ADMIN_HUB_ACTIVITY_TODAY = 'Today';
export const ADMIN_HUB_ACTIVITY_YESTERDAY = 'Yesterday';
export const ADMIN_HUB_ACTIVITY_EMPTY =
  'Nothing here yet. Updates on your website will appear here.';
export const ADMIN_HUB_COLOURS_SAVED = (n: number) =>
  n === 1 ? '1 colour from your shop' : `${n} colours from your shop`;
export const ADMIN_HUB_COLOURS_FOUND = (n: number) =>
  n === 1 ? '1 colour found in your logo' : `${n} colours found in your logo`;
export const ADMIN_HUB_COLOURS_TUNE = 'Pick and fine-tune the ones you like';
export const ADMIN_HUB_COLOURS_NOT_SENT = 'Not sent yet';
export const ADMIN_HUB_COLOURS_SENT = 'Sent';
export const ADMIN_HUB_COLOURS_KERSIVO = "Using KERSIVO's choice";
export const ADMIN_HUB_COLOURS_MINUTE = 'Takes about a minute';
export const ADMIN_HUB_COLOURS_MAIN = 'Main';
export const ADMIN_HUB_COLOURS_ACCENT = 'Accent';
export const ADMIN_HUB_COLOURS_TITLE = 'Brand colours';
export const ADMIN_HUB_COLOURS_YOUR_LOGO = 'Your logo';
export const ADMIN_HUB_COLOURS_FOUND_IN = 'Found in your logo';
export const ADMIN_HUB_COLOURS_PICK_PHOTO = 'Pick from a photo';
export const ADMIN_HUB_COLOURS_HEX = '# Hex';
export const ADMIN_HUB_COLOURS_HEX_LABEL = 'Hex';
export const ADMIN_HUB_COLOURS_FINE_TUNE_MAIN = 'Fine-tune main colour';
export const ADMIN_HUB_COLOURS_FINE_TUNE_ACCENT = 'Fine-tune accent colour';
export const ADMIN_HUB_COLOURS_LIGHTER = 'Lighter';
export const ADMIN_HUB_COLOURS_DEEPER = 'Deeper';
export const ADMIN_HUB_COLOURS_DEPTH = 'Depth';
export const ADMIN_HUB_COLOURS_MUTED = 'Muted';
export const ADMIN_HUB_COLOURS_VIVID = 'Vivid';
export const ADMIN_HUB_COLOURS_INTENSITY = 'Intensity';
export const ADMIN_HUB_COLOURS_QUICK = 'Quick picks';
export const ADMIN_HUB_COLOURS_QUICK_HINT = 'Same colour, lighter → deeper';
export const ADMIN_HUB_COLOURS_BG = 'Website background';
export const ADMIN_HUB_COLOURS_DARK = 'Dark';
export const ADMIN_HUB_COLOURS_LIGHT = 'Light';
export const ADMIN_HUB_COLOURS_LOOKS = 'How it looks on your site';
export const ADMIN_HUB_COLOURS_GUIDE =
  "This is a guide, not your final design. We'll build your website in these colours.";
export const ADMIN_HUB_COLOURS_SEND = 'Send colours to KERSIVO';
export const ADMIN_HUB_COLOURS_CHOOSE = "Not sure? Let KERSIVO choose — we'll pick from your logo.";
export const ADMIN_HUB_COLOURS_CHOOSE_SHORT = 'Let KERSIVO choose';
export const ADMIN_HUB_COLOURS_CHOOSE_LINK = 'Let KERSIVO choose';
export const ADMIN_HUB_COLOURS_SAVE = 'Save draft';
export const ADMIN_HUB_COLOURS_RESET = 'Reset to logo';
export const ADMIN_HUB_COLOURS_TOAST = "Thanks — we'll use these colours for your website.";
export const ADMIN_HUB_COLOURS_CONTRAST_OK = 'Text on your buttons is easy to read';
export const ADMIN_HUB_COLOURS_CONTRAST_FAIL = 'Hard to read on buttons';
export const ADMIN_HUB_COLOURS_MAKE_DEEPER = 'Make it deeper';
export const ADMIN_HUB_COLOURS_MAKE_LIGHTER = 'Make it lighter';
export const ADMIN_HUB_COLOURS_BW =
  'Your logo is black and white — pick a colour or let us choose';
export const ADMIN_HUB_COLOURS_BOOK = 'Book now';
export const ADMIN_HUB_COLOURS_PRICES = 'Our prices';
export const ADMIN_HUB_COLOURS_MAIN_SEG = 'Main colour';
export const ADMIN_HUB_COLOURS_EMPTY_ROLE = 'Not set';
export const ADMIN_HUB_COLOURS_SOURCE_LOGO = 'From your logo';
export const ADMIN_HUB_COLOURS_SOURCE_MANUAL = 'Picked by you';
export const ADMIN_HUB_COLOURS_SOURCE_KERSIVO = "KERSIVO's choice";
export const ADMIN_HUB_COLOURS_SOURCE_LABEL = 'Source';
export const ADMIN_HUB_COLOURS_SENT_AT = 'Sent';
export const ADMIN_HUB_COLOURS_COPY = 'Copy';
export const ADMIN_HUB_COLOURS_COPIED = 'Copied';

export const ADMIN_HUB_WRITE_MESSAGE = 'Write a message…';
export const ADMIN_HUB_UNREAD_COUNT = (n: number) => (n === 1 ? '1 unread' : `${n} unread`);
export const ADMIN_HUB_MESSAGES_EMPTY =
  'No messages yet. Questions about your website? Send us a message.';
export const ADMIN_HUB_MESSAGES_SUB = 'We reply here and by email.';
export const ADMIN_HUB_MESSAGES_PLACEHOLDER_SUB = ADMIN_HUB_MESSAGES_SUB;

export const ADMIN_HUB_CHANGES_DRAFTS = 'Drafts';
export const ADMIN_HUB_CHANGES_WITH = 'With KERSIVO';
export const ADMIN_HUB_CHANGES_DONE = 'Done';
export const ADMIN_HUB_CHANGES_SEND_READY = "Send when you're ready";
export const ADMIN_HUB_CHANGES_EMPTY = 'No changes yet';

export const ADMIN_HUB_LAUNCH_BUTTON = 'Launch this website';
export const ADMIN_HUB_LAUNCH_PRICE = '£39/month';

export const ADMIN_HUB_DRAFT_SHOP_TITLE = 'Add your services, team and products';
export const ADMIN_HUB_DRAFT_SHOP_BODY =
  'Anything you add here appears on your preview website and carries over when you go live.';
export const ADMIN_HUB_DRAFT_SHOP_BUTTON = 'Set up my shop';

export const ADMIN_HUB_WEBSITE_TITLE = 'Your website preview';
export const ADMIN_HUB_WEBSITE_SUB =
  'Exactly what your clients will see. Switch to Booking to try it as a client.';
export const ADMIN_HUB_WEBSITE_PAGES = 'Preview pages';
export const ADMIN_HUB_WEBSITE_DEVICE = 'Device';
export const ADMIN_HUB_WEBSITE_FULL_SCREEN = 'Full screen';
export const ADMIN_HUB_WEBSITE_SUGGEST_SHORT = 'Suggest';
export const ADMIN_HUB_WEBSITE_SCALED = (width: number) => `${width}px · scaled to fit`;
export const ADMIN_HUB_CHANGES_SUB = 'Tell us what to change on your preview.';
export const ADMIN_HUB_CHANGES_SELF_EDIT =
  'Prices, services, team and products: edit them yourself in the menu — they update your booking preview straight away.';
export const ADMIN_HUB_BOOKING_EMPTY = "We're still adding services and barbers to this booking page.";
