export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubDetailsHandlers } from '@/lib/previewHub/handlers/details';

export const { GET, PATCH } = createHubDetailsHandlers(tokenSourceOf);
