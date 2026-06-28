#!/usr/bin/env node
// Navigate to authenticated Vibes URLs and screenshot them — the reusable
// companion to clerk-qa-login.mjs for ad-hoc logged-in debugging / screenshots
// OUTSIDE the full qa-pr spine.
//
// Why this exists (and why not chrome-devtools MCP): the chrome-devtools MCP
// launches its Chrome with `--remote-debugging-pipe` (a file-descriptor
// transport), NOT a TCP `--remote-debugging-port`, so there is no CDP URL to
// hand `clerk-qa-login.mjs --cdp` — you cannot attach the validated Clerk
// session to the MCP's own browser. The reliable pattern is instead:
//
//   1) clerk-qa-login.mjs --instance <i> --origin <o> --email <e> --storage state.json
//      → authenticates and exports a Playwright storageState (cookies + origin
//        localStorage). The minted token stays in-process; only the session
//        cookie lands in state.json.
//   2) this script --storage state.json <url> [<url> ...]
//      → loads that session into a fresh Playwright context and screenshots each
//        URL, waiting for the app <iframe> to actually paint first.
//
// SECURITY: state.json holds a live Clerk session cookie. Treat it like the
// secret it is — never print, echo, commit, or paste its contents anywhere. This
// script only ever reads it as a Playwright input and emits non-secret evidence
// (final URL, signed-in email, iframe-ready bool, shot path). It never prints a
// cookie or token.
//
// Usage (keep the storage file OUTSIDE the repo — it holds a session cookie):
//   node clerk-authed-shot.mjs --storage /tmp/state.prod.json --out /tmp/shots \
//     https://vibes.diy/chat/<handle>/<slug> [more urls...]
//   [--out <dir>]        directory for screenshots (default: cwd). Auto-named from each URL path.
//   [--mobile]           use a 390x844 (iPhone 14 Pro) viewport instead of 1280x900
//   [--viewport WxH]     explicit viewport (overrides --mobile)
//   [--full]             full-page screenshot instead of viewport-only
//   [--no-iframe-wait]   skip the "wait until the app iframe paints" poll (faster, for non-app pages)
//   [--settle <ms>]      extra settle time after iframe paint (default 2500)
//   [--allow-repo-path]  permit a --storage path inside the repo (refused by default,
//                        so a cookie-bearing file can't be accidentally git-added)
//
// Tip for the Vibes editor: route-nav straight to /chat/<handle>/<slug> rather
// than clicking sidebar app cards — the card→preview→ENTER path is finicky and
// can open the wrong vibe. The sidebar lists exactly these URLs.
//
// Exit 0 if every URL produced a screenshot, 1 otherwise.
// Background: docs/specs/2026-06-28-clerk-signin-token-qa-login.md,
//             agents/authed-browser-debugging.md
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { existsSync, readlinkSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, resolve as presolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function loadChromium() {
  const bases = [
    here,
    process.cwd(),
    presolve(dirname(process.execPath), "..", "lib", "node_modules") + "/",
    process.env.NODE_PATH ? process.env.NODE_PATH + "/" : null,
  ].filter(Boolean);
  for (const base of bases) {
    const req = createRequire(base.endsWith("/") ? base : base + "/");
    for (const name of ["playwright", "playwright-core"]) {
      try {
        return req(name).chromium;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}
const chromium = loadChromium();
if (!chromium) {
  console.error("clerk-authed-shot: Playwright not found (need 'playwright' or 'playwright-core' installed, or on NODE_PATH).");
  process.exit(2);
}

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const val = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : d;
};
const storagePath = val("storage");
const outDir = val("out", process.cwd());
const settle = parseInt(val("settle", "2500"), 10);
const waitIframe = !flag("no-iframe-wait");
const fullPage = flag("full");
// Positional URLs are everything that isn't a flag or a flag's value.
const flagsWithValue = new Set(["storage", "out", "viewport", "settle"]);
const urls = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    if (flagsWithValue.has(a.slice(2))) i++; // skip its value
    continue;
  }
  urls.push(a);
}

if (!storagePath || !existsSync(storagePath)) {
  console.error("clerk-authed-shot: --storage <file> is required and must exist (export it with clerk-qa-login.mjs --storage).");
  process.exit(2);
}
if (urls.length === 0) {
  console.error("clerk-authed-shot: pass at least one URL to screenshot.");
  process.exit(2);
}

// Refuse a storage file that lives inside the git repo: it holds a live session
// cookie, and a repo-local path is one `git add -A` away from being committed.
// Default to /tmp; --allow-repo-path is the explicit escape hatch.
if (!flag("allow-repo-path")) {
  let dir = presolve(storagePath, "..");
  let repoRoot = null;
  for (let up = 0; up < 40 && dir; up++) {
    if (existsSync(presolve(dir, ".git"))) {
      repoRoot = dir;
      break;
    }
    const parent = presolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  if (repoRoot) {
    console.error(
      `clerk-authed-shot: --storage path is inside the repo (${repoRoot}). It holds a live session cookie — ` +
        "write it under /tmp (e.g. /tmp/state.prod.json) so it can't be accidentally committed, or pass --allow-repo-path to override.",
    );
    process.exit(2);
  }
}

let viewport = { width: 1280, height: 900 };
const vp = val("viewport");
if (vp && /^\d+x\d+$/.test(vp)) {
  const [w, h] = vp.split("x").map(Number);
  viewport = { width: w, height: h };
} else if (flag("mobile")) {
  viewport = { width: 390, height: 844 };
}

function resolveCloudChromium() {
  try {
    const link = "/opt/pw-browsers/chromium";
    if (existsSync(link)) {
      const abs = presolve("/opt/pw-browsers", readlinkSync(link));
      if (existsSync(abs)) return abs;
    }
  } catch {
    /* fall through */
  }
  try {
    for (const d of readdirSync("/opt/pw-browsers")
      .filter((d) => d.startsWith("chromium-"))
      .sort()
      .reverse()) {
      const abs = `/opt/pw-browsers/${d}/chrome-linux/chrome`;
      if (existsSync(abs)) return abs;
    }
  } catch {
    /* not the cloud image */
  }
  return undefined;
}

function nameFor(url, i) {
  try {
    const u = new URL(url);
    const slug = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
    return `${String(i + 1).padStart(2, "0")}-${slug.replace(/[^a-z0-9-]+/gi, "-")}.png`;
  } catch {
    return `${String(i + 1).padStart(2, "0")}-shot.png`;
  }
}

// Wait until the Vibes app preview *iframe* has actually painted content.
// The preview is served from `<app>--<owner>.<host>`, a DIFFERENT origin than
// the `vibes.diy` editor — so the editor page cannot read the iframe's
// document (same-origin policy), and "the <iframe> element exists" is NOT a
// readiness signal (it's there immediately, blank). Playwright, however, drives
// each child frame regardless of origin, so we poll the app frame's own body.
// The `<app>--<owner>` host (a `--` in the hostname) uniquely identifies the
// preview frame and excludes auxiliary iframes (Clerk, analytics).
async function waitForAppPaint(page, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const appFrame = page.frames().find((fr) => {
      try {
        return new URL(fr.url()).hostname.includes("--");
      } catch {
        return false;
      }
    });
    if (appFrame) {
      try {
        const len = await appFrame.evaluate(() => (document.body?.innerText || "").trim().length);
        if (len > 0) return true;
      } catch {
        /* frame mid-navigation; retry */
      }
    }
    await page.waitForTimeout(500);
  }
  return false;
}

mkdirSync(outDir, { recursive: true });

const executablePath = resolveCloudChromium();
const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
const cloud = !!executablePath;

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  ...(cloud && proxyServer ? { proxy: { server: proxyServer } } : {}),
  args: cloud ? ["--no-sandbox", "--disable-dev-shm-usage", "--disable-quic", "--ssl-version-max=tls1.2"] : [],
});

let allOk = true;
try {
  const context = await browser.newContext({ storageState: storagePath, viewport });
  const page = await context.newPage();

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const shot = `${outDir}/${nameFor(url, i)}`;
    const ev = { url, shot };
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      if (waitIframe) {
        ev.iframeReady = await waitForAppPaint(page);
      }
      await page.waitForTimeout(settle);
      await page.screenshot({ path: shot, fullPage });
      ev.finalUrl = page.url();
      ev.signedInEmail = await page
        .evaluate(() => window.Clerk?.user?.primaryEmailAddress?.emailAddress ?? null)
        .catch(() => null);
      ev.ok = true;
    } catch (e) {
      ev.ok = false;
      ev.err = e?.message || String(e);
      allOk = false;
    }
    process.stdout.write(JSON.stringify(ev) + "\n");
  }
} finally {
  await browser.close().catch(() => {});
}

process.exit(allOk ? 0 : 1);
