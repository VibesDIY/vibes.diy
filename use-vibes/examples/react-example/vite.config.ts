import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'use-vibes': resolve(__dirname, 'node_modules/use-vibes/index.js'),
    },
  },
});
