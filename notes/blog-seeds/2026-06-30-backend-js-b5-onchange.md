# A backend that reacts to its own data — without eating itself

Source: `claude/backend-js-b5-onchange` (B5 of #2856; follows B4's durable `scheduled` lane)

B5 gives each vibe's `backend.js` an `onChange` handler: after a document write **commits**, the vibe's
server code runs with the changed doc, its prior version, and the db name. "Run a function when data
changes" is the feature; the interesting part is everything you get wrong if you implement the obvious
version.

**Don't reuse the doc-changed stream.** Vibes already has a `evt-doc-changed` event — but it's local
WebSocket fan-out: no document payload (just ids/channel), per-channel duplication, and it only reaches
*currently-subscribed sockets*. Wire `onChange` to it and a handler silently never fires when nobody's
watching the page. So B5 emits a **new, dedicated** queue message carrying the full payload, in the same
post-commit step as the write — independent of who's subscribed. Codex caught two more at the spec stage:
the prior doc must be read from the committed `seq-1` row (the pre-read head races the per-doc seq
allocator), and deletes go through a *separate* `deleteDocEvento`, so emitting only from `putDoc` would
miss every delete. Both folded in before a line of code.

**The loop guard is the whole ballgame.** A handler that writes (B6) can trigger its own `onChange`,
which writes again… So every write carries a generation `depth`, and emission is suppressed past a cap
(4). A depth counter alone can't tell a backend-induced write from a user write; a source tag alone can't
stop a legitimate A→B→A chain — so you need *both* (Charlie). The neat part: in B5 `ctx.db` still throws,
so handlers *can't* write yet — the guard is built, wired, and unit-tested (a simulated self-feeding chain
terminates in exactly 4 generations) but provably dormant. B6 inherits a proven guard instead of bolting
one on after the amplification bug ships.

**Fire-and-forget, but not fire-and-forget-about.** The write already committed, so an enqueue failure
must never fail it — but it also must not be *silent* (Charlie): a dropped `onChange` logs at `error` and
increments a counter, so a systemic enqueue outage is observable rather than a quiet stream of lost
events. The narrow commit→enqueue crash gap is documented as at-most-once; no transactional outbox yet.

Two structural notes: the heavy logic (the depth math, the executor, the emit) lives in pure,
unit-tested `api-svc` functions, so the BackendDO's new `onchange` op is a thin shell validated by the
build — same discipline as B3/B4. And the whole thing is dark behind `BACKEND_JS=off`: the emit gate
reads the flag on the write path, so while the feature is off, a document write does **zero** extra work —
no predecessor read, no enqueue. Flip the flag and the lane lights up.
