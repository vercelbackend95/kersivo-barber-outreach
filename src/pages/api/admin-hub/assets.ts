export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubAssetsHandlers } from '@/lib/previewHub/handlers/assets';

export const { GET, POST } = createHubAssetsHandlers(cookieSourceOf);
