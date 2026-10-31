export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubChangesHandlers } from '@/lib/previewHub/handlers/changes';

export const { GET, POST } = createHubChangesHandlers(cookieSourceOf);
