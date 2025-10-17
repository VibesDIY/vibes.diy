import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3456,
    open: true,
    host: true, // Allow external connections for testing
  },
  define: {
    // Expose environment info for debugging
    __DEV_MODE__: true,
  },
  optimizeDeps: {
    // Ensure workspace dependencies are properly handled
    include: ['use-vibes', 'call-ai'],
  },
  build: {
    sourcemap: true,
  },
});
