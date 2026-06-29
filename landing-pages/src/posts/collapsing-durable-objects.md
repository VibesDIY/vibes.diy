---
title: "We only needed one Durable Object"
date: 2026-06-28T10:00:00Z
author: "Vibes DIY"
summary: "We had three Durable Object classes that were really one handler surface opened against three shard keys. Here's how we collapsed them into a single class — and which 'separate-class' argument fell apart the moment we pushed on it."
glyph: "3 DO → 1"
---

Three classes, three bindings, three things to keep straight — and a case for keeping them apart that sounded airtight until it met production. The realtime layer underneath Vibes DIY ran on three Durable Object classes: `ChatSessions` for codegen streams, `AppSessions` for live vibes, `SharedSessions` for shared reads. Three classes, three "APIs" (`chatApi`, `vibeApi`, `sharedApi`), and a three-way handler manifest (`sharedHandlers` / `appHandlers` / `chatHandlers`) deciding which connection could serve which operation.

By the time we got to this work, those three classes were the *same handler surface opened against a different shard key*. This is the build log for collapsing them into one.

## The recurring tax: shuffling handlers between buckets

The reframe came out of a review. The three "APIs" were not different services — they were one surface, and the shard key was the only thing that actually mattered. You could see it in the maintenance pattern: a string of past changes were all "this call landed on the wrong plane" work, and every one of them meant physically *moving a Durable Object around* — a wrangler migration, deploy ordering, blast-radius care — just to re-home a capability.

So the first, behavior-preserving step was to stop *choosing an API* and instead *declare a shard kind*. We collapsed the three handler arrays into one declarative list where each entry carries `allowed: ShardKind[]` (`"stream" | "vibe" | "shared"`). Every plane's handler set became `handlersForShard(kind)` — a filter over that one list. Nothing about what each DO serves changed; the placement metadata just moved into one place that both the composition and the parity tests read.

What makes that safe is splitting *why* a handler was shard-bound into two categories:

- **Code/capability presence** — bound only because the code wasn't bundled elsewhere (the QuickJS access-fn lives in the vibe DO). Dissolvable: load the capability where it's allowed behind a lazy `import()`. This is also why "doc writes must never reach the chat plane" turned out to be a code-loading fact, **not** a security boundary.
- **Stateful rendezvous / topology** — irreducible. A doc write does *local broadcast* on the vibe shard; `subscribeDocs` / `subscribeViewerGrants` fan out to co-tenant sockets that only exist there. No amount of loading code elsewhere helps, so doc ops stay `["vibe"]`.

The manifest unifies **code**, never **topology**. A nice side effect: the old `imgGenAppSessionStopgapHandlers` array — a special case that re-exposed `open-chat` / `prompt` on the vibe plane — stopped being a stopgap and became `allowed: ["stream", "vibe"]` on two handlers. The whole concept of "a separate array to remember to keep in sync" went away. Re-homing a capability is now a one-line `allowed` edit, no DO migration ever again.

Here's the whole collapse on one screen — three classes, three "APIs", three handler arrays, all folding into the single `Sessions` class that derives its plane from the request path:

<div class="table-scroll">
<table>
  <thead><tr><th>Old class</th><th>Purpose</th><th>Old "API"</th><th>Old handler array</th><th>→ Unified</th></tr></thead>
  <tbody>
    <tr><td><code>ChatSessions</code></td><td>codegen streams</td><td><code>chatApi</code></td><td><code>chatHandlers</code></td><td rowspan="3"><code>Sessions</code> — one class. Kind comes from <code>shardKindForPath</code>; each plane's set is <code>handlersForShard(kind)</code>, a filter over one list keyed on per-handler <code>allowed: ShardKind[]</code>.</td></tr>
    <tr><td><code>AppSessions</code></td><td>live vibes</td><td><code>vibeApi</code></td><td><code>appHandlers</code></td></tr>
    <tr><td><code>SharedSessions</code></td><td>shared reads</td><td><code>sharedApi</code></td><td><code>sharedHandlers</code></td></tr>
  </tbody>
</table>
</div>

## The isolation argument that didn't survive contact

The first draft of the three-vs-two-vs-one-class decision leaned on keeping codegen in its own class, so a runaway codegen stream couldn't pressure the always-warm read plane. It sounds right. It isn't.

Cloudflare does not contract that separate DO *classes* get separate *placement* — instance co-location is their opaque scheduling. What you actually get is *per-instance* limits, and a codegen stream is already one instance with its own CPU/memory budget, isolated from the shared singleton regardless of whether they share a class name. Reasoning about a provider's internal scheduling as if it were a guarantee is a trap. Strip the argument out and the decision got *simpler*: go to one class.

## "Can a lean read shard wake cheaply?" is a bundler question

The whole collapse hinged on one question that sounds like a Durable Object question but isn't: can a hibernated shared/read shard wake cheaply, or does it re-pay the QuickJS parse on the way up?

The measurement clarified the runtime model. A DO **constructor** re-runs on **every** wake from hibernation — but **global/top-level module scope**, where static imports are parsed, runs **once per isolate** and re-runs only when the isolate is recreated. Isolate lifetime is decoupled from DO hibernation, but *correlated* through the shared idle trigger: a shard woken after a long idle frequently lands in a fresh isolate and re-executes top-level scope. So yes, the worst case is real, and against a startup budget of **1 s** the existing lazy-init of `createRequestHandler` in `app.ts` (which dodges error 10021) is load-bearing, not optional.

The design conclusion falls out of the correlation, not the mechanism: you can't assume warm, so make the lean path lean. And the fix lives in the bundler. The architecture doc named the wrong lever — wrangler's `find_additional_modules` + `rules`, an esbuild mechanism — but this worker is bundled by **Vite + `@cloudflare/vite-plugin` (Rollup)**, where that doesn't apply. The real lever is Rollup dynamic-import code-splitting, so the verification isn't "did it deploy" — it's a build-output assertion: the worker entry chunk must not contain QuickJS, and a separate lazy chunk must.

## One class, two binding handles

The last real reason to split was the `cli` environment. It cross-script-binds vibe/shared to the *prod* worker (shared data plane) but runs codegen *locally* (per-env isolation). A single class seemed to collide with that — until you remember a binding is `(name, class_name, script_name?)`. You can bind the *same* class name twice: `SESSIONS` → prod for vibe/shared, and `CODEGEN_SESSIONS` → local for codegen. Same class, two namespaces, no behavior change. `wrangler deploy --dry-run` confirms it renders as two distinct namespaces.

The unified class can no longer infer its plane from its class — there's only one — so it derives the kind from the request path via `shardKindForPath`, pinned by a parity test against `routeDecision` (app.ts routes by one, the DO stamps identity by the other, both keyed on the same pathname).

We kept the old classes exported and bound. The collapse is rollback-able by re-routing; the old classes get GC'd in a later, irreversible deploy once `wrangler tail` proves zero traffic. Deleting a cross-script-bound class is **cli-first** — the reverse of the usual prod-before-cli — or the prod deploy fails the validator with 10061.

## Branding the connections so the compiler catches mistakes

The collapse is on the server. The browser side had its own version of the same problem: it opened three WebSocket connections, all typed as the full `VibesDiyApiIface`, so nothing stopped a doc write from being aimed at the codegen connection at compile time. We branded each one with a kind-parameterized `Conn<K>` view so the compiler now refuses wrong-shard calls.

Staging it as "alias first, then let the build surface every wrong-kind site" worked — and immediately exposed a latent bug in the `Conn<K>` machinery itself. `AvailableMethods` routed *no-reqType* methods (`close`, `getTokenClaims`, every `on*` registrar) through the policy branch, because `never extends ReqType` is `true`, silently dropping them from every shard view. The fix was a `[MethodReqType] extends [never]` tuple-wrapped guard, locked by a `shard-policy.test-d.ts` assertion. The lesson generalizes: an `extends X` check where the input can be `never` will quietly take the wrong branch — wrap it in a tuple to defeat distribution and catch the empty case.

## What types still can't prove

This is **kind** enforcement, and only in the worker. Types can prove "this is a vibe connection." They cannot prove "this is the shard for *this* vibe (`owner--appSlug`)." That shard-identity check is the keystone still to build: category-(b) handlers will need a fail-loud runtime identity gate at dispatch, so a write that can't reach its vibe's broadcast shard **throws** rather than persisting quietly. Types shrink the honest-mistake surface to almost nothing; that one runtime assertion is the part you can never delete.

<div class="post-cta">
  <h3>One surface. Many shards. No migrations.</h3>
  <p>The platform we collapse down so a sentence becomes a working, multi-user app — that's the thing you get to build on.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
