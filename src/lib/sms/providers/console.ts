import type { SendSmsInput, SendSmsResult, SmsProvider } from '../types';

export function createConsoleSmsProvider(): SmsProvider {
  return {
    name: 'console',
    async send(input: SendSmsInput): Promise<SendSmsResult> {
      const id = `dev-${Date.now()}`;
      console.log('[DEV SMS]', {
        to: input.toE164,
        body: input.body,
        id,
      });
      return { provider: 'console', providerMessageId: id };
    },
  };
}
