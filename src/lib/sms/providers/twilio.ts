import { SmsDeliveryError, type SendSmsInput, type SendSmsResult, type SmsProvider } from '../types';

function env(name: string): string {
  const value = (
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as Record<string, unknown>)[name]) ??
    (typeof process !== 'undefined' ? process.env[name] : '') ??
    ''
  )
    .toString()
    .trim();
  return value;
}

export function isTwilioConfigured(): boolean {
  return Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_FROM_NUMBER'));
}

/**
 * Trial accounts reject custom Body text — Body must be a Twilio template key
 * (e.g. `sms_appointment_reminders`). Set `TWILIO_TRIAL_TEMPLATE` to opt in.
 * Clear the env after upgrading to Pay as you go.
 */
export function resolveTwilioMessageBody(customBody: string): string {
  const trialTemplate = env('TWILIO_TRIAL_TEMPLATE');
  return trialTemplate || customBody;
}

export function createTwilioSmsProvider(): SmsProvider {
  const accountSid = env('TWILIO_ACCOUNT_SID');
  const authToken = env('TWILIO_AUTH_TOKEN');
  const from = env('TWILIO_FROM_NUMBER');

  if (!accountSid || !authToken || !from) {
    throw new SmsDeliveryError('Twilio credentials are not configured.');
  }

  return {
    name: 'twilio',
    async send(input: SendSmsInput): Promise<SendSmsResult> {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
      const body = new URLSearchParams({
        To: input.toE164,
        From: from,
        Body: resolveTwilioMessageBody(input.body),
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      const payload = (await response.json().catch(() => null)) as {
        sid?: string;
        message?: string;
        error_message?: string;
      } | null;

      if (!response.ok) {
        const detail = payload?.error_message || payload?.message || `HTTP ${response.status}`;
        throw new SmsDeliveryError(`Twilio send failed: ${detail}`, payload);
      }

      return {
        provider: 'twilio',
        providerMessageId: payload?.sid ?? null,
      };
    },
  };
}
