export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubDetailsHandlers } from '@/lib/previewHub/handlers/details';

export const { GET, PATCH } = createHubDetailsHandlers(cookieSourceOf);
