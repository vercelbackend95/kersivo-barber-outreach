import { describe, expect, it } from 'vitest';
import { PREVIEW_TURNAROUND_TEXT } from './config';
import { buildPreviewRequestAcknowledgementEmail, buildPreviewRequestInternalEmail } from './emails';

describe('free preview emails', () => {
  it('E1 uses the spec subject, turnaround from config, reply-to and sign-off', () => {
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
});
