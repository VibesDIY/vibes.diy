#!/usr/bin/env node
// Headless qa-pr login — MAIN PATH for authenticated cloud sessions.
//
// Mints a Clerk sign-in token and consumes it (ticket strategy) in a real
// browser, yielding a genuine Clerk session — identical to a normal login — so
// the qa-pr spine runs authenticated in the cloud with zero app code changes.
//
// Why a script (and not the agent driving `evaluate_script` directly): the
// minted sign-in token is a credential, and the harness security policy forbids
// it ever entering the agent's transcript / tool-call arguments. This script
// keeps the token in-process end-to-end — it is minted, passed to the page as a
// function argument, and consumed, and is NEVER printed. Only non-secret
// evidence (userId, session presence, instance) is emitted. Driving the consume
// from the agent's own `evaluate_script` would require materializing the token
// into a tool call, which the classifier (correctly) blocks — so this script is
// the primary mechanism, not a fallback.
//
// Instance discipline (a token minted on the wrong instance won't activate):
//   --instance prod    → CLERK_SECRET_KEY          → vibes.diy / prod-v2 / cli-v2
//                        (prod Clerk: clerk.vibes.diy, pk_live)
//   --instance preview → CLERK_SECRET_KEY_PREVIEW  → dev-v2.vibesdiy.net + pr-*.workers.dev
//                        (dev/preview Clerk: *.clerk.accounts.dev, pk_test)
// NOTE: cli-v2 is an exact PROD clone (same Clerk), so it uses the PROD secret —
// do not mint cli tokens on the preview instance.
//
// Usage:
//   node clerk-qa-login.mjs --instance preview --origin https://dev-v2.vibesdiy.net
//   node clerk-qa-login.mjs --instance prod    --origin https://vibes.diy --shot /tmp/p.png
//   [--email a@b.com | --user-id user_xxx]  (default: git config user.email)
//   [--shot <png>]      screenshot of the signed-in shell (no token is ever on screen)
//   [--storage <json>]  write Playwright storageState (cookies) for session reuse
//   [--cdp <url>]       attach to an existing Chrome (CDP http/ws URL) instead of
//                       launching one — use to authenticate a browser another tool drives
//
// Cloud env accommodations (agents/cloud-browser-setup.md) are applied
// automatically when a Playwright Chromium is present under /opt/pw-browsers:
// route through $HTTPS_PROXY and cap TLS at 1.2 (the egress proxy can't reassemble
// Chrome's larger TLS1.3 ClientHello), plus --no-sandbox. On a workstation with a
// real Chrome and no /opt/pw-browsers, none of that is applied.
//
// Exit 0 on a verified session, 1 otherwise. Background:
// docs/specs/2026-06-28-clerk-signin-token-qa-login.md
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync, readlinkSync, readdirSync } from "node:fs";
import { dirname, resolve as presolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// Resolve Playwright from wherever it lives: a local node_modules (workstation)
// or the global install that ships with the cloud image (/opt/node22/lib/...).
function loadPlaywright() {
  const bases = [
    here, // local node_modules walking up from the skill
    process.cwd(),
    presolve(dirname(process.execPath), "..", "lib", "node_modules") + "/", // global next to `node`
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
const chromium = loadPlaywright();
if (!chromium) {
  console.error("clerk-qa-login: Playwright not found (need 'playwright' or 'playwright-core' installed, or on NODE_PATH).");
  process.exit(2);
}

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : d;
};
const wantJson = process.argv.includes("--json");
const instance = (arg("instance", "preview") || "").toLowerCase();
const origin = arg("origin");
const email = arg("email");
const userId = arg("user-id");
const shotPath = arg("shot");
const storagePath = arg("storage");
const cdpUrl = arg("cdp");
if (instance !== "prod" && instance !== "preview") {
  console.error(`clerk-qa-login: --instance must be 'prod' or 'preview' (got '${instance}').`);
  process.exit(2);
}
if (!origin) {
  console.error("clerk-qa-login: --origin is required (the target origin where window.Clerk is live).");
  process.exit(2);
}

// Resolve the Playwright Chromium the same way scripts/setup-cloud-browser.sh does;
// absent (a real workstation) → let Playwright resolve its own Chrome.
function resolveCloudChromium() {
  try {
    const link = "/opt/pw-browsers/chromium";
    if (existsSync(link)) {
      const p = readlinkSync(link);
      const abs = presolve("/opt/pw-browsers", p);
      if (existsSync(abs)) return abs;
    }
  } catch {
    /* fall through */
  }
  try {
    const dirs = readdirSync("/opt/pw-browsers")
      .filter((d) => d.startsWith("chromium-"))
      .sort();
    for (const d of dirs.reverse()) {
      const abs = `/opt/pw-browsers/${d}/chrome-linux/chrome`;
      if (existsSync(abs)) return abs;
    }
  } catch {
    /* not the cloud image */
  }
  return undefined;
}

function mint() {
  const a = [presolve(here, "clerk-signin-token.mjs"), "--instance", instance, "--json"];
  if (userId) a.push("--user-id", userId);
  else if (email) a.push("--email", email);
  // Child stdout is captured here, in-process — the token never reaches our stdout.
  const out = execFileSync("node", a, { encoding: "utf8" });
  return JSON.parse(out.trim());
}

// Consume runs in the page; `ticket` arrives as a function argument (never inlined
// into source), so it is not present in this file or in any log.
async function consumeFn(ticket) {
  for (let i = 0; i < 60 && !window.Clerk; i++) await new Promise((r) => setTimeout(r, 250));
  if (!window.Clerk) return { ok: false, err: "window.Clerk not present" };
  await window.Clerk.load?.();
  const before = { signedIn: !!window.Clerk.user, frontendApi: window.Clerk.frontendApi || null };
  let result;
  try {
    result = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket });
  } catch (e) {
    return { ok: false, err: "signIn.create threw: " + (e?.message || String(e)), before };
  }
  if (result.status !== "complete") return { ok: false, status: result.status, before };
  await window.Clerk.setActive({ session: result.createdSessionId });
  return {
    ok: true,
    before,
    userId: window.Clerk.user?.id ?? null,
    email: window.Clerk.user?.primaryEmailAddress?.emailAddress ?? null,
    sessionId: result.createdSessionId ? "present" : null,
  };
}

async function verifyFn() {
  const c = window.Clerk;
  const token = await c?.session?.getToken().catch(() => null);
  const txt = document.body?.innerText || "";
  return {
    clerkUserId: c?.user?.id ?? null,
    clerkEmail: c?.user?.primaryEmailAddress?.emailAddress ?? null,
    hasSessionCookie: /__session=|__client_uat=[^0]/.test(document.cookie),
    sessionTokenPresent: !!token,
    sessionTokenLen: (token || "").length,
    signInControlPresent: !!document.querySelector('[class*="cl-signIn"], a[href*="sign-in"]'),
    signedOutMarker: /\bsign in\b|\blog in\b/i.test(txt) && !c?.user,
    title: document.title,
  };
}

(async () => {
  const minted = mint(); // { token, userId, email, instance }
  const evidence = { instance, origin, resolvedUserId: minted.userId, resolvedEmail: minted.email };

  let browser, context, owns = false;
  if (cdpUrl) {
    browser = await chromium.connectOverCDP(cdpUrl);
    context = browser.contexts()[0] || (await browser.newContext());
  } else {
    const executablePath = resolveCloudChromium();
    const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
    const cloud = !!executablePath; // /opt/pw-browsers present ⇒ cloud image
    browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      ...(cloud && proxyServer ? { proxy: { server: proxyServer } } : {}),
      args: cloud ? ["--no-sandbox", "--disable-dev-shm-usage", "--disable-quic", "--ssl-version-max=tls1.2"] : [],
    });
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    owns = true;
  }

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60000 });
    evidence.consume = await page.evaluate(consumeFn, minted.token);
    if (evidence.consume.ok) {
      await page.goto(origin, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2000);
      evidence.authed = await page.evaluate(verifyFn);
      if (shotPath) {
        await page.screenshot({ path: shotPath });
        evidence.screenshot = shotPath;
      }
      if (storagePath) {
        await context.storageState({ path: storagePath });
        evidence.storageState = storagePath;
      }
    }
    evidence.PASS = !!(evidence.consume.ok && evidence.authed?.clerkUserId && evidence.authed?.hasSessionCookie);
    process.stdout.write(JSON.stringify(evidence, wantJson ? null : null, 2) + "\n");
    process.exitCode = evidence.PASS ? 0 : 1;
  } finally {
    if (owns) await browser.close();
    else await browser.close().catch(() => {});
  }
})().catch((e) => {
  console.error("clerk-qa-login: " + (e?.message || String(e)));
  process.exit(1);
});
