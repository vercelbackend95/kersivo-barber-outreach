export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubProfileHandlers } from '@/lib/previewHub/handlers/shopSetup';

export const { GET, PATCH } = createHubProfileHandlers(cookieSourceOf);
