export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubReviewsHandlers } from '@/lib/previewHub/handlers/reviews';

export const { GET, POST } = createHubReviewsHandlers(tokenSourceOf);
