import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREVIEW_OVER_CAP_MESSAGE, PREVIEW_TURNAROUND_TEXT } from './config';
import { HUB_ACK_BUTTON, HUB_ACK_SUBJECT, HUB_OPS_OPEN_HUB } from './hubCopy';
import {
  buildHubFilesAddedInternalEmail,
  buildHubMessageFromKersivoEmail,
  buildHubLaunchApprovedInternalEmail,
  buildHubMessagesAddedInternalEmail,
  buildHubSiteLiveEmail,
  buildHubSubscribedEmail,
  buildPreviewChangesRequestedInternalEmail,
  buildPreviewRequestAcknowledgementEmail,
  buildPreviewRequestInternalEmail,
  buildPreviewUpdatedEmail,
} from './emails';
import {
  HUB_OPS_FILES_EMAIL_SUBJECT,
  HUB_OWNER_MESSAGE_EMAIL_BUTTON,
  HUB_OWNER_MESSAGE_EMAIL_SUBJECT,
} from './hubCopy';

const HUB_TOKEN = 'A'.repeat(43);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('free preview emails', () => {
  it('E1 uses the spec subject, turnaround from config, reply-to and sign-off', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'false');
    const email = buildPreviewRequestAcknowledgementEmail({
      to: 'sam@example.com',
      firstName: null,
      shopName: 'Sharp & Co',
    });
    expect(email.subject).toBe("We've received your preview request — Sharp & Co");
    expect(email.replyTo).toBe('hello@kersivo.co.uk');
    expect(email.html).toContain('Hi there,');
    expect(email.html).toContain('free website preview for Sharp &amp; Co');
    expect(email.html).toContain(PREVIEW_TURNAROUND_TEXT);
    expect(email.html).toContain('You only pay if you decide to launch.');
    expect(email.html).toContain('The KERSIVO team');
    expect(email.html).not.toMatch(/\b\d+ working days\b/);
  });

  it('E1 over the daily cap gives the longer wait instead of the usual turnaround', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'false');
    const email = buildPreviewRequestAcknowledgementEmail({
      to: 'sam@example.com',
      firstName: null,
      shopName: 'Sharp Cuts',
      overDailyCap: true,
    });
    expect(email.html).toContain(
      "We've received your request. Because each preview is built by hand, yours may take up to 3 working days.",
    );
    expect(email.html).not.toContain(PREVIEW_TURNAROUND_TEXT);
  });

  it('E2 lists the fields, escapes input and links to the ops detail view', () => {
    const email = buildPreviewRequestInternalEmail({
      id: 'req_1',
      firstName: '<b>Sam</b>',
      email: 'sam@example.com',
      shopName: 'Sharp Cuts',
      townCity: 'Leeds',
      bookingPageUrl: null,
      instagramUrl: 'https://instagram.com/sharpcuts',
      googleListingUrl: null,
      websiteUrl: null,
      barberCount: '2-3',
      currentBookingSystem: 'booksy',
      hasOwnDomain: 'not_sure',
      notes: null,
      marketingOptIn: true,
      entryPoint: 'pricing',
      createdAt: new Date('2026-10-29T10:00:00Z'),
    });
    expect(email.subject).toBe('New preview request: Sharp Cuts, Leeds');
    expect(email.to).toBe('hello@kersivo.co.uk');
    expect(email.replyTo).toBe('sam@example.com');
    expect(email.html).toContain('/ops/preview-requests/req_1');
    expect(email.html).toContain('&lt;b&gt;Sam&lt;/b&gt;');
    expect(email.html).toContain('2–3');
    expect(email.html).toContain('Booksy');
    expect(email.html).toContain('Not sure');
    expect(email.html).toContain('<a href="https://www.instagram.com/sharpcuts">https://www.instagram.com/sharpcuts</a>');
    expect(email.html).toContain('(sharpcuts)');
  });

  it('E2 lists each workLinks platform with a clickable URL when we have one', () => {
    const email = buildPreviewRequestInternalEmail({
      id: 'req_2',
      firstName: 'Sam',
      email: 'sam@example.com',
      shopName: 'Sharp Cuts',
      townCity: 'Leeds',
      bookingPageUrl: null,
      instagramUrl: null,
      googleListingUrl: null,
      websiteUrl: null,
      workLinks: [
        { platform: 'booksy', value: 'https://booksy.com/en-gb/1', url: 'https://booksy.com/en-gb/1' },
        { platform: 'google', value: 'Northside Barbers, Leeds', url: null },
        { platform: 'tiktok', value: 'shop', url: 'https://www.tiktok.com/@shop' },
      ],
      barberCount: '2-3',
      currentBookingSystem: 'booksy',
      hasOwnDomain: 'not_sure',
      notes: null,
      marketingOptIn: false,
      entryPoint: null,
      createdAt: new Date('2026-10-29T10:00:00Z'),
    });
    expect(email.html).toContain('<th align="left" valign="top">Booksy</th>');
    expect(email.html).toContain('<a href="https://booksy.com/en-gb/1">https://booksy.com/en-gb/1</a>');
    expect(email.html).toContain('Northside Barbers, Leeds');
    expect(email.html).toContain('<a href="https://www.tiktok.com/@shop">https://www.tiktok.com/@shop</a>');
    expect(email.html).not.toContain('Work links');
  });

  it('E2 says clearly when no links or optional answers came with the request', () => {
    const email = buildPreviewRequestInternalEmail({
      id: 'req_3',
      firstName: null,
      email: 'sam@example.com',
      shopName: 'Sharp Cuts',
      townCity: 'Leeds',
      bookingPageUrl: null,
      instagramUrl: null,
      googleListingUrl: null,
      websiteUrl: null,
      workLinks: null,
      barberCount: null,
      currentBookingSystem: null,
      hasOwnDomain: null,
      notes: null,
      marketingOptIn: false,
      entryPoint: null,
      createdAt: new Date('2026-10-29T10:00:00Z'),
    });
    expect(email.html).toContain('No links provided');
    expect(email.html).toContain('<th align="left" valign="top">Barbers</th><td>—</td>');
  });

  it('E1 with the hub flag on uses §9.1 copy, the hub button and a snapshot', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
    const email = buildPreviewRequestAcknowledgementEmail({
      to: 'sam@example.com',
      firstName: 'Sam',
      shopName: 'Sharp Cuts',
      publicToken: HUB_TOKEN,
    });
    expect(email.subject).toBe(HUB_ACK_SUBJECT('Sharp Cuts'));
    expect(email.html).toContain(PREVIEW_TURNAROUND_TEXT);
    expect(email.html).toContain(HUB_ACK_BUTTON);
    expect(email.html).toContain(`/preview/${HUB_TOKEN}`);
    expect(email.html).toContain('We design every preview individually');
    expect(email.html).not.toContain('email you a private link');
    expect(email.html).toMatchSnapshot();
  });

  it('E1 hub over-cap keeps PREVIEW_OVER_CAP_MESSAGE in the second paragraph', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
    const email = buildPreviewRequestAcknowledgementEmail({
      to: 'sam@example.com',
      firstName: null,
      shopName: 'Sharp Cuts',
      overDailyCap: true,
      publicToken: HUB_TOKEN,
    });
    expect(email.html).toContain(PREVIEW_OVER_CAP_MESSAGE);
    expect(email.html).not.toContain(PREVIEW_TURNAROUND_TEXT);
    expect(email.html).toContain(`/preview/${HUB_TOKEN}`);
  });

  it('E2 with the hub flag on adds the hub link next to the ops link', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
    const email = buildPreviewRequestInternalEmail({
      id: 'req_1',
      publicToken: HUB_TOKEN,
      firstName: 'Sam',
      email: 'sam@example.com',
      shopName: 'Sharp Cuts',
      townCity: 'Leeds',
      bookingPageUrl: null,
      instagramUrl: null,
      googleListingUrl: null,
      websiteUrl: null,
      barberCount: null,
      currentBookingSystem: null,
      hasOwnDomain: null,
      notes: null,
      marketingOptIn: false,
      entryPoint: null,
      createdAt: new Date('2026-10-29T10:00:00Z'),
    });
    expect(email.html).toContain('/ops/preview-requests/req_1');
    expect(email.html).toContain(`/preview/${HUB_TOKEN}`);
    expect(email.html).toContain(HUB_OPS_OPEN_HUB);
  });

  it('E1 with the hub flag off stays byte-identical even when a token is passed', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'false');
    const email = buildPreviewRequestAcknowledgementEmail({
      to: 'sam@example.com',
      firstName: null,
      shopName: 'Sharp & Co',
      publicToken: HUB_TOKEN,
    });
    expect(email.subject).toBe("We've received your preview request — Sharp & Co");
    expect(email.html).not.toContain(HUB_ACK_BUTTON);
    expect(email.html).not.toContain(`/preview/${HUB_TOKEN}`);
  });

  it('ops files digest lists kinds and links to the request', () => {
    const email = buildHubFilesAddedInternalEmail({
      id: 'req_1',
      shopName: 'Sharp Cuts',
      counts: [
        { kind: 'SHOP_PHOTO', count: 6 },
        { kind: 'LOGO', count: 1 },
      ],
    });
    expect(email.subject).toBe(HUB_OPS_FILES_EMAIL_SUBJECT('Sharp Cuts'));
    expect(email.html).toContain('Shop photos');
    expect(email.html).toContain('>6<');
    expect(email.html).toContain('/ops/preview-requests/req_1');
    expect(email.html).toContain('Open in KERSIVO Ops');
  });

  it('KERSIVO → owner message email is transactional, escaped, and links to the hub thread', () => {
    const email = buildHubMessageFromKersivoEmail({
      to: 'sam@example.com',
      firstName: 'Sam',
      shopName: 'Sharp Cuts',
      publicToken: HUB_TOKEN,
      body: 'We can reopen it. <img src=x onerror=alert(1)>',
    });
    expect(email.subject).toBe(HUB_OWNER_MESSAGE_EMAIL_SUBJECT('Sharp Cuts'));
    expect(email.to).toBe('sam@example.com');
    expect(email.replyTo).toBe('hello@kersivo.co.uk');
    expect(email.html).toContain(HUB_OWNER_MESSAGE_EMAIL_BUTTON);
    expect(email.html).toContain(`/preview/${HUB_TOKEN}/messages`);
    expect(email.html).toContain('We can reopen it.');
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toMatchSnapshot();
  });

  it('E4 stays the same when the hub flag is off, even if items are passed', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'false');
    const email = buildPreviewUpdatedEmail({
      to: 'sam@example.com',
      firstName: 'Sam',
      shopName: 'Sharp Cuts',
      previewUrl: 'https://kersivo.co.uk/preview/abc',
      expiresAt: new Date('2026-12-01T10:00:00Z'),
      completedItems: [{ page: 'HOME', body: 'Bigger logo', status: 'DONE', opsNote: null }],
    });
    expect(email.subject).toBe("We've updated your Sharp Cuts preview");
    expect(email.html).toContain("We've made your changes.");
    expect(email.html).not.toContain('Bigger logo');
    expect(email.html).not.toContain("Here's what we did");
  });

  it('E4 lists Done and Not possible items when the hub flag is on', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
    const email = buildPreviewUpdatedEmail({
      to: 'sam@example.com',
      firstName: 'Sam',
      shopName: 'Sharp Cuts',
      previewUrl: 'https://kersivo.co.uk/preview/abc',
      expiresAt: new Date('2026-12-01T10:00:00Z'),
      completedItems: [
        { page: 'HOME', body: 'Bigger logo', status: 'DONE', opsNote: null },
        { page: 'SERVICES', body: 'New type', status: 'NOT_POSSIBLE', opsNote: 'Type is already set.' },
      ],
    });
    expect(email.html).toContain('Bigger logo');
    expect(email.html).toContain('Not possible');
    expect(email.html).toContain('Type is already set.');
  });

  it('changes email lists items only when the hub flag is on', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'false');
    const off = buildPreviewChangesRequestedInternalEmail({
      id: 'req_1',
      email: 'sam@example.com',
      shopName: 'Sharp Cuts',
      townCity: 'Leeds',
      changesText: 'Please fix the logo',
      items: [{ page: 'HOME', body: 'Bigger logo' }],
    });
    expect(off.html).toContain('Please fix the logo');
    expect(off.html).not.toContain('Home: Bigger logo');
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
    const on = buildPreviewChangesRequestedInternalEmail({
      id: 'req_1',
      email: 'sam@example.com',
      shopName: 'Sharp Cuts',
      townCity: 'Leeds',
      changesText: 'Please fix the logo',
      items: [{ page: 'HOME', body: 'Bigger logo' }],
    });
    expect(on.html).toContain('Home: Bigger logo');
  });

  it('owner → ops message digest uses the count and ops messages tab', () => {
    const email = buildHubMessagesAddedInternalEmail({
      id: 'req_1',
      shopName: 'Sharp Cuts',
      count: 3,
    });
    expect(email.subject).toBe('3 new messages from Sharp Cuts');
    expect(email.html).toContain('/ops/preview-requests/req_1?tab=messages');
    expect(buildHubMessagesAddedInternalEmail({ id: 'req_1', shopName: 'Sharp Cuts', count: 1 }).subject).toBe(
      '1 new message from Sharp Cuts',
    );
  });

  it('subscribed email points at the launch checklist', () => {
    const email = buildHubSubscribedEmail({
      to: 'sam@example.com',
      firstName: 'Sam',
      shopName: 'Sharp Cuts',
      checklistUrl: 'https://kersivo.co.uk/admin/preview-launch',
    });
    expect(email.subject).toBe("Let's put Sharp Cuts live");
    expect(email.html).toContain('/admin/preview-launch');
    expect(email.html).toContain('Open your launch checklist');
  });

  it('launch-approved ops email uses Ready to launch', () => {
    const email = buildHubLaunchApprovedInternalEmail({ id: 'req_1', shopName: 'Sharp Cuts' });
    expect(email.subject).toBe('Ready to launch: Sharp Cuts');
    expect(email.html).toContain('/ops/preview-requests/req_1');
  });

  it('site-live email lists dashboard next steps', () => {
    const email = buildHubSiteLiveEmail({
      to: 'sam@example.com',
      firstName: 'Sam',
      shopName: 'Sharp Cuts',
      liveUrl: 'https://sharpcuts.co.uk',
    });
    expect(email.subject).toBe('Sharp Cuts is live');
    expect(email.html).toContain('https://sharpcuts.co.uk');
    expect(email.html).toContain('Add your booking link to Google');
    expect(email.html).toContain('Start selling products');
  });
});
