export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubAssetsHandlers } from '@/lib/previewHub/handlers/assets';

export const { GET, POST } = createHubAssetsHandlers(tokenSourceOf);
