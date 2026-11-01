import type { PreviewHubActor } from '@prisma/client';

export const HUB_MESSAGE_MAX_CHARS = 2000;
export const HUB_MESSAGE_MAX_ATTACHMENTS = 5;
export const HUB_MESSAGES_POLL_MS = 30_000;

export type HubMessagePublic = {
  id: string;
  author: PreviewHubActor;
  body: string;
  createdAt: string;
  readByOwnerAt: string | null;
  readByOpsAt: string | null;
  attachments: Array<{
    id: string;
    kind: string;
    originalFileName: string;
    contentType: string;
    sizeBytes: number;
    hasThumb: boolean;
  }>;
};

export function hubMessageDayKey(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function hubMessageTimeLabel(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  });
}
