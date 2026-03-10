// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
    security: {
    checkOrigin: false
  },

  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        'lucide-react': fileURLToPath(new URL('./src/components/lucide-react.tsx', import.meta.url))

      }
          },
    build: {
      rollupOptions: {
        external: ['@vercel/blob']
      }

    }
  }

});
