import { describe, expect, it, afterEach } from 'vitest';
import { resolveTwilioMessageBody } from './twilio';

describe('resolveTwilioMessageBody', () => {
  const original = process.env.TWILIO_TRIAL_TEMPLATE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TWILIO_TRIAL_TEMPLATE;
    } else {
      process.env.TWILIO_TRIAL_TEMPLATE = original;
    }
  });

  it('returns custom body when trial template env is unset', () => {
    delete process.env.TWILIO_TRIAL_TEMPLATE;
    expect(resolveTwilioMessageBody('Shop: reminder — Cut on Mon 1 Jan, 10:00 (UK).')).toBe(
      'Shop: reminder — Cut on Mon 1 Jan, 10:00 (UK).',
    );
  });

  it('returns trial template key when TWILIO_TRIAL_TEMPLATE is set', () => {
    process.env.TWILIO_TRIAL_TEMPLATE = 'sms_appointment_reminders';
    expect(resolveTwilioMessageBody('custom text ignored')).toBe('sms_appointment_reminders');
  });
});
