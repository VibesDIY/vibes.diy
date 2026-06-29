# The Bot Shepherd: 270 PRs in 17 Days, Mostly From a Beach

*A founder's-eye view of what high-velocity shipping actually looks like up close — why the
speed was the safety mechanism, why the real bottleneck was never the code, and how the tools
got better every time a task needed them to.*

---

## Where this was written

I'm on a Greek island. Officially, on vacation. The codebase lives on the other side of an
ocean, and my laptop's token streams did not enjoy the swim — so I pushed as much of my work as
possible into cloud sessions, where the agent runs next to a copy of the repo instead of next to
me.

That started as a latency hack. It turned into the way I work now. Most of what I ship lately, I
ship from my phone, from a beach. And — across these seventeen days, in this one codebase, at
least — it comes out *faster and better* than when I was hunched over a laptop with full focus.
Because the hard part of building was never the coding. It was deciding what matters.

Here's what came out of those seventeen days (June 12–29):

- **270 pull requests merged** *(the count as of my analysis snapshot midday June 29; a few
  more landed later the same day — the window kept filling as I wrote, which is rather the point)*
- **~223,000 lines of churn** across 2,650 file-changes
- **median PR: 196 lines, 5 files**
- **median time-to-merge: 0.8 hours** — 80% merged in under six hours, 95% within a day
- **95% of PRs were agent-authored**; I personally merged 261 of them
- a steady ~16 PRs/day, peaking at **47 merged on June 28**

If you're an indie builder, "270 PRs, one reviewer, from a phone" should set off alarms. That's
the rubber-stamp zone, where quality dies and prod goes down on a Friday. It didn't. And the
reason it didn't is the thing I actually want to write about.

## The real bottleneck was never the code. It was focus.

I could not have done this work the old way — not because I can't write the code, but because I
cannot hold *that many threads* in my head at once. A migration here, an eval harness there, a
routing change, a dependency extraction, a UI polish pass. Switching between them by hand is
brutal: every context switch dumps the stack, and rebuilding it costs twenty minutes and a
little bit of will. Fractured focus is the tax every solo builder pays, and it's the real reason
"just ship faster" usually means "ship sloppier."

The agent removes that tax. **It holds the context so I don't have to.** Each workstream keeps
its own state — what's done, what's blocked, what's next — and I dip in only when a decision is
required. I'm not maintaining ten mental stacks; I'm answering ten questions, each one already
framed for me with the relevant context attached.

That changes what I am. I'm not a coder going fast. I'm a **shepherd moving a flock** — many
workstreams grazing forward in parallel, and me walking the edge of the field, nudging direction
where it's needed. The thing that used to make parallel work dangerous — fractured attention,
half-remembered state, the change you forgot you started — is exactly the thing the agent
absorbs. So I get the *throughput* of many parallel threads without the *risk* that normally
comes with splitting your focus across them.

## High velocity is a slicing problem

Look again at that median: **196 lines.** The *mean* was 826 — more than four times bigger —
which tells you the average is a lie. A handful of giants drag it up: a CI prettier-format split
(59k lines, mechanical), a vendored-skills import (18k), a dead-code prune (5.9k). The top 10
PRs are **53% of all churn**; strip those obvious sweeps and the typical change is a couple
hundred lines you can read in one sitting.

The real texture:

| PR size (churn) | share |
|---|---|
| ≤50 lines | 19% |
| 51–200 | 32% |
| 201–500 | 20% |
| 501–1,000 | 13% |
| >1,000 | 16% |

**Half of every PR was 200 lines or fewer. Seventy percent were under 500.** A 200-line diff is
something you can reason about completely on a phone screen and *revert without ceremony* if it
misbehaves. And the speed tracks the size, cleanly:

| PR size | median time-to-merge | merged same-day |
|---|---|---|
| ≤50 lines | 0.4h | 82% |
| 51–200 | 0.7h | 83% |
| 201–500 | 0.7h | 80% |
| 501–1,000 | 1.2h | 89% |
| >1,000 | 2.8h | **64%** |

The big PRs are the *only* bucket where same-day merge falls off a cliff. Size is where latency
lives, and latency is where risk lives. The decomposition shows up in the titles too: **18% say
*slice*, *phase*, *step*, or *bucket*; 29% reference a parent issue.** Big work didn't arrive as
a big-bang. It arrived as a chain — and a chain of small things is exactly what a shepherd can
hold when an agent is carrying the state.

## One hand, four different caution dials

When agents write 95% of the code, the human's job is no longer authorship. It's **choosing
where to go, and how carefully to tread — dialed to risk and reward, per change.** The agents
are extraordinary at producing correct, tested, well-scoped slices. What they can't decide is
how much it would hurt if *this particular* slice were wrong in prod. That judgment is the job,
and it's almost the entire job.

Four PRs from across the window — three different workstreams, two different weeks — with one
hand setting the dial four different ways:

- **#2827 — sidebar links point at the `/vibe` route.** Blast radius: a URL string prefix.
  Shipped **hot, no flag, merged 25 minutes after it opened.** Dial wide open.
- **#2837 — a brand-new vibe builds *in place* on `/vibe`** instead of bouncing to `/chat`.
  Higher stakes (first-run for every new app): shipped **on**, but only after an end-to-end run
  on the preview deploy and a fix for a P1 a reviewer caught. Dial open, with a gate.
- **#2835 — server-side rendering for vibes** (a separate epic from the route work above).
  Risky surface. Landed **dormant behind a flag,
  production explicitly `off`** — fully built, shipped *dark* — and the PR was *spec-first*: a
  design doc opened for review **before any code.** Dial nearly closed.
- **#2494 — moving doc operations onto a new connection plane** (the earlier AppSessions split,
  merged June 21 — eight days before the others). Carried a hold I wrote by hand:
  *"⚠️ Do not merge until after the next prod deploy of `main`... so the change deploys in
  isolation and any regression is unambiguously attributable."* Dial closed, sequenced on
  purpose so a regression would have exactly one suspect.

Same shepherd, four different bodies of work, four reads of "what does it cost if this is
wrong?" That's the craft. Not the typing — the dial.

## The tools got better every time a task needed them

Here's the part that makes the speed compound instead of burn out: **we improve the tooling as
we go, and every improvement is pulled into existence by a real task, never speculative.** The
record of this lives in our `agents/` directory — the shared playbook the agents read before
they work. We touched **22 of those docs** in the window, and the new ones map one-to-one onto
walls we hit:

- **June 25 — `github-mcp-limits.md`.** The GitHub MCP's `actions_list` output was too bloated
  to be useful mid-session, so we built a slim wrapper (`scripts/gh-runs.sh`) and wrote down
  when to reach for it. Friction → fix → documented.
- **June 28 — `cloud-browser-setup.md` + `authed-browser-debugging.md`.** This is the forcing
  function paying off. To QA from a beach I needed screenshots from the cloud session — so we
  made the `chrome-devtools` MCP work *out of the box* via a SessionStart hook, then wrote the
  recipe for driving a *logged-in* browser for ad-hoc debugging. Suddenly I can see the product,
  not just the diff, from my phone.
- **June 29 — `identity-ship-verify.md`.** The identity migration (below) needed a way to prove
  a ship was safe on prod *without re-logging-in everyone* — a headless `DEVICE_ID` round-trip.
  The migration called the runbook into being; the runbook made the next identity slice cheaper.

Each of these is a small investment that lowers the cost and risk of everything after it. The
cloud forcing function — born from a latency problem on an island — is *why* low-risk shipping
from a phone is even possible. And because the improvements are demand-driven, none of them is
wasted: we only built the tool the moment a task proved we needed it. The agentic flow puts me
in the product under real-world conditions (on mobile, on flaky beach wifi, as an actual user),
which surfaces the next improvement to call forth — **without ever breaking my stride.**

## Three migrations that never existed as one scary PR

The thesis only earns its keep on work that's genuinely dangerous. Big migrations are where
teams reach for the big-bang merge and a prayer. We didn't.

**Retiring `/chat` for the `/vibe` route.** Two parallel route families for the same app; the
goal was to make `/vibe` the front door. It came as a staircase — point the sidebar over
(#2827), route new-vibe builds in place (#2837), SSR groundwork behind a flag (#2835) — each
step keeping `/chat` alive as a fallback. Always shippable, because no slice removed the old
path until the new one was proven.

**De-fireproofing identity.** The scariest work of the sprint: untangling our identity and
device-credential layer from an embedded dependency — the canonical "touch it wrong and everyone
gets logged out" nightmare. It moved in buckets and phases: collapse three session services into
one (#2714), lift the device-id keybag in-repo (#2735), tighten cert verification (#2671), route
imports through a clean seam one module at a time. One slice's whole job was *triage*: of ~90
call sites that supposedly needed changing, ~80 were test harnesses and only **two** real ones
fit the narrower contract — so we narrowed those two and *documented why the rest couldn't be*.

**The eval harnesses.** The least glamorous, quietly most important: the measurement
infrastructure that lets us change prompts and swap models on *evidence* instead of vibes —
cross-model codegen evals (#2542), a one-shot-vs-agentic harness (#2638), an autoresearch loop
that iterates against a metric (#2596). The single highest-risk change you can make to an AI
product is to its prompts; before this, that was a guess. Now it's a number — the instrument
panel for the dial.

## If you're building solo (or nearly)

1. **Let the agent hold the context; spend your focus on decisions, not threads.** The win isn't
   typing speed. It's never paying the context-switch tax again. Shepherd many workstreams; don't
   juggle them.
2. **Make slices independently shippable.** Keep the old path alive, add fallbacks
   (`vibeApi ?? chatApi`), land risky features flag-off. A slice that can't ship alone isn't a
   slice — it's a time bomb with extra steps.
3. **Set the caution dial per change, not per project.** Match ceremony to blast radius. Ship
   cheap-to-revert work hot; sequence and gate the expensive stuff.
4. **Improve the tools on demand, and write it down.** Every wall you hit is a chance to lower
   the cost of the next mile — but only build the tool the task actually calls for, and capture
   the recipe so it compounds.
5. **Use your own product under real conditions.** The beach, the phone, the flaky wifi surfaced
   improvements a desk never would.

The headline — 270 PRs in 17 days — looks like a story about speed. It isn't. It's a story about
where the bottleneck actually was. The hard part was never the code; it was holding focus across
everything that matters and deciding what to do next. Hand the context-holding to the agent, keep
the deciding for yourself, slice the scary things small, and improve your tools every time a task
demands it — and you can move a whole flock forward at once. From a beach. Going *faster*,
and *safer*, than careful was for me — at least across this window, in this codebase. One
founder's seventeen days, not a law of nature. But it was consistent enough to write down.

---

*Numbers from a PR-level analysis of the PRs merged into `vibesdiy/vibes.diy` between 2026-06-12
and 2026-06-29 — 270 as of a midday-June-29 snapshot (a handful more merged later that day; all
percentages here are computed over that 270-PR snapshot). The tooling arc is the `agents/`
directory's own commit history over the same window. Seed:
`notes/blog-seeds/2026-06-29-low-risk-high-velocity-270-prs.md`.*
