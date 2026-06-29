# identity-ship-verify — confirm a de-fireproof identity ship on prod with no re-login

Runbook for verifying an **identity/device-id runtime** ship (the lifted
keybag, owned device-id/cert schemas, dash-client, Clerk token decode — the
`@vibes.diy/identity` extraction that replaced `@fireproof/core-keybag`). The
contract these ships must hold: **nothing on the wire changed** — existing
device certs and Clerk tokens keep working with **no forced re-login**. A break
here is an auth/sign-in regression and is a **rollback** signal.

Three checks, each PASS/FAIL with evidence. Steps 1–2 are the gate; step 3 is
the one part the headless seed can't cover (the real CA-callback enroll write).

> This is the auth-specific companion to [cli-then-prod.md](cli-then-prod.md)
> (general stage-on-cli verify) and [authed-browser-debugging.md](authed-browser-debugging.md)
> (drive a logged-in browser). Read those for the shared mechanics; this doc
> adds what's auth-shipping-specific and the headless-`login` recipe that lives
> nowhere else.

## Facts you don't need to re-derive

- **Prod worker URL for the CLI** is the CLI default: `https://vibes.diy/api?.stable-entry.=cli`
  (`DEFAULT_API_URL` in `vibes-diy/cli/cli-ctx.ts`). On `vibes.diy`,
  `.stable-entry.=cli` routes to `cli-v2.vibesdiy.net`, else `prod-v2.vibesdiy.net`
  (`deriveHostnameBase`, `vibes-diy/cli/cmds/pull-cmd.ts`). cli is an **exact
  prod clone** sharing the same Neon/Clerk/data plane ([environments.md](environments.md)),
  so verifying against `?.stable-entry.=cli` exercises the prod identity stack.
- **Shipped CLI version** = npm `latest` dist-tag: `npm view vibes-diy version dist-tags`.
  The repo `vibes-diy/package.json` is `0.0.0` (version is stamped at publish), so
  don't compare against it — compare `npx vibes-diy@latest --version` to the
  `latest` tag to prove you're not on a stale cache. (`pkg@p*` is the publish tag;
  see [deploy-tags.md](deploy-tags.md).)
- **The prod device-id cert is handed to cloud sessions as `$VIBES_DEVICE_ID`** —
  a device-id keybag item (raw or base64 JSON; the full `~/.fireproof/keybag/<id>.json`
  or the bare `{deviceId, cert}`). `seedDeviceIdFromEnv` (`vibes-diy/cli/device-id-env.ts`)
  writes it into the keybag **only when no cert exists yet** (an interactive login
  always wins). It is a credential: **never print, log, or commit it** — pass it
  through `env`, never echo it.
- **Operator account**: `--email jchris@gmail.com` resolves the Clerk user via the
  instance admin secret (it need not match the git identity — see
  [authed-browser-debugging.md](authed-browser-debugging.md)).
- **Instance discipline**: `--instance prod` (`CLERK_SECRET_KEY`, `clerk.vibes.diy`)
  for `vibes.diy` / `prod-v2` / `cli-v2`. preview is a different instance.
- **Diagnostics if a step fails**: `wrangler tail vibes-diy-v2 --env prod`
  (worker names in [wrangler-tail.md](wrangler-tail.md)) to capture the server-side
  verify error. Not part of the gate — only consult on failure.

## Step 1 — Browser sign-in (lifted dash-client + Clerk token decode)

1. Mint a real prod session and export storage state (this _is_ the Clerk
   sign-in + token decode):
   ```sh
   node .claude/skills/qa-pr/scripts/clerk-qa-login.mjs \
     --instance prod --origin https://vibes.diy --email jchris@gmail.com \
     --storage /tmp/state.prod.json
   #  → require "PASS": true with a non-null authed.clerkUserId
   ```
2. Drive a logged-in browser to `https://vibes.diy/`, reusing that storage state.
   Copy the cloud-launch boilerplate (`loadChromium` / `resolveCloudChromium` /
   `--no-sandbox …ssl-version-max=tls1.2` / `proxy: { server: HTTPS_PROXY }`)
   verbatim from `.claude/skills/qa-pr/scripts/clerk-authed-shot.mjs`. Assert:
   - `document.body.innerText` is **not** signed-out; the **dashboard list renders**
     — count anchors matching `/(vibe|chat)/<owner>/<slug>` (this is the
     `useRecentVibes` SSR loader; ~50 links for a populated account).
   - Open one vibe and wait for the app **iframe** to paint — the preview frame's
     host contains `--` (`<slug>--<owner>.prod-v2.vibesdiy.net`); poll its
     `document.body.innerText.length > 0` (see the `waitForAppPaint` helper in
     `clerk-authed-shot.mjs`).
   - **Network gate**: capture `page.on("response")`; **FAIL on any 4xx/5xx** for
     app/api calls. Clerk decode path should be 2xx: `clerk.vibes.diy/v1/client`,
     `/v1/environment`, and the `assets.prod-v2…/_auth/session` POST.
   - **"0 PUTs" is NOT a failure.** The signed-in vibes list is **SSR-hydrated on
     the document GET**, so a read-only dashboard load issues no dashboard `PUT`s.
     The real gate is "no 4xx/5xx", not "saw a PUT". (304 = cache, 307 =
     Clerk versioned-asset redirect — both normal.)

PASS = signed-in, list renders, a vibe opens (iframe paints), zero 4xx/5xx.

## Step 2 — CLI device-id round-trip, headless seed (keybag write→read→sign + worker verify)

```sh
npx vibes-diy@latest --version          # must equal the npm `latest` dist-tag
SCRATCH="$(mktemp -d)"
HOME="$SCRATCH" VIBES_DEVICE_ID="$VIBES_DEVICE_ID" \
  npx vibes-diy@latest list --api-url 'https://vibes.diy/api?.stable-entry.=cli' \
  > "$SCRATCH/out.txt" 2> "$SCRATCH/err.txt"
echo "exit:$?  lines:$(wc -l < "$SCRATCH/out.txt")"
head "$SCRATCH/out.txt"
rm -rf "$SCRATCH"                        # delete the scratch keybag
```

PASS = exit 0 and a **personalized** listing of real vibes (proves seeded
`setDeviceId` write → `getDeviceId` read → ES256 token sign → prod-worker
verify). FAIL = non-zero exit, `not authenticated`/401, or empty/error.

## Step 3 — Interactive `vibes-diy login` headlessly (the real CA-callback enroll write)

This is the part the headless seed skips: CSR → CA sign → **persist**. It's
drivable in a cloud session, but two gotchas will eat an hour if you don't know
them up front.

**How `login` works** (`vibes-diy/cli/cmds/login-cmd.ts` → `deviceIdRegisterEvento`):
it generates a CSR, starts a **localhost HTTP server on a random port**, and
prints `URL: https://vibes.diy/settings/csr-to-cert?csr=<CSR>&returnUrl=http://localhost:<port>/cert`,
then blocks up to `--timeout` seconds for the cert. The
`/settings/csr-to-cert` page (`vibes.diy/pkg/app/routes/settings/csr-to-cert.tsx`)
**auto-submits** the CSR once Clerk reports `isLoaded && isSignedIn`, then after a
**5-second** `waitUntilClose` timer redirects the browser to `returnUrl?cert=…`.

**Gotcha A — don't close the browser early.** Clerk init + the 5s redirect timer
is ≈ 8–12s. A driver that screenshots and closes at ~8s kills the page before the
callback fires → `login` waits the full timeout and exits 1. **Wait until the main
frame URL actually becomes `localhost:<port>`.**

**Gotcha B — the agent proxy rejects the plain-HTTP localhost callback.** The
browser is launched with `proxy: { server: HTTPS_PROXY }` (required for the HTTPS
`vibes.diy` leg), and it routes the `http://localhost:<port>/cert` navigation
**through that proxy**, which only accepts HTTPS CONNECT tunnels and answers with
the `agent-proxy relay: this proxy only accepts HTTPS CONNECT tunnels` error — so
the cert never reaches the CLI server. **`proxy.bypass: "localhost,127.0.0.1"`
did NOT fix it.** The fix that works: **intercept localhost requests with
`context.route()` and service them with a direct Node `http.get` (no proxy), then
`route.fulfill()` the response back.** That Node GET delivers the cert to the
CLI's local server and completes enrollment:

```js
import http from "node:http";
const get = (u) =>
  new Promise((res, rej) => {
    const r = http.get(u, { timeout: 15000 }, (x) => {
      let b = "";
      x.on("data", (c) => (b += c));
      x.on("end", () => res({ status: x.statusCode, body: b, ctype: x.headers["content-type"] }));
    });
    r.on("error", rej);
    r.on("timeout", () => r.destroy(new Error("local timeout")));
  });
// launch with proxy AND this route; reuse storage state from a fresh clerk-qa-login mint:
await context.route(
  (url) => {
    try {
      const h = new URL(url).hostname;
      return h === "localhost" || h === "127.0.0.1";
    } catch {
      return false;
    }
  },
  async (route) => {
    const r = await get(route.request().url());
    await route.fulfill({ status: r.status, contentType: r.ctype, body: r.body });
  }
);
await page.goto(caUrl, { waitUntil: "domcontentloaded" });
// then poll page.url() up to ~75s until it contains "localhost:<port>"
```

**Orchestration**: start `login --timeout 150` in the background (isolated `HOME`,
`env -u VIBES_DEVICE_ID` so it really enrolls), scrape the `csr-to-cert` URL from
its output, mint a fresh prod session (`clerk-qa-login … --storage /tmp/state.enroll.json`),
run the driver above, `wait` for `login`, then run `list` in the same `HOME`.

Success markers: `login` prints `✓ Registration complete! Certificate successfully
stored with Device ID.` and exits 0; `list` returns a personalized listing.
**Side effect**: this enrolls a _new real device cert_ on the account's CA
(server-side persists) — that's inherent to testing the enroll path and is
expected. Clean up the local `HOME`/keybag after.

## Secret & cleanup hygiene (every run)

- **Never** print/log/commit `$VIBES_DEVICE_ID` or the storage-state cookie file.
  Redact `csr=…` and `cert=…` in any captured `login`/browser output before
  echoing.
- `rm -rf` every scratch `HOME` (they hold device-cert keybags) and
  `rm -f /tmp/state.*.json` when done. Write storage-state files under `/tmp`,
  never in the repo (`clerk-authed-shot.mjs` refuses a repo-local path).
- Report a PASS/FAIL line per step with the real evidence (exit codes, a sample
  of the listing, error text + the matching `wrangler tail` line on failure). If
  green, state explicitly that **existing credentials verified with no re-login**.
