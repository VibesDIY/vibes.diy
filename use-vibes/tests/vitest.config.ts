// import { defineConfig } from 'vitest/config';
// import react from '@vitejs/plugin-react';
//
// export default defineConfig({
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   plugins: [react() as any],
//   test: {
//     environment: 'jsdom',
//     globals: true,
//     setupFiles: ['./setup.ts'],
//   },
// });
//

// /// <reference types="@vitest/browser/providers/playwright" />

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'use-vibes',
    exclude: ['dist/**', 'node_modules/**'],
    include: ['**/*test.?(c|m)[jt]s?(x)'],
    testTimeout: 30000,
    hookTimeout: 10000,
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  },
});
