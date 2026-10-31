import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import {
  OPS_PREVIEW_REQUESTS_PATH,
  PREVIEW_OVER_CAP_MESSAGE,
  PREVIEW_REPLY_TO_EMAIL,
  PREVIEW_TURNAROUND_TEXT,
  formatPreviewExpiryDate,
  getPreviewNotifyEmail,
  isPreviewHubEnabled,
  previewPagePath,
} from './config';
import {
  HUB_ACK_BUTTON,
  HUB_ACK_HUB_READY,
  HUB_ACK_HUB_USES,
  HUB_ACK_NO_PAY,
  HUB_ACK_SUBJECT,
  HUB_ACK_WHEN_READY,
  HUB_OPS_FILES_EMAIL_BUTTON,
  HUB_OPS_FILES_EMAIL_INTRO,
  HUB_OPS_FILES_EMAIL_SUBJECT,
  HUB_OPS_MESSAGES_EMAIL_BUTTON,
  HUB_OPS_MESSAGES_EMAIL_INTRO,
  HUB_OPS_MESSAGES_EMAIL_SUBJECT,
  HUB_OPS_OPEN_HUB,
  HUB_OWNER_MESSAGE_EMAIL_BUTTON,
  HUB_OWNER_MESSAGE_EMAIL_INTRO,
  HUB_OWNER_MESSAGE_EMAIL_SUBJECT,
} from './hubCopy';
import { hubMessageExcerpt } from './hubMessageText';
import { currentBookingSystemLabel } from '@/lib/forms/currentBookingSystems';
import {
  FREE_PREVIEW_BARBER_COUNTS,
  FREE_PREVIEW_DOMAIN_OPTIONS,
  labelFor,
} from './intake';
import { displayWorkLinks, type DisplayWorkLink } from './workLinkNormalise';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain, mobile-friendly transactional body: one paragraph per block. */
function paragraphs(blocks: string[]): string {
  return blocks
    .map((block) => `<p style="margin:0 0 16px;line-height:1.5">${block}</p>`)
    .join('\n');
}

const SIGN_OFF = 'The KERSIVO team';

function greeting(firstName: string | null | undefined): string {
  return `Hi ${escapeHtml(firstName?.trim() || 'there')},`;
}

export type FreePreviewEmail = { to: string; subject: string; html: string; replyTo: string };

function hubButton(url: string, label: string): string {
  const safe = escapeHtml(url);
  return `<a href="${safe}" style="display:inline-block;padding:12px 18px;background:#d72638;color:#fff8ee;text-decoration:none;border-radius:8px;font-weight:600">${escapeHtml(label)}</a>`;
}

/** E1 — acknowledgement to the owner (spec §9). Hub flag on: HUB_SPEC.md §9.1. */
export function buildPreviewRequestAcknowledgementEmail(input: {
  to: string;
  firstName: string | null;
  shopName: string;
  overDailyCap?: boolean;
  publicToken?: string;
}): FreePreviewEmail {
  if (isPreviewHubEnabled() && input.publicToken) {
    const shop = escapeHtml(input.shopName);
    const hubUrl = previewPageUrl(input.publicToken);
    const intro = input.overDailyCap
      ? `Thanks for requesting a free website preview for ${shop}. ${escapeHtml(PREVIEW_OVER_CAP_MESSAGE)}`
      : `Thanks for requesting a free website preview for ${shop}. We design every preview individually, ${escapeHtml(PREVIEW_TURNAROUND_TEXT)}.`;
    return {
      to: input.to,
      subject: HUB_ACK_SUBJECT(input.shopName),
      replyTo: PREVIEW_REPLY_TO_EMAIL,
      html: paragraphs([
        greeting(input.firstName),
        intro,
        `${escapeHtml(HUB_ACK_HUB_READY)}<br>${hubButton(hubUrl, HUB_ACK_BUTTON)}`,
        escapeHtml(HUB_ACK_HUB_USES),
        escapeHtml(HUB_ACK_WHEN_READY),
        escapeHtml(HUB_ACK_NO_PAY),
        SIGN_OFF,
      ]),
    };
  }

  const shop = escapeHtml(input.shopName);
  return {
    to: input.to,
    subject: `We've received your preview request — ${input.shopName}`,
    replyTo: PREVIEW_REPLY_TO_EMAIL,
    html: paragraphs([
      greeting(input.firstName),
      input.overDailyCap
        ? `Thanks for requesting a free website preview for ${shop}. ${escapeHtml(PREVIEW_OVER_CAP_MESSAGE)} We'll design it individually for your shop and email you a private link.`
        : `Thanks for requesting a free website preview for ${shop}. We'll design it individually for your shop and email you a private link, ${escapeHtml(PREVIEW_TURNAROUND_TEXT)}.`,
      "If you have photos, a logo or anything you'd like us to include, just reply to this email.",
      "There's nothing to pay and no card needed. You only pay if you decide to launch.",
      SIGN_OFF,
    ]),
  };
}

export type PreviewRequestInternalEmailInput = {
  id: string;
  publicToken?: string;
  firstName: string | null;
  email: string;
  shopName: string;
  townCity: string;
  bookingPageUrl: string | null;
  instagramUrl: string | null;
  googleListingUrl: string | null;
  websiteUrl: string | null;
  workLinks?: unknown;
  barberCount: string | null;
  currentBookingSystem: string | null;
  hasOwnDomain: string | null;
  notes: string | null;
  marketingOptIn: boolean;
  entryPoint: string | null;
  createdAt: Date;
  overDailyCap?: boolean;
};

export function opsPreviewRequestUrl(id: string): string {
  return `${getPublicSiteUrl()}${OPS_PREVIEW_REQUESTS_PATH}/${encodeURIComponent(id)}`;
}

function workLinkEmailCell(link: DisplayWorkLink): string {
  if (link.url) {
    const safe = escapeHtml(link.url);
    const extraLabel =
      link.handle && link.handle !== link.url
        ? link.handle
        : link.value && link.value !== link.url
          ? link.value
          : '';
    const extra = extraLabel ? ` (${escapeHtml(extraLabel)})` : '';
    return `<a href="${safe}">${safe}</a>${extra}`;
  }
  return escapeHtml(link.value || '—');
}

function workLinkEmailRows(input: PreviewRequestInternalEmailInput): Array<[string, string]> {
  const links = displayWorkLinks(input);
  if (!links.length) return [['Links', 'No links provided']];
  return links.map((link) => [link.label, workLinkEmailCell(link)]);
}

/** E2 — internal notification with every submitted field and the ops link (spec §9). */
export function buildPreviewRequestInternalEmail(input: PreviewRequestInternalEmailInput): FreePreviewEmail {
  const rows: Array<[string, string, 'html' | 'text']> = [
    ['Shop', input.shopName, 'text'],
    ['Town / city', input.townCity, 'text'],
    ['First name', input.firstName ?? '—', 'text'],
    ['Email', input.email, 'text'],
    ...workLinkEmailRows(input).map(([label, html]) => [label, html, 'html'] as [string, string, 'html']),
    ['Barbers', labelFor(FREE_PREVIEW_BARBER_COUNTS, input.barberCount), 'text'],
    ['Booking system', currentBookingSystemLabel(input.currentBookingSystem), 'text'],
    ['Own domain', labelFor(FREE_PREVIEW_DOMAIN_OPTIONS, input.hasOwnDomain), 'text'],
    ['Notes', input.notes ?? '—', 'text'],
    ['Marketing opt-in', input.marketingOptIn ? 'Yes' : 'No', 'text'],
    ['Entry point', input.entryPoint ?? '—', 'text'],
    ['Requested at', input.createdAt.toISOString(), 'text'],
    ...(input.overDailyCap
      ? ([['Daily cap', 'Over the cap: owner told it may take up to 3 working days', 'text']] as Array<
          [string, string, 'text']
        >)
      : []),
  ];
  const opsUrl = opsPreviewRequestUrl(input.id);
  const hubLink =
    isPreviewHubEnabled() && input.publicToken
      ? ` · <a href="${escapeHtml(previewPageUrl(input.publicToken))}">${escapeHtml(HUB_OPS_OPEN_HUB)}</a>`
      : '';
  return {
    to: getPreviewNotifyEmail(),
    subject: `New preview request: ${input.shopName}, ${input.townCity}`,
    replyTo: input.email,
    html: `<p>A new free preview request has been received.</p>
<p><a href="${escapeHtml(opsUrl)}">Open it in KERSIVO Ops</a>${hubLink}</p>
<table cellpadding="4">${rows
      .map(([label, value, kind]) => {
        const cell = kind === 'html' ? value : escapeHtml(value);
        return `<tr><th align="left" valign="top">${escapeHtml(label)}</th><td>${cell}</td></tr>`;
      })
      .join('')}</table>`,
  };
}

export type PreviewRequestDetailsEmailInput = {
  id: string;
  email: string;
  shopName: string;
  townCity: string;
  barberCount?: string;
  currentBookingSystem?: string;
  hasOwnDomain?: string;
  firstName?: string;
  notes?: string;
  marketingOptIn?: boolean;
};

/** Short follow-up to E2 when the owner adds optional details after sending the form. Only what changed. */
export function buildPreviewRequestDetailsInternalEmail(input: PreviewRequestDetailsEmailInput): FreePreviewEmail {
  const rows: Array<[string, string]> = [];
  if (input.barberCount) rows.push(['Barbers', labelFor(FREE_PREVIEW_BARBER_COUNTS, input.barberCount)]);
  if (input.currentBookingSystem) rows.push(['Booking system', currentBookingSystemLabel(input.currentBookingSystem)]);
  if (input.hasOwnDomain) rows.push(['Own domain', labelFor(FREE_PREVIEW_DOMAIN_OPTIONS, input.hasOwnDomain)]);
  if (input.firstName) rows.push(['First name', input.firstName]);
  if (input.notes) rows.push(['Notes', input.notes]);
  if (input.marketingOptIn !== undefined) rows.push(['Marketing opt-in', input.marketingOptIn ? 'Yes' : 'No']);
  const opsUrl = opsPreviewRequestUrl(input.id);
  return {
    to: getPreviewNotifyEmail(),
    subject: `Preview details added: ${input.shopName}, ${input.townCity}`,
    replyTo: input.email,
    html: `<p>${escapeHtml(input.shopName)} (${escapeHtml(input.email)}) added details to their preview request.</p>
<p><a href="${escapeHtml(opsUrl)}">Open it in KERSIVO Ops</a></p>
<table cellpadding="4">${rows
      .map(
        ([label, value]) =>
          `<tr><th align="left" valign="top">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      )
      .join('')}</table>`,
  };
}

export function previewPageUrl(token: string): string {
  return `${getPublicSiteUrl()}${previewPagePath(token)}`;
}

function linkBlock(url: string): string {
  const safe = escapeHtml(url);
  return `<a href="${safe}">${safe}</a>`;
}

export type PreviewLinkEmailInput = {
  to: string;
  firstName: string | null;
  shopName: string;
  previewUrl: string;
  expiresAt: Date;
};

/** E3 — preview ready (spec §9). */
export function buildPreviewReadyEmail(input: PreviewLinkEmailInput): FreePreviewEmail {
  const shop = escapeHtml(input.shopName);
  return {
    to: input.to,
    subject: `Your website preview for ${input.shopName} is ready`,
    replyTo: PREVIEW_REPLY_TO_EMAIL,
    html: paragraphs([
      greeting(input.firstName),
      `Your private website preview for ${shop} is ready:<br>${linkBlock(input.previewUrl)}`,
      'Open it on your phone, try the booking flow and see it the way your clients would. Bookings on the preview are for testing only — no payments are taken.',
      "Want something changed? Use 'Request changes' on the preview or reply to this email. One round of changes is included before you decide.",
      "Happy with it? Launch it for £39/month per location — no setup fee, 0% KERSIVO commission (Stripe fees apply). We'll connect your domain, and nothing goes live until you approve it.",
      `Your preview link works until ${escapeHtml(formatPreviewExpiryDate(input.expiresAt))}.`,
      SIGN_OFF,
    ]),
  };
}

/** E4 — preview updated after changes (spec §9). */
export function buildPreviewUpdatedEmail(input: PreviewLinkEmailInput): FreePreviewEmail {
  return {
    to: input.to,
    subject: `We've updated your ${input.shopName} preview`,
    replyTo: PREVIEW_REPLY_TO_EMAIL,
    html: paragraphs([
      greeting(input.firstName),
      `We've made your changes. Take another look:<br>${linkBlock(input.previewUrl)}`,
      `If it's right, you can launch it from the preview for £39/month. Your link works until ${escapeHtml(formatPreviewExpiryDate(input.expiresAt))}.`,
      SIGN_OFF,
    ]),
  };
}

/** Internal notification: the owner asked for changes on their preview (spec §6). */
export function buildPreviewChangesRequestedInternalEmail(input: {
  id: string;
  email: string;
  shopName: string;
  townCity: string;
  changesText: string;
}): FreePreviewEmail {
  const opsUrl = opsPreviewRequestUrl(input.id);
  return {
    to: getPreviewNotifyEmail(),
    subject: `Preview changes requested: ${input.shopName}, ${input.townCity}`,
    replyTo: input.email,
    html: `<p>${escapeHtml(input.shopName)} (${escapeHtml(input.email)}) asked for changes to their preview.</p>
<p><a href="${escapeHtml(opsUrl)}">Open it in KERSIVO Ops</a></p>
<blockquote style="white-space:pre-wrap;margin:0;padding:8px 12px;border-left:3px solid #ccc">${escapeHtml(input.changesText)}</blockquote>`,
  };
}

/** One-click "no thanks" page: /preview/{token}/no-thanks (spec §9). */
export function previewNoThanksUrl(token: string): string {
  return `${previewPageUrl(token)}/no-thanks`;
}

function noThanksLink(url: string): string {
  return `<a href="${escapeHtml(url)}">Click here</a>`;
}

export type PreviewFollowupEmailInput = {
  to: string;
  firstName: string | null;
  shopName: string;
  previewUrl: string;
  noThanksUrl: string;
};

/** E5 — follow-up after the preview was sent (spec §9). */
export function buildPreviewFollowupEmail(input: PreviewFollowupEmailInput): FreePreviewEmail {
  return {
    to: input.to,
    subject: `Had a chance to look at your ${input.shopName} preview?`,
    replyTo: PREVIEW_REPLY_TO_EMAIL,
    html: paragraphs([
      greeting(input.firstName),
      `Just checking you saw the website preview we made for ${escapeHtml(input.shopName)}:<br>${linkBlock(input.previewUrl)}`,
      "If something isn't quite right, tell us and we'll change it.",
      `Not for you? No problem — ${noThanksLink(input.noThanksUrl)} and we won't email you about it again.`,
      SIGN_OFF,
    ]),
  };
}

/** E6 — expiry reminder (spec §9). */
export function buildPreviewExpiryReminderEmail(
  input: PreviewFollowupEmailInput & { expiresAt: Date },
): FreePreviewEmail {
  const expiryDate = formatPreviewExpiryDate(input.expiresAt);
  return {
    to: input.to,
    subject: `Your ${input.shopName} preview expires on ${expiryDate}`,
    replyTo: PREVIEW_REPLY_TO_EMAIL,
    html: paragraphs([
      greeting(input.firstName),
      `Your private website preview for ${escapeHtml(input.shopName)} will expire on ${escapeHtml(expiryDate)}:<br>${linkBlock(input.previewUrl)}`,
      "Want to launch it, or need more time? Reply to this email and we'll help.",
      `${noThanksLink(input.noThanksUrl)} if you'd rather we didn't email you about it again.`,
      SIGN_OFF,
    ]),
  };
}

const HUB_FILE_KIND_LABELS: Record<string, string> = {
  LOGO: 'Logo',
  SHOP_PHOTO: 'Shop photos',
  TEAM_PHOTO: 'Team photos',
  PRICE_LIST: 'Price list',
  MESSAGE_ATTACHMENT: 'Message attachments',
  CHANGE_ATTACHMENT: 'Change attachments',
  OTHER: 'Other files',
};

/** Ops digest when the owner adds files (HUB_SPEC.md §5). At most one per request per 15 minutes. */
export function buildHubFilesAddedInternalEmail(input: {
  id: string;
  shopName: string;
  counts: Array<{ kind: string; count: number }>;
}): FreePreviewEmail {
  const opsUrl = opsPreviewRequestUrl(input.id);
  const rows = input.counts
    .map((row) => {
      const label = HUB_FILE_KIND_LABELS[row.kind] ?? row.kind;
      return `<tr><th align="left">${escapeHtml(label)}</th><td>${row.count}</td></tr>`;
    })
    .join('');
  return {
    to: getPreviewNotifyEmail(),
    subject: HUB_OPS_FILES_EMAIL_SUBJECT(input.shopName),
    replyTo: PREVIEW_REPLY_TO_EMAIL,
    html: `<p>${escapeHtml(HUB_OPS_FILES_EMAIL_INTRO(input.shopName))}</p>
<table cellpadding="4">${rows}</table>
<p><a href="${escapeHtml(opsUrl)}">${escapeHtml(HUB_OPS_FILES_EMAIL_BUTTON)}</a></p>`,
  };
}

/** Immediate transactional email when KERSIVO writes in the hub thread (HUB_SPEC.md §5). */
export function buildHubMessageFromKersivoEmail(input: {
  to: string;
  firstName: string | null;
  shopName: string;
  publicToken: string;
  body: string;
}): FreePreviewEmail {
  const replyUrl = `${previewPageUrl(input.publicToken)}/messages`;
  const excerpt = escapeHtml(hubMessageExcerpt(input.body));
  return {
    to: input.to,
    subject: HUB_OWNER_MESSAGE_EMAIL_SUBJECT(input.shopName),
    replyTo: PREVIEW_REPLY_TO_EMAIL,
    html: paragraphs([
      greeting(input.firstName),
      escapeHtml(HUB_OWNER_MESSAGE_EMAIL_INTRO(input.shopName)),
      `<span style="white-space:pre-wrap">${excerpt}</span>`,
      hubButton(replyUrl, HUB_OWNER_MESSAGE_EMAIL_BUTTON),
      SIGN_OFF,
    ]),
  };
}

/** Ops digest when the owner sends messages (HUB_SPEC.md §5). At most one per request per 15 minutes. */
export function buildHubMessagesAddedInternalEmail(input: {
  id: string;
  shopName: string;
  count: number;
}): FreePreviewEmail {
  const opsUrl = `${opsPreviewRequestUrl(input.id)}?tab=messages`;
  return {
    to: getPreviewNotifyEmail(),
    subject: HUB_OPS_MESSAGES_EMAIL_SUBJECT(input.count, input.shopName),
    replyTo: PREVIEW_REPLY_TO_EMAIL,
    html: `<p>${escapeHtml(HUB_OPS_MESSAGES_EMAIL_INTRO(input.count, input.shopName))}</p>
<p><a href="${escapeHtml(opsUrl)}">${escapeHtml(HUB_OPS_MESSAGES_EMAIL_BUTTON)}</a></p>`,
  };
}
