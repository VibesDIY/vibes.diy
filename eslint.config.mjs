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
        project: true,
      },
    },
  },
  {
    ignores: [
      "babel.config.cjs",
      "jest.config.js",
      "**/.netlify/**",
      "**/.react-router/**",
      "**/dist/",
      "**/pubdir/",
      "**/node_modules/",
      "**/scripts/",
      "scripts/",
      "smoke/react/",
      "src/missingTypes/lib.deno.d.ts",
      "**/notes/**",
      "**/.cache/**",
      "**/.esm-cache/**",
      "**/build/**",
      "**/.wrangler/**",
      "**/claude-browse-vibes/**",
      "playwright.config.js",
      "**/tests-new/**",
      "**/examples/react-example/**",
      "vitest.config.ts",
      "**/.storybook/**",
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
);

export default opts;
