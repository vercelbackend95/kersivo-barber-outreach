export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubMessagesHandlers } from '@/lib/previewHub/handlers/messages';

export const { GET, POST } = createHubMessagesHandlers(tokenSourceOf);
