#!/usr/bin/env node
// Mint a Clerk sign-in token for headless qa-pr login (cloud sessions).
//
// Backend-only: needs CLERK_SECRET_KEY (the qa-pr harness env — never committed).
// Resolves the operator's Clerk userId by email (default: `git config
// user.email`), then mints a one-time sign-in token the browser consumes via the
// ticket strategy. Dependency-free — plain fetch against the Clerk Backend API.
//
// Usage:
//   CLERK_SECRET_KEY=sk_... node clerk-signin-token.mjs [--email a@b.com] [--user-id user_xxx] [--json]
//
// Output (default): the bare token on stdout (so it can be captured into a var).
//   --json: { token, userId, email } for the harness.
//
// Background: docs/specs/2026-06-28-clerk-signin-token-qa-login.md
import { execSync } from "node:child_process";

const BAPI = "https://api.clerk.com/v1";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}
const wantJson = process.argv.includes("--json");

function die(msg) {
  process.stderr.write(`clerk-signin-token: ${msg}\n`);
  process.exit(1);
}

const secret = process.env.CLERK_SECRET_KEY;
if (!secret) {
  die(
    "CLERK_SECRET_KEY is not set. Provide the secret for the TARGET instance " +
      "(prod for vibes.diy, dev/preview for *.workers.dev previews) in the harness env.",
  );
}
if (!secret.startsWith("sk_")) {
  die("CLERK_SECRET_KEY does not look like a Clerk secret key (expected sk_…).");
}

async function bapi(path, init = {}) {
  const res = await fetch(`${BAPI}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    die(`Clerk BAPI ${init.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 400)}`);
  }
  return body ? JSON.parse(body) : undefined;
}

async function resolveUserId() {
  const explicit = arg("user-id");
  if (explicit) return explicit;

  let email = arg("email");
  if (!email) {
    try {
      email = execSync("git config user.email", { encoding: "utf8" }).trim();
    } catch {
      /* fall through to the error below */
    }
  }
  if (!email) {
    die("No --user-id and no email (pass --email or set git config user.email).");
  }

  // GET /users?email_address=<email> → [{ id, ... }]
  const users = await bapi(`/users?email_address=${encodeURIComponent(email)}`);
  if (!Array.isArray(users) || users.length === 0) {
    die(`No Clerk user found for email ${email} on this instance. Wrong instance secret?`);
  }
  if (users.length > 1) {
    process.stderr.write(`clerk-signin-token: ${users.length} users match ${email}; using the first.\n`);
  }
  return { userId: users[0].id, email };
}

const resolved = await resolveUserId();
const userId = typeof resolved === "string" ? resolved : resolved.userId;
const email = typeof resolved === "string" ? undefined : resolved.email;

// POST /sign_in_tokens { user_id } → { token, ... }
const minted = await bapi("/sign_in_tokens", {
  method: "POST",
  body: JSON.stringify({ user_id: userId }),
});
if (!minted?.token) {
  die(`sign_in_tokens response had no token: ${JSON.stringify(minted).slice(0, 300)}`);
}

if (wantJson) {
  process.stdout.write(JSON.stringify({ token: minted.token, userId, email }) + "\n");
} else {
  process.stdout.write(minted.token + "\n");
}
