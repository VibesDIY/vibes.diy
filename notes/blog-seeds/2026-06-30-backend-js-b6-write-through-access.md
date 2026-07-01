# The design was approved. Then the live isolate said "could not be cloned."

Source: `claude/backend-js-b6-write-through-access` (B6 of #2856; the write/access core) — stacked on the SSR loader plumbing (#2967, #2845)

B6 makes a vibe's `backend.js` `ctx.db.put(doc)` / `ctx.db.delete(id)` **real**: a server-side write goes
through the *same* access gate a user write does, as the trigger's identity, so `access.js` literally
can't tell them apart. The access/data half — reuse the production `putDoc`/`deleteDoc` gate (QuickJS
`access.js`, grant-state, `AccessFnOutputs` sidecar), through the same per-doc seq allocator, as the
`onChange`→original-writer / `fetch`→session-user / `scheduled`→owner identity, with B5's loop-guard
depth finally carrying real values — went the way a careful port goes. The *transport* half is the story.

**The approved design was impossible, and only a live isolate could tell us.** The plan (Charlie-signed)
was a dedicated `Fetcher` capability in the loaded isolate's `env` — `env.__VIBES_DB.fetch(...)`. It
passed every unit test against the fake loader binding. Then we flipped `BACKEND_JS=loader` on the PR
preview (the open-beta `env.LOADER` binding is absent from CI, so this was the *first* real isolate load)
and read the errors, one deploy at a time:

1. `could not be cloned` — the real Worker Loader **structured-clones `WorkerCode.env`**. A host callback
   can't ride `env`; it carries cloneable *data* only. The entire approved channel was a dead end.
2. Pivot to `globalOutbound` (the only other channel) → `not of type 'Fetcher'`. `globalOutbound` is
   passed by reference, but it demands a *real* `Fetcher` — a plain `{ fetch }` object is rejected.
3. The only real `Fetcher` that can reach a per-invocation, in-memory callback is a **stub back to the
   `BackendDO` itself**: a same-name self-stub resolves to the same instance = same isolate, so the
   executor's nonce→callback registry is shared, and a DO→isolate→DO subrequest *doesn't* deadlock (the
   input gate is open across the `await`). `ctx.db` → `globalOutbound` (self-stub) → the DO's `fetch` →
   `handleBackendDbOp` → registry → the production gate. It worked… almost:
4. `Access function unavailable` — the `BackendDO`'s `vctx` never wired the QuickJS invoker the session DO
   does. Add it.
5. `no active call context` — the nonce vanished: the worker bundle had **duplicated** the executor
   module, so the executor registered in one `Map` and the handler read another. Pin the registry to a
   `globalThis` singleton.
6. `{"ok":true,"wrote":"hit-live-test"}` — and the doc is queryable. A backend handler wrote through the
   access gate, on a real edge isolate.

**The lesson isn't any one bug — it's that the load-bearing unknown ("how does `ctx.db` reach the host?")
was unanswerable without a live open-beta binding, and every layer of the answer was invisible to CI.**
The design doc's "open question 1" is now closed with an empirically-forced architecture, not a guess.
`env` is capability-free; `globalOutbound` is a DO self-stub that services *only* the db-op URL and 403s
all other egress (so there's still no open-Internet egress until B8); identity + loop-guard depth are
applied host-side and never travel through the isolate.

Two more notes worth keeping. The gate reconciliation: a rebase onto current `main` collided with an
interim `#2290` refactor (DM dbs governed by a built-in access fn), so `runPutAccessGate` /
`runDeleteAccessGate` had to *absorb* main's helpers rather than pick a side — the 123-test
`access-fn`/`dm` suite is the proof it stayed behavior-preserving. And the honest edge: `fetch`-triggered
writes are still anonymous until the `_api` verified-session resolver lands (#3001) — fail-safe, since
`access.js` must opt them in. All of it stays dark in prod behind `BACKEND_JS=off`; the preview is where
it's real.
