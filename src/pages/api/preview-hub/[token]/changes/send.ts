export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubChangesSendHandlers } from '@/lib/previewHub/handlers/changes';

export const { POST } = createHubChangesSendHandlers(tokenSourceOf);
