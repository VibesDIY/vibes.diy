#!/usr/bin/env node
/**
 * /qa-pr — Gmail OTP poller
 *
 * Usage: node gmail-otp.mjs <plus-alias> [--dry-run] [--timeout-ms=60000]
 *
 * Polls the dedicated Gmail mailbox for a recent message addressed to
 * <plus-alias> from Clerk / Vibes. Prints the first 6-digit code or
 * magic-link URL found, or "TIMEOUT" on stderr after the timeout.
 *
 * Requires credentials written by setup-gmail.mjs at
 * ~/.config/vibes-qa/gmail-credentials.json (override with
 * QA_GMAIL_CREDENTIALS).
 *
 * STATUS (2026-05-21): scaffolding only. The qa-pr skill no longer invokes
 * this helper because Vibes' Clerk configuration is OAuth-only — there's
 * no email sign-up flow to receive an OTP through. The script is retained
 * intact so a future flow that does require an email round-trip (publish
 * confirmation emails, share invites, password reset, etc.) can pick it up
 * without re-implementing Gmail polling.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { argv, env, exit, stdout, stderr } from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const HELP = `Usage: node gmail-otp.mjs <plus-alias> [--dry-run] [--timeout-ms=60000]

Polls the Gmail mailbox configured by setup-gmail.mjs for a recent message
addressed to <plus-alias> and prints the first 6-digit code or magic-link
URL found on stdout. Exits non-zero with "TIMEOUT" on stderr if no match
arrives within the timeout window.

Options:
  --dry-run         Print the Gmail search query and exit without contacting
                    the API. Useful for offline checks.
  --timeout-ms=N    Override the default 60000 ms poll budget.
  --help            Show this message.

Environment overrides:
  QA_GMAIL_CREDENTIALS  Override the credentials file path.
`;

const args = argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  stdout.write(HELP);
  exit(args.length === 0 ? 1 : 0);
}

const alias = args.find((a) => !a.startsWith("--"));
if (!alias || !alias.includes("@")) {
  stderr.write("First positional argument must be a full email alias.\n");
  exit(1);
}
const dryRun = args.includes("--dry-run");
const timeoutMs = (() => {
  const flag = args.find((a) => a.startsWith("--timeout-ms="));
  if (!flag) return 60_000;
  const n = Number(flag.slice("--timeout-ms=".length));
  if (!Number.isFinite(n) || n <= 0) {
    stderr.write(`Invalid --timeout-ms: ${flag}\n`);
    exit(1);
  }
  return n;
})();

// Gmail's search syntax: "to:" matches the alias as it appears in the To
// header. The 5-minute "newer_than" window keeps us from picking up
// stale OTPs from earlier runs on the same alias.
const query = `to:${alias} newer_than:5m (subject:verification OR subject:verify OR subject:code OR subject:sign)`;

if (dryRun) {
  stdout.write(`Gmail search query: ${query}\n`);
  exit(0);
}

const credPath =
  env.QA_GMAIL_CREDENTIALS ??
  join(homedir(), ".config", "vibes-qa", "gmail-credentials.json");
const creds = JSON.parse(await readFile(credPath, "utf8"));

async function getAccessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) {
    throw new Error(`Refresh failed: ${r.status} ${await r.text()}`);
  }
  const j = await r.json();
  return j.access_token;
}

async function searchMessages(token) {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "5");
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Search failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.messages ?? [];
}

async function fetchMessageBody(token, id) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${await r.text()}`);
  return r.json();
}

function extractOtp(message) {
  // Walk all text/plain and text/html parts and concatenate their decoded
  // bodies. Then look for a 6-digit run (the Clerk OTP shape) or a
  // magic-link URL.
  const parts = [];
  const walk = (p) => {
    if (!p) return;
    if (p.body?.data) parts.push(Buffer.from(p.body.data, "base64url").toString("utf8"));
    (p.parts ?? []).forEach(walk);
  };
  walk(message.payload);
  const body = parts.join("\n");
  const code = body.match(/\b(\d{6})\b/);
  if (code) return code[1];
  const link = body.match(/https:\/\/[^\s"<>]+(?:verify|magic|sign[-_]in|auth)[^\s"<>]*/i);
  if (link) return link[0];
  return null;
}

const accessToken = await getAccessToken();
const start = Date.now();
let attempt = 0;
while (Date.now() - start < timeoutMs) {
  attempt++;
  const messages = await searchMessages(accessToken);
  for (const m of messages) {
    const full = await fetchMessageBody(accessToken, m.id);
    const otp = extractOtp(full);
    if (otp) {
      stdout.write(`${otp}\n`);
      exit(0);
    }
  }
  const remaining = timeoutMs - (Date.now() - start);
  if (remaining <= 0) break;
  const backoff = Math.min(2_000 * Math.pow(1.4, attempt - 1), 8_000, remaining);
  await delay(backoff);
}
stderr.write(`TIMEOUT after ${timeoutMs}ms polling for ${alias}\n`);
exit(2);
