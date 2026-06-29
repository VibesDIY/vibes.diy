# Browser screenshots in the cloud env (chrome-devtools MCP)

The `mcp__chrome-devtools__*` tools (navigate, screenshot, snapshot, console,
network, etc.) work **out of the box in Claude Code cloud / web sessions** — a
SessionStart hook runs [`scripts/setup-cloud-browser.sh`](../scripts/setup-cloud-browser.sh)
automatically, so by default you should just call the tools. Prefer driving this
managed Chrome over asking a human to run a browser locally; the cloud env is the
default place we screenshot and QA.

If `navigate_page` fails with one of the errors below, the hook didn't run (older
session, hook disabled) — run the script by hand once and retry:

```bash
bash scripts/setup-cloud-browser.sh
```

It is idempotent and a no-op on a local workstation (where real Chrome exists and
there is no `/opt/pw-browsers` Chromium), so running it never hurts.

## What the cloud container is missing, and what the script fixes

The cloud image ships a Playwright **Chromium** under `/opt/pw-browsers` but not a
Google **Chrome** at the path `chrome-devtools-mcp` launches, and headful Chrome
there needs three accommodations the MCP server doesn't apply itself. Each maps
to an error you'll see if it's missing:

| Symptom from `navigate_page` / Chrome                                                           | Cause                                                     | Fix the script applies                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Could not find Google Chrome executable for channel 'stable' at /opt/google/chrome/chrome`     | No Chrome binary at the expected path                     | A shim at `/opt/google/chrome/chrome` that execs the Playwright Chromium (the `/opt/pw-browsers/chromium` symlink, or the newest versioned `chromium-*/chrome-linux/chrome` install — resolved at runtime) |
| `Target closed` / Chrome dies on launch                                                         | Runs as root; default sandbox can't initialize            | `--no-sandbox --disable-dev-shm-usage`                                                                                                                                                                     |
| `Missing X server to start the headful browser`                                                 | No display                                                | Starts `Xvfb :99` and exports `DISPLAY`                                                                                                                                                                    |
| `net::ERR_CONNECTION_CLOSED` on **every** HTTPS site (curl/openssl through the proxy work fine) | The egress proxy can't parse Chrome's TLS 1.3 ClientHello | Route through `$HTTPS_PROXY` with `--disable-quic --ssl-version-max=tls1.2`                                                                                                                                |

## Why the TLS 1.2 cap — the non-obvious one

Outbound HTTPS goes through the agent egress proxy (`$HTTPS_PROXY`, e.g.
`http://127.0.0.1:39423`). That proxy enforces per-host egress policy by reading
the **SNI** out of the TLS ClientHello, then splicing a pass-through tunnel to the
real origin (it does **not** MITM — `openssl s_client -proxy` through it shows the
real origin cert, e.g. Cloudflare-issued, `Verify return code: 0`).

Chrome's **TLS 1.3** ClientHello is large — post-quantum key share
(X25519MLKEM768) plus GREASE push it past one TCP segment. The proxy's SNI parser
reads only the first segment, can't reassemble the rest, and resets the
connection → `ERR_CONNECTION_CLOSED` during the handshake
(`net_error -100`, `SSL error code 1`). curl and openssl don't hit this because
their ClientHello is small enough to fit one segment.

Capping at **`--ssl-version-max=tls1.2`** produces a compact, single-segment
ClientHello the proxy parses cleanly. This is **not** a security downgrade of
origin verification: the proxy is pass-through, so Chrome still completes a real
TLS handshake with the origin and validates its cert against Chrome's built-in
roots. (Confirmed by loading `https://vibes.diy` with a completely empty NSS
store — no proxy CA import needed.)

`--disable-quic` stops Chrome wasting a round on QUIC (UDP/443), which the proxy
can't tunnel at all.

## Things that look like fixes but aren't needed

- **Importing the proxy CA into the NSS store (`certutil`).** Unnecessary — the
  proxy is pass-through, so origins present their real, publicly-trusted certs.
  The TLS 1.2 cap is the actual fix.
- **`--ignore-certificate-errors`.** Never. It disables verification and isn't
  even the problem (the failure was a connection reset, not a cert error).

## Ephemerality

Everything the script sets up (the shim, the Xvfb process) lives outside the repo
in the container's ephemeral filesystem and is gone when the container recycles.
That's fine — the SessionStart hook rebuilds it at the start of the next session.
Nothing here needs to be (or should be) committed except the script and this doc.

## Running the repo's Playwright / vitest-browser tests in the cloud env

The section above is about the **chrome-devtools MCP** browser (the one the agent
drives to screenshot and QA). That uses the container's bundled Chromium
(`chromium-1194`) and Just Works via the shim.

The repo's **own** browser tests are a different thing. `@playwright/test` and
`@vitest/browser-playwright` are pinned to `playwright@^1.61.1`, whose Chromium
build is revision **1228** — but the cloud image only ships **1194**. So
`playwright test` / vitest browser mode fail with:

```
browserType.launch: Executable doesn't exist at
/opt/pw-browsers/chromium-1228/chrome-linux/chrome
Please run … : playwright install
```

…and the naive `playwright install` ALSO fails in this env: its built-in
downloader pulls the ~180 MiB zip in one shot with no resume, and the agent
egress proxy drops the long transfer at ~80% every time
(`Download failed: server closed connection`). The headless-shell build is worse
— it's served (via the `dbazure` CDN path) from
`playwright.download.prss.microsoft.com`, which the proxy hard-blocks
(`HTTP 400 "GatewayExceptionResponse"`).

**The fix — run this before the repo's browser tests in a cloud session:**

```bash
pnpm run playwright:install      # → scripts/install-pw-chromium.sh
```

It is idempotent (a fast no-op once `chromium-<rev>` is installed) and a no-op on
a local workstation (no `/opt/pw-browsers`), so it's always safe to run. How it
sidesteps the proxy:

- The **Chrome-for-Testing** ("cft") artifacts — both the headful chrome and the
  headless-shell — are served from `storage.googleapis.com`, which the proxy
  **does** allow (unlike the MS host the `dbazure` path redirects to).
- `curl -L -C -` follows the redirect **and resumes** across the proxy's
  connection drops, so it fetches the whole zip reliably where Playwright's
  one-shot downloader can't.
- The script `curl`s the two cft zips into a localhost "mirror", serves them on
  `http://127.0.0.1:<port>/`, and runs `playwright install … chromium
chromium-headless-shell` with `PLAYWRIGHT_DOWNLOAD_HOST` pointed at the mirror
  — so Playwright fetches from localhost (no proxy) and does its own unzip /
  directory layout / `INSTALLATION_COMPLETE` markers / `.links` bookkeeping.

`ffmpeg-1011` is a dependency of the chromium install but is already shipped in
the image, so it's never re-downloaded. If a future image bumps Playwright, the
script reads the wanted revision from the pinned `playwright-core`'s
`browsers.json` automatically — no edit needed unless the cft download host
itself changes.

## Local workstation

None of the above applies on a developer's Mac/Linux workstation: there,
`chrome-devtools-mcp` drives a real, installed Chrome directly. The script
detects the absence of `/opt/pw-browsers` and exits without touching anything.
For the local-workstation browser-QA setup (real Chrome, persistent profile,
Google session seeding), see
[`.claude/skills/qa-pr/references/local-workstation-setup.md`](../.claude/skills/qa-pr/references/local-workstation-setup.md).
