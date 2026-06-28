# Don't build a parallel auth path when the platform already ships one

Source: `claude/clerk-signin-token-qa-login` (supersedes the device-id approach, #2779 closed)

We needed an agent to log into the web app headlessly (Google OAuth + passkey →
un-automatable). We designed a whole device-id browser-auth path: reuse the CLI's
device cert in the browser, a unified auth adapter, a ~25-file Clerk→adapter
migration. It was sound, and we'd already shipped the prototype + Increment A.

Then we asked the question we should have asked first: *does Clerk itself have a
feature for this?* It does — sign-in tokens (the ticket strategy). A backend mints
a one-time token for a user; the browser consumes it and gets a **real Clerk
session**. The only reason we'd ruled it out earlier was "no `CLERK_SECRET_KEY` in
the repo" — but the secret doesn't belong in the repo; it belongs in the *harness*
env, exactly like the device cert we were already injecting. Once the owner was
fine with that, the entire device-id edifice collapsed to a 30-line mint script
and a two-call browser snippet, with **zero app changes**.

Angles worth a full post:

1. **"Is there a native feature?" is a cheaper question than any design — ask it
   before you spec, not after.** We did real work (spec, prototype, an increment,
   a 25-file migration plan, two rounds of review) on a custom mechanism before
   checking whether the auth vendor already solved it. The check took one web
   search. The lesson isn't "we wasted effort" (the research stands); it's that
   the build-vs-adopt question has wildly asymmetric cost and belongs at the very
   top of the funnel.

2. **A constraint that's really "not here" vs. "can't exist."** "No
   `CLERK_SECRET_KEY`" was true of the repo and we treated it as a law of physics,
   which forced the device-id design. It was actually a placement question — put
   the secret in the harness, not the source. Whenever a constraint blocks the
   obvious path, separate "absent in this scope" from "fundamentally unavailable";
   they look identical and have opposite consequences.

3. **For a QA tool, fidelity is the whole game.** The device-id path would have
   tested a *bespoke* auth path that real users never hit — a QA harness that
   diverges from production auth can both cry wolf and miss real regressions.
   Logging in *through Clerk* means qa-pr exercises the exact session a user gets.
   Prefer the mechanism that makes your test indistinguishable from the real thing.
