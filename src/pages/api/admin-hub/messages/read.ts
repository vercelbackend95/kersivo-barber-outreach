export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubMessagesReadHandlers } from '@/lib/previewHub/handlers/messages';

export const { POST } = createHubMessagesReadHandlers(cookieSourceOf);
