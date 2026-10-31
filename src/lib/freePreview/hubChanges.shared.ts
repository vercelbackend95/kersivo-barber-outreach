import type { PreviewChangeStatus } from '@prisma/client';
import { HUB_CHANGES_PAGES } from './hubCopy';

export const HUB_CHANGE_PAGES = ['HOME', 'SERVICES', 'BARBERS', 'GALLERY', 'CONTACT', 'BOOKING', 'OTHER'] as const;
export const HUB_CHANGE_BODY_MAX = 2000;
export const HUB_OPEN_CHANGE_STATUSES: readonly PreviewChangeStatus[] = ['DRAFT', 'SENT', 'IN_PROGRESS'];

export type HubChangePublic = {
  id: string;
  page: (typeof HUB_CHANGE_PAGES)[number];
  pageLabel: string;
  body: string;
  attachmentId: string | null;
  status: PreviewChangeStatus;
  opsNote: string | null;
  round: number | null;
  createdAt: string;
  sentAt: string | null;
  resolvedAt: string | null;
};

export function changePageLabel(page: string): string {
  return HUB_CHANGES_PAGES[page as keyof typeof HUB_CHANGES_PAGES] ?? page;
}
