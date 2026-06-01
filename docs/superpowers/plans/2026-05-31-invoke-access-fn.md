# invokeAccessFn — Wire the Eval Mechanism (Issue #2087)

> **UPDATED 2026-05-31:** Original plan used `new Function()` which doesn't work in DO fetch handlers at runtime. Canary testing confirmed `@cf-wasm/quickjs` works. See Handoff Prompts below.

## Status

Tasks 1–5 are committed on branch `worktree-jchris+invoke-access-fn` (PR #2089). The `new Function()` approach fails at runtime in DO fetch handlers — `allow_eval_during_startup` only covers startup scope. Deploy-preview CI is blocked by the startup CPU limit caused by the flag itself.

**Canary results (2026-05-31):**
1. `new Function()` in DO fetch → `EvalError: Code generation from strings disallowed`
2. Module-scope eval → works but can't eval per-request user code
3. `@cf-wasm/quickjs` in DO fetch → ✅ works, no compat flags needed, 258KB gzipped

## Remaining Work: Two Handoff Prompts

### Prompt 1: Switch AccessFnDO to QuickJS WASM

Paste this to a fresh agent session:

---

### Prompt 2: Remove `allow_eval_during_startup` and fix deploy

Paste this to a fresh agent session after Prompt 1 is merged:

---

## Handoff Prompt 1: Switch AccessFnDO to QuickJS WASM

```
## Task: Replace `new Function()` with QuickJS WASM in AccessFnDO

### Context

PR #2089 on branch `worktree-jchris+invoke-access-fn` wires `invokeAccessFn` for access function enforcement on writes. The implementation is complete but the eval mechanism is broken: `new Function()` doesn't work at runtime in Cloudflare DO fetch handlers. The `allow_eval_during_startup` compat flag only covers Worker startup/module scope.

Canary testing confirmed `@cf-wasm/quickjs` (npm package) works perfectly in DO fetch handlers. It uses QuickJS compiled to WASM — no compat flags needed, 258KB gzipped overhead.

### Worktree

Path: `/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+invoke-access-fn`
Branch: `worktree-jchris+invoke-access-fn`
PR: #2089

Enter the worktree, then work from `vibes.diy/` subdirectory.

### What to change

**1. Install `@cf-wasm/quickjs` in `vibes.diy/pkg/`**

```bash
cd vibes.diy/pkg && pnpm add @cf-wasm/quickjs
```

**2. Rewrite `vibes.diy/pkg/workers/access-fn.ts`**

Replace the `new Function()` eval with QuickJS WASM. The current file:
- Receives `source` in the POST body (access function JS source code)
- Lazy-compiles it with `new Function("doc", "oldDoc", "user", "ctx", source)` on first request
- Caches the compiled function for the DO instance lifetime
- Calls it with `(doc, oldDoc, user, helpers)` and returns the result

New approach using `@cf-wasm/quickjs`:
- Import `getQuickJSWASMModule` from `@cf-wasm/quickjs`
- On each invoke request, create a QuickJS context via `QuickJS.newContext()`
- Use `vm.evalCode()` to evaluate the access function source wrapped as an IIFE
- Marshal the arguments (doc, oldDoc, user, ctx/helpers) into the VM
- Call the function and extract the result
- Dispose the VM context

Key API usage (verified by canary):
```typescript
import { getQuickJSWASMModule } from "@cf-wasm/quickjs";

// In fetch handler:
const QuickJS = await getQuickJSWASMModule();
const vm = QuickJS.newContext();

// Wrap source as self-invoking: the user writes `return { allowAnonymous: true };`
// We wrap it as a function body that receives serialized args via a global
const argsJson = JSON.stringify({ doc, oldDoc, user, ctx: helperNames });
vm.evalCode(`globalThis.__args = ${argsJson};`);
const result = vm.evalCode(`
  const __a = globalThis.__args;
  const fn = new Function("doc", "oldDoc", "user", "ctx", ${JSON.stringify(source)});
  JSON.stringify(fn(__a.doc, __a.oldDoc, __a.user, __a.ctx));
`);
// Note: new Function works INSIDE QuickJS VM — it's a JS interpreter in WASM

if (result.error) {
  const err = vm.dump(result.error);
  result.error.dispose();
  vm.dispose();
  // return forbidden
}
const value = JSON.parse(vm.dump(result.value));
result.value.dispose();
vm.dispose();
// return value as AccessDescriptor
```

**Simpler approach** — since QuickJS is a full JS interpreter, you can just evalCode the source directly with args as globals:

```typescript
const QuickJS = await getQuickJSWASMModule();
const vm = QuickJS.newContext();

// Set up globals for doc, oldDoc, user, ctx as JSON
const setupCode = `
  const doc = ${JSON.stringify(body.doc)};
  const oldDoc = ${JSON.stringify(body.oldDoc)};
  const user = ${JSON.stringify(body.user)};
  const ctx = ${JSON.stringify(helperData)};
`;
vm.evalCode(setupCode);

// Eval the user's source — it uses `return` statements
// Wrap in a function body so `return` works
const fnResult = vm.evalCode(`(function() { ${source} })()`);
if (fnResult.error) {
  const errStr = vm.dump(fnResult.error);
  fnResult.error.dispose();
  vm.dispose();
  return respondForbidden(`access function error: ${JSON.stringify(errStr)}`);
}
const resultJson = vm.evalCode(`JSON.stringify(${vm.dump(fnResult.value)})`);
// Actually simpler: just dump the value directly
const accessResult = vm.dump(fnResult.value);
fnResult.value.dispose();
vm.dispose();
```

**Important**: The `makeHelpers()` function returns an object with methods (like `forbid()`). Methods can't be serialized into QuickJS. Two options:
- (a) Only pass serializable helper data (user info) and skip method helpers — simplest
- (b) Register helper functions as QuickJS globals via `vm.newFunction()` — more complete but complex

Start with (a). The access function gets `doc`, `oldDoc`, `user` as data. The `ctx` helpers like `forbid()` can be replaced by the access function returning `{ forbidden: "reason" }` directly (which is already the pattern).

**3. Keep the caching behavior**

The current code caches the compiled function for the DO instance lifetime. With QuickJS, compilation is cheap (~1ms), so you can either:
- Cache the source string and create a fresh VM per request (simpler, better isolation)
- Cache nothing — source comes in the POST body every time (current architecture already does this)

The current architecture sends `source` in every POST body from `app-documents.ts`. So just eval it fresh each time — no caching needed. This actually simplifies the DO significantly.

**4. Update unit tests**

`vibes.diy/api/tests/access-fn-unit.test.ts` tests the eval wrapper pattern using `new Function()` directly (which works in Node). These tests validate the LOGIC, not the CF runtime. They can stay as-is since Node supports `new Function()`. But add a note that the production path uses QuickJS WASM.

**5. Run checks**

```bash
cd /path/to/worktree && pnpm fast-check
```

Fix any TypeScript errors. The main things to watch for:
- Import of `getQuickJSWASMModule` resolves correctly
- No type errors from the QuickJS API
- Existing tests still pass (the integration tests in `access-fn-invoke.test.ts` use a mock `invokeAccessFn`, not the real DO)

**6. Commit**

```bash
git add vibes.diy/pkg/workers/access-fn.ts vibes.diy/pkg/package.json vibes.diy/pkg/pnpm-lock.yaml
git commit -m "feat(firefly): switch AccessFnDO from new Function to QuickJS WASM

new Function() doesn't work at runtime in DO fetch handlers —
allow_eval_during_startup only covers startup scope. QuickJS WASM
evaluates JS strings via a WASM sandbox, no compat flags needed."
```
```

## Handoff Prompt 2: Remove allow_eval_during_startup + Fix Deploy

```
## Task: Remove `allow_eval_during_startup` and verify deploy-preview passes

### Context

PR #2089 on branch `worktree-jchris+invoke-access-fn`. The `allow_eval_during_startup` compatibility flag was added in the spike phase to enable `new Function()` in DO constructors. Canary testing proved this flag doesn't help (eval only works at startup scope, not in DO fetch handlers). Worse, the flag itself causes deploy-preview CI to fail with `Error: Script startup exceeded CPU time limit` (code 10021) — it enables module-level eval calls in bundled dependencies that blow the startup budget.

After Prompt 1 switches to QuickJS WASM, this flag is no longer needed.

### Worktree

Path: `/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+invoke-access-fn`
Branch: `worktree-jchris+invoke-access-fn`
PR: #2089

### What to change

**1. Remove `allow_eval_during_startup` from `vibes.diy/pkg/wrangler.toml`**

Line 4 currently reads:
```toml
compatibility_flags = ["nodejs_compat", "allow_eval_during_startup"]
```

Change to:
```toml
compatibility_flags = ["nodejs_compat"]
```

This is the ONLY place it appears — it's in the top-level config and inherited by all env sections.

**2. Run pnpm fast-check**

```bash
cd /path/to/worktree && pnpm fast-check
```

Should pass — removing a compat flag doesn't affect TypeScript or tests.

**3. Commit and push**

```bash
git add vibes.diy/pkg/wrangler.toml
git commit -m "fix(deploy): remove allow_eval_during_startup — no longer needed

QuickJS WASM handles runtime eval without compat flags. The flag was
causing deploy-preview to fail with CPU startup limit (10021) by
enabling eval in bundled dependencies at module scope."

git push origin worktree-jchris+invoke-access-fn
```

**4. Verify deploy-preview CI passes**

Watch the GitHub Actions run on PR #2089. The `deploy-preview` job should now pass since the startup CPU budget is no longer blown by the eval flag.

If it still fails, check the error — it may be the QuickJS WASM bundle size (632KB total, 258KB gzipped). CF Workers have a 10MB compressed limit so this should be fine, but verify the error message.

**5. Post PR comment confirming deploy-preview is green**

Once CI passes, comment on PR #2089 confirming the deploy blocker is resolved.
```
