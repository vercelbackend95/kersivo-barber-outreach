export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubChangesSendHandlers } from '@/lib/previewHub/handlers/changes';

export const { POST } = createHubChangesSendHandlers(cookieSourceOf);
