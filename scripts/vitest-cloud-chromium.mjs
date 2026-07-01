// vitest-cloud-chromium.mjs — let @vitest/browser-playwright suites run in the
// Claude Code cloud / remote execution environment WITHOUT a browser download.
//
// THE PROBLEM (VibesDIY/vibes.diy#2989)
// -------------------------------------
// The cloud container pre-installs ONE Playwright Chromium build under
// /opt/pw-browsers (e.g. chromium-1194), but the repo pins a newer Playwright
// (playwright@^1.61.1) whose headless-shell build is a different revision
// (chromium_headless_shell-1228). So every vitest browser-mode project bails at
// startup with "Executable doesn't exist … Please run: playwright install" —
// and `playwright install` is both discouraged in this env and unreliable
// through the egress proxy (see scripts/install-pw-chromium.sh).
//
// THE FIX
// -------
// Playwright launches whatever binary you hand it via `launchOptions.executablePath`
// and — unlike its managed downloads — does NOT version-gate it. When the exact
// headless-shell build Playwright wants is missing, we point it at the full
// Chromium already in the image (it runs fine headless). No download, no proxy,
// works instantly. When the matching build IS present (e.g. after running
// `pnpm playwright:install`), we leave executablePath unset so Playwright uses
// its optimized headless shell.
//
// Root also needs the sandbox dropped (same as scripts/setup-cloud-browser.sh
// does for the chrome-devtools MCP), so inside the cloud container we always
// pass chromiumSandbox:false + --disable-dev-shm-usage.
//
// This is a NO-OP on CI and local workstations, where /opt/pw-browsers is
// absent — there it returns `{}` and Playwright's default resolution is used
// untouched. Feed the result straight into the provider:
//
//   provider: playwright(cloudChromiumProviderOptions()),

import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The cloud container's pre-provisioned Playwright browser cache. Its existence
// is the signal that we're in the cloud env (CI / local workstations don't have
// it). Honor an override but default to the documented cloud path.
const PW_CACHE = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";

/**
 * Playwright provider options for @vitest/browser-playwright's `playwright()`.
 * Returns `{}` everywhere except the cloud container, where it returns the
 * launch overrides needed to run headless Chromium as root — falling back to
 * the pre-installed full Chromium when the pinned headless-shell build is
 * missing. See the file header and VibesDIY/vibes.diy#2989.
 *
 * @returns {{ launchOptions?: { executablePath?: string; chromiumSandbox?: boolean; args?: string[] } }}
 */
export function cloudChromiumProviderOptions() {
  try {
    if (!existsSync(PW_CACHE)) return {};

    /** @type {{ executablePath?: string; chromiumSandbox?: boolean; args: string[] }} */
    const launchOptions = {
      // Chrome can't initialize its sandbox as root (how the cloud container
      // runs). Mirror scripts/setup-cloud-browser.sh's --no-sandbox.
      chromiumSandbox: false,
      args: ["--disable-dev-shm-usage"],
    };

    // Only reach for the full-Chromium fallback when the exact headless-shell
    // build Playwright expects isn't on disk.
    if (!expectedHeadlessShellPresent(PW_CACHE)) {
      const chromium = resolveFullChromium(PW_CACHE);
      if (chromium) launchOptions.executablePath = chromium;
    }

    return { launchOptions };
  } catch {
    // Never let browser-launch heuristics break config loading — fall back to
    // Playwright's default behavior.
    return {};
  }
}

/**
 * Is the chrome-headless-shell build the installed Playwright expects present in
 * `dir`? Reads the wanted revision from playwright-core's browsers.json (the
 * source of truth) so it tracks Playwright bumps automatically. When the
 * revision can't be determined, returns false so callers prefer the safe
 * full-Chromium fallback.
 * @param {string} dir
 * @returns {boolean}
 */
function expectedHeadlessShellPresent(dir) {
  const rev = expectedChromiumRevision("chromium-headless-shell");
  if (!rev) return false;
  return existsSync(join(dir, `chromium_headless_shell-${rev}`, "chrome-linux", "chrome-headless-shell"));
}

/**
 * Read a browser build revision out of the installed playwright-core's
 * browsers.json (the source of truth for what Playwright wants).
 * @param {string} name browsers.json entry name, e.g. "chromium-headless-shell"
 * @returns {string | undefined}
 */
function expectedChromiumRevision(name) {
  const jsonPath = resolveBrowsersJson();
  if (!jsonPath) return undefined;
  try {
    const data = JSON.parse(readFileSync(jsonPath, "utf8"));
    const entry = data.browsers?.find((b) => b.name === name);
    return entry?.revision ? String(entry.revision) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Locate playwright-core's browsers.json across install layouts. pnpm hides
 * playwright-core (it's a transitive dep) and blocks the `./browsers.json`
 * subpath via `exports`, so we can't require it directly — instead we reach it
 * through the `playwright` package (a direct dep of the test packages) and read
 * the file next to playwright-core's own entry. Falls back to a direct resolve
 * for hoisted/npm layouts. Resolved relative to the running package (cwd) first,
 * then to this script.
 * @returns {string | undefined}
 */
function resolveBrowsersJson() {
  for (const base of [join(process.cwd(), "noop.js"), fileURLToPath(import.meta.url)]) {
    let require;
    try {
      require = createRequire(base);
    } catch {
      continue;
    }
    // Direct (hoisted / npm): browsers.json or package.json of playwright-core.
    for (const resolver of [
      () => require.resolve("playwright-core/browsers.json"),
      () => join(dirname(require.resolve("playwright-core/package.json")), "browsers.json"),
      // pnpm: hop through `playwright` to reach its bundled playwright-core.
      () => {
        const pw = createRequire(require.resolve("playwright"));
        return join(dirname(pw.resolve("playwright-core")), "browsers.json");
      },
    ]) {
      try {
        const p = resolver();
        if (existsSync(p)) return p;
      } catch {
        // Try the next strategy.
      }
    }
  }
  return undefined;
}

/**
 * Resolve a full Chromium executable under `dir`, preferring the stable
 * `chromium` symlink and falling back to the newest versioned install. Mirrors
 * scripts/setup-cloud-browser.sh's resolve_chromium().
 * @param {string} dir
 * @returns {string | undefined}
 */
function resolveFullChromium(dir) {
  try {
    const resolved = realpathSync(join(dir, "chromium"));
    if (existsSync(resolved)) return resolved;
  } catch {
    // No symlink — fall through to the versioned scan.
  }

  let best;
  let bestRev = -1;
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    const match = /^chromium-(\d+)$/.exec(entry);
    if (!match) continue;
    const rev = Number(match[1]);
    const bin = join(dir, entry, "chrome-linux", "chrome");
    if (rev > bestRev && existsSync(bin)) {
      bestRev = rev;
      best = bin;
    }
  }
  return best;
}
