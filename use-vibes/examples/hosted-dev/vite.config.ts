import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3456,
    open: true,
    host: true, // Allow external connections for testing
    fs: {
      // Allow serving files from workspace packages
      allow: ['..', '../..', '../../..'],
    },
  },
  define: {
    // Expose environment info for debugging
    __DEV_MODE__: true,
  },
  optimizeDeps: {
    // Exclude workspace dependencies from pre-bundling to enable HMR
    exclude: ['use-vibes', '@vibes.diy/use-vibes-base', 'call-ai'],
  },
  build: {
    sourcemap: true,
  },
});
