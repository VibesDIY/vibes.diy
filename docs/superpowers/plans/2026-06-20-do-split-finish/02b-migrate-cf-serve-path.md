# A2b — Migrate the worker `cf-serve` path off `env.ACCESS_FN_DO`

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. The connection-routing option (Task 2) has a design decision — run `brainstorming` on it before committing to an approach. The fail-closed guard (Task 1) is concrete TDD and should land first regardless.
>
> **Added after review** (@chatgpt-codex-connector, PR #2492): the worker
> `cf-serve` route is a **second live consumer** of `env.ACCESS_FN_DO` that the
> first draft missed. A3 cannot delete the class until this is resolved.

**Goal:** Stop the worker `cf-serve` path (deployed-vibe app subdomains + asset
host) from reaching `env.ACCESS_FN_DO`, and add a fail-closed guard so a missing
access invoker can never silently bypass enforcement. After this PR + A2, no
production path invokes `env.ACCESS_FN_DO` and the default invoker can be
removed.

**Architecture:** `route-decision.ts:62` routes app subdomain / asset host to
`cf-serve`; `app.ts:305,308` handle it by calling `cfServeAppCtx(request, env,
cctx)` and `cfServe(request, cctx)` with **no** `invokeAccessFn` override and
**no** `eventoFactory`, so deployed-vibe doc writes run in the worker under
`vibesMsgEvento` + the default `env.ACCESS_FN_DO` invoker.

**Tech Stack:** TypeScript, Cloudflare Workers, QuickJS (WASM), Vitest.

**Spec:** `../../specs/2026-06-20-do-split-finish-design.md` (Track A2b).

---

## Task 1: Fail-closed guard in `putDocEvento` (land first)

This is correct and worth doing **independent** of the routing decision — it
removes the fail-open footgun the review identified.

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-write-eventos.ts` (~line 217)
- Test: `vibes.diy/api/tests/access-fn-invoke.test.ts` (or a new sibling)

- [ ] **Step 1: Write the failing test**

A doc with an access binding (`afbRow.accessFnCid` set) written through a context
with **no** `invokeAccessFn` must be **rejected**, not written.

```ts
it("rejects an access-bound write when no invokeAccessFn is available", async () => {
  // set up an app with an access binding but DO NOT provide invokeAccessFn
  const res = await putDocThroughEvento(
    {
      /* access-bound db */
    },
    { invokeAccessFn: undefined }
  );
  expect(res).toMatchObject({ type: "vibes.diy.res-error" });
  // and assert the doc was NOT persisted
});
```

- [ ] **Step 2: Run it — confirm it fails (write currently succeeds, fail-open)**

Run: `cd vibes.diy/tests && pnpm test access-fn-invoke -- --run`
Expected: FAIL — the write currently goes through (the `if (afbRow?.accessFnCid
&& vctx.invokeAccessFn)` block is skipped when the invoker is undefined).

- [ ] **Step 3: Add the guard**

In `app-documents-write-eventos.ts`, before the existing
`if (afbRow?.accessFnCid && vctx.invokeAccessFn)` block, fail closed when a
binding exists but no invoker is wired:

```ts
if (afbRow?.accessFnCid && !vctx.invokeAccessFn) {
  await ctx.send.send(ctx, {
    type: "vibes.diy.res-error",
    error: { message: "Access function unavailable" },
  } satisfies ResError);
  return Result.Ok(EventoResult.Continue);
}
```

- [ ] **Step 4: Run it — confirm it passes**, then run the broader access suite
      (`pnpm test access-fn -- --run`) to confirm no regressions where an invoker IS
      present.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-write-eventos.ts vibes.diy/api/tests/access-fn-invoke.test.ts
git commit -m "fix(access): fail closed when an access-bound write has no invoker (#2265)"
```

---

## Task 2: Take the worker `cf-serve` path off `env.ACCESS_FN_DO` (design decision)

Pick ONE approach in the brainstorm. Both end with the worker path no longer
calling `env.ACCESS_FN_DO`.

### Option A (preferred): route deployed-vibe doc ops to AppSessions

Have the deployed vibe's iframe runtime open its data WebSocket to
`/api/app?vibe=<owner>--<slug>` (AppSessions, with `localInvokeAccessFn` +
local broadcast) instead of the app-subdomain root `cf-serve` WebSocket. The
worker `cf-serve` route then carries only asset/non-doc traffic.

- Audit the iframe runtime connection (`vibe/runtime/use-firefly.ts` and the
  srv-sandbox `vibeApi` wiring) — how the deployed-vibe data plane resolves its
  WS URL on an app subdomain.
- Confirm app subdomains can reach `/api/app` (route-decision already maps
  `/api/app` → `app-api` → AppSessions for any host).
- Risk: app-subdomain origin/CORS/auth differences vs the dashboard origin;
  whether the deployed runtime currently relies on same-origin app-subdomain WS.

### Option B: give the worker path a local invoker

Pass an `invokeAccessFn` override into `cfServeAppCtx` at `app.ts:305` that
evaluates access fns in-worker (instantiate QuickJS per request — the same
`localInvokeAccessFn` building block AppSessions uses, minus the cached module).

- Simpler/localized, but pays cold-QuickJS cost per access-bound write on the
  worker path. Measure.
- Keeps deployed-vibe data ops in the worker (no behavior change for clients).

- [ ] **Step 1: Brainstorm + decide A vs B**, record the decision in this file
      and the PR.
- [ ] **Step 2: Implement the chosen option** (expand into TDD steps once chosen).
- [ ] **Step 3: Grep gate** — `rg -n "env\.ACCESS_FN_DO" vibes.diy --type ts -g '!**/tests/**'`
      returns **only** the default invoker in `cf-serve.ts` (removed in Task 3).

---

## Task 3: Remove the default invoker + verify

- [ ] **Step 1:** Delete the default `invokeAccessFn` block from `cf-serve.ts`
      (the `env.ACCESS_FN_DO.idFromName(...)` block, ~lines 430–462). With Task 1's
      guard in place, any context lacking an invoker now fails closed.

- [ ] **Step 2: Grep gate** — zero `env.ACCESS_FN_DO` in non-test code.

- [ ] **Step 3: `pnpm check`** → green.

- [ ] **Step 4: PR + preview smoke** — critically, smoke a **deployed** vibe's
      access-gated writes on its **app subdomain** (not just the editor): a gated
      write must still be enforced. This is the gate before A3 deletes the class.
