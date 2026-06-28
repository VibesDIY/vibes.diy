# The cheap always-warm read shard is a bundler problem, not a Durable Object problem

Source: #2714 (Spec B design — DO physical collapse)

We want to collapse three Durable Object classes (chat/vibe/shared) into one
shard-keyed surface. The whole thing hinges on one question that sounds like a DO
question but isn't: *can a lean shared/read shard wake cheaply?* The fear was that
a hibernated shard, woken to serve a sidebar query, would re-pay the QuickJS parse
(a static top-level `import` in `cf-serve.ts`) and blow the startup budget.

The measurement clarified the runtime model. A DO **constructor** re-runs on **every**
wake from hibernation — but **global/top-level module scope** (where static imports
are parsed) runs **once per isolate**, and re-runs only when the *isolate* is
recreated. Hibernation evicts the DO; isolate eviction is a separate event with **no
guarantee** the isolate stays warm across a hibernation. And because hibernation is
triggered by the same sustained inactivity that makes isolate eviction likely, a
shard woken after a long idle frequently lands in a **fresh** isolate and re-executes
top-level scope. So: yes, the worst case is real — a static QuickJS import is re-paid
on cold-isolate wake. The startup budget is **1 s** (raised from 400 ms in Oct 2025),
and the repo already engineers around it (`app.ts` lazy-inits `createRequestHandler`
to dodge "error 10021"). The lazy-load is load-bearing, not optional.

Two angles worth a full post:

1. **"Does hibernation re-run global scope?" is the wrong question — ask about the
   isolate.** The honest answer is a 2×2 (constructor always; global scope only on
   isolate recreate; isolate lifetime decoupled from DO hibernation but *correlated*
   through the shared idle trigger). The design conclusion falls out of the
   correlation, not the mechanism: you can't assume warm, so make the lean path lean.

2. **The fix lives in the bundler, and the architecture doc named the wrong one.**
   The doc said "set wrangler `find_additional_modules` + `rules`" — but this worker
   is bundled by **Vite + `@cloudflare/vite-plugin` (Rollup)**, where that esbuild
   mechanism doesn't apply. The real lever is Rollup dynamic-import code-splitting
   (does a bare `import()` already split QuickJS into its own chunk, or does the
   plugin re-inline it?). So the verification isn't "did it deploy" — it's a
   **build-output assertion**: the worker *entry chunk* must not contain QuickJS, and
   a separate lazy chunk must. That CI-able check is also the *data* that de-risks the
   downstream 3→1-vs-3→2 decision, which is exactly why we deferred that decision
   behind the prototype instead of guessing.

Bonus gotcha for the migration half: deleting a cross-script-bound DO class is
**cli-first** — the reverse of the usual prod-before-cli — or the prod deploy fails
the validator with 10061. `deleted_classes` is irreversible, so it goes last, after
`wrangler tail` proves zero traffic, with the old classes kept routable as the only
rollback path.
