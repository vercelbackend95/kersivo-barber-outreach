export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubReviewsHandlers } from '@/lib/previewHub/handlers/reviews';

export const { GET, POST } = createHubReviewsHandlers(cookieSourceOf);
