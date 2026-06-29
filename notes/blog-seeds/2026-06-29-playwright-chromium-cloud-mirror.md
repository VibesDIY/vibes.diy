# Getting the repo's Playwright Chromium installed behind a hostile egress proxy

Source: `claude/browser-revision-mismatch-5j7rwx`

The cloud agent env ships one Chromium build (`chromium-1194`); the repo pins
`playwright@1.61.1`, which wants build `1228`. So the project's `playwright test`
/ `@vitest/browser-playwright` suites couldn't run in cloud sessions — and the
obvious `playwright install` failed too, which is the interesting part.

Two distinct proxy failure modes stacked up: (1) Playwright's built-in downloader
pulls the ~180 MiB zip in a single shot with no resume, and the egress proxy
drops the long transfer at ~80% every time; (2) the headless-shell build's
`dbazure` CDN path redirects to `playwright.download.prss.microsoft.com`, which
the proxy hard-blocks with `400 GatewayExceptionResponse`. The unlock: the
Chrome-for-Testing ("cft") artifacts are served from `storage.googleapis.com`
(proxy-allowed), and `curl -L -C -` both follows the redirect and *resumes*
across the proxy's connection drops — so curl gets the whole zip where
Playwright's one-shot fetch can't.

The fix (`scripts/install-pw-chromium.sh`) is a nice little pattern: rather than
hand-lay-out the browser dir + markers (fragile), it `curl`s the cft zips into a
localhost mirror, serves them on `127.0.0.1`, and runs the real
`playwright install` with `PLAYWRIGHT_DOWNLOAD_HOST` pointed at the mirror — so
Playwright does its own unzip/layout/`INSTALLATION_COMPLETE`/`.links` bookkeeping,
fetching from localhost with no proxy in the path. The trade-off worth writing up:
"don't fight the proxy on the big transfer; move the big transfer off the proxy
and let the tool do what it's good at." Also a reminder that ephemeral cloud
caches (`/opt/pw-browsers`) mean a working install has to be a committed,
idempotent script, not a one-time manual step.
