# Running vitest browser-mode suites in the cloud with zero browser download

Source: `claude/issue-2989-qissmf`

The companion to the Chromium-mirror trick (`2026-06-29-playwright-chromium-cloud-mirror.md`):
that one gets the *exact* pinned Chromium build (1228) into the cloud image by
mirroring the Chrome-for-Testing zips past a hostile egress proxy. This one asks
a cheekier question — do the **vitest** browser suites even need the matching
build? For hook/DOM tests (`renderHook`, RTL, component tests) the answer is no.

The unlock is a one-liner in Playwright's contract: it version-gates the browsers
*it* downloads and manages, but it launches whatever binary you hand it via
`launchOptions.executablePath` without complaint. The cloud image already ships a
full `chromium-1194` (that's what the chrome-devtools MCP shim drives). So a tiny
shared helper (`scripts/vitest-cloud-chromium.mjs`) that every browser
`vitest.config` funnels its provider through — `playwright(cloudChromiumProviderOptions())`
— points `executablePath` at that pre-installed Chromium when the pinned
headless-shell build is absent, drops the sandbox for root (`chromiumSandbox:false`
+ `--disable-dev-shm-usage`, mirroring `setup-cloud-browser.sh`), and the
1194↔1228 mismatch just stops mattering. No 180 MiB download, no proxy, instant.

Two design details worth writing up. (1) It's a *layered fallback*, not a
clobber: the helper reads the wanted revision from `playwright-core`'s
`browsers.json` and only reaches for the image's Chromium when the exact
headless-shell build is missing — so if you *did* run `pnpm playwright:install`,
the matching build wins. (2) The whole thing is gated on `/opt/pw-browsers`
existing, so it's a hard no-op on CI and local workstations (returns `{}`,
Playwright's default resolution untouched). The gotcha that shaped the file
layout: the configs are `moduleResolution: nodenext`, so the import needs an
explicit extension and a resolvable type — hence a plain `.mjs` plus a
hand-written `.d.mts` next to it, which both esbuild (config loader) and tsc
resolve without pulling the script into any tsconfig. Also documented the
node-env escape hatch for pure-logic suites:
`vitest run --browser.enabled=false --environment=node`.
