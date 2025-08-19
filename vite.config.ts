import devtoolsJson from '@improvements/vite-plugin-devtools-json';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ command, mode }: ConfigEnv): UserConfig => {
  // Disable React Router plugin for tests or when explicitly disabled
  const disableReactRouter = mode === 'test' || process.env.DISABLE_REACT_ROUTER === 'true';

  return {
    plugins: [
      tailwindcss(),
      // Only include React Router plugin when not disabled
      ...(!disableReactRouter ? [reactRouter()] : []),
      tsconfigPaths(),
      devtoolsJson(),
    ],
    // Define global constants
    // define: {
    //   IFRAME__CALLAI_API_KEY: JSON.stringify(env.VITE_OPENROUTER_API_KEY),
    // },
    // Server configuration for local development
    server: {
      host: '0.0.0.0', // Listen on all local IPs
      allowedHosts: ['devserver-main--fireproof-ai-builder.netlify.app'], // Specific ngrok hostname
      cors: true, // Enable CORS for all origins
      hmr: true, // Use default HMR settings for local development
      // Ignore test directory changes to prevent unnecessary reloads during development
      watch: {
        ignored: ['**/tests/**'],
      },
    },
    // Configure static file handling for HTML pages
    publicDir: 'public',
    // Ensure JSON imports are properly handled
    json: {
      stringify: true,
    },
    test: {
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: [
          'RegexParser.ts',
          'app/hooks/useChat.ts',
          'app/ChatInterface.tsx',
          'app/ResultPreview.tsx',
          'app/prompts.ts',
          'app/root.tsx',
          'app/routes.ts',
          'app/components/**/*.tsx',
        ],
        enabled: true,
      },
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
      deps: {
        inline: ['react-router', '@react-router/dev'],
      },
    },
  };
});
