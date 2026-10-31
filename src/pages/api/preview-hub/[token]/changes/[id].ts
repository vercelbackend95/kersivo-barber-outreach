export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubChangeByIdHandlers } from '@/lib/previewHub/handlers/changes';

export const { PATCH, DELETE } = createHubChangeByIdHandlers(tokenSourceOf);
