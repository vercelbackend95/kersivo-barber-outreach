export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubChangesHandlers } from '@/lib/previewHub/handlers/changes';

export const { GET, POST } = createHubChangesHandlers(tokenSourceOf);
