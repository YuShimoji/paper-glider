import { defineConfig } from 'vite';

export default defineConfig({
  base: '/paper-glider/',
  build: {
    outDir: 'docs',
    chunkSizeWarningLimit: 550,
  },
});
