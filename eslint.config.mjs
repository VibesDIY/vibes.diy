import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

const opts = tseslint.config(
  eslint.configs.recommended,
  //   ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    languageOptions: {
      globals: {
        queueMicrotask: "readonly",
      },
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: true, // Memory-efficient type-aware linting
        // project: false,
      },
    },
  },
  {
    ignores: [
      "**/.claude/**",
      "babel.config.cjs",
      "jest.config.js",
      "**/.netlify/**",
      "**/.react-router/**",
      "**/slack/**",
      "**/dist/",
      "**/pubdir/",
      "**/node_modules/",
      "**/scripts/",
      "scripts/",
      "smoke/react/",
      "src/missingTypes/lib.deno.d.ts",
      "**/notes/**",
      "vibesbox/**",
      "vibes.diy/tempo/**",
      "vibes.diy/failback-homepage/**",
      "hosting/**",
      "**/coverage/**",
      "**/.cache/**",
      "**/.esm-cache/**",
      "**/build/**",
      "**/.wrangler/**",
      "**/claude-browse-vibes/**",
      "playwright.config.js",
      "**/tests-new/**",
      "**/examples/**",
      "use-vibes/tests/**",
      "vitest.config.ts",
      "**/.storybook/**",
      "**/storybook-static/**",
      "**/tailwind.config.js",
      "vibes.diy/**/root.*",
      "**/eslint.config.mjs",
      "**/jest.config.mjs",
      "**/src/types.d.ts",
      "**/worker-configuration.d.ts",
      "**/*.d.ts",
      "**/*.js.map",
      "**/*.d.ts.map",
      "**/pkg/*.js",
    ],
  },
  {
    plugins: {
      import: importPlugin,
    },

    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      // "no-console": ["warn"],
      "import/no-duplicates": ["error"],
    },
  },
  {
    rules: {
      "no-restricted-globals": ["error"], //, "URL", "TextDecoder", "TextEncoder"],
    },
  },
  // Guard rail: ban bare console.log in shipping paths — use console.info,
  // console.warn, or console.error instead. Keeps debug noise out of prod.
  {
    files: ["vibes.diy/api/**/*.{ts,tsx}", "vibes.diy/vibe/runtime/**/*.{ts,tsx}", "call-ai/v2/**/*.ts"],
    ignores: [
      "**/*.test.*",
      "**/*.spec.*",
      "**/*.test-*.ts",
      "**/tests/**",
      "vibes.diy/api/svc/usage-report/**",
      "call-ai/v2/cli.ts",
    ],
    rules: {
      "no-console": ["error", { allow: ["error", "warn", "info"] }],
    },
  }
);

export default opts;
