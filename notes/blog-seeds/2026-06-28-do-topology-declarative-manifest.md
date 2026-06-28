# Stop tracking "which API is which": one shard-keyed handler manifest

Source: #2714 (design + decision), predecessors #2265 / #2517 / #2710

For a while the realtime layer ran three "APIs" — `chatApi` (ChatSessions),
`vibeApi` (AppSessions), `sharedApi` (SharedSessions) — and a three-way handler
manifest (`sharedHandlers` / `appHandlers` / `chatHandlers`) deciding which
connection may serve which operation. The recurring tax was *shuffling handlers
between those three buckets*: #2265, #2517, and the read-handler move in #2710
were all "this call landed on the wrong plane" work, and each one was physically
**moving a Durable Object around** — a wrangler migration, deploy ordering,
blast-radius care.

The reframe (jchris, out of the #2710 review): the three "APIs" are not different
services. They're the **same handler surface opened against a different DO shard
key**, and the shard key is the only thing that matters. So stop choosing an API;
choose a shard kind — and let each handler **declare** the shard kinds that may
serve it instead of being **quarantined** into a per-plane array.

This seed is the first, behavior-preserving step: collapse the three handler
arrays into **one declarative list** where each entry carries
`allowed: ShardKind[]` (`"stream" | "vibe" | "shared"`). Every plane's evento
became `handlersForShard(kind)` — a filter over the one list. Nothing about what
each DO serves changed; the *placement metadata* just moved into one place that
both the composition and the parity tests read.

Worth a fuller post:

- **The trade-off that makes it safe is splitting *why* a handler was
  shard-bound into two categories.** (a) **Code/capability presence** — bound
  only because the code isn't bundled elsewhere (QuickJS access-fn lives in the
  vibe DO). Dissolvable: load the capability where it's allowed, behind a lazy
  `import()`. This is also why "doc writes must never reach the chat plane" was a
  code-loading fact, **not** a security boundary. (b) **Stateful rendezvous /
  topology** — irreducible. A doc write does *local broadcast* on the vibe shard;
  `subscribeDocs`/`subscribeViewerGrants` fan out to co-tenant sockets that only
  exist there. No amount of loading code elsewhere helps. So doc ops stay
  `["vibe"]`; the manifest unifies **code**, never **topology**.

- **A special-case array dissolved into one tag.** The old
  `imgGenAppSessionStopgapHandlers` (#2350) re-exposed `open-chat`/`prompt` on the
  vibe plane so img-gen on `vibeApi` wasn't rejected. In the declarative model
  that's not a stopgap — it's just `allowed: ["stream","vibe"]` on those two
  handlers. The whole concept of "a separate array to remember to keep in sync"
  went away. That's the velocity unlock in miniature: re-homing a capability is a
  one-line `allowed` edit, no DO migration ever again.

- **The tests became assertions over `allowed`.** The parity test no longer
  diffs three arrays; it reads each handler's declared shard set directly (doc
  ops are exactly `["vibe"]`, streaming is stream-bound, shared reads are all
  three). The test is now checking the *contract*, not the *wiring*.

The gotcha / what's deliberately deferred: this is **kind** enforcement only, and
only in the worker. The keystone still to build (and the reason #2714 wants a
brainstorm + TDD plan before the rest) is the part types *can't* prove — **shard
identity**. Types can prove "this is a vibe connection"; they can't prove "this
is the shard for *this* vibe (`owner--appSlug`)". So category-(b) handlers will
need a **fail-loud runtime identity gate at dispatch**: a write that can't reach
its vibe's broadcast shard must **throw**, never persist-and-go-quiet. Types
shrink the honest-mistake surface to ~nothing; that one runtime assertion is the
part you can never delete. Remaining plan lives in `agents/do-session-split.md`.
