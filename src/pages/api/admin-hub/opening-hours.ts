export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubOpeningHoursHandlers } from '@/lib/previewHub/handlers/shopSetup';

export const { GET, PUT } = createHubOpeningHoursHandlers(cookieSourceOf);
