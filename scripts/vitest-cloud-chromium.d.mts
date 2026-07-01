// Type declarations for vitest-cloud-chromium.mjs — kept hand-written (the
// public surface is one tiny function) so the `.mjs` import resolves under
// `moduleResolution: nodenext` without pulling the script into any tsconfig.

/**
 * Playwright provider options for @vitest/browser-playwright's `playwright()`.
 * `{}` on CI and local workstations; launch overrides (sandbox off, and a
 * full-Chromium `executablePath` fallback) inside the Claude Code cloud
 * container. See VibesDIY/vibes.diy#2989.
 */
export function cloudChromiumProviderOptions(): {
  launchOptions?: {
    executablePath?: string;
    chromiumSandbox?: boolean;
    args?: string[];
  };
};
