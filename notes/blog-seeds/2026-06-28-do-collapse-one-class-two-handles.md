# Three Durable Object classes into one — and the isolation argument that didn't survive contact

Source: #2714 Spec B Phase C (branch `claude/spec-b-phase-c-do-collapse`)

The session layer had three Durable Object classes — ChatSessions (codegen),
AppSessions (vibe), SharedSessions (shared reads) — that were, by this point, the
*same handler surface opened against a different shard key*. Spec A had already
built the gate that made a handler physically unable to serve the wrong shard;
Phase A had made the heavy capability (QuickJS) lazy so a lean read instance
never parses it. Phase C is the collapse itself: one class `Sessions` that derives
its plane from the request path and replicates each former class's wiring per
kind. The old classes stay exported and bound — the collapse is rollback-able by
re-routing — and get GC'd in a later, irreversible deploy once drained.

Two angles worth a post:

1. **"Separate class = blast-radius isolation" is a claim you can't actually
   cash.** The first draft of the 3-vs-2-vs-1-classes decision leaned on keeping
   codegen in its own class so a runaway codegen stream couldn't pressure the
   always-warm read plane. Pushed on it, the argument collapsed: Cloudflare does
   not contract that separate DO *classes* get separate *placement*; instance
   co-location is their opaque scheduling. What you actually get is *per-instance*
   limits — and a codegen stream is already one instance with its own CPU/memory
   budget, isolated from the shared singleton regardless of whether they share a
   class name. Reasoning about a provider's internal scheduling as if it were a
   guarantee is a trap. Strip it out and the decision got *simpler*: go to one
   class.

2. **One class, two binding handles — `script_name` is the disambiguator.** The
   one real reason left to split was the cli environment: it cross-script-binds
   vibe/shared to the *prod* worker (shared data plane) but runs codegen *locally*
   (per-env isolation). A single class seemed to collide with that — until you
   realize a binding is `(name, class_name, script_name?)`, so you can bind the
   *same* class name twice: `SESSIONS` → prod (cross-script) for vibe/shared, and
   `CODEGEN_SESSIONS` → local for codegen. Same class, two namespaces, no behavior
   change. `wrangler deploy --dry-run` confirms it renders as two distinct
   namespaces. The migration validator's verdict on a local `new_classes` class
   coexisting with a same-named cross-script binding is the one thing docs don't
   cover — but it's caught safely at the cli deploy, which is reversible (old
   classes still live). So we recorded 3→1 as the plan-of-record and let the
   reversible deploy be the backstop instead of gating on a throwaway experiment.

Bonus: the unified class can't infer its plane from its class anymore (there's
only one), so it derives the kind from the request path via `shardKindForPath` —
which a parity test pins against `routeDecision`, since app.ts routes by one and
the DO stamps identity by the other, both keyed on the same pathname.
