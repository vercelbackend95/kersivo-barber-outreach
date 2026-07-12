export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  id?: string;
  role: ChatRole;
  content: string;
  /** Reserved for future tool-calling turns. */
  toolCalls?: unknown[];
  /** Reserved for future live shop/booking context injection. */
  context?: Record<string, unknown>;
};

export type ChatRequestBody = {
  messages: ChatMessage[];
};

export const MAX_CHAT_MESSAGES = 40;
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_TOTAL_CHARS = 48_000;
