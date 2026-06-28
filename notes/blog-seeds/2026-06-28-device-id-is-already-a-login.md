# The login was already there — the browser just never asked

Source: `claude/device-id-browser-login` (spec: headless web login for cloud qa-pr)

We wanted an agent to log into the vibes.diy web app in an unattended cloud
session. The front door is Clerk + Google OAuth + a passkey — un-automatable by
design. The reflex is to reach for the standard E2E trick (Clerk sign-in tokens
via the Backend API)… except this repo has no `CLERK_SECRET_KEY`, so that door is
also shut.

The unlock came from reading the *server*, not the client. The CLI already does
headless auth with a device cert (`VIBES_DEVICE_ID`), and the API doesn't treat
that as a second-class citizen — `coercedVerifiedAuthUser()` collapses `device-id`
and `clerk` to the *same* `userId` claim. The device cert even carries the user's
Clerk identity baked in. So the data plane already accepts "log in as this user"
without Clerk at all. The only reason it was "CLI-only" was that the *web client*
never implemented the path — not a server boundary, just an unused seam.

Angles worth a full post:

1. **"Can't be done" is often "isn't wired up."** Two plausible doors (OAuth,
   Clerk Backend API) were genuinely shut, which makes it easy to conclude the
   whole thing is blocked. The actual answer was a capability the backend already
   had, exposed to one client and not another. When a feature seems impossible,
   separate *policy/credential* limits (real walls) from *integration* gaps
   (unbuilt seams) — they look identical from the UI and are completely different
   problems.

2. **Two subagents, one wrong conclusion, and why cross-reading mattered.** One
   research pass concluded "browsers can't use device certs — they can't sign with
   private keys." It was confidently wrong (WebCrypto signs JWKs fine; the CLI's
   minter is plain JS). The correct picture only emerged from cross-referencing it
   against the other pass that had found the server-side claim coercion. Parallel
   investigators are worth more when you reconcile their disagreements than when
   you average them.
