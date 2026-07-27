export type SendSmsInput = {
  toE164: string;
  body: string;
};

export type SendSmsResult = {
  provider: string;
  providerMessageId: string | null;
};

export type SmsProvider = {
  readonly name: string;
  send(input: SendSmsInput): Promise<SendSmsResult>;
};

export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    readonly causeDetail?: unknown,
  ) {
    super(message);
    this.name = 'SmsDeliveryError';
  }
}
