# The TLS 1.3 ClientHello that broke every browser screenshot in the cloud

Source: `claude/browser-screenshot-testing-bwy7yv` (chrome-devtools MCP in cloud sessions)

Getting `mcp__chrome-devtools__*` to screenshot `vibes.diy` from a Claude Code
cloud session meant clearing four layers, three of them boring (no Chrome binary
at the expected path → shim to the Playwright Chromium; runs as root → `--no-sandbox`;
no display → `Xvfb`). The fourth was the interesting one and the reason this is
worth a post.

Every HTTPS navigation died with `net::ERR_CONNECTION_CLOSED` — but `curl` and
`openssl s_client` through the *same* egress proxy returned 200 and the real
origin cert. So the proxy worked, the CA was fine (the proxy is pass-through, not
MITM — it presents the origin's real cert), and Chrome was definitely using the
proxy (pointing it at a dead port changed the error to `ERR_PROXY_CONNECTION_FAILED`).
Headless Chrome's stderr gave the tell: `handshake failed; SSL error code 1,
net_error -100` — the connection died *during the TLS handshake*.

The cause: the egress proxy enforces per-host policy by reading **SNI** out of the
TLS ClientHello, then splicing a raw tunnel to the origin. Chrome's **TLS 1.3**
ClientHello is big — post-quantum key share (X25519MLKEM768) plus GREASE push it
past one TCP segment. The proxy's SNI parser reads only the first segment, can't
reassemble, and resets. `curl`/`openssl` never tripped it because their
ClientHello fits in one segment. The fix is one flag: `--ssl-version-max=tls1.2`,
which yields a compact single-segment ClientHello. Crucially this is *not* a
verification downgrade — the proxy is pass-through, so Chrome still does a real
TLS handshake with the origin and validates against its built-in roots (proven by
loading the site with a completely empty NSS store).

Two angles worth a full post:

1. **"curl works but the browser doesn't" is a fingerprint, not a fluke.** When a
   policy middlebox parses the ClientHello, the *size and shape* of that hello —
   not just the destination — decides whether you get through. Modern browsers
   ship large TLS 1.3 ClientHellos (PQ key shares, GREASE) that span segments;
   minimal clients don't. The asymmetry is the diagnosis. Reach for the byte-level
   tell (`net_error -100` mid-handshake) before blaming certs.

2. **The red-herring fix that "worked" for the wrong reason.** Importing the proxy
   CA into Chrome's NSS store felt like progress and the next attempt succeeded —
   but the CA import was irrelevant; the TLS-1.2 cap applied in the same step was
   the actual fix. Always re-test the minimal change in isolation (empty NSS store
   → still works) before writing the import into a setup script you'll ship. The
   shipped `scripts/setup-cloud-browser.sh` is smaller and more honest for it.
