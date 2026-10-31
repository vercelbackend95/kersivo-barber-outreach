export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubChangeByIdHandlers } from '@/lib/previewHub/handlers/changes';

export const { PATCH, DELETE } = createHubChangeByIdHandlers(cookieSourceOf);
