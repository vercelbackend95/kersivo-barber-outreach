export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubMessagesReadHandlers } from '@/lib/previewHub/handlers/messages';

export const { POST } = createHubMessagesReadHandlers(tokenSourceOf);
