# useVibe() Hook (Slice 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `useVibe(dbName)` — a React hook exposing `{ me, ready, can }` that gates writes by running the vibe's own `access.js` in-iframe via the slice-1 runner, so generated code stops re-deriving access from identity.

**Architecture:** A pure consumer of `VibeContext` (identity/grants/adminMode from `viewerEnv`, `access.js` source from `accessFnSources`, dbName→cid from `accessFnBindings`) composed with `evaluateWrite`. Readiness is three-state (resolved-string / resolved-null / pending) with a shared per-`cid` grace timer so a never-arriving source degrades to interactive instead of stranding the app. `adminMode` is threaded additively through the whoAmI→viewerChanged identity path.

**Tech Stack:** TypeScript, React (hooks, `useSyncExternalStore`), arktype (wire types), vitest browser mode + `@testing-library/react`.

**Spec:** [`docs/superpowers/specs/2026-06-22-usevibe-hook-slice3-design.md`](../specs/2026-06-22-usevibe-hook-slice3-design.md)

**Test command (all tasks):** from repo root, `cd vibes.diy/tests && pnpm test -- <file>` (browser-mode vitest). Type/format gate: `pnpm check` from root before final push.

> **Note on `render-vibe` / SSR (corrects one line of the spec):** SSR `buildViewerEnvForRender` calls `resolveWhoAmI` with `auth: undefined` and has no client admin-toggle to read, so it cannot populate `adminMode`. `adminMode` therefore arrives via the **bootstrap whoAmI → viewerChanged** path (exactly how `viewer` identity itself bootstraps — SSR ships a baseline, the first whoAmI corrects it). The SSR viewerEnv builder is intentionally **not** modified for adminMode.

---

## File Structure

- **Create** `vibes.diy/vibe/runtime/use-vibe-grace.ts` — shared per-`cid` grace-timeout registry + `useGraceDegraded` hook. One responsibility: "is this cid's source pending past the grace window?", shared across all hook instances.
- **Create** `vibes.diy/vibe/runtime/use-vibe.ts` — the `useVibe` hook + its public types (`UseVibeResult`, `CanVerdict`, `UseVibeMe`).
- **Create** `vibes.diy/tests/app/use-vibe-grace.test.ts` — unit tests for the grace registry.
- **Create** `vibes.diy/tests/app/use-vibe.test.tsx` — browser tests for the hook.
- **Modify** `vibes.diy/vibe/runtime/vibe.ts` — `viewerEnv` gains `adminMode?`.
- **Modify** `vibes.diy/vibe/types/index.ts` — `ResVibeWhoAmI` + `EvtVibeViewerChanged` gain `adminMode?`.
- **Modify** `vibes.diy/api/svc/public/who-am-i.ts` — echo `adminMode` in the response.
- **Modify** `vibes.diy/vibe/runtime/register-dependencies.ts` — `bootstrapViewer` forwards `adminMode`.
- **Modify** `vibes.diy/vibe/runtime/VibeContext.tsx` — `viewerChanged` handler copies `adminMode`.
- **Modify** `vibes.diy/vibe/runtime/index.ts` — export `useVibe` + types.

**adminMode checklist → tasks** (maps Charlie's four legs): leg 1 whoAmI response = Task 1+2; leg 2 bridge passthrough + leg 3 bootstrap/viewerChanged producers = Task 2; leg 4 render-time `viewerEnv` type = Task 1 (type carries the field; value supplied by the whoAmI path per the SSR note above).

---

## Task 1: Thread `adminMode` onto the wire/types (additive, no behavior change)

**Files:**

- Modify: `vibes.diy/vibe/runtime/vibe.ts:11-17`
- Modify: `vibes.diy/vibe/types/index.ts:482-489` (`ResVibeWhoAmI`) and `:589-596` (`EvtVibeViewerChanged`)
- Test: `vibes.diy/tests/app/use-vibe-grace.test.ts` is unrelated; add the type round-trip assertion to a new `vibes.diy/tests/app/admin-mode-wire.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/admin-mode-wire.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isEvtVibeViewerChanged, isResVibeWhoAmI } from "@vibes.diy/vibe-types";

describe("adminMode on identity wire types", () => {
  it("EvtVibeViewerChanged accepts adminMode", () => {
    expect(
      isEvtVibeViewerChanged({
        type: "vibe.evt.viewerChanged",
        viewer: { userHandle: "alice" },
        access: "viewer",
        adminMode: true,
      })
    ).toBe(true);
  });

  it("ResVibeWhoAmI accepts adminMode", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        viewer: { userHandle: "alice" },
        access: "viewer",
        adminMode: true,
      })
    ).toBe(true);
  });

  it("both still accept payloads without adminMode (optional)", () => {
    expect(isEvtVibeViewerChanged({ type: "vibe.evt.viewerChanged", viewer: null, access: "none" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests && pnpm test -- admin-mode-wire`
Expected: FAIL — `adminMode: true` is rejected by arktype (unknown key) so `isEvtVibeViewerChanged`/`isResVibeWhoAmI` return `false`.

- [ ] **Step 3: Add `adminMode?` to the three types**

In `vibes.diy/vibe/runtime/vibe.ts`, add to the `viewerEnv` object (after the `grants?` line, before the closing `})`):

```ts
  "adminMode?": "boolean",
```

In `vibes.diy/vibe/types/index.ts`, add the same line to `ResVibeWhoAmI` (after its `grants?` line, line ~488) and to `EvtVibeViewerChanged` (after its `grants?` line, line ~595):

```ts
  "adminMode?": "boolean",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests && pnpm test -- admin-mode-wire`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/vibe.ts vibes.diy/vibe/types/index.ts vibes.diy/tests/app/admin-mode-wire.test.ts
git commit -m "feat(vibe): thread adminMode onto viewerEnv/whoAmI/viewerChanged types"
```

---

## Task 2: Propagate `adminMode` through the whoAmI → viewerChanged producers

**Files:**

- Modify: `vibes.diy/api/svc/public/who-am-i.ts:227-235` (echo in response)
- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts:568-579` (`bootstrapViewer` dispatch)
- Modify: `vibes.diy/vibe/runtime/VibeContext.tsx:117-123` (handler copy-through)
- Test: extend `vibes.diy/tests/app/vibe-context-viewer.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `vibes.diy/tests/app/vibe-context-viewer.test.tsx` inside the `describe`:

```tsx
it("copies adminMode through on viewerChanged", async () => {
  let captured: Vibe | undefined;
  render(
    <VibeContextProvider mountParams={{ usrEnv: {}, viewerEnv: { viewer: null, access: "none" } }}>
      <Probe onCtx={(c) => (captured = c)} />
    </VibeContextProvider>
  );

  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "vibe.evt.viewerChanged",
        viewer: { userHandle: "owner" },
        access: "override",
        isOwner: true,
        adminMode: true,
      },
    })
  );

  await waitFor(() => {
    expect(captured?.mountParams.viewerEnv?.adminMode).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests && pnpm test -- vibe-context-viewer`
Expected: FAIL — `viewerEnv.adminMode` is `undefined` because the handler drops the field.

- [ ] **Step 3: Copy `adminMode` through in the VibeContext handler**

In `vibes.diy/vibe/runtime/VibeContext.tsx`, in the `viewerChanged` `setViewerEnv` call (around line 117), add a spread line alongside the existing `grants` spread:

```tsx
        ...(event.data.grants ? { grants: event.data.grants } : {}),
        ...(event.data.adminMode !== undefined ? { adminMode: event.data.adminMode } : {}),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests && pnpm test -- vibe-context-viewer`
Expected: PASS.

- [ ] **Step 5: Forward `adminMode` in `bootstrapViewer` and echo it in the host response**

In `vibes.diy/vibe/runtime/register-dependencies.ts`, in `bootstrapViewer`'s dispatched event data (around line 576), add alongside the `grants` spread:

```ts
        ...(r.grants ? { grants: r.grants } : {}),
        ...(r.adminMode !== undefined ? { adminMode: r.adminMode } : {}),
```

In `vibes.diy/api/svc/public/who-am-i.ts`, the handler already destructures `adminMode` from the request at line 208 (`const { appSlug, ownerHandle: ownerUserSlug, adminMode } = req;`). In the response object (around line 234), add alongside the `grants` spread:

```ts
        ...(r.grants !== undefined ? { grants: r.grants } : {}),
        ...(adminMode === true ? { adminMode: true } : {}),
```

(The request's `adminMode` is the authoritative client toggle; `resolveWhoAmI`'s result `r` has no `adminMode` field, so echo the request value.)

- [ ] **Step 6: Typecheck the API package**

Run: `pnpm check` (from repo root)
Expected: PASS — no type errors in `who-am-i.ts` or `register-dependencies.ts`.

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/vibe/runtime/VibeContext.tsx vibes.diy/vibe/runtime/register-dependencies.ts vibes.diy/api/svc/public/who-am-i.ts vibes.diy/tests/app/vibe-context-viewer.test.tsx
git commit -m "feat(vibe): propagate adminMode through whoAmI response and viewerChanged"
```

---

## Task 3: Shared per-`cid` grace-timeout registry

**Files:**

- Create: `vibes.diy/vibe/runtime/use-vibe-grace.ts`
- Test: `vibes.diy/tests/app/use-vibe-grace.test.ts`

**Design:** module-level registry keyed by `cid`. One shared `setTimeout` per `cid` (refcounted across hook instances); on expiry it marks the `cid` grace-degraded and notifies subscribers. `useGraceDegraded(cid, pending)` arms the timer only while `pending` and exposes the degraded flag reactively via `useSyncExternalStore`. `GRACE_MS` is overridable for tests via `setGraceMsForTest`.

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/use-vibe-grace.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { armGrace, isGraceDegraded, subscribeGrace, setGraceMsForTest, __resetGraceForTest } from "@vibes.diy/vibe-runtime";

beforeEach(() => {
  __resetGraceForTest();
  setGraceMsForTest(20);
});
afterEach(() => __resetGraceForTest());

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("grace registry", () => {
  it("marks a cid degraded after the grace window", async () => {
    expect(isGraceDegraded("cidA")).toBe(false);
    const cancel = armGrace("cidA");
    await wait(40);
    expect(isGraceDegraded("cidA")).toBe(true);
    cancel();
  });

  it("shares one timer across instances — both see degraded together", async () => {
    const c1 = armGrace("cidB");
    const c2 = armGrace("cidB");
    let notified = 0;
    const unsub = subscribeGrace(() => (notified += 1));
    await wait(40);
    expect(isGraceDegraded("cidB")).toBe(true);
    expect(notified).toBeGreaterThan(0);
    c1();
    c2();
    unsub();
  });

  it("cancelling all arms before expiry prevents degradation (cleanup)", async () => {
    const cancel = armGrace("cidC");
    cancel();
    await wait(40);
    expect(isGraceDegraded("cidC")).toBe(false);
  });

  it("a second arm after one cancel keeps the timer alive (refcount)", async () => {
    const c1 = armGrace("cidD");
    const c2 = armGrace("cidD");
    c1(); // one instance unmounts; timer must survive
    await wait(40);
    expect(isGraceDegraded("cidD")).toBe(true);
    c2();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests && pnpm test -- use-vibe-grace`
Expected: FAIL — module `use-vibe-grace` does not exist.

- [ ] **Step 3: Implement the registry**

Create `vibes.diy/vibe/runtime/use-vibe-grace.ts`:

```ts
import { useEffect } from "react";
import { useSyncExternalStore } from "react";

// Default "interactive, never wait forever" window. A source that never
// arrives (RPC failure leaving the cid absent) degrades to optimistic after
// this many ms instead of pinning the app in a skeleton.
let GRACE_MS = 4000;

const degraded = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const refcount = new Map<string, number>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function isGraceDegraded(cid: string): boolean {
  return degraded.has(cid);
}

export function subscribeGrace(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Arm the shared per-cid timer. Idempotent across instances via refcount;
// the timer is created once and survives until the LAST armer cancels (or it
// fires). Returns a cleanup that decrements the refcount.
export function armGrace(cid: string): () => void {
  refcount.set(cid, (refcount.get(cid) ?? 0) + 1);
  if (!degraded.has(cid) && !timers.has(cid)) {
    timers.set(
      cid,
      setTimeout(() => {
        timers.delete(cid);
        degraded.add(cid);
        notify();
      }, GRACE_MS)
    );
  }
  let released = false;
  return () => {
    if (released) return; // StrictMode double-invoke safety
    released = true;
    const n = (refcount.get(cid) ?? 1) - 1;
    if (n > 0) {
      refcount.set(cid, n);
      return;
    }
    refcount.delete(cid);
    const t = timers.get(cid);
    if (t !== undefined) {
      clearTimeout(t);
      timers.delete(cid);
    }
  };
}

// React binding: returns whether `cid` is grace-degraded, and arms the shared
// timer only while `pending`. Resets on cid/pending change; cleans up on unmount.
export function useGraceDegraded(cid: string | undefined, pending: boolean): boolean {
  const flag = useSyncExternalStore(
    subscribeGrace,
    () => (cid !== undefined ? isGraceDegraded(cid) : false),
    () => false
  );
  useEffect(() => {
    if (cid === undefined || !pending) return;
    return armGrace(cid);
  }, [cid, pending]);
  return cid !== undefined ? flag : false;
}

// ── test-only helpers ────────────────────────────────────────────────
export function setGraceMsForTest(ms: number): void {
  GRACE_MS = ms;
}
export function __resetGraceForTest(): void {
  for (const t of timers.values()) clearTimeout(t);
  degraded.clear();
  timers.clear();
  refcount.clear();
  listeners.clear();
  GRACE_MS = 4000;
}
```

- [ ] **Step 4: Export the registry from the runtime barrel**

In `vibes.diy/vibe/runtime/index.ts`, after the `useViewer` export (line 17), add (the `__reset*ForTest`/`setGraceMsForTest` test helpers follow the existing `__resetRegisteredAccessFnSourcesForTests` barrel precedent):

```ts
export {
  useGraceDegraded,
  armGrace,
  isGraceDegraded,
  subscribeGrace,
  setGraceMsForTest,
  __resetGraceForTest,
} from "./use-vibe-grace.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd vibes.diy/tests && pnpm test -- use-vibe-grace`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/runtime/use-vibe-grace.ts vibes.diy/vibe/runtime/index.ts vibes.diy/tests/app/use-vibe-grace.test.ts
git commit -m "feat(vibe): shared per-cid grace-timeout registry for useVibe readiness"
```

---

## Task 4: The `useVibe` hook

**Files:**

- Create: `vibes.diy/vibe/runtime/use-vibe.ts`
- Modify: `vibes.diy/vibe/runtime/index.ts:17` (add export)
- Test: `vibes.diy/tests/app/use-vibe.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `vibes.diy/tests/app/use-vibe.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import {
  VibeContextProvider,
  useVibe,
  setGraceMsForTest,
  __resetGraceForTest,
  __resetRegisteredAccessFnSourcesForTests,
} from "@vibes.diy/vibe-runtime";

// Membership-only access fn: requires channel "team", readable on ["team"].
const TEAM_SRC = `export const aestheticBoard = (doc, oldDoc, user, ctx) => {
  ctx.requireAccess("team");
  return { channels: ["team"] };
};`;

const CID = "cid-team";

// Sources reach VibeContext via vibe.evt.accessFnSource events (slice 2c). The
// type has no Base/tid: { type, cid, source }. Dispatch AFTER render so the
// provider's message listener is attached; waitFor() absorbs the state update.
function seedSource(cid: string, source: string | null) {
  window.dispatchEvent(new MessageEvent("message", { data: { type: "vibe.evt.accessFnSource", cid, source } }));
}

function Probe({ dbName, onResult }: { dbName: string; onResult: (r: ReturnType<typeof useVibe>) => void }) {
  const r = useVibe(dbName);
  onResult(r);
  return null;
}

function mount(viewerEnv: unknown, bindings?: { dbName: string; accessFnCid: string }[]) {
  let last: ReturnType<typeof useVibe> | undefined;
  render(
    <VibeContextProvider mountParams={{ usrEnv: {}, viewerEnv: viewerEnv as never, accessFnBindings: bindings }}>
      <Probe dbName="aestheticBoard" onResult={(r) => (last = r)} />
    </VibeContextProvider>
  );
  return () => last!;
}

beforeEach(() => {
  __resetGraceForTest();
  __resetRegisteredAccessFnSourcesForTests();
});
afterEach(() => __resetGraceForTest());

describe("useVibe", () => {
  it("owner+member → can.create allowed", async () => {
    const get = mount(
      {
        viewer: { userHandle: "owner" },
        access: "override",
        isOwner: true,
        grants: { aestheticBoard: { channels: ["team"], publicChannels: [], roles: [] } },
      },
      [{ dbName: "aestheticBoard", accessFnCid: CID }]
    );
    seedSource(CID, TEAM_SRC);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().me?.userHandle).toBe("owner");
    expect(get().me?.isOwner).toBe(true);
    expect(get().can.create({ type: "tile" })).toEqual({ ok: true });
  });

  it("anonymous → can.create denied with reason (garden-gnome case)", async () => {
    const get = mount({ viewer: null, access: "none" }, [{ dbName: "aestheticBoard", accessFnCid: CID }]);
    seedSource(CID, TEAM_SRC);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().me).toBeNull();
    expect(get().can.create({ type: "tile" })).toEqual({ ok: false, reason: "authentication required" });
  });

  it("non-member signed-in → denied with channel reason", async () => {
    const get = mount(
      {
        viewer: { userHandle: "bob" },
        access: "viewer",
        grants: { aestheticBoard: { channels: [], publicChannels: [], roles: [] } },
      },
      [{ dbName: "aestheticBoard", accessFnCid: CID }]
    );
    seedSource(CID, TEAM_SRC);
    await waitFor(() => expect(get().ready).toBe(true));
    const v = get().can.create({ type: "tile" });
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("team");
  });

  it("adminMode bypasses the gate for a non-member owner", async () => {
    const get = mount(
      {
        viewer: { userHandle: "owner" },
        access: "override",
        isOwner: true,
        adminMode: true,
        grants: { aestheticBoard: { channels: [], publicChannels: [], roles: [] } },
      },
      [{ dbName: "aestheticBoard", accessFnCid: CID }]
    );
    seedSource(CID, TEAM_SRC);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().can.create({ type: "tile" })).toEqual({ ok: true });
  });

  it("resolved-unknown (source null) → ready + optimistic", async () => {
    const get = mount({ viewer: { userHandle: "x" }, access: "viewer" }, [{ dbName: "aestheticBoard", accessFnCid: CID }]);
    seedSource(CID, null);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().can.create({ type: "tile" })).toEqual({ ok: true });
  });

  it("no binding for dbName → ready + optimistic", async () => {
    const get = mount({ viewer: { userHandle: "x" }, access: "viewer" }, []);
    await waitFor(() => expect(get().ready).toBe(true));
    expect(get().can.edit({ _id: "1" })).toEqual({ ok: true });
  });

  it("pending source → not ready, then grace-degrades to interactive", async () => {
    setGraceMsForTest(20);
    // Never seed cid-never → it stays absent in accessFnSources (pending).
    const get = mount({ viewer: { userHandle: "x" }, access: "viewer" }, [{ dbName: "aestheticBoard", accessFnCid: "cid-never" }]);
    expect(get().ready).toBe(false);
    expect(get().can.create({ type: "tile" })).toEqual({ ok: false, reason: "pending" });
    await waitFor(() => expect(get().ready).toBe(true), { timeout: 500 });
    expect(get().can.create({ type: "tile" })).toEqual({ ok: true });
  });
});
```

> Sources are seeded via the `seedSource` helper (a `vibe.evt.accessFnSource` MessageEvent — the same event `VibeContext` already listens for in slice 2c), so the tests depend on no private internals. `__resetRegisteredAccessFnSourcesForTests` is the existing barrel-exported reset helper (from `register-dependencies.ts`) used to clear any module-level baseline between tests.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd vibes.diy/tests && pnpm test -- use-vibe.test`
Expected: FAIL — `useVibe` is not exported from `@vibes.diy/vibe-runtime`.

- [ ] **Step 3: Implement the hook**

Create `vibes.diy/vibe/runtime/use-vibe.ts`:

```ts
import { useMemo } from "react";
import { useVibeContext } from "./VibeContext.js";
import { evaluateWrite, type AccessGrants, type AccessUser } from "./access-runner.js";
import { useGraceDegraded } from "./use-vibe-grace.js";

export interface CanVerdict {
  readonly ok: boolean;
  readonly reason?: string;
}

export interface UseVibeMe {
  readonly userHandle: string;
  readonly displayName?: string;
  readonly isOwner: boolean;
}

export interface UseVibeResult {
  /** Resolved viewer identity, or null when anonymous. */
  readonly me: UseVibeMe | null;
  /** True once identity AND this db's access source have resolved (or the
   *  grace window degraded a never-arriving source to optimistic). Gate
   *  access-sensitive UI on this to avoid a half-resolved flash. */
  readonly ready: boolean;
  readonly can: {
    create(doc: unknown): CanVerdict;
    edit(doc: unknown): CanVerdict;
    delete(doc: unknown): CanVerdict;
  };
}

const EMPTY_GRANTS: AccessGrants = { channels: [], publicChannels: [], roles: [] };

export function useVibe(dbName: string): UseVibeResult {
  const { mountParams, accessFnSources } = useVibeContext();
  const env = mountParams.viewerEnv;

  const identityReady = env !== undefined;
  const cid = mountParams.accessFnBindings?.find((b) => b.dbName === dbName)?.accessFnCid;
  const hasBinding = cid !== undefined;
  const sourcePresent = hasBinding && accessFnSources.has(cid);
  const pending = hasBinding && !sourcePresent;

  const graceDegraded = useGraceDegraded(cid, pending);

  const sourceReady = !hasBinding || sourcePresent || graceDegraded;
  const ready = identityReady && sourceReady;

  // A real source string only when the cache holds one; null (resolved-unknown),
  // absent (no binding), or grace-degraded all leave this undefined → optimistic.
  const source = hasBinding && sourcePresent ? accessFnSources.get(cid) : undefined;

  const me: UseVibeMe | null = useMemo(
    () => (env?.viewer ? { ...env.viewer, isOwner: env.isOwner ?? false } : null),
    [env?.viewer, env?.isOwner]
  );
  const grants: AccessGrants = env?.grants?.[dbName] ?? EMPTY_GRANTS;
  const adminMode = env?.adminMode ?? false;

  const can = useMemo(() => {
    const user: AccessUser | null = me;
    function verdict(doc: unknown, oldDoc: unknown): CanVerdict {
      if (!ready) return { ok: false, reason: "pending" };
      if (typeof source !== "string") return { ok: true }; // optimistic
      const v = evaluateWrite({ source, dbName, doc, oldDoc, user, grants, adminMode });
      if ("unknown" in v) {
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
          // Telemetry seam (spec §Telemetry): full unknown-rate metric is a later item.
          console.warn(`[useVibe] unknown verdict for "${dbName}": ${v.reason}`);
        }
        return { ok: true, reason: v.reason };
      }
      return v.ok ? { ok: true } : { ok: false, reason: v.reason };
    }
    return {
      create: (doc: unknown) => verdict(doc, null),
      edit: (doc: unknown) => verdict(doc, doc),
      delete: (doc: unknown) => verdict(doc, doc),
    };
  }, [ready, source, dbName, me, grants, adminMode]);

  return { me, ready, can };
}
```

- [ ] **Step 4: Export from the runtime barrel**

In `vibes.diy/vibe/runtime/index.ts`, after the grace exports added in Task 3, add:

```ts
export { useVibe, type UseVibeResult, type CanVerdict, type UseVibeMe } from "./use-vibe.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd vibes.diy/tests && pnpm test -- use-vibe.test`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/runtime/use-vibe.ts vibes.diy/vibe/runtime/index.ts vibes.diy/tests/app/use-vibe.test.tsx
git commit -m "feat(vibe): add useVibe() write-gate hook (me/ready/can)"
```

---

## Task 5: Cross-cutting acceptance tests (shared-grace agreement, flips-without-reload)

**Files:**

- Test: `vibes.diy/tests/app/use-vibe.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append inside the `describe("useVibe", …)` block:

```tsx
it("two hooks on the same db flip to interactive together (shared grace)", async () => {
  setGraceMsForTest(20);
  let a: ReturnType<typeof useVibe> | undefined;
  let b: ReturnType<typeof useVibe> | undefined;
  render(
    <VibeContextProvider
      mountParams={{
        usrEnv: {},
        viewerEnv: { viewer: { userHandle: "x" }, access: "viewer" },
        accessFnBindings: [{ dbName: "aestheticBoard", accessFnCid: "cid-shared-never" }],
      }}
    >
      <Probe dbName="aestheticBoard" onResult={(r) => (a = r)} />
      <Probe dbName="aestheticBoard" onResult={(r) => (b = r)} />
    </VibeContextProvider>
  );
  expect(a!.ready).toBe(false);
  expect(b!.ready).toBe(false);
  await waitFor(
    () => {
      expect(a!.ready).toBe(true);
      expect(b!.ready).toBe(true);
    },
    { timeout: 500 }
  );
});

it("adminMode flip via viewerChanged flips can.* without remount", async () => {
  const get = mount(
    {
      viewer: { userHandle: "owner" },
      access: "override",
      isOwner: true,
      grants: { aestheticBoard: { channels: [], publicChannels: [], roles: [] } },
    },
    [{ dbName: "aestheticBoard", accessFnCid: CID }]
  );
  seedSource(CID, TEAM_SRC);
  await waitFor(() => expect(get().ready).toBe(true));
  expect(get().can.create({ type: "tile" }).ok).toBe(false); // non-member, not admin

  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "vibe.evt.viewerChanged",
        viewer: { userHandle: "owner" },
        access: "override",
        isOwner: true,
        adminMode: true,
        grants: { aestheticBoard: { channels: [], publicChannels: [], roles: [] } },
      },
    })
  );

  await waitFor(() => expect(get().can.create({ type: "tile" })).toEqual({ ok: true }));
});
```

> Reuses `CID`, `TEAM_SRC`, `Probe`, `mount`, `seedSource` from Task 4 (same test file).

- [ ] **Step 2: Run tests to verify they fail, then pass**

Run: `cd vibes.diy/tests && pnpm test -- use-vibe.test`
Expected: both new tests already pass against the Task-4 implementation (this task is a coverage guard for the two cross-cutting acceptance criteria). If `adminMode flip` fails, confirm Task 2's `VibeContext` copy-through landed.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/tests/app/use-vibe.test.tsx
git commit -m "test(vibe): shared-grace agreement and adminMode-flips-without-reload"
```

---

## Task 6: Full gate + rules-bag

- [ ] **Step 1: Run the full check suite**

Run: `pnpm check` (from repo root — format + build + test + lint)
Expected: PASS. If formatting drifts, it is auto-written; re-stage and amend the last commit.

- [ ] **Step 2: Run the constructor rules-bag gate**

Run: `pnpm run rules-bag:constructors`
Expected: PASS (no new direct constructors introduced; the hook uses existing runtime APIs).

- [ ] **Step 3: Confirm no behavior change for the dormant path**

Manual reasoning check (no code): `useVibe` is exported but nothing in generated apps imports it yet (slice 4 does the prompt flip). `useViewer` is untouched. `adminMode` defaults to `false`/absent everywhere, so non-admin identity is byte-for-byte unchanged. Record this in the PR description.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin claude/usevibe-hook-slice3-impl
```

Open a ready-for-review PR titled "Plan A · slice 3 (impl): useVibe() hook", label `agent-created`, @-mention `@CharlieHelps`, subscribe, and drive feedback → `ready-to-merge` per the repo's PR lifecycle.

---

## Self-Review

**Spec coverage:**

- Public API `{ me, can, ready }` + `can.create/edit/delete` → Task 4. ✅
- `me` mapping (viewer + isOwner, null when anon) → Task 4 + tests. ✅
- Readiness: identityReady, source string/null/absent, no-binding → Task 4 tests (resolved-unknown, no-binding, pending). ✅
- Grace timeout, per-`cid` shared, arms-only-while-pending, reset on change, StrictMode cleanup, late-source-wins → Task 3 (registry + tests) + Task 5 (shared agreement). ✅
- Verdict mapping (ok/denied/unknown→optimistic/pending) → Task 4 hook + owner/anon/non-member/unknown tests. ✅
- `oldDoc`: create→null, edit/delete→doc → Task 4 `verdict` wiring. ✅
- adminMode four-leg threading + flips-without-reload → Tasks 1, 2, 5. ✅
- Telemetry seam (dev warn on unknown) → Task 4 hook. ✅
- can.see omitted; useViewer untouched; dormant rollout → Task 6 Step 3 + no export of can.see. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full content. The one lookup (`registerAccessFnSource` name) is an explicit verify-step (Task 4 Step 2) with a concrete fallback, not a placeholder. ✅

**Type consistency:** `WriteVerdict` discriminated via `"unknown" in v`; `evaluateWrite` args match `EvaluateWriteArgs` (source/dbName/doc/oldDoc/user/grants/adminMode); `AccessUser` = `{ userHandle, displayName?, isOwner }` matches `UseVibeMe`; `armGrace`/`isGraceDegraded`/`useGraceDegraded`/`setGraceMsForTest`/`__resetGraceForTest` names consistent between Task 3 module and Task 4/5 tests. ✅
