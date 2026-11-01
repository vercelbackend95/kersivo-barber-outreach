export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubBrandColoursHandlers } from '@/lib/previewHub/handlers/brandColours';

export const { PATCH } = createHubBrandColoursHandlers(tokenSourceOf);
