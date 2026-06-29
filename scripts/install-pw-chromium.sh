#!/usr/bin/env bash
#
# install-pw-chromium.sh — make the repo's pinned Playwright Chromium present
# in the Claude Code cloud / remote execution environment so the project's
# Playwright + @vitest/browser-playwright test suites can actually run.
#
# THE PROBLEM
# -----------
# The cloud container image ships ONE Playwright Chromium build under
# /opt/pw-browsers (currently chromium-1194). The repo pins a newer Playwright
# (playwright@^1.61.1) whose Chromium build is a different revision (1228). So
# `playwright test` / vitest browser mode bail out with:
#
#     browserType.launch: Executable doesn't exist at
#     /opt/pw-browsers/chromium-<rev>/chrome-linux/chrome
#     Looks like Playwright Test or Playwright was just installed or updated.
#     Please run the following command to download new browsers: playwright install
#
# …and the obvious `playwright install` ALSO fails here: its built-in downloader
# pulls the ~180 MiB zip in a single shot with no resume, and the agent egress
# proxy drops the long transfer at ~80% every time ("server closed connection").
# Worse, the headless-shell build is served (via cdn.playwright.dev's `dbazure`
# path) from playwright.download.prss.microsoft.com, which the proxy hard-blocks
# (HTTP 400 "GatewayExceptionResponse").
#
# THE FIX
# -------
# The Chrome-for-Testing ("cft") artifacts — both the headful chrome and the
# headless-shell — are served from storage.googleapis.com, which the proxy DOES
# allow. curl (unlike Playwright's downloader) follows the redirect and, with
# `-C -`, resumes across the proxy's connection drops, so it can fetch the whole
# zip reliably. So we:
#
#   1. curl the cft chrome + cft headless-shell zips into a localhost "mirror"
#      laid out at the exact paths Playwright requests.
#   2. Serve that mirror over http://127.0.0.1:<port>/ .
#   3. Run `playwright install chromium chromium-headless-shell` with
#      PLAYWRIGHT_DOWNLOAD_HOST pointed at the mirror, so Playwright fetches from
#      localhost (no proxy, no resets) and does its own unzip / directory layout
#      / INSTALLATION_COMPLETE markers / .links bookkeeping.
#
# It is idempotent (a no-op once the wanted revision is installed) and a no-op on
# a local workstation (no /opt/pw-browsers), so it is safe to run anytime.
#
# Background + rationale: agents/cloud-browser-setup.md
set -euo pipefail

log() { printf 'install-pw-chromium: %s\n' "$*" >&2; }

# --- Only meaningful in the cloud container ---------------------------------
# A local workstation has no /opt/pw-browsers Playwright cache; there `playwright
# install` works against the public CDN directly. Bow out.
PW_CACHE="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
if [ ! -d "$PW_CACHE" ]; then
  log "no Playwright browser cache at $PW_CACHE — assuming local workstation, nothing to do."
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH="${TMPDIR:-/tmp}/pw-chromium-install"
mkdir -p "$SCRATCH"

# --- 1. Resolve the Playwright version this repo wants ----------------------
# Prefer an already-installed playwright-core (its browsers.json is the source of
# truth for the revision). Fall back to the version pinned in the root
# package.json. We then make a throwaway playwright-core of that version present
# in $SCRATCH purely to read its browsers.json — this works whether or not the
# repo's node_modules are installed yet.
read_pw_version_from_pkg() {
  node -e '
    const fs=require("fs");
    const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const d={...(p.devDependencies||{}),...(p.dependencies||{})};
    const v=d.playwright||d["@playwright/test"]||d["playwright-core"]||"";
    process.stdout.write(String(v).replace(/^[\^~>=<\s]+/,""));
  ' "$REPO_ROOT/package.json" 2>/dev/null || true
}

PW_VERSION="$(read_pw_version_from_pkg)"
if [ -z "$PW_VERSION" ]; then
  log "could not determine pinned Playwright version from package.json — aborting."
  exit 1
fi
log "repo pins Playwright $PW_VERSION."

# Ensure a playwright-core of the pinned version is present in $SCRATCH (cheap;
# ~1s, no browser download — we only want its browsers.json + cli.js).
PW_CORE_DIR="$SCRATCH/node_modules/playwright-core"
NEED_INSTALL=1
if [ -f "$PW_CORE_DIR/package.json" ]; then
  HAVE="$(node -e 'process.stdout.write(require(process.argv[1]).version)' "$PW_CORE_DIR/package.json" 2>/dev/null || true)"
  [ "$HAVE" = "$PW_VERSION" ] && NEED_INSTALL=0
fi
if [ "$NEED_INSTALL" = 1 ]; then
  log "fetching playwright-core@$PW_VERSION into scratch (metadata only)…"
  ( cd "$SCRATCH" && npm i --no-save --no-audit --no-fund --silent "playwright-core@$PW_VERSION" ) \
    || { log "npm install of playwright-core@$PW_VERSION failed."; exit 1; }
fi

BROWSERS_JSON="$PW_CORE_DIR/browsers.json"
[ -f "$BROWSERS_JSON" ] || { log "browsers.json missing at $BROWSERS_JSON — aborting."; exit 1; }

# Pull the chromium revision + Chrome-for-Testing version out of browsers.json.
REV="$(node -e 'const b=require(process.argv[1]);const c=b.browsers.find(x=>x.name==="chromium");process.stdout.write(c.revision)' "$BROWSERS_JSON")"
CFT_VER="$(node -e 'const b=require(process.argv[1]);const c=b.browsers.find(x=>x.name==="chromium");process.stdout.write(c.browserVersion||"")' "$BROWSERS_JSON")"
if [ -z "$REV" ] || [ -z "$CFT_VER" ]; then
  log "could not read chromium revision/version from browsers.json — aborting."
  exit 1
fi
log "wanted: chromium revision $REV (Chrome for Testing $CFT_VER)."

# --- 2. Idempotency: already installed? -------------------------------------
if [ -f "$PW_CACHE/chromium-$REV/INSTALLATION_COMPLETE" ] \
   && [ -f "$PW_CACHE/chromium_headless_shell-$REV/INSTALLATION_COMPLETE" ]; then
  log "chromium-$REV already installed in $PW_CACHE — nothing to do."
  exit 0
fi

# --- 2b. Preflight: ffmpeg must already be present --------------------------
# `playwright install chromium` also installs the matching ffmpeg build, but
# ffmpeg is ONLY served from the `dbazure` CDN path (→ the MS host the proxy
# hard-blocks) — we can't mirror it the way we mirror the cft chrome. The cloud
# image pre-seeds the right ffmpeg revision, so this is normally fine. If a
# future image stops doing that, surface a clear, actionable message up front
# rather than a confusing mid-install proxy failure.
FFMPEG_REV="$(node -e 'const b=require(process.argv[1]);const f=b.browsers.find(x=>x.name==="ffmpeg");process.stdout.write(f?f.revision:"")' "$BROWSERS_JSON" 2>/dev/null || true)"
if [ -n "$FFMPEG_REV" ] && [ ! -f "$PW_CACHE/ffmpeg-$FFMPEG_REV/INSTALLATION_COMPLETE" ]; then
  log "WARNING: ffmpeg-$FFMPEG_REV is not pre-seeded in $PW_CACHE. ffmpeg is only"
  log "         served from the proxy-blocked MS host (not the cft/googleapis path"
  log "         we mirror), so the chromium install will fail fetching it. This"
  log "         image may have stopped bundling ffmpeg — update this script"
  log "         (see agents/cloud-browser-setup.md) to handle ffmpeg too."
fi

# --- 3. Build the localhost mirror via curl ---------------------------------
# Playwright (with PLAYWRIGHT_DOWNLOAD_HOST set) fetches the cft artifacts at:
#   /builds/cft/<CFT_VER>/linux64/chrome-linux64.zip
#   /builds/cft/<CFT_VER>/linux64/chrome-headless-shell-linux64.zip
# We mirror those exact paths. The public source is cdn.playwright.dev, which
# 307-redirects the cft path to storage.googleapis.com (proxy-allowed). curl
# follows the redirect (-L) and resumes partial transfers (-C -).
MIRROR="$SCRATCH/mirror"
CFT_DIR="$MIRROR/builds/cft/$CFT_VER/linux64"
mkdir -p "$CFT_DIR"

CDN="https://cdn.playwright.dev"
fetch_zip() {
  # $1 = filename under the cft linux64 dir
  local name="$1" dest="$CFT_DIR/$1" url="$CDN/builds/cft/$CFT_VER/linux64/$1"
  if unzip -t "$dest" >/dev/null 2>&1; then
    log "$name already present and valid — reusing."
    return 0
  fi
  log "downloading $name …"
  local i
  for i in 1 2 3 4 5 6; do
    if curl -fsSL -C - --retry 6 --retry-all-errors --retry-delay 2 --max-time 600 \
         -o "$dest" "$url"; then
      if unzip -t "$dest" >/dev/null 2>&1; then
        log "$name downloaded ($(stat -c%s "$dest" 2>/dev/null) bytes)."
        return 0
      fi
    fi
    log "attempt $i for $name failed; retrying…"
    # A leftover error body (e.g. a proxy 400) would poison -C - resume; drop it
    # unless it looks like a real partial zip.
    if ! unzip -t "$dest" >/dev/null 2>&1 && [ "$(stat -c%s "$dest" 2>/dev/null || echo 0)" -lt 1000000 ]; then
      rm -f "$dest"
    fi
    sleep 2
  done
  log "ERROR: could not download $name from $url"
  return 1
}

fetch_zip "chrome-linux64.zip"
fetch_zip "chrome-headless-shell-linux64.zip"

# --- 4. Serve the mirror and run the real install ---------------------------
MIRROR_LOG="$SCRATCH/mirror.log"
PORT_FILE="$SCRATCH/port"
rm -f "$PORT_FILE"

# Tiny static server: streams files under $MIRROR, logs hits/misses, prints its
# chosen ephemeral port on stdout. Resolved paths are confined to ROOT so a
# crafted request (e.g. /../../etc/passwd) can never escape the mirror dir.
MIRROR="$MIRROR" node -e '
  const http=require("http"),fs=require("fs"),path=require("path");
  const ROOT=path.resolve(process.env.MIRROR);
  const s=http.createServer((req,res)=>{
    let rel;
    try { rel=decodeURIComponent(req.url.split("?")[0]); }
    catch (_) { process.stderr.write("BADREQ "+req.url+"\n");res.writeHead(400);return res.end(); }
    const f=path.resolve(path.join(ROOT,rel));
    if(f!==ROOT && !f.startsWith(ROOT+path.sep)){
      process.stderr.write("DENY "+req.url+"\n");res.writeHead(403);return res.end();
    }
    fs.stat(f,(e,st)=>{
      if(e||!st.isFile()){process.stderr.write("MISS "+req.url+"\n");res.writeHead(404);return res.end();}
      res.writeHead(200,{"content-length":st.size});
      fs.createReadStream(f).pipe(res);
    });
  });
  s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);});
' >"$PORT_FILE" 2>"$MIRROR_LOG" &
MIRROR_PID=$!
trap 'kill "$MIRROR_PID" 2>/dev/null || true' EXIT

# Wait for the server to report its port.
for _ in $(seq 1 50); do
  [ -s "$PORT_FILE" ] && break
  sleep 0.1
done
PORT="$(cat "$PORT_FILE" 2>/dev/null || true)"
if [ -z "$PORT" ]; then
  log "mirror server did not start — see $MIRROR_LOG."
  exit 1
fi
log "mirror serving on http://127.0.0.1:$PORT"

log "running playwright install (chromium + headless-shell) from the mirror…"
# PLAYWRIGHT_SKIP_BROWSER_GC=1 is critical here. `playwright install` normally
# runs a browser-GC pass FIRST, deleting any browser dir in $PW_CACHE not
# referenced by a registered .links entry. Our scratch playwright-core only
# links the 1228 build, so without this the GC would delete the image's bundled
# chromium-1194 BEFORE downloading 1228 — and if the download then fails partway
# (proxy hiccup, a future image missing ffmpeg, etc.) the cache is left with NO
# usable Chromium, breaking the chrome-devtools MCP shim too. We only ever add
# browsers here; we never want to remove the bundled one.
PLAYWRIGHT_SKIP_BROWSER_GC=1 PLAYWRIGHT_BROWSERS_PATH="$PW_CACHE" \
  PLAYWRIGHT_DOWNLOAD_HOST="http://127.0.0.1:$PORT" \
  node "$PW_CORE_DIR/cli.js" install chromium chromium-headless-shell

# --- 5. Verify -------------------------------------------------------------
if [ -f "$PW_CACHE/chromium-$REV/INSTALLATION_COMPLETE" ]; then
  log "done. chromium-$REV installed in $PW_CACHE."
else
  log "ERROR: chromium-$REV still missing after install."
  exit 1
fi
