export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubStateHandlers } from '@/lib/previewHub/handlers/state';

export const { GET } = createHubStateHandlers(cookieSourceOf);
