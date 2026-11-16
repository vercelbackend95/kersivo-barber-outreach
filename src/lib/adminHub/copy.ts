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
/** Build tile line once the owner has subscribed before seeing the preview: the stage's own line, marked as paid. */
export const ADMIN_HUB_BUILD_COPY_SUBSCRIBED = (stageCopy: string) => `Subscription active. ${stageCopy}`;
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
export const ADMIN_HUB_COLOURS_HEX_LABEL = 'Hex';
export const ADMIN_HUB_COLOURS_FINE_TUNE_MAIN = 'Fine-tune main colour';
export const ADMIN_HUB_COLOURS_FINE_TUNE_ACCENT = 'Fine-tune accent colour';
export const ADMIN_HUB_COLOURS_BG = 'Website background';
export const ADMIN_HUB_COLOURS_DARK = 'Dark';
export const ADMIN_HUB_COLOURS_LIGHT = 'Light';
export const ADMIN_HUB_COLOURS_LOOKS = 'How it looks on your site';
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
export const ADMIN_HUB_COLOURS_PALETTE = 'Palette';
export const ADMIN_HUB_COLOURS_SENT_ON = 'Sent on';
export const ADMIN_HUB_COLOURS_COPY_HEX = (hex: string) => `Copy ${hex}`;
export const ADMIN_HUB_COLOURS_BW =
  'Your logo is black and white — pick a colour or let us choose';
export const ADMIN_HUB_COLOURS_BOOK = 'Book now';
export const ADMIN_HUB_COLOURS_PRICES = 'Our prices';
export const ADMIN_HUB_COLOURS_EMPTY_ROLE = 'Not set';
export const ADMIN_HUB_COLOURS_SOURCE_LOGO = 'From your logo';
export const ADMIN_HUB_COLOURS_SOURCE_MANUAL = 'Picked by you';
export const ADMIN_HUB_COLOURS_SOURCE_KERSIVO = "KERSIVO's choice";
export const ADMIN_HUB_COLOURS_SOURCE_LABEL = 'Source';
export const ADMIN_HUB_COLOURS_SENT_AT = 'Sent';
export const ADMIN_HUB_COLOURS_COPY = 'Copy';
export const ADMIN_HUB_COLOURS_COPIED = 'Copied';

/* Brand colours picker */
export const ADMIN_HUB_COLOURS_AREA_LABEL = 'Lightness and intensity';
export const ADMIN_HUB_COLOURS_AREA_VALUE = (light: number, vivid: number) => `${light} % light, ${vivid} % vivid`;
export const ADMIN_HUB_COLOURS_AREA_HELP = 'Arrow keys move the colour: up and down for lighter or deeper, left and right for muted or vivid.';
export const ADMIN_HUB_COLOURS_STRIPES_MAIN = (tone: 'dark' | 'light') => `Striped colours are hard to see on a ${tone} background`;
export const ADMIN_HUB_COLOURS_STRIPES_ACCENT = 'Striped colours make Book button text hard to read';
export const ADMIN_HUB_COLOURS_HUE = 'Hue';
export const ADMIN_HUB_COLOURS_HUE_VALUE = (name: string, degrees: number) => `${name}, ${degrees}°`;
export const ADMIN_HUB_COLOURS_SHADES = 'Shades';
export const ADMIN_HUB_COLOURS_SHADE = (name: string, hex: string) => `${name} ${hex}`;
export const ADMIN_HUB_COLOURS_SUGGEST = 'Goes with your main colour';
export const ADMIN_HUB_COLOURS_SUGGEST_HINT = 'Easy to read and stands out';
export const ADMIN_HUB_COLOURS_PAIRS = 'Classic barbershop pairs';
export const ADMIN_HUB_COLOURS_PAIRS_HINT = 'Sets main, accent and background in one tap';
export const ADMIN_HUB_COLOURS_PAIR_LABEL = (label: string, tone: 'dark' | 'light') => `${label}, ${tone} background`;
export const ADMIN_HUB_COLOURS_UNDO_DONE = 'Change undone';
export const ADMIN_HUB_COLOURS_VISION = 'See it as';
export const ADMIN_HUB_COLOURS_VISION_NORMAL = 'Normal';
export const ADMIN_HUB_COLOURS_VISION_CB = 'Colour blind';
export const ADMIN_HUB_COLOURS_VISION_GREY = 'No colour';
export const ADMIN_HUB_COLOURS_VISION_NOTE = {
  normal: '',
  deuteranopia: 'How visitors with red-green colour blindness see your colours.',
  grey: 'Without colour, only light and dark are left. Good contrast still reads clearly.',
} as const;
export const ADMIN_HUB_COLOURS_GUIDE_NOTE =
  "This is a guide, not your final design. We'll build your website in these colours.";

/* "Easy to read?" guide */
export const ADMIN_HUB_GUIDE_EMPTY = 'Pick a main colour and we will check it for you.';
export const ADMIN_HUB_GUIDE_ALL_CLEAR = 'Everything is easy to read';
export const ADMIN_HUB_GUIDE_TO_FIX = (n: number) => (n === 1 ? '1 thing to fix' : `${n} things to fix`);
export const ADMIN_HUB_GUIDE_TIPS = (n: number) => (n === 1 ? '1 tip' : `${n} tips`);
export const ADMIN_HUB_GUIDE_SUMMARY_CLEAR = 'Your colours pass the WCAG 2.2 readability checks for text and buttons.';
export const ADMIN_HUB_GUIDE_SUMMARY_FIX = 'Some visitors will struggle to read part of your site. One tap fixes it and keeps your colour.';
export const ADMIN_HUB_GUIDE_STATE = { pass: 'Easy to read', fail: 'Hard to read', tip: 'Worth a look', tipOk: 'Looks good' } as const;
export const ADMIN_HUB_GUIDE_RATIO = (ratio: string, needs: string) => `Contrast ${ratio} · needs ${needs}`;
export const ADMIN_HUB_GUIDE_CHECKS = {
  button: {
    title: 'Book button text',
    pass: 'The words on your Book button are easy to read.',
    fail: 'The words on your Book button are hard to read. Buttons need strong contrast so every customer can book.',
  },
  main: {
    title: 'Main colour on your background',
    pass: (tone: 'dark' | 'light') => `Your main colour stands out on the ${tone} background.`,
    fail: (tone: 'dark' | 'light') => `Your main colour blends into the ${tone} background, so headings and blocks in it fade away.`,
  },
  accentBg: {
    title: 'Accent details on your background',
    pass: 'Small accent details, like icons and links, are easy to spot.',
    fail: 'Small accent details, like icons and links, may be hard to spot on the background.',
  },
  distinct: {
    title: 'Book button stands out',
    pass: 'Your accent is different enough from your main colour, so the Book button catches the eye.',
    fail: 'Your accent is very close to your main colour, so the Book button may get lost in the header.',
  },
  colourBlind: {
    title: 'Colour-blind friendly',
    pass: 'Main and accent stay different for visitors with red-green colour blindness.',
    fail: 'With red-green colour blindness your main and accent look almost the same.',
  },
} as const;
export const ADMIN_HUB_GUIDE_TRY = (name: string) => `Try ${name.toLowerCase()}`;
export const ADMIN_HUB_GUIDE_TONE = (tone: 'dark' | 'light') => `Or use a ${tone} background`;
export const ADMIN_HUB_GUIDE_FIX_ALL = 'Fix all';
export const ADMIN_HUB_GUIDE_FIX_TO = (hex: string) => `Changes it to ${hex}`;
export const ADMIN_HUB_GUIDE_HOW = 'How we check';
export const ADMIN_HUB_GUIDE_HOW_BODY =
  'We compare how light and dark your colours are, using WCAG 2.2, the accessibility standard for websites. Text on buttons needs a contrast of at least 4.5:1. Colour blocks and large headings need 3:1. Tips are not required, but they help more customers find and book.';

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
export const ADMIN_HUB_CHANGES_EMPTY_HINT =
  'Spotted something on your preview? Use Suggest and tell us what to change.';
export const ADMIN_HUB_CHANGES_FILTER = 'Filter changes';
export const ADMIN_HUB_CHANGES_FILTER_EMPTY = 'Nothing here yet.';
export const ADMIN_HUB_CHANGES_SHOW_ALL = 'Show all changes';
export const ADMIN_HUB_CHANGES_READY = (drafts: number) =>
  drafts === 1 ? '1 draft ready to send' : `${drafts} drafts ready to send`;
export const ADMIN_HUB_CHANGES_NOTHING_TO_SEND = 'No drafts to send yet';
export const ADMIN_HUB_WEBSITE_BOOKING_ADDRESS = 'Booking preview';

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
