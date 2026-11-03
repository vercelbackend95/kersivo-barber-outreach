import { afterEach, describe, expect, it, vi } from 'vitest';

const resendSend = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => resendSend(...args) };
  },
}));

import { isReservedRecipient } from './reservedRecipients';
import { isPermanentEmailDeliveryError, EmailDeliveryError, sendRenderedEmail } from './sender';

describe('isReservedRecipient', () => {
  it.each([
    'local-domain-search@example.com',
    'A@EXAMPLE.ORG',
    'b@example.net',
    'c@shop.test',
    'd@x.invalid',
    'e@demo.example',
    'f@app.localhost',
    'g@localhost',
    'h@mail.example.com',
  ])('%s is reserved', (email) => {
    expect(isReservedRecipient(email)).toBe(true);
  });

  it.each([
    'owner@kersivo.co.uk',
    'owner@example.com.barbers.co.uk',
    'owner@testbarbers.co.uk',
    'owner@barber.testing',
    'not-an-email',
  ])('%s is not reserved', (email) => {
    expect(isReservedRecipient(email)).toBe(false);
  });
});

describe('sendRenderedEmail to a reserved recipient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns suppressed without calling the provider', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await sendRenderedEmail({
      to: 'local-domain-search@example.com',
      subject: 's',
      html: '<p>x</p>',
    });
    expect(result).toEqual({ messageId: null, suppressed: true });
    expect(resendSend).not.toHaveBeenCalled();
  });
});

describe('isPermanentEmailDeliveryError', () => {
  it.each([
    [400, true],
    [403, true],
    [422, true],
    [429, false],
    [500, false],
    [503, false],
  ])('Resend %i → permanent=%s', (statusCode, expected) => {
    const error = new EmailDeliveryError('Resend returned an error response.', { statusCode });
    expect(isPermanentEmailDeliveryError(error)).toBe(expected);
  });

  it('is false for network errors and non-delivery errors', () => {
    expect(isPermanentEmailDeliveryError(new EmailDeliveryError('Failed to send email through Resend.', null))).toBe(false);
    expect(isPermanentEmailDeliveryError(new Error('boom'))).toBe(false);
  });
});
