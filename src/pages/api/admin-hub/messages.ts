export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubMessagesHandlers } from '@/lib/previewHub/handlers/messages';

export const { GET, POST } = createHubMessagesHandlers(cookieSourceOf);
