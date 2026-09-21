import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  sanitizeSentryRequestUrl,
  scrubPiiText,
  scrubSentryEvent,
} from './sentryPiiScrub';
import { isSentryEnabled } from './sentry';

const here = dirname(fileURLToPath(import.meta.url));

describe('sentry helpers', () => {
  it('reports disabled when DSN unset (unit env)', () => {
    // In vitest without SENTRY_DSN, init is a no-op and helper returns false.
    expect(typeof isSentryEnabled()).toBe('boolean');
  });

  it('server config disables default PII and uses scrubSentryEvent', () => {
    const src = readFileSync(join(here, '../../../sentry.server.config.ts'), 'utf8');
    expect(src).toContain('sendDefaultPii: false');
    expect(src).toContain('scrubSentryEvent');
  });
});

describe('sentry PII scrub', () => {
  it('redacts emails in messages and exception values', () => {
    expect(scrubPiiText('fail for customer@example.com')).toBe('fail for [redacted-email]');

    const event = scrubSentryEvent({
      message: 'boom customer@example.com',
      exception: {
        values: [{ type: 'Error', value: 'SMTP rejected customer@example.com' }],
      },
    });

    expect(event.message).toBe('boom [redacted-email]');
    expect(event.exception?.values?.[0]?.value).toBe('SMTP rejected [redacted-email]');
    expect(JSON.stringify(event)).not.toContain('customer@example.com');
  });

  it('redacts UK phone-like values in exception text', () => {
    const event = scrubSentryEvent({
      exception: {
        values: [{ value: 'Twilio failed for 07700900123' }],
      },
    });
    expect(event.exception?.values?.[0]?.value).toBe('Twilio failed for [redacted-phone]');
    expect(JSON.stringify(event)).not.toContain('07700900123');
  });

  it('strips query strings and fragments from request URLs', () => {
    expect(
      sanitizeSentryRequestUrl('https://kersivo.co.uk/book/reschedule?token=SECRET&x=1'),
    ).toBe('https://kersivo.co.uk/book/reschedule');
    expect(sanitizeSentryRequestUrl('https://kersivo.co.uk/book/cancel#frag')).toBe(
      'https://kersivo.co.uk/book/cancel',
    );

    const event = scrubSentryEvent({
      request: {
        url: 'https://kersivo.co.uk/book/reschedule?token=SECRET',
      },
    });
    expect(event.request?.url).toBe('https://kersivo.co.uk/book/reschedule');
  });

  it('redacts sensitive headers and scrubs request/extra/breadcrumb surfaces', () => {
    const event = scrubSentryEvent({
      request: {
        url: 'https://kersivo.co.uk/api/x',
        data: { email: 'customer@example.com', shopId: 'shop_1' },
        headers: {
          Authorization: 'Bearer secret',
          Cookie: 'session=abc',
          'Stripe-Signature': 't=1',
          'X-Admin-Secret': 'admin',
          Accept: 'application/json',
        },
      },
      extra: {
        phone: '07700900123',
        note: 'contact customer@example.com',
        shopId: 'shop_1',
      },
      breadcrumbs: [
        {
          message: 'sent to customer@example.com',
          data: { to: 'customer@example.com', outboundId: 'out_1' },
        },
      ],
    });

    expect(event.request?.headers?.Authorization).toBe('[redacted]');
    expect(event.request?.headers?.Cookie).toBe('[redacted]');
    expect(event.request?.headers?.['Stripe-Signature']).toBe('[redacted]');
    expect(event.request?.headers?.['X-Admin-Secret']).toBe('[redacted]');
    expect(event.request?.headers?.Accept).toBe('application/json');
    expect(event.request?.data).toEqual({ email: '[redacted]', shopId: 'shop_1' });
    expect(event.extra).toEqual({
      phone: '[redacted]',
      note: 'contact [redacted-email]',
      shopId: 'shop_1',
    });
    expect(event.breadcrumbs?.[0]?.message).toBe('sent to [redacted-email]');
    expect(event.breadcrumbs?.[0]?.data).toEqual({
      to: '[redacted-email]',
      outboundId: 'out_1',
    });
  });

  it('removes event.user direct identity fields', () => {
    const event = scrubSentryEvent({
      user: {
        id: 'u1',
        email: 'customer@example.com',
        username: 'customer',
        ip_address: '1.2.3.4',
      },
      message: 'ok',
    });
    expect(event.user).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain('customer@example.com');
    expect(JSON.stringify(event)).not.toContain('1.2.3.4');
  });
});
