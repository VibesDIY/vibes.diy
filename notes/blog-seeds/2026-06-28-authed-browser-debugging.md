# Giving an ephemeral agent just-enough identity to test a logged-in flow

Source: `claude/clerk-signin-token-qa-0mcvvi` — adds `clerk-authed-shot.mjs` +
`agents/authed-browser-debugging.md`. This is the direct answer to the open
gotcha from the cloud-first-browser-QA seed (`2026-06-28-why-cloud-first-browser-qa.md`,
angle #3: "how do you give an isolated, ephemeral agent _just enough_ identity to
test a logged-in flow without handing it standing access?").

The cloud container is cold by construction — no ambient Google session, nothing
to borrow — which is exactly what makes it safe and reproducible, and exactly why
the authenticated half of browser QA couldn't run there. The Clerk
sign-in-token / ticket flow closes that gap: a backend secret mints a one-time
token, a real browser consumes it into a genuine Clerk session, and the agent
never holds standing credentials — just a disposable, per-run session it minted
for itself. Identity scoped to a single run, not granted to the fleet.

The non-obvious second half is **driving** that session. The instinct is to point
the chrome-devtools MCP browser at the login and screenshot through the tools you
already have. You can't: that Chrome launches with `--remote-debugging-pipe`, a
file-descriptor transport with no TCP CDP URL, so there's nothing for a
`--cdp`-style attach to connect to. The reliable path is sideways — export the
session as a Playwright storage-state file and drive a separate Playwright context
that loads it. One command to authenticate-and-export, one to open-and-screenshot.

What made it _smooth_ (the point of the doc) was writing down the two failures
that cost the most time, because neither is guessable: route-nav to
`/chat/<handle>/<slug>` is deterministic where clicking the sidebar's app cards is
not (the preview→ENTER panel can stay stuck on the wrong vibe), and you must wait
for the app `<iframe>` to paint or you screenshot the empty editor shell. Both are
now in the script and the doc, so the next person types two commands instead of
rediscovering them.

Angles worth a full post:

1. **Ephemeral identity as a primitive.** "Mint a one-time session for this run,
   hold no standing access" is a cleaner security story than seeding long-lived
   cookies into a profile — and it's _more_ automatable, not less. The safe
   version and the convenient version turned out to be the same version.

2. **The transport mismatch nobody warns you about.** A pipe-transport browser and
   a port-transport auth tool look interchangeable until you try to bridge them.
   Worth a short post on recognizing when two "drive a browser" tools simply can't
   share one — and why the answer was a third browser, not a clever attach.

3. **Smoothness is documented failures, not documented happy paths.** The login
   worked first try; the time went into route-nav-vs-cards and iframe-paint. A
   recipe that only shows the commands would have let the next person re-hit both.
   The valuable half of a how-to is the two lines that say "don't do the obvious
   thing here."
