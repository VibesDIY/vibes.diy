# ViewerTag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ViewerTag` component returned from `useViewer()` that renders an inline user pill with a dashed-ring avatar; when the current viewer looks at themselves, clicking the avatar uploads a new profile photo.

**Architecture:** The component is closure-bound to the current viewer inside `useViewer()` and not exported at the top level. Photo upload uses two existing/new postMessage RPCs: `putAsset` (bytes → CID) then a new `updateAvatarCid` (CID → SQL user settings). The avatar route `/u/:userSlug/avatar` is unchanged.

**Tech Stack:** React, arktype, Vitest, `@testing-library/react`, existing `VibeSandboxApi` postMessage bridge pattern.

---

## File Map

| File                                                             | Role                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `vibes.diy/vibe/types/index.ts`                                  | Add `ReqVibeUpdateAvatarCid` / `ResVibeUpdateAvatarCid` types + guards          |
| `vibes.diy/vibe/runtime/register-dependencies.ts`                | Add `updateAvatarCid(cid)` to `VibeSandboxApi`; expose `getRegisteredVibeApi()` |
| `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`                      | Add `vibeUpdateAvatarCid` handler; register it                                  |
| `vibes.diy/vibe/runtime/use-viewer-tag.tsx`                      | New — `ViewerTagImpl` component                                                 |
| `vibes.diy/vibe/runtime/use-viewer.ts`                           | Add `ViewerTag` to `UseViewerResult` + return value                             |
| `vibes.diy/vibe/runtime/index.ts`                                | Export `ViewerTagProps` type (not the component)                                |
| `vibes.diy/tests/app/vibe-sandbox-api-update-avatar-cid.test.ts` | New — postMessage round-trip tests                                              |
| `vibes.diy/tests/app/viewer-tag.test.tsx`                        | New — component render tests                                                    |
| `prompts/pkg/llms/use-viewer.md`                                 | Add `## ViewerTag` section                                                      |

---

## Task 1: Add postMessage types for `updateAvatarCid`

**Files:**

- Modify: `vibes.diy/vibe/types/index.ts` (after `isResVibeWhoAmI` at line ~573)

- [ ] **Step 1: Add the types**

Insert after the `isResVibeWhoAmI` function:

```ts
// Sandbox → host: persist a freshly-uploaded avatar CID to the viewer's
// platform profile. The host enforces that the sandbox userSlug matches
// the authenticated session before calling ensureUserSettings.
export const ReqVibeUpdateAvatarCid = type({
  type: "'vibe.req.updateAvatarCid'",
  userSlug: "string",
  appSlug: "string",
  cid: "string",
}).and(Base);
export type ReqVibeUpdateAvatarCid = typeof ReqVibeUpdateAvatarCid.infer;

export function isReqVibeUpdateAvatarCid(x: unknown): x is ReqVibeUpdateAvatarCid {
  return !(ReqVibeUpdateAvatarCid(x) instanceof type.errors);
}

// Host → sandbox response.
export const ResVibeUpdateAvatarCid = type({
  type: "'vibe.res.updateAvatarCid'",
  status: "'ok' | 'error'",
  "message?": "string",
}).and(Base);
export type ResVibeUpdateAvatarCid = typeof ResVibeUpdateAvatarCid.infer;

export function isResVibeUpdateAvatarCid(x: unknown): x is ResVibeUpdateAvatarCid {
  return !(ResVibeUpdateAvatarCid(x) instanceof type.errors);
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd vibes.diy && pnpm typecheck 2>&1 | grep -E "error|warning" | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/vibe/types/index.ts
git commit -m "feat(vibe-types): add ReqVibeUpdateAvatarCid / ResVibeUpdateAvatarCid message types"
```

---

## Task 2: Add `updateAvatarCid` to `VibeSandboxApi` + expose accessor

**Files:**

- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts`
- Create: `vibes.diy/tests/app/vibe-sandbox-api-update-avatar-cid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/vibe-sandbox-api-update-avatar-cid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { VibeSandboxApi } from "@vibes.diy/vibe-runtime";

describe("VibeSandboxApi.updateAvatarCid", () => {
  it("sends vibe.req.updateAvatarCid and resolves on ok response", async () => {
    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", userSlug: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    // Ack the host so requests can flow.
    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    const promise = api.updateAvatarCid("bafycid123");

    await Promise.resolve();
    await Promise.resolve();

    const req = posts.find((p) => (p as { type: string }).type === "vibe.req.updateAvatarCid") as {
      type: string;
      tid: string;
      userSlug: string;
      appSlug: string;
      cid: string;
    };
    expect(req).toBeDefined();
    expect(req.userSlug).toBe("alice");
    expect(req.appSlug).toBe("myapp");
    expect(req.cid).toBe("bafycid123");

    // Reply ok.
    listeners.forEach((h) => h({ data: { type: "vibe.res.updateAvatarCid", tid: req.tid, status: "ok" } } as MessageEvent));

    const r = await promise;
    expect(r.isOk()).toBe(true);
    expect(r.Ok().status).toBe("ok");
  });

  it("resolves with error status when the host rejects", async () => {
    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", userSlug: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    const promise = api.updateAvatarCid("bafycid456");
    await Promise.resolve();
    await Promise.resolve();

    const req = posts.find((p) => (p as { type: string }).type === "vibe.req.updateAvatarCid") as { tid: string };
    listeners.forEach((h) =>
      h({ data: { type: "vibe.res.updateAvatarCid", tid: req.tid, status: "error", message: "unauthorized" } } as MessageEvent)
    );

    const r = await promise;
    expect(r.isOk()).toBe(true);
    expect(r.Ok().status).toBe("error");
    expect(r.Ok().message).toBe("unauthorized");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true vitest run vibe-sandbox-api-update-avatar-cid 2>&1 | tail -20
```

Expected: FAIL — `api.updateAvatarCid is not a function`.

- [ ] **Step 3: Add imports to `register-dependencies.ts`**

At the top of `vibes.diy/vibe/runtime/register-dependencies.ts`, add to the existing `@vibes.diy/vibe-types` import:

```ts
import {
  // ... existing imports ...
  type ReqVibeUpdateAvatarCid,
  type ResVibeUpdateAvatarCid,
  isResVibeUpdateAvatarCid,
} from "@vibes.diy/vibe-types";
```

- [ ] **Step 4: Add module-level accessor before the `vibeApi` export**

Insert before `export const vibeApi = Lazy(...)`:

```ts
let _registeredApi: VibeSandboxApi | undefined;

/** Returns the VibeSandboxApi instance registered by the current page's
 *  registerDependencies call. Undefined before registerDependencies runs. */
export function getRegisteredVibeApi(): VibeSandboxApi | undefined {
  return _registeredApi;
}
```

- [ ] **Step 5: Set `_registeredApi` inside `registerDependencies`**

In the `registerDependencies` function body, after `const ctxVibeApi = vibeApi(...)`:

```ts
_registeredApi = ctxVibeApi;
```

- [ ] **Step 6: Add `updateAvatarCid` method to `VibeSandboxApi`**

After the `putAsset` method (line ~338):

```ts
/** Persist a freshly-uploaded avatar CID to the viewer's platform profile.
 *  The host validates that the sandbox userSlug matches the authenticated
 *  viewer before writing to user settings. */
updateAvatarCid(cid: string): Promise<Result<ResVibeUpdateAvatarCid>> {
  return this.request<ReqVibeUpdateAvatarCid, ResVibeUpdateAvatarCid>(
    {
      type: "vibe.req.updateAvatarCid",
      ...this.svc.vibeApp,
      cid,
    },
    { wait: isResVibeUpdateAvatarCid, timeout: 10000 }
  );
}
```

- [ ] **Step 7: Run test to confirm it passes**

```bash
cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true vitest run vibe-sandbox-api-update-avatar-cid 2>&1 | tail -20
```

Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add vibes.diy/vibe/runtime/register-dependencies.ts \
        vibes.diy/tests/app/vibe-sandbox-api-update-avatar-cid.test.ts
git commit -m "feat(vibe-runtime): add VibeSandboxApi.updateAvatarCid + getRegisteredVibeApi accessor"
```

---

## Task 3: Add `vibeUpdateAvatarCid` host handler in srv-sandbox

**Files:**

- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`

- [ ] **Step 1: Add imports**

In `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`, add to the `@vibes.diy/vibe-types` import:

```ts
import {
  // ... existing ...
  type ReqVibeUpdateAvatarCid,
  type ResVibeUpdateAvatarCid,
  isReqVibeUpdateAvatarCid,
} from "@vibes.diy/vibe-types";
```

- [ ] **Step 2: Add the handler function**

Insert after the `vibeWhoAmI` function (after line ~830):

```ts
function vibeUpdateAvatarCid(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.updateAvatarCid",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqVibeUpdateAvatarCid(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<MessageEvent, ReqVibeUpdateAvatarCid, unknown>): Promise<Result<EventoResultType>> => {
      const { tid, cid } = ctx.validated;
      const rRes = await vibeDiyApi.ensureUserSettings({
        settings: [{ type: "profile", avatarCid: cid }],
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid,
          type: "vibe.res.updateAvatarCid",
          status: "error",
          message: rRes.Err().message,
        } satisfies ResVibeUpdateAvatarCid);
        return Result.Ok(EventoResult.Stop);
      }
      await ctx.send.send(ctx, {
        tid,
        type: "vibe.res.updateAvatarCid",
        status: "ok",
      } satisfies ResVibeUpdateAvatarCid);
      return Result.Ok(EventoResult.Stop);
    },
  };
}
```

- [ ] **Step 3: Register the handler**

In the handler array (around line 948), add `vibeUpdateAvatarCid(this)` after `vibeWhoAmI(this)`:

```ts
vibePutAsset(this),
vibeWhoAmI(this),
vibeUpdateAvatarCid(this),   // ← add
```

- [ ] **Step 4: Type-check**

```bash
cd vibes.diy && pnpm typecheck 2>&1 | grep -E "error" | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/srv-sandbox/srv-sandbox.ts
git commit -m "feat(srv-sandbox): handle vibe.req.updateAvatarCid → ensureUserSettings"
```

---

## Task 4: Implement `ViewerTagImpl` component

**Files:**

- Create: `vibes.diy/vibe/runtime/use-viewer-tag.tsx`
- Create: `vibes.diy/tests/app/viewer-tag.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `vibes.diy/tests/app/viewer-tag.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VibeContextProvider, type ViewerEnv } from "@vibes.diy/vibe-runtime";
import { useViewer } from "@vibes.diy/use-vibes-base";

// Wrap in provider and render the component via useViewer to get ViewerTag
function renderViewerTag(env: ViewerEnv | undefined, props: Record<string, unknown> = {}) {
  function Inner() {
    const { ViewerTag } = useViewer();
    return <ViewerTag {...(props as Parameters<typeof ViewerTag>[0])} />;
  }
  render(
    <VibeContextProvider mountParams={{ usrEnv: {}, ...(env ? { viewerEnv: env } : {}) }}>
      <Inner />
    </VibeContextProvider>
  );
}

const aliceEnv: ViewerEnv = {
  viewer: { userSlug: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
  access: "owner",
};

describe("ViewerTag", () => {
  it("renders the viewer slug in a pill when no props given", () => {
    renderViewerTag(aliceEnv);
    expect(screen.getByText("alice")).toBeTruthy();
  });

  it("renders another user's slug when userSlug prop is given", () => {
    renderViewerTag(aliceEnv, { userSlug: "bob" });
    expect(screen.getByText("bob")).toBeTruthy();
  });

  it("renders fallback when userSlug prop is present but undefined", () => {
    renderViewerTag(aliceEnv, { userSlug: undefined });
    expect(screen.getByText("no user handle provided")).toBeTruthy();
  });

  it("renders fallback when user prop has no userSlug", () => {
    renderViewerTag(aliceEnv, { user: { userSlug: "" } });
    expect(screen.getByText("no user handle provided")).toBeTruthy();
  });

  it("does not show edit ring for another user", () => {
    renderViewerTag(aliceEnv, { userSlug: "bob" });
    // file input should not be present
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("shows edit affordance (file input) when viewing self", () => {
    renderViewerTag(aliceEnv);
    expect(document.querySelector('input[type="file"]')).toBeTruthy();
  });

  it("does not show edit affordance when viewer is anonymous", () => {
    renderViewerTag(undefined);
    // No viewer → no edit ring even with no userSlug prop
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("does not show edit ring when userSlug matches viewer but viewer is null", () => {
    renderViewerTag(undefined, { userSlug: undefined });
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("uses user.avatarUrl when provided via object prop", () => {
    renderViewerTag(aliceEnv, {
      user: { userSlug: "bob", avatarUrl: "https://custom.test/bob.png" },
    });
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img?.src).toBe("https://custom.test/bob.png");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true vitest run viewer-tag 2>&1 | tail -20
```

Expected: FAIL — `useViewer(...).ViewerTag is not a function` or similar.

- [ ] **Step 3: Create `use-viewer-tag.tsx`**

Create `vibes.diy/vibe/runtime/use-viewer-tag.tsx`:

```tsx
import React, { useRef, useState } from "react";
import type { ViewerEnv } from "./vibe.js";
import { getRegisteredVibeApi } from "./register-dependencies.js";

type ViewerPayload = NonNullable<ViewerEnv["viewer"]>;

export type ViewerTagProps =
  | { userSlug?: never; user?: never }
  | { userSlug: string; user?: never }
  | { user: { userSlug: string; displayName?: string; avatarUrl?: string }; userSlug?: never };

type ViewerTagImplProps = ViewerTagProps & { _viewer: ViewerPayload | null };

export function ViewerTagImpl({ _viewer, ...props }: ViewerTagImplProps): React.ReactElement {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Undefined / empty guard — key present but value falsy
  const slugFromProp = "user" in props && props.user ? props.user.userSlug : "userSlug" in props ? props.userSlug : undefined;

  if (("userSlug" in props || "user" in props) && !slugFromProp) {
    return <span style={{ opacity: 0.4, fontStyle: "italic", fontSize: 13 }}>no user handle provided</span>;
  }

  // Resolve final slug and avatar URL
  const resolvedSlug = slugFromProp ?? _viewer?.userSlug ?? "";
  const resolvedAvatarUrl =
    "user" in props && props.user?.avatarUrl
      ? props.user.avatarUrl
      : resolvedSlug
        ? `/u/${encodeURIComponent(resolvedSlug)}/avatar`
        : undefined;

  // Self: no slug/user prop given, OR resolved slug matches the viewer.
  // Never self if viewer is anonymous — guards the undefined === undefined case.
  const isSelf = _viewer !== null && ((!("userSlug" in props) && !("user" in props)) || resolvedSlug === _viewer?.userSlug);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const api = getRegisteredVibeApi();
    if (!api) return;
    setUploading(true);
    try {
      const rUpload = await api.putAsset(file, file.type);
      if (rUpload.isErr()) return;
      const { cid } = rUpload.Ok();
      await api.updateAvatarCid(cid);
    } finally {
      setUploading(false);
      // Reset so the same file can be selected again
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const initial = resolvedSlug.charAt(0).toUpperCase();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 999,
        padding: "5px 14px 5px 5px",
        fontSize: 14,
        color: "#e0e0e0",
      }}
    >
      <span
        onClick={isSelf ? () => fileRef.current?.click() : undefined}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "white",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
          cursor: isSelf ? "pointer" : "default",
          opacity: uploading ? 0.5 : 1,
          ...(isSelf ? { outline: "2px dashed #818cf8", outlineOffset: 2 } : {}),
        }}
      >
        {resolvedAvatarUrl ? (
          <img
            src={resolvedAvatarUrl}
            alt={resolvedSlug}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
          />
        ) : (
          initial
        )}
        {isSelf && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15,12,40,0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "#a5b4fc",
              borderRadius: "50%",
            }}
          >
            ✎
          </span>
        )}
      </span>
      <span style={{ fontWeight: 500 }}>{resolvedSlug}</span>
      {isSelf && <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />}
    </span>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true vitest run viewer-tag 2>&1 | tail -20
```

Expected: PASS (9 tests). If `useViewer` doesn't return `ViewerTag` yet, some tests will still fail — that's expected; they'll pass after Task 5.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/use-viewer-tag.tsx \
        vibes.diy/tests/app/viewer-tag.test.tsx
git commit -m "feat(vibe-runtime): add ViewerTagImpl component"
```

---

## Task 5: Wire `ViewerTag` into `useViewer`

**Files:**

- Modify: `vibes.diy/vibe/runtime/use-viewer.ts`
- Modify: `vibes.diy/vibe/runtime/index.ts`

- [ ] **Step 1: Update `UseViewerResult` and `useViewer`**

Replace the contents of `vibes.diy/vibe/runtime/use-viewer.ts` with:

```ts
import React from "react";
import { aclAllows, type DbAcl } from "./db-acl-allows.js";
import { useVibeContext } from "./VibeContext.js";
import type { ViewerEnv } from "./vibe.js";
import { ViewerTagImpl, type ViewerTagProps } from "./use-viewer-tag.js";

type ViewerPayload = NonNullable<ViewerEnv["viewer"]>;
type DocAccessLevel = ViewerEnv["access"];

export interface UseViewerResult {
  readonly viewer: ViewerPayload | null;
  readonly access: DocAccessLevel;
  readonly dbAcls: Record<string, DbAcl>;
  readonly can: (action: "read" | "write" | "delete", dbName?: string) => boolean;
  /** True while viewer identity has not yet been resolved (e.g. preview mode
   *  before the parent pushes vibe.evt.viewerChanged). Gate access-gated UI
   *  on !isViewerPending rather than rendering the anonymous fallback. */
  readonly isViewerPending: boolean;
  /** Inline user pill. Renders the current viewer (editable) when called
   *  with no props. Pass `userSlug` to render another user read-only. */
  readonly ViewerTag: React.FC<ViewerTagProps>;
}

export function useViewer(): UseViewerResult {
  const { mountParams } = useVibeContext();
  const env = mountParams.viewerEnv;
  const isViewerPending = env === undefined;
  const viewer = env?.viewer ?? null;
  const access: DocAccessLevel = env?.access ?? "none";
  const dbAcls: Record<string, DbAcl> = env?.dbAcls ?? {};

  function can(action: "read" | "write" | "delete", dbName?: string): boolean {
    if (dbName !== undefined) {
      return aclAllows(dbAcls[dbName], action, access);
    }
    if (!aclAllows(undefined, action, access)) return false;
    for (const acl of Object.values(dbAcls)) {
      if (!aclAllows(acl, action, access)) return false;
    }
    return true;
  }

  const ViewerTag: React.FC<ViewerTagProps> = React.useCallback(
    (props: ViewerTagProps) => React.createElement(ViewerTagImpl, { ...props, _viewer: viewer }),
    [viewer]
  );

  return { viewer, access, dbAcls, can, isViewerPending, ViewerTag };
}
```

- [ ] **Step 2: Export `ViewerTagProps` from the runtime barrel**

In `vibes.diy/vibe/runtime/index.ts`, add:

```ts
export type { ViewerTagProps } from "./use-viewer-tag.js";
```

- [ ] **Step 3: Run all viewer tests**

```bash
cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true vitest run use-viewer viewer-tag vibe-context-viewer 2>&1 | tail -30
```

Expected: all pass.

- [ ] **Step 4: Run full check**

```bash
cd vibes.diy && pnpm fast-check 2>&1 | tee /tmp/viewer-tag-check.log | tail -30
```

Expected: no new failures.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/use-viewer.ts \
        vibes.diy/vibe/runtime/index.ts
git commit -m "feat(vibe-runtime): return ViewerTag from useViewer()"
```

---

## Task 6: Add ViewerTag docs to `use-viewer.md`

**Files:**

- Modify: `prompts/pkg/llms/use-viewer.md`

- [ ] **Step 1: Add `## ViewerTag` section**

Append to the end of `prompts/pkg/llms/use-viewer.md`:

````md
## ViewerTag

`ViewerTag` is a ready-made inline user pill returned alongside `viewer` from `useViewer()`. It is not a separate import — you get it from the hook.

```jsx
const { viewer, ViewerTag } = useViewer();

// Show the current viewer (edit ring appears — they can tap to change their avatar):
<ViewerTag />

// Show another user read-only (no edit affordance):
<ViewerTag userSlug={comment.authorUserSlug} />
```
````

**Self-detection is automatic.** When `ViewerTag` renders the current viewer it shows a dashed indigo ring and pencil overlay on the avatar. Clicking it opens a file picker; the upload and profile save happen internally.

**Undefined safety.** If `userSlug` is present in props but falsy (e.g. a missing field from a loop lookup), `ViewerTag` renders a dim italic placeholder instead of the edit ring. This prevents a broken data source from accidentally granting photo-edit access to an arbitrary pill.

Use `<ViewerTag />` (no props) for the current user and `<ViewerTag userSlug={...} />` for others. That's the whole API.

````

- [ ] **Step 2: Verify the prompts package builds**

```bash
cd prompts && pnpm build 2>&1 | tail -10
````

Expected: exits 0.

- [ ] **Step 3: Run full check from repo root**

```bash
cd vibes.diy && pnpm fast-check 2>&1 | tee /tmp/viewer-tag-final.log | tail -30
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add prompts/pkg/llms/use-viewer.md
git commit -m "docs(prompts): document ViewerTag in use-viewer LLM preamble"
```

---

## Self-Review Checklist

**Spec coverage:**

- [x] `ViewerTag` returned from `useViewer()`, not top-level export
- [x] `userSlug` string prop + undocumented `user` object prop
- [x] Self-detection via `'userSlug' in props` (not `=== undefined`)
- [x] Undefined guard → dim italic fallback
- [x] Visual: pill, dashed ring + ✎ overlay for self
- [x] Click avatar → file input trigger
- [x] Upload: `putAsset` then `updateAvatarCid` postMessage RPCs
- [x] New `ReqVibeUpdateAvatarCid` / `ResVibeUpdateAvatarCid` types + host handler
- [x] `prompts/pkg/llms/use-viewer.md` updated with string-prop-only docs
- [x] `isSelf = false` when `_viewer === null` (anonymous guard)
