// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import sentry from '@sentry/astro';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://kersivo.co.uk',
  output: 'server',
  adapter: vercel(),
  integrations: [
    react(),
    sentry({
      sourceMapsUploadOptions: {
        enabled: false,
      },
      autoInstrumentation: {
        requestHandler: true,
      },
    }),
  ],
  // Keep HTML-aware whitespace (Astro 7 default is 'jsx') to reduce landing layout regressions.
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  security: {
    checkOrigin: false
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        external: ['@vercel/blob'],
      },
    },
  },
});
