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
export const ADMIN_HUB_VIEW_ALL = 'View all';
export const ADMIN_HUB_APP_LOADING = 'Loading…';
export const ADMIN_HUB_APP_RETRY = 'Try again';
export const ADMIN_HUB_APP_ERROR = 'Something went wrong. Try again.';
export const ADMIN_HUB_ACTIVITY_SHOW_ALL = 'Show all';
export const ADMIN_HUB_LAUNCH_READONLY =
  'The owner finishes these steps after they sign in.';

export const ADMIN_HUB_TILE_PROGRESS = 'Your website build';
export const ADMIN_HUB_TILE_PREVIEW = 'Your preview';
export const ADMIN_HUB_TILE_CONTENT = 'Website content';
export const ADMIN_HUB_TILE_COLOURS = 'Brand colours';
export const ADMIN_HUB_TILE_MESSAGES = 'Messages';
export const ADMIN_HUB_TILE_CHANGES = 'Changes';
export const ADMIN_HUB_TILE_ACTIVITY = 'Activity';
export const ADMIN_HUB_CONTENT_EMPTY =
  'Photos, your logo and a few lines of text help us build a site that feels like your shop.';
export const ADMIN_HUB_NOT_ADDED = 'Not added';
export const ADMIN_HUB_CONTENT_DONE = '✓';
/** Website content tile (O3): caption under the logo slot, photo cell names and the "+N" cell. */
export const ADMIN_HUB_CONTENT_LOGO = 'Logo';
export const ADMIN_HUB_CONTENT_PHOTO = (index: number, total: number) => `Shop photo ${index} of ${total}`;
export const ADMIN_HUB_CONTENT_MORE_PHOTOS = (n: number) => `+${n}`;
export const ADMIN_HUB_CONTENT_SHOW_ALL_PHOTOS = (n: number) =>
  n === 1 ? 'Show your shop photo' : `Show all ${n} shop photos`;
export const ADMIN_HUB_SHOP_TEAM_COUNT = (n: number) =>
  n === 1 ? '1 team member' : `${n} team members`;
export const ADMIN_HUB_SHOP_SERVICES_COUNT = (n: number) => (n === 1 ? '1 service' : `${n} services`);
export const ADMIN_HUB_SHOP_PRODUCTS_COUNT = (n: number) => (n === 1 ? '1 product' : `${n} products`);
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
/** Live region after the Overview picks up a change made in an app (hubStore refresh). */
export const ADMIN_HUB_OVERVIEW_UPDATED = 'Overview updated';
export const ADMIN_HUB_ADD = 'Add';
export const ADMIN_HUB_ADD_MENU = 'Add to your website or shop';
export const ADMIN_HUB_ADD_GROUP_WEBSITE = 'Your website';
export const ADMIN_HUB_ADD_GROUP_SHOP = 'Your shop';
export const ADMIN_HUB_ADD_BUSINESS = 'Business details';
export const ADMIN_HUB_ADD_BUSINESS_HINT = 'Name, address, phone and email';
export const ADMIN_HUB_ADD_HOURS = 'Opening hours';
export const ADMIN_HUB_ADD_HOURS_HINT = 'When customers can visit and book';
export const ADMIN_HUB_ADD_PHOTOS = 'Shop photos';
export const ADMIN_HUB_ADD_PHOTOS_HINT = 'Inside, outside, chairs and cuts';
export const ADMIN_HUB_ADD_LOGO = 'Logo';
/** Matches HubUploader / hubAssets accepted types for LOGO. */
export const ADMIN_HUB_ADD_LOGO_HINT = 'JPG, PNG, WEBP, SVG or PDF';
export const ADMIN_HUB_ADD_TEXT = 'Text for your website';
export const ADMIN_HUB_ADD_TEXT_HINT = 'About your shop, Instagram and anything else';
export const ADMIN_HUB_ADD_PRICE = 'Price list';
export const ADMIN_HUB_ADD_PRICE_HINT = 'Photo or PDF of your current prices';
export const ADMIN_HUB_ADD_OTHER = 'Other files';
export const ADMIN_HUB_ADD_OTHER_HINT = 'Menus, flyers, anything useful';
export const ADMIN_HUB_ADD_TEAM = 'Team member';
export const ADMIN_HUB_ADD_TEAM_HINT = 'A barber on your booking page';
export const ADMIN_HUB_ADD_SERVICE = 'Service';
export const ADMIN_HUB_ADD_SERVICE_HINT = 'Name, price and duration';
export const ADMIN_HUB_ADD_PRODUCT = 'Product';
export const ADMIN_HUB_ADD_PRODUCT_HINT = 'Listed in your shop, not on sale yet';
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
export const ADMIN_HUB_COLOURS_DRAFT = 'Draft saved';
export const ADMIN_HUB_COLOURS_DRAFT_HINT = "Saved as a draft — send it when you're happy";
export const ADMIN_HUB_COLOURS_SENT_HINT = (date: string) => `Sent on ${date}. Message us to change it.`;
export const ADMIN_HUB_COLOURS_SENT_HINT_UNDATED = 'Sent. Message us to change it.';
export const ADMIN_HUB_COLOURS_MINUTE = 'Takes about a minute';
export const ADMIN_HUB_COLOURS_MAIN = 'Main';
export const ADMIN_HUB_COLOURS_ACCENT = 'Accent';
export const ADMIN_HUB_COLOURS_TITLE = 'Brand colours';
export const ADMIN_HUB_COLOURS_YOUR_LOGO = 'Your logo';
export const ADMIN_HUB_COLOURS_NO_LOGO = 'No logo uploaded yet';
export const ADMIN_HUB_COLOURS_UPLOAD = 'Upload logo';
export const ADMIN_HUB_COLOURS_FOUND_IN = 'Found in your logo';
export const ADMIN_HUB_COLOURS_PICK_SCREEN = 'Pick from your screen';
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
export const ADMIN_HUB_COLOURS_CONFIRM_TITLE = 'Send your logo and colours to KERSIVO?';
export const ADMIN_HUB_COLOURS_CONFIRM_BODY =
  "Once sent, your logo and brand colours are locked and we'll start building your site with them. You won't be able to change them here afterwards. If something needs fixing later, send us a message.";
export const ADMIN_HUB_COLOURS_CONFIRM_YES = 'Yes, send to KERSIVO';
export const ADMIN_HUB_COLOURS_CONFIRM_BACK = 'Go back and review';
export const ADMIN_HUB_COLOURS_SENDING = 'Sending…';
export const ADMIN_HUB_COLOURS_LOCKED_NOTICE = (date: string) =>
  `Sent to KERSIVO on ${date}. Your logo and colours are locked while we build your site. Need a change?`;
export const ADMIN_HUB_COLOURS_MESSAGE_US = 'Message us';
export const ADMIN_HUB_COLOURS_CHOOSE = "Not sure? Let KERSIVO choose — we'll pick from your logo.";
export const ADMIN_HUB_COLOURS_CHOOSE_SHORT = 'Let KERSIVO choose';
export const ADMIN_HUB_COLOURS_CHOOSE_LINK = 'Let KERSIVO choose';
export const ADMIN_HUB_COLOURS_SAVE = 'Save draft';
export const ADMIN_HUB_COLOURS_RESET = 'Reset to logo';
export const ADMIN_HUB_COLOURS_TOAST = "Thanks — we'll use these colours for your website.";

/** UK long date in Europe/London, e.g. 2 November 2026. */
export function formatBrandSubmittedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const ADMIN_HUB_COLOURS_READABILITY = 'Easy to read?';
export const ADMIN_HUB_COLOURS_CONTRAST_BUTTON = 'Button text on accent';
export const ADMIN_HUB_COLOURS_CONTRAST_MAIN = 'Main colour on background';
export const ADMIN_HUB_COLOURS_CONTRAST_PASS = 'easy to read';
export const ADMIN_HUB_COLOURS_CONTRAST_LOW = 'hard to read';
export const ADMIN_HUB_COLOURS_MAKE_ACCENT_DEEPER = 'Make accent deeper';
export const ADMIN_HUB_COLOURS_MAKE_ACCENT_LIGHTER = 'Make accent lighter';
export const ADMIN_HUB_COLOURS_MAKE_MAIN_DEEPER = 'Make main deeper';
export const ADMIN_HUB_COLOURS_MAKE_MAIN_LIGHTER = 'Make main lighter';
export const ADMIN_HUB_COLOURS_PICK_MAIN = 'Pick a main colour';
export const ADMIN_HUB_COLOURS_SWAP = 'Swap';
export const ADMIN_HUB_COLOURS_SWAP_LABEL = 'Swap main and accent';
export const ADMIN_HUB_COLOURS_NO_ACCENT = 'No accent';
export const ADMIN_HUB_COLOURS_UNDO = 'Undo';
export const ADMIN_HUB_COLOURS_ROLE_GROUP = 'Colour to edit';
export const ADMIN_HUB_COLOURS_SAME_HEX = "Main and accent can't be the same colour.";
export const ADMIN_HUB_COLOURS_HEX_USE = 'Use';
export const ADMIN_HUB_COLOURS_HEX_ERROR_CHARS = 'Use 0–9 and A–F only, like #1F6F6B.';
export const ADMIN_HUB_COLOURS_HEX_ERROR_LENGTH = 'Use 3 or 6 characters, like #1F6F6B.';
export const ADMIN_HUB_COLOURS_CHOOSE_PREFIX = 'Not sure?';
export const ADMIN_HUB_COLOURS_CHOOSE_SUFFIX = "— we'll pick from your logo.";
export const ADMIN_HUB_COLOURS_FIND_AGAIN = 'Find colours again';
export const ADMIN_HUB_COLOURS_EXTRACT_FAILED = "Couldn't read the colours in your logo.";
export const ADMIN_HUB_COLOURS_NEW_LOGO = 'You have a new logo. Find its colours?';
export const ADMIN_HUB_COLOURS_DRAFT_TOAST = 'Draft saved';
export const ADMIN_HUB_COLOURS_DRAFT_TOAST_FAILED = "Couldn't save your colours. Open Brand colours to try again.";
export const ADMIN_HUB_COLOURS_SAVE_FAILED = "Couldn't save. Your changes are still here — try again.";
export const ADMIN_HUB_COLOURS_SLIDER_WORDS = {
  depth: (pct: number) => `${pct >= 50 ? 'Deeper' : 'Lighter'}, ${pct} %`,
  intensity: (pct: number) => `${pct >= 50 ? 'Vivid' : 'Muted'}, ${pct} %`,
};
export const ADMIN_HUB_COLOURS_PALETTE = 'Palette';
export const ADMIN_HUB_COLOURS_SENT_ON = 'Sent on';
export const ADMIN_HUB_COLOURS_COPY_HEX = (hex: string) => `Copy ${hex}`;
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

/** Leaving an app window with unsaved edits (AppHost). */
export const ADMIN_HUB_LEAVE_TITLE = 'Leave without saving?';
export const ADMIN_HUB_LEAVE_BODY = "Your changes on this page haven't been saved yet.";
export const ADMIN_HUB_LEAVE_KEEP = 'Keep editing';
export const ADMIN_HUB_LEAVE_DISCARD = 'Discard changes';
