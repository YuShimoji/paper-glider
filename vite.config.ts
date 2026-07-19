import { defineConfig } from 'vite';

export default defineConfig({
  base: '/paper-glider/',
  plugins: [
    {
      name: 'strip-generated-trailing-whitespace',
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk') output.code = output.code.replace(/[ \t]+$/gm, '');
        }
      },
    },
  ],
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
