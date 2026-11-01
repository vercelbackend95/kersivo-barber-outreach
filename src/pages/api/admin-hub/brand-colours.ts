export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubBrandColoursHandlers } from '@/lib/previewHub/handlers/brandColours';

export const { PATCH } = createHubBrandColoursHandlers(cookieSourceOf);
