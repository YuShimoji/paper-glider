import { defineConfig } from 'vite';

export default defineConfig({
  base: '/paper-glider/',
  build: {
    outDir: 'docs',
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.includes('/node_modules/three/build/three.module.js') ? 'three-core' : undefined;
        },
      },
    },
  },
});
