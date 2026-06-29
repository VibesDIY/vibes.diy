---
title: "Why our agents don't get a laptop"
date: 2026-06-28T12:00:00Z
author: "Vibes DIY"
summary: "A capability that only works on a hand-configured laptop quietly pushes all the work back to the laptop. Here's why we made cloud containers the default home for agent QA — and three war stories from getting browser validation to run there."
glyph: "☁ not 💻"
---

The fastest way to make an agent's work reproducible is to stop running it on your machine. We want agent work — including browser QA — to happen in ephemeral cloud containers by default: not as a heroic stunt, but as the boring, standard place it runs. The reasoning is almost embarrassingly simple — a capability that only works on a hand-configured laptop quietly pushes everything back toward the laptop.

Look at what it takes to drive a browser QA pass on a workstation. It's a real checklist: install Chrome, authenticate `gh`, and the genuinely fiddly one — seed a Google Workspace session into a specific chrome-devtools profile directory, once per engineer, being careful not to pollute it. That's per-person onboarding that rots, drifts, and silently differs between machines. "Works on mine." The cloud version is a SessionStart hook: every session, every agent, identical setup, zero steps. The capability stops being a thing a few people have configured and becomes a thing the fleet just *has*.

That difference is the whole point. A check that needs setup gets skipped under deadline; a check that's already wired up gets used. We want validation to be **standard operating procedure** — every PR exercises what it changed against a real running environment before it's called ready, the same way every PR gets a blog seed and a review. You cannot mandate a step that only works on some machines. An SOP has to be universally available first, and it has to scale to many agents in parallel, each in an isolated container — which a shared laptop never will.

There's a principle hiding in here worth saying out loud: **reproducibility beats power.** The cloud Chromium is not more capable than a developer's Chrome. It's more *uniform*. For an agent, a clean, identical, disposable environment every run is worth more than a powerful bespoke one, because it removes the entire class of "it behaved differently on my setup" failures and makes a result something anyone can re-run and trust.

But wanting agents in the cloud and actually getting them to *see* the product there are two different things. Three war stories from the getting-there.

<div class="table-scroll">
<table>
    <thead><tr><th>Symptom</th><th>Cause</th><th>Fix</th></tr></thead>
    <tbody>
        <tr><td>Every HTTPS navigation dies <code>net::ERR_CONNECTION_CLOSED</code>, but <code>curl</code> through the same proxy returns 200</td><td>Chrome's TLS 1.3 ClientHello (PQ key share + GREASE) spans two TCP segments; the egress proxy's SNI parser reads only the first and resets</td><td><code>--ssl-version-max=tls1.2</code> for a compact single-segment ClientHello — not a verification downgrade</td></tr>
        <tr><td>CLI against a PR preview worker fails <code>[authentication_required]</code> with the normal device cert</td><td>Previews share dev's bindings, so their certs come from the <code>DEV</code> CA, not <code>vibes.diy</code></td><td>A second headless cert, <code>VIBES_DEVICE_ID_PREVIEW</code> (delete <code>~/.fireproof/keybag/</code> first — an existing login always wins)</td></tr>
        <tr><td><code>POST /cdn-cgi/rum</code> 404s on every page load</td><td>Automatic RUM setup points the beacon at your own zone path, but <code>/cdn-cgi/*</code> never reaches the SSR Worker</td><td>Manual "JS Snippet" install gated by <code>enableCfRum = env.ENVIRONMENT === "prod" && request.cf?.isEUCountry !== "1"</code>, posting to <code>cloudflareinsights.com</code></td></tr>
    </tbody>
</table>
</div>

## The TLS handshake that broke every screenshot

Pointing `mcp__chrome-devtools__*` at vibes.diy from a cloud session meant clearing four layers. Three were boring: no Chrome binary at the expected path (shim to the Playwright Chromium), runs as root (`--no-sandbox`), no display (`Xvfb`). The fourth was the interesting one.

Every HTTPS navigation died with `net::ERR_CONNECTION_CLOSED` — but `curl` and `openssl s_client` through the *same* egress proxy returned 200 and the real origin cert. So the proxy worked, the CA was fine (it's pass-through, not MITM — it presents the origin's real cert), and Chrome was definitely using the proxy. Headless Chrome's stderr gave the tell: `handshake failed; SSL error code 1, net_error -100`. The connection was dying *during* the TLS handshake.

The cause: the egress proxy enforces per-host policy by reading SNI out of the TLS ClientHello, then splicing a raw tunnel to the origin. Chrome's TLS 1.3 ClientHello is big — a post-quantum key share (X25519MLKEM768) plus GREASE push it past one TCP segment. The proxy's SNI parser reads only the first segment, can't reassemble, and resets. `curl` and `openssl` never tripped it because their ClientHello fits in one segment.

The fix is one flag:

```sh
--ssl-version-max=tls1.2
```

That yields a compact, single-segment ClientHello. Crucially, this is *not* a verification downgrade — the proxy is pass-through, so Chrome still does a real TLS handshake with the origin and validates against its built-in roots. We proved it by loading the site with a completely empty NSS store.

Two lessons stuck. First: **"curl works but the browser doesn't" is a fingerprint, not a fluke.** When a policy middlebox parses the ClientHello, the size and shape of that hello — not just the destination — decides whether you get through. Reach for the byte-level tell (`net_error -100` mid-handshake) before blaming certs. Second: a tempting red herring. Importing the proxy CA into Chrome's NSS store *felt* like progress, and the next attempt succeeded — but the CA import was irrelevant; the TLS-1.2 cap applied in the same step was the actual fix. Always re-test the minimal change in isolation before writing it into a setup script you'll ship. The shipped `scripts/setup-cloud-browser.sh` is smaller and more honest for it.

## Why a PR preview needs a different device cert

QA against a preview means QA against the preview *worker*, and that's where the auth model gets interesting. Point the `vibes-diy` CLI at a PR's preview worker:

```sh
VIBES_API_URL=https://pr-<N>-vibes-diy-v2.jchris.workers.dev/api
```

...and the normal device cert fails with `[authentication_required]`. Previews share dev's bindings, so their certs are issued by the `DEV` CA, not `vibes.diy`. The fix is a second headless cert, `VIBES_DEVICE_ID_PREVIEW`.

The gotcha worth knowing: the CLI only seeds its keybag when it's *empty* — an existing login always wins. So switching environments mid-session silently keeps the stale cert until you delete `~/.fireproof/keybag/`. Once you see it, the dev/prod/preview CA split makes sense, and the slow `compile_test` window becomes a chance to validate changed features against a real preview instead of just unit tests.

## The 404 you can't fix in your Worker

Every page load fired `POST vibes.diy/cdn-cgi/rum` and got a 404 — a console error plus a failed-network entry on every route. Cloudflare's Web Analytics "Automatic Setup" injects a RUM beacon and, for ad-blocker evasion, points it at your own zone path, `/cdn-cgi/rum`.

The obvious fixes are all wrong. You can't intercept it in the Worker — `/cdn-cgi/*` is served by Cloudflare's edge *before* the request reaches any Worker. (Proof: `curl /cdn-cgi/trace` returns Cloudflare's trace dump that no Worker code generates.) And automatic injection isn't reliable for Worker-rendered HTML in the first place; vibes.diy is 100% SSR-in-the-Worker, which is exactly why the zone-path beacon 404s.

The real fix flips the dashboard to manual "JS Snippet" installation and injects the beacon yourself in the SSR `<head>`. The manually-installed beacon posts to `cloudflareinsights.com/cdn-cgi/rum` — Cloudflare's own domain — so it never touches our zone or Worker. No 404, same dashboard.

Manual setup loses Cloudflare's automatic "exclude EU" carve-out, but because we render in the Worker we have `request.cf.isEUCountry` and rebuild the posture in one line:

```js
enableCfRum = env.ENVIRONMENT === "prod" && request.cf?.isEUCountry !== "1"
```

The `=== "prod"` half matters: a manual-install beacon attributes data by *token*, not hostname, so a prod token firing from a preview host would pollute the production analytics site. Trade accepted — the `cloudflareinsights.com` collector is a little more ad-blockable than the same-origin path, a fine price for killing a 404 on every page.

## The honest edge

There's a gotcha we haven't solved, and it's worth naming. The thing that makes cloud containers safe and reproducible — no ambient credentials, a cold profile every run — is exactly why the *authenticated* QA spine can't fully run there yet. There's no signed-in session to borrow. How do you give an isolated, ephemeral agent just enough identity to test a logged-in flow without handing it standing access? That's still open. But the direction is settled: the default place an agent looks at the product is the cloud, because that's the only default that everyone shares.

<div class="post-cta">
  <h3>Built and checked in the cloud, by default.</h3>
  <p>The same uniform environment our agents validate in is the one your apps run in. Type a sentence; ship something real.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
