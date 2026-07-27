import { createConsoleSmsProvider } from './providers/console';
import { createTwilioSmsProvider, isTwilioConfigured } from './providers/twilio';
import { SmsDeliveryError, type SmsProvider } from './types';

function isProductionRuntime(): boolean {
  return import.meta.env.PROD === true || process.env.NODE_ENV === 'production';
}

export function isSmsRemindersEnabled(): boolean {
  const raw = (
    import.meta.env.SMS_REMINDERS_ENABLED ??
    (typeof process !== 'undefined' ? process.env.SMS_REMINDERS_ENABLED : '') ??
    ''
  )
    .toString()
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * Resolve SMS provider: Twilio when configured; console in non-production;
 * production without Twilio throws (caller should log per-item failure).
 */
export function getSmsProvider(): SmsProvider {
  if (isTwilioConfigured()) {
    return createTwilioSmsProvider();
  }
  if (!isProductionRuntime()) {
    return createConsoleSmsProvider();
  }
  throw new SmsDeliveryError(
    'SMS_REMINDERS_ENABLED but Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER).',
  );
}
