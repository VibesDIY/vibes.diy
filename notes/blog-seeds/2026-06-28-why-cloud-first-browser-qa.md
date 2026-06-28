# Why we want agents working from the cloud, not a laptop

Source: `claude/browser-screenshot-testing-bwy7yv` / #2776 (companion to the TLS-1.3 ClientHello seed — that one is _how_ we made the browser work; this is _why_ we want it there at all)

The fix in this PR was a one-flag TLS tweak. The reason it was worth chasing is
the bigger story: we want agent work — including browser QA — to happen in
ephemeral cloud containers by default, and a capability that only works on a
hand-configured laptop quietly pushes everything back toward the laptop.

The contrast is right there in the same diff. The local-workstation path for
`qa-pr` is a real checklist: install Chrome, authenticate `gh`, and the
genuinely fiddly one — seed a Google Workspace session into a specific
chrome-devtools profile dir, once per engineer, being careful not to pollute it.
That's per-person onboarding that rots, drifts, and silently differs between
machines ("works on mine"). The cloud version is a SessionStart hook: every
session, every agent, identical setup, zero steps. The capability stops being a
thing a few people have configured and becomes a thing the fleet just _has_.

That difference is what makes browser validation actually happen. A check that
needs setup gets skipped under deadline; a check that's already wired up gets
used. The goal is to make validation **standard operating procedure** — every PR
exercises what it changed against a real running environment before it's called
ready, the same way every PR gets a blog seed and a review. You can't mandate a
step that only works on some machines; an SOP has to be universally available
first. Making the cloud env the default place to screenshot and walk flows is the
precondition that lets "validate before merge" become a rule instead of a
nice-to-have — and it scales to many agents in parallel, each in an isolated
container, in a way a shared laptop never will.

Angles worth a full post:

1. **Reproducibility beats power.** The cloud Chromium is not more capable than a
   developer's Chrome — it's _more uniform_. For agents, a clean, identical,
   disposable environment every run is worth more than a powerful bespoke one,
   because it removes the entire class of "it behaved differently on my setup"
   failures and makes a result something anyone can trust and re-run.

2. **Defaults decide what gets done.** Tooling that requires setup is tooling that
   gets bypassed. The same QA pass framed as "cloud-default, zero setup" vs
   "first do this 8-item local checklist" produces wildly different adoption. The
   engineering win here is small; the behavioral win — moving the path of least
   resistance to _doing the check_ — is the real payoff.

3. **Isolation cuts both ways — name the gotcha.** The thing that makes cloud
   containers safe and reproducible (no ambient credentials, cold profile every
   run) is exactly why the _authenticated_ QA spine still can't run there yet:
   there's no signed-in session to borrow. Worth a post on its own: how do you
   give an isolated, ephemeral agent _just enough_ identity to test a logged-in
   flow without handing it standing access? Unsolved here, and the honest edge of
   the cloud-first push.
