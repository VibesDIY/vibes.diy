#!/usr/bin/env node
/**
 * /qa-pr — Gmail OAuth setup
 *
 * One-time interactive flow that obtains a refresh token for a dedicated
 * Gmail mailbox and writes it to ~/.config/vibes-qa/gmail-credentials.json.
 *
 * Prerequisites the operator must complete in Google Cloud Console first:
 *  1. Create or select a project.
 *  2. Enable the Gmail API for that project.
 *  3. Configure the OAuth consent screen (External, Testing) and add the
 *     dedicated Gmail address to the test users list.
 *  4. Create OAuth credentials → Application type "Desktop". Download the
 *     JSON; locate the client_id and client_secret.
 *
 * Then run this script and follow the prompts.
 */

import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, exit, argv, env } from "node:process";

const HELP = `Usage: node setup-gmail.mjs [--help]

One-time interactive flow that obtains a Gmail API refresh token and writes
it to ~/.config/vibes-qa/gmail-credentials.json. Prompts for client_id and
client_secret on stdin, opens an OAuth authorization URL in the browser via
\`open\` (macOS) or \`xdg-open\` (Linux), then catches the redirect on
http://127.0.0.1:53682/oauth2callback.

Environment overrides:
  QA_GMAIL_CREDENTIALS  Override the credentials file path.
  QA_GMAIL_PORT         Override the local redirect port (default 53682).
`;

if (argv.includes("--help") || argv.includes("-h")) {
  stdout.write(HELP);
  exit(0);
}

const CRED_PATH =
  env.QA_GMAIL_CREDENTIALS ??
  join(homedir(), ".config", "vibes-qa", "gmail-credentials.json");
const PORT = Number(env.QA_GMAIL_PORT ?? 53682);
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const rl = createInterface({ input: stdin, output: stdout });
const clientId = (await rl.question("Google OAuth client_id: ")).trim();
const clientSecret = (await rl.question("Google OAuth client_secret: ")).trim();
rl.close();

if (!clientId || !clientSecret) {
  stdout.write("client_id and client_secret are both required.\n");
  exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    if (url.pathname !== "/oauth2callback") {
      res.writeHead(404).end();
      return;
    }
    const c = url.searchParams.get("code");
    res.writeHead(200, { "content-type": "text/plain" }).end(
      c
        ? "OK — you can close this tab and return to the terminal."
        : "Missing ?code in callback URL.",
    );
    server.close();
    if (c) resolve(c);
    else reject(new Error("OAuth callback arrived without ?code"));
  });
  server.listen(PORT, "127.0.0.1", () => {
    stdout.write(`\nOpen this URL in your browser to authorize:\n\n${authUrl.toString()}\n\n`);
  });
});

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});
const tokens = await tokenResponse.json();
if (!tokenResponse.ok || !tokens.refresh_token) {
  stdout.write(`Token exchange failed: ${JSON.stringify(tokens)}\n`);
  exit(1);
}

await mkdir(dirname(CRED_PATH), { recursive: true });
await writeFile(
  CRED_PATH,
  JSON.stringify(
    {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      scope: SCOPE,
      saved_at: new Date().toISOString(),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
stdout.write(`\nSaved credentials to ${CRED_PATH} (mode 0600).\n`);
exit(0);
