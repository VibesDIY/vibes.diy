# Vibe Viewer Identity & Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface viewer identity (userSlug, displayName) and per-app/per-db access info to the running vibe sandbox via the existing iframe postMessage bridge, plus a stable per-userSlug avatar URL convention so generated app code can render avatars and gate UI on capabilities.

**Architecture:** New typed message pair (`vibe.req.whoAmI` / `vibe.res.whoAmI`) modeled on the existing `vibe.req.putAsset` pattern. Viewer info is computed once on the server (`renderVibe`) and embedded as JSON into `mountParams` for instant first-paint; sandbox can also call `vibeDiyApi.whoAmI()` for refresh and subscribes to `vibe.evt.viewerChanged` for login/logout. Avatars resolve via a stable `GET /u/:userSlug/avatar` HTTP route that 302s to a content-addressed CID URL (or Clerk fallback), with ETag revalidation so embedded references update when a user uploads a new avatar.

**Tech Stack:** TypeScript, arktype runtime types, React, Drizzle ORM, Cloudflare Workers, Vitest, `@adviser/cement` Result/Future/Evento.

**Spec:** [docs/superpowers/specs/2026-05-09-vibe-viewer-identity-capabilities-design.md](../specs/2026-05-09-vibe-viewer-identity-capabilities-design.md)

---

## File Map

**New files:**

- `vibes.diy/api/svc/public/who-am-i.ts` — Evento handler that computes viewer identity, app-scoped access, and the per-db ACL map.
- `vibes.diy/api/svc/public/get-user-avatar.ts` — HTTP route handler for `GET /u/:userSlug/avatar`.
- `use-vibes/base/hooks/use-viewer.ts` — `useViewer()` hook with `can()` and `avatarUrlFor()` helpers. Lives in the public consumer package alongside `useVibes`/`useFireproof` so generated app code can `import { useViewer } from "use-vibes"` (same import path as `ImgGen`).
- `vibes.diy/vibe/runtime/db-acl-allows.ts` — Client port of the host's `aclAllows` for sync sandbox-side gating. Pure logic, no React; lives in vibe-runtime since both use-vibes-base and any other consumer can depend on it.
- `vibes.diy/api/svc/public/who-am-i.test.ts`, `vibes.diy/api/svc/public/get-user-avatar.test.ts`, `use-vibes/base/hooks/use-viewer.test.tsx`, `vibes.diy/vibe/runtime/db-acl-allows.test.ts`.

**Modified files:**

- `vibes.diy/api/types/settings.ts` — add `userSettingProfile` union member with `avatarCid?` and `displayName?` fields.
- `vibes.diy/api/types/index.ts` — re-export the new profile type.
- `vibes.diy/vibe/types/index.ts` — add `viewerPayload`, `ReqVibeWhoAmI`, `ResVibeWhoAmI`, `EvtVibeViewerChanged`.
- `vibes.diy/api/types/vibes-diy-api.ts` — add `whoAmI` method to the `VibesDiyApi` interface.
- `vibes.diy/vibe/runtime/vibe.ts` — extend `vibeMountParams` with `viewerEnv?` (initial viewer + access + dbAcls + apiBaseUrl).
- `vibes.diy/vibe/runtime/VibeContext.tsx` — populate context from `mountParams.viewerEnv`, subscribe to `viewerChanged`.
- `vibes.diy/vibe/runtime/register-dependencies.ts` — add `whoAmI()` method on `VibeSandboxApi`.
- `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` — add the host-side bridge handler that responds to `vibe.req.whoAmI` and emits `vibe.evt.viewerChanged`.
- `vibes.diy/api/svc/intern/render-vibe.ts` — compute initial viewer at request time and embed into `mountJS`.
- `use-vibes/base/index.ts` — re-export `useViewer` from `./hooks/use-viewer.js`.
- `use-vibes/pkg/index.ts` — re-export `useViewer` from `@vibes.diy/use-vibes-base` so vibes can `import { useViewer } from "use-vibes"`.
- `vibes.diy/pkg/app/...` settings page (whichever component owns user settings UI) — add Avatar upload + display-name fields.
- HTTP router (wherever public routes register) — wire `GET /u/:userSlug/avatar`.

---

## Phase 1 — Types & Settings Field

### Task 1: Add `userSettingProfile` to user settings types

**Why first:** every later layer references this shape; types must compile before handlers can use them.

**Files:**

- Modify: `vibes.diy/api/types/settings.ts`
- Modify: `vibes.diy/api/types/index.ts`
- Test: `vibes.diy/api/types/settings.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Append to `vibes.diy/api/types/settings.test.ts` (create the file if needed; copy the imports pattern from `vibes.diy/api/types/db-acls.test.ts` if one exists, otherwise:

```ts
import { describe, it, expect } from "vitest";
import { userSettingProfile, isUserSettingProfile, userSettingItem } from "./settings.js";

describe("userSettingProfile", () => {
  it("accepts both fields optional", () => {
    expect(isUserSettingProfile({ type: "profile" })).toBe(true);
  });

  it("accepts avatarCid + displayName", () => {
    expect(isUserSettingProfile({ type: "profile", avatarCid: "bafy123", displayName: "Alice" })).toBe(true);
  });

  it("rejects wrong discriminant", () => {
    expect(isUserSettingProfile({ type: "sharing", grants: [] })).toBe(false);
  });

  it("is a member of userSettingItem union", () => {
    const result = userSettingItem({ type: "profile", avatarCid: "bafy123" });
    expect(result instanceof Error).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/api && pnpm vitest run types/settings.test.ts`
Expected: FAIL — `userSettingProfile` is not exported.

- [ ] **Step 3: Add the type to settings.ts**

In `vibes.diy/api/types/settings.ts`, after the `userSettingDefaultUserSlug` definition (around line 41), add:

```ts
export const userSettingProfile = type({
  type: "'profile'",
  "avatarCid?": "string",
  "displayName?": "string",
});
export type UserSettingProfile = typeof userSettingProfile.infer;
export function isUserSettingProfile(obj: unknown): obj is UserSettingProfile {
  return !(userSettingProfile(obj) instanceof type.errors);
}
```

Then extend the `userSettingItem` union to include it. Replace the existing line:

```ts
export const userSettingItem = userSettingShareing.or(userSettingModelDefaults).or(userSettingDefaultUserSlug);
```

with:

```ts
export const userSettingItem = userSettingShareing
  .or(userSettingModelDefaults)
  .or(userSettingDefaultUserSlug)
  .or(userSettingProfile);
```

- [ ] **Step 4: Re-export from api types index**

In `vibes.diy/api/types/index.ts`, find the existing settings re-exports (search for `userSettingShareing` or `UserSettingItem`) and add to that block:

```ts
export { userSettingProfile, type UserSettingProfile, isUserSettingProfile } from "./settings.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd vibes.diy/api && pnpm vitest run types/settings.test.ts`
Expected: PASS — all four cases.

- [ ] **Step 6: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors.

- [ ] **Step 7: Commit**

```bash
npx prettier --write vibes.diy/api/types/settings.ts vibes.diy/api/types/index.ts vibes.diy/api/types/settings.test.ts
git add vibes.diy/api/types/settings.ts vibes.diy/api/types/index.ts vibes.diy/api/types/settings.test.ts
git commit -m "feat(api-types): add userSettingProfile (avatarCid, displayName)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add `viewerPayload`, `ReqVibeWhoAmI`, `ResVibeWhoAmI`, `EvtVibeViewerChanged` to vibe types

**Files:**

- Modify: `vibes.diy/vibe/types/index.ts`
- Test: `vibes.diy/vibe/types/index.test.ts` (create if absent — follow the existing test pattern from elsewhere in the repo if one exists for these types).

- [ ] **Step 1: Write the failing test**

Append to (or create) `vibes.diy/vibe/types/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isReqVibeWhoAmI, isResVibeWhoAmI, isEvtVibeViewerChanged } from "./index.js";

describe("ReqVibeWhoAmI", () => {
  it("validates a request", () => {
    expect(isReqVibeWhoAmI({ type: "vibe.req.whoAmI", tid: "abc", appSlug: "myapp", userSlug: "alice" })).toBe(true);
  });
  it("rejects wrong type", () => {
    expect(isReqVibeWhoAmI({ type: "vibe.req.other", tid: "abc", appSlug: "x", userSlug: "y" })).toBe(false);
  });
  it("rejects missing appSlug", () => {
    expect(isReqVibeWhoAmI({ type: "vibe.req.whoAmI", tid: "abc", userSlug: "alice" })).toBe(false);
  });
});

describe("ResVibeWhoAmI", () => {
  it("validates anon response (viewer null)", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        tid: "abc",
        viewer: null,
        access: "none",
      })
    ).toBe(true);
  });
  it("validates signed-in response with dbAcls", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        tid: "abc",
        viewer: { userSlug: "alice", displayName: "Alice" },
        access: "owner",
        dbAcls: { comments: { write: ["members"] } },
      })
    ).toBe(true);
  });
  it("rejects bad access value", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        tid: "abc",
        viewer: null,
        access: "superadmin",
      })
    ).toBe(false);
  });
});

describe("EvtVibeViewerChanged", () => {
  it("validates an event (no tid)", () => {
    expect(
      isEvtVibeViewerChanged({
        type: "vibe.evt.viewerChanged",
        viewer: { userSlug: "alice" },
        access: "viewer",
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/vibe/types && pnpm vitest run index.test.ts`
Expected: FAIL — guards not exported.

- [ ] **Step 3: Add types to index.ts**

In `vibes.diy/vibe/types/index.ts`, after the `EvtVibePutAssetProgress` definition, add:

```ts
// ── Viewer identity & capabilities ───────────────────────────────────
// Sandbox-facing surface for who is viewing this vibe and what they can
// do. Sandbox sees only userSlug — never Clerk userId. Capabilities are
// UX hints; every write still re-authorizes server-side at put-doc.

import { dbAcl } from "@vibes.diy/api-types";

export const viewerPayload = type({
  userSlug: "string",
  "displayName?": "string",
});
export type ViewerPayload = typeof viewerPayload.infer;

export const docAccessLevel = type("'owner' | 'editor' | 'viewer' | 'submitter' | 'none'");
export type DocAccessLevel = typeof docAccessLevel.infer;

// Request: sandbox → host. Carries (appSlug, userSlug) so the host
// handler can compute access against the right app — same pattern as
// every other Req<*> in this file.
export const ReqVibeWhoAmI = type({
  type: "'vibe.req.whoAmI'",
  appSlug: "string",
  userSlug: "string",
}).and(Base);

export type ReqVibeWhoAmI = typeof ReqVibeWhoAmI.infer;

export function isReqVibeWhoAmI(x: unknown): x is ReqVibeWhoAmI {
  return !(ReqVibeWhoAmI(x) instanceof type.errors);
}

// Response: host → sandbox.
//
// `viewer: null` means anonymous (not signed in). The arktype `null`
// literal matches encoded JSON `null`.
//
// `access` is the app-scoped role. `dbAcls` carries any per-db overrides
// configured for this app — missing entries fall back to the role gate
// in the sandbox's `can()` helper.
export const ResVibeWhoAmI = type({
  type: "'vibe.res.whoAmI'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "dbAcls?": type({ "[string]": dbAcl }),
}).and(Base);

export type ResVibeWhoAmI = typeof ResVibeWhoAmI.infer;

export function isResVibeWhoAmI(x: unknown): x is ResVibeWhoAmI {
  return !(ResVibeWhoAmI(x) instanceof type.errors);
}

// Event: identity changed (login/logout, future persona switch). Same
// shape as the response minus tid semantics — no request to correlate.
export const EvtVibeViewerChanged = type({
  type: "'vibe.evt.viewerChanged'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "dbAcls?": type({ "[string]": dbAcl }),
});

export type EvtVibeViewerChanged = typeof EvtVibeViewerChanged.infer;

export function isEvtVibeViewerChanged(x: unknown): x is EvtVibeViewerChanged {
  return !(EvtVibeViewerChanged(x) instanceof type.errors);
}
```

(`Base` is already imported at the top of the file; verify by reading the existing put-asset section.)

- [ ] **Step 4: Run tests to verify pass**

Run: `cd vibes.diy/vibe/types && pnpm vitest run index.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-export from api-types if needed**

Confirm `dbAcl` is exported from `@vibes.diy/api-types`. If the import in step 3 fails, search:

```bash
grep -n "export.*dbAcl" vibes.diy/api/types/index.ts
```

If missing, add `export { dbAcl, type DbAcl, isDbAcl } from "./db-acls.js";` to `vibes.diy/api/types/index.ts`.

- [ ] **Step 6: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors.

- [ ] **Step 7: Commit**

```bash
npx prettier --write vibes.diy/vibe/types/index.ts vibes.diy/vibe/types/index.test.ts vibes.diy/api/types/index.ts
git add vibes.diy/vibe/types/index.ts vibes.diy/vibe/types/index.test.ts vibes.diy/api/types/index.ts
git commit -m "feat(vibe-types): add viewer payload, whoAmI req/res, viewerChanged evt

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Server: whoAmI handler

### Task 3: Implement the `whoAmI` Evento handler

The handler reads the viewer's Clerk session, resolves their default userSlug + display name from user-settings, computes app-scoped access via `checkDocAccess`, loads the per-db ACL map from app settings, and returns `ResVibeWhoAmI`.

**Files:**

- Create: `vibes.diy/api/svc/public/who-am-i.ts`
- Test: `vibes.diy/api/svc/public/who-am-i.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/api/svc/public/who-am-i.test.ts`. Adapt fixtures from the existing test pattern in `vibes.diy/api/svc/public/list-members.test.ts` (read it first to learn the SQL fixture and Evento ctx setup). The skeleton:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resolveWhoAmI } from "./who-am-i.js";
// ... import the same test ctx helper that list-members.test.ts uses (e.g. createVibeDiyTestCtx)

describe("resolveWhoAmI", () => {
  let vctx: /* same type as list-members.test.ts uses */;

  beforeEach(async () => {
    // copy the same beforeEach that list-members.test.ts uses to seed
    // a userSlugBinding row + an app row and any inviteGrants.
  });

  it("returns null viewer for unauthenticated request", async () => {
    const res = await resolveWhoAmI(vctx, {
      auth: undefined,
      appSlug: "myapp",
      ownerUserSlug: "alice",
    });
    expect(res.isOk()).toBe(true);
    const r = res.Ok();
    expect(r.viewer).toBeNull();
    expect(r.access).toBe("none");
  });

  it("returns owner identity + access for the owner", async () => {
    const res = await resolveWhoAmI(vctx, {
      auth: { verifiedAuth: { claims: { userId: "user_alice" } } } as any,
      appSlug: "myapp",
      ownerUserSlug: "alice",
    });
    expect(res.isOk()).toBe(true);
    const r = res.Ok();
    expect(r.viewer?.userSlug).toBe("alice");
    expect(r.access).toBe("owner");
  });

  it("returns viewer userSlug + 'editor' access for an invited editor", async () => {
    // beforeEach added an editor inviteGrant for user_bob → alice/myapp
    const res = await resolveWhoAmI(vctx, {
      auth: { verifiedAuth: { claims: { userId: "user_bob" } } } as any,
      appSlug: "myapp",
      ownerUserSlug: "alice",
    });
    expect(res.isOk()).toBe(true);
    const r = res.Ok();
    expect(r.viewer?.userSlug).toBe("bob");
    expect(r.access).toBe("editor");
  });

  it("returns dbAcls map when the app has configured overrides", async () => {
    // beforeEach upserted dbAcls.comments = { write: ["members"] }
    const res = await resolveWhoAmI(vctx, {
      auth: { verifiedAuth: { claims: { userId: "user_alice" } } } as any,
      appSlug: "myapp",
      ownerUserSlug: "alice",
    });
    expect(res.Ok().dbAcls?.comments?.write).toEqual(["members"]);
  });

  it("uses settings.displayName override when set", async () => {
    // beforeEach added a userSettings row for user_alice with profile.displayName = "Alice the Great"
    const res = await resolveWhoAmI(vctx, {
      auth: { verifiedAuth: { claims: { userId: "user_alice" } } } as any,
      appSlug: "myapp",
      ownerUserSlug: "alice",
    });
    expect(res.Ok().viewer?.displayName).toBe("Alice the Great");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/api && pnpm vitest run svc/public/who-am-i.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `resolveWhoAmI` plus the Evento wrapper**

Create `vibes.diy/api/svc/public/who-am-i.ts`:

```ts
import { Result, Option, EventoHandler, EventoResultType, EventoResult, HandleTriggerCtx } from "@adviser/cement";
import { eq, and } from "drizzle-orm";
import { type } from "arktype";
import {
  MsgBase,
  W3CWebSocketEvent,
  ReqWithOptionalAuth,
  VibesDiyError,
  ClerkClaim,
  isUserSettingProfile,
  isUserSettingDefaultUserSlug,
} from "@vibes.diy/api-types";
import { ReqVibeWhoAmI, ResVibeWhoAmI, ViewerPayload, DocAccessLevel, isReqVibeWhoAmI } from "@vibes.diy/vibe-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";
import { checkDocAccess } from "./access-helpers.js";
import { ensureAppSettings } from "./ensure-app-settings.js";

// Same precedence as list-members.ts:deriveAuthorDisplay.
function deriveDisplayName(claims: ClerkClaim): string {
  const p = claims.params;
  if (p.nick !== undefined && p.nick.trim() !== "") return p.nick.trim();
  if (p.name !== null && p.name.trim() !== "") return p.name.trim();
  const composed = `${p.first} ${p.last}`.trim();
  if (composed !== "") return composed;
  return p.email;
}

export interface ResolveWhoAmIArgs {
  auth: { verifiedAuth: { claims: ClerkClaim } } | undefined;
  appSlug: string;
  ownerUserSlug: string;
}

export interface ResolvedWhoAmI {
  viewer: ViewerPayload | null;
  access: DocAccessLevel;
  dbAcls: Record<string, import("@vibes.diy/api-types").DbAcl> | undefined;
}

export async function resolveWhoAmI(vctx: VibesApiSQLCtx, args: ResolveWhoAmIArgs): Promise<Result<ResolvedWhoAmI>> {
  const { auth, appSlug, ownerUserSlug } = args;

  // App-scoped access — works for both anon and signed-in. checkDocAccess
  // returns "none" when called with an unrecognized userId, so anon falls
  // through cleanly.
  const viewerUserId = auth?.verifiedAuth.claims.userId;
  const access: DocAccessLevel = viewerUserId ? await checkDocAccess(vctx, viewerUserId, appSlug, ownerUserSlug) : "none";

  // Per-db ACL map for this app — load via the same path as resolveDbAcl
  // but return the whole map.
  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    userSlug: ownerUserSlug,
    env: [],
  });
  if (rSettings.isErr()) return Result.Err(rSettings);
  const dbAcls = rSettings.Ok().settings.entry.dbAcls;

  if (!auth) {
    return Result.Ok({ viewer: null, access, dbAcls });
  }

  // Identity: viewer's default userSlug + optional displayName from user-settings.
  // Fallback display: derive from Clerk claims same as list-members.
  const userSettingsRow = await vctx.sql.db
    .select({ settings: vctx.sql.tables.userSettings.settings })
    .from(vctx.sql.tables.userSettings)
    .where(eq(vctx.sql.tables.userSettings.userId, viewerUserId!))
    .limit(1)
    .then((r) => r[0]);

  let viewerSlug: string | undefined;
  let displayOverride: string | undefined;
  const items = (userSettingsRow?.settings as unknown[]) ?? [];
  for (const item of items) {
    if (isUserSettingDefaultUserSlug(item) && !viewerSlug) viewerSlug = item.userSlug;
    if (isUserSettingProfile(item)) {
      if (item.displayName) displayOverride = item.displayName;
    }
  }

  // If no defaultUserSlug is configured, fall back to the binding most recently
  // associated with this userId.
  if (!viewerSlug) {
    const binding = await vctx.sql.db
      .select({ userSlug: vctx.sql.tables.userSlugBinding.userSlug })
      .from(vctx.sql.tables.userSlugBinding)
      .where(eq(vctx.sql.tables.userSlugBinding.userId, viewerUserId!))
      .limit(1)
      .then((r) => r[0]);
    viewerSlug = binding?.userSlug;
  }

  if (!viewerSlug) {
    // Authenticated but no slug bound — extremely rare. Treat as anon for the
    // identity surface; access has already been computed.
    return Result.Ok({ viewer: null, access, dbAcls });
  }

  const displayName = displayOverride ?? deriveDisplayName(auth.verifiedAuth.claims);

  return Result.Ok({
    viewer: { userSlug: viewerSlug, displayName },
    access,
    dbAcls,
  });
}

// Evento handler — used by the iframe bridge in srv-sandbox.
export const whoAmIEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqVibeWhoAmI>, ResVibeWhoAmI | VibesDiyError> = {
  hash: "vibe.whoAmI",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (!isReqVibeWhoAmI(msg.payload)) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload }));
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqVibeWhoAmI>>, ResVibeWhoAmI | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const { appSlug, userSlug: ownerUserSlug } = req;
      const rRes = await resolveWhoAmI(vctx, {
        auth: req._auth,
        appSlug,
        ownerUserSlug,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: rRes.Err().message },
        } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }
      const r = rRes.Ok();
      await ctx.send.send(ctx, {
        type: "vibe.res.whoAmI",
        viewer: r.viewer,
        access: r.access,
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
      } satisfies ResVibeWhoAmI);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
```

**Note on `appSlug`/`ownerUserSlug`:** Task 2 already places these on `ReqVibeWhoAmI` so this handler reads them off the validated payload directly (no `(req as unknown as ...).` casts). If a test fixture in Task 2 was missing them, fix and re-run Task 2's tests before continuing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd vibes.diy/api && pnpm vitest run svc/public/who-am-i.test.ts`
Expected: PASS — all five cases.

- [ ] **Step 5: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors.

- [ ] **Step 6: Commit**

```bash
npx prettier --write vibes.diy/api/svc/public/who-am-i.ts vibes.diy/api/svc/public/who-am-i.test.ts
git add vibes.diy/api/svc/public/who-am-i.ts vibes.diy/api/svc/public/who-am-i.test.ts vibes.diy/vibe/types/index.ts vibes.diy/vibe/types/index.test.ts
git commit -m "feat(api): whoAmI handler — viewer + access + dbAcls

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Register `whoAmI` in `VibesDiyApi` interface

**Files:**

- Modify: `vibes.diy/api/types/vibes-diy-api.ts`
- Modify: wherever the api dispatcher lives (search for `listMembers(req:` and follow the wiring).

- [ ] **Step 1: Add to interface**

In `vibes.diy/api/types/vibes-diy-api.ts`, find the `listMembers` line (currently around line 163) and add immediately after:

```ts
whoAmI(req: Req<ReqVibeWhoAmI>): Promise<Result<ResVibeWhoAmI, VibesDiyError>>;
```

Add the imports at the top of the file:

```ts
import { ReqVibeWhoAmI, ResVibeWhoAmI } from "@vibes.diy/vibe-types";
```

- [ ] **Step 2: Wire the handler into the dispatcher**

Find where `listMembersEvento` is registered (search `grep -rn "listMembersEvento" vibes.diy/api/`). Register `whoAmIEvento` next to it the same way.

- [ ] **Step 3: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors. If the api dispatcher exposes a typed `vibeDiyApi.whoAmI` method (mirroring `listMembers`), the wiring is complete.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/types/vibes-diy-api.ts <wire-up-file>
git commit -m "feat(api): register whoAmI in VibesDiyApi dispatcher

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Avatar HTTP Route

### Task 5: Implement `GET /u/:userSlug/avatar`

Stable per-userSlug avatar URL that 302s to the current avatarCid (or 404 if none). Spec §1a.

**Files:**

- Create: `vibes.diy/api/svc/public/get-user-avatar.ts`
- Modify: HTTP router (search for an existing route registration like `assets/cid` to find the file).
- Test: `vibes.diy/api/svc/public/get-user-avatar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/api/svc/public/get-user-avatar.test.ts`. Pattern after any existing http-route test — look for one in `vibes.diy/api/svc/public/` that handles HTTP `Request` and asserts on `HttpResponseBodyType`.

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { handleGetUserAvatar } from "./get-user-avatar.js";

describe("GET /u/:userSlug/avatar", () => {
  let vctx: /* same test ctx as other tests */;

  beforeEach(async () => {
    // Seed: userSlugBinding alice→user_alice; userSettings for user_alice
    // with profile.avatarCid = "bafy123".
  });

  it("302s to cid-asset URL when avatarCid is set", async () => {
    const res = await handleGetUserAvatar(vctx, "alice", undefined);
    expect(res.status).toBe(302);
    expect(res.headers.Location).toContain("bafy123");
    expect(res.headers.ETag).toBe('"bafy123"');
    expect(res.headers["Cache-Control"]).toBe("max-age=0, must-revalidate");
  });

  it("returns 304 when If-None-Match matches the current ETag", async () => {
    const res = await handleGetUserAvatar(vctx, "alice", '"bafy123"');
    expect(res.status).toBe(304);
  });

  it("404s when userSlug is unknown", async () => {
    const res = await handleGetUserAvatar(vctx, "ghost", undefined);
    expect(res.status).toBe(404);
  });

  it("404s when userSlug is bound but has no avatarCid", async () => {
    // beforeEach created a "noavatar" slug with no profile entry.
    const res = await handleGetUserAvatar(vctx, "noavatar", undefined);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/api && pnpm vitest run svc/public/get-user-avatar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the handler**

Create `vibes.diy/api/svc/public/get-user-avatar.ts`:

```ts
import { eq } from "drizzle-orm";
import { isUserSettingProfile } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

export interface AvatarHttpResult {
  status: 200 | 302 | 304 | 404;
  headers: Record<string, string>;
  body?: string;
}

// Resolve the userSlug → avatarCid; return a 302/304/404 shape suitable
// for the public route layer. Spec §1a — content-addressed URL behind a
// stable per-userSlug indirection so embedded references update when the
// user uploads a new avatar.
export async function handleGetUserAvatar(
  vctx: VibesApiSQLCtx,
  userSlug: string,
  ifNoneMatch: string | undefined
): Promise<AvatarHttpResult> {
  const binding = await vctx.sql.db
    .select({ userId: vctx.sql.tables.userSlugBinding.userId })
    .from(vctx.sql.tables.userSlugBinding)
    .where(eq(vctx.sql.tables.userSlugBinding.userSlug, userSlug))
    .limit(1)
    .then((r) => r[0]);
  if (!binding) return { status: 404, headers: {} };

  const settingsRow = await vctx.sql.db
    .select({ settings: vctx.sql.tables.userSettings.settings })
    .from(vctx.sql.tables.userSettings)
    .where(eq(vctx.sql.tables.userSettings.userId, binding.userId))
    .limit(1)
    .then((r) => r[0]);

  let avatarCid: string | undefined;
  for (const item of (settingsRow?.settings as unknown[]) ?? []) {
    if (isUserSettingProfile(item) && item.avatarCid) {
      avatarCid = item.avatarCid;
      break;
    }
  }
  if (!avatarCid) return { status: 404, headers: {} };

  const etag = `"${avatarCid}"`;
  if (ifNoneMatch === etag) {
    return {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "max-age=0, must-revalidate",
      },
    };
  }

  // 302 to the existing cid-asset endpoint. The redirected URL is
  // content-addressed and safe to cache long-term; only this redirect
  // is the no-cache layer.
  const target = `/assets/cid/?cid=${encodeURIComponent(avatarCid)}`;
  return {
    status: 302,
    headers: {
      Location: target,
      ETag: etag,
      "Cache-Control": "max-age=0, must-revalidate",
    },
  };
}
```

- [ ] **Step 4: Verify the cid-asset URL shape**

Read `vibes.diy/api/svc/public/cid-asset.ts` (or whatever serves `/assets/cid/`). Confirm whether the canonical query parameter is `cid=` or `url=`. If it's `url=` taking the original asset URL, change the `target` line above to match the existing endpoint contract.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd vibes.diy/api && pnpm vitest run svc/public/get-user-avatar.test.ts`
Expected: PASS — all four cases.

- [ ] **Step 6: Wire the route in the public router**

Search for the route registration that mounts `/assets/cid/`:

```bash
grep -rn "/assets/cid\|assets/cid/\|cidAsset" vibes.diy/api/ | grep -v node_modules | grep -v ".test."
```

Find the file that registers the route. Add a sibling registration for `GET /u/:userSlug/avatar` that:

1. Extracts `userSlug` from the path.
2. Reads `If-None-Match` from request headers.
3. Calls `handleGetUserAvatar(vctx, userSlug, ifNoneMatch)`.
4. Builds an `HttpResponseBodyType` from the returned `{status, headers}` and sends it.

(Exact file shape varies; this step is a 30–60 line port of the cid-asset registration. Read that route's source first to learn the framework's request/response idiom.)

- [ ] **Step 7: Run integration test for the route**

Add a smoke test next to existing route smoke tests verifying that a request to `/u/alice/avatar` returns 302. Find the pattern by reading the cid-asset smoke test if one exists.

- [ ] **Step 8: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors.

- [ ] **Step 9: Commit**

```bash
npx prettier --write vibes.diy/api/svc/public/get-user-avatar.ts vibes.diy/api/svc/public/get-user-avatar.test.ts
git add vibes.diy/api/svc/public/get-user-avatar.ts vibes.diy/api/svc/public/get-user-avatar.test.ts <route-registration-file>
git commit -m "feat(api): GET /u/:userSlug/avatar — stable indirection to avatarCid

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Iframe Bridge

### Task 6: Add `whoAmI()` to `VibeSandboxApi`

**Files:**

- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts`

- [ ] **Step 1: Write the failing test**

If a `register-dependencies.test.ts` exists, append a test there. Otherwise create `vibes.diy/vibe/runtime/register-dependencies.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { VibeSandboxApi } from "./register-dependencies.js";

describe("VibeSandboxApi.whoAmI", () => {
  it("posts vibe.req.whoAmI and resolves on a matching response", async () => {
    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", userSlug: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as any,
      postMessage: ((msg: unknown) => posts.push(msg)) as any,
    });
    // Pretend the host has acked.
    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));
    const pending = api.whoAmI();
    // Simulate the host responding.
    const sentTid = (posts[0] as { tid: string }).tid;
    listeners.forEach((h) =>
      h({
        data: {
          type: "vibe.res.whoAmI",
          tid: sentTid,
          viewer: { userSlug: "alice", displayName: "Alice" },
          access: "owner",
        },
      } as MessageEvent)
    );
    const res = await pending;
    expect(res.isOk()).toBe(true);
    expect(res.Ok().viewer?.userSlug).toBe("alice");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/vibe/runtime && pnpm vitest run register-dependencies.test.ts`
Expected: FAIL — `whoAmI` doesn't exist on `VibeSandboxApi`.

- [ ] **Step 3: Add the method**

In `vibes.diy/vibe/runtime/register-dependencies.ts`, in the imports block at the top, add:

```ts
import { ReqVibeWhoAmI, ResVibeWhoAmI, isResVibeWhoAmI } from "@vibes.diy/vibe-types";
```

Inside the `VibeSandboxApi` class (after `listDbNames` is a good spot), add:

```ts
whoAmI(): Promise<Result<ResVibeWhoAmI>> {
  return this.request<ReqVibeWhoAmI, ResVibeWhoAmI>(
    {
      type: "vibe.req.whoAmI",
      appSlug: this.svc.vibeApp.appSlug,
      userSlug: this.svc.vibeApp.userSlug,
    },
    { wait: isResVibeWhoAmI, timeout: 10000 }
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd vibes.diy/vibe/runtime && pnpm vitest run register-dependencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors.

- [ ] **Step 6: Commit**

```bash
npx prettier --write vibes.diy/vibe/runtime/register-dependencies.ts vibes.diy/vibe/runtime/register-dependencies.test.ts
git add vibes.diy/vibe/runtime/register-dependencies.ts vibes.diy/vibe/runtime/register-dependencies.test.ts
git commit -m "feat(vibe-runtime): VibeSandboxApi.whoAmI() — sandbox-side request

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Add the host-side bridge handler `vibe.whoAmI` to srv-sandbox

**Files:**

- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`
- Test: `vibes.diy/vibe/srv-sandbox/srv-sandbox.test.ts` (extend if it exists)

- [ ] **Step 1: Write the failing test**

Pattern after the existing put-asset test (`vibes.diy/api/tests/srv-sandbox-put-asset.test.ts`). Add a sibling test file:

```ts
// vibes.diy/api/tests/srv-sandbox-who-am-i.test.ts
import { describe, it, expect } from "vitest";
import { vibesDiySrvSandbox } from "../../vibe/srv-sandbox/srv-sandbox.js";
// ... follow the put-asset test's harness setup verbatim.

describe("srv-sandbox vibe.req.whoAmI", () => {
  it("calls vibeDiyApi.whoAmI and posts the response", async () => {
    // 1. Spin up vibesDiySrvSandbox with a mocked vibeDiyApi whose .whoAmI
    //    returns Result.Ok({ type: "vibe.res.whoAmI", viewer: ..., access: ... }).
    // 2. Dispatch a fake MessageEvent { data: { type: "vibe.req.whoAmI", tid: "t1", appSlug, userSlug } }.
    // 3. Assert: postMessage was called with { tid: "t1", type: "vibe.res.whoAmI", ... }.
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/api && pnpm vitest run tests/srv-sandbox-who-am-i.test.ts`
Expected: FAIL — handler not registered.

- [ ] **Step 3: Implement the handler in srv-sandbox.ts**

Find the `vibePutAsset` factory in `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` (around line 695). Below it, add a sibling factory:

```ts
function vibeWhoAmI(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.whoAmI",
    validate: (ctx) => {
      const { request: req } = ctx;
      const data = (req as MessageEvent | undefined)?.data as { type?: string } | undefined;
      if (data?.type === "vibe.req.whoAmI") {
        return Promise.resolve(Result.Ok(Option.Some(data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx) => {
      const { tid, appSlug, userSlug } = ctx.validated as ReqVibeWhoAmI;
      const rRes = await vibeDiyApi.whoAmI({
        // Wrap in whatever Req<> shape the dispatcher expects — copy from
        // the existing listMembers call site within srv-sandbox if there
        // is one; otherwise the simplest form is the validated payload.
        type: "vibe.req.whoAmI",
        appSlug,
        userSlug,
      } as ReqVibeWhoAmI);

      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid,
          type: "vibe.res.whoAmI",
          viewer: null,
          access: "none",
        } satisfies ResVibeWhoAmI);
        return Result.Ok(EventoResult.Stop);
      }
      const r = rRes.Ok();
      await ctx.send.send(ctx, {
        tid,
        type: "vibe.res.whoAmI",
        viewer: r.viewer,
        access: r.access,
        ...(r.dbAcls ? { dbAcls: r.dbAcls } : {}),
      } satisfies ResVibeWhoAmI);
      return Result.Ok(EventoResult.Stop);
    },
  };
}
```

Add the necessary imports at the top of the file:

```ts
import { ReqVibeWhoAmI, ResVibeWhoAmI } from "@vibes.diy/vibe-types";
```

Find where `vibePutAsset(sandbox)` is registered with the Evento (search `vibePutAsset(this`). Register `vibeWhoAmI(this)` next to it.

- [ ] **Step 4: Run test to verify pass**

Run: `cd vibes.diy/api && pnpm vitest run tests/srv-sandbox-who-am-i.test.ts`
Expected: PASS.

- [ ] **Step 5: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors.

- [ ] **Step 6: Commit**

```bash
npx prettier --write vibes.diy/vibe/srv-sandbox/srv-sandbox.ts vibes.diy/api/tests/srv-sandbox-who-am-i.test.ts
git add vibes.diy/vibe/srv-sandbox/srv-sandbox.ts vibes.diy/api/tests/srv-sandbox-who-am-i.test.ts
git commit -m "feat(srv-sandbox): handle vibe.req.whoAmI on the host bridge

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Sandbox Runtime: db-acl-allows + useViewer

### Task 8: Implement `aclAllows` client port

Pure function port of `vibes.diy/api/svc/public/db-acl-resolver.ts:aclAllows` — same name, same vocabulary, same semantics. Lives in the runtime so `can()` can be sync.

**Files:**

- Create: `vibes.diy/vibe/runtime/db-acl-allows.ts`
- Test: `vibes.diy/vibe/runtime/db-acl-allows.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/vibe/runtime/db-acl-allows.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { aclAllows } from "./db-acl-allows.js";

describe("aclAllows (client port)", () => {
  it("falls back to canRead when ACL has no read entry", () => {
    expect(aclAllows(undefined, "read", "owner")).toBe(true);
    expect(aclAllows(undefined, "read", "viewer")).toBe(true);
    expect(aclAllows(undefined, "read", "submitter")).toBe(false);
    expect(aclAllows(undefined, "read", "none")).toBe(false);
  });

  it("falls back to canWrite when ACL has no write entry", () => {
    expect(aclAllows(undefined, "write", "owner")).toBe(true);
    expect(aclAllows(undefined, "write", "submitter")).toBe(true);
    expect(aclAllows(undefined, "write", "viewer")).toBe(false);
    expect(aclAllows(undefined, "write", "none")).toBe(false);
  });

  it("members group includes editor/viewer/submitter (and owner implicitly)", () => {
    expect(aclAllows({ write: ["members"] }, "write", "viewer")).toBe(true);
    expect(aclAllows({ write: ["members"] }, "write", "owner")).toBe(true);
    expect(aclAllows({ write: ["members"] }, "write", "none")).toBe(false);
  });

  it("editors group is editor + owner", () => {
    expect(aclAllows({ write: ["editors"] }, "write", "editor")).toBe(true);
    expect(aclAllows({ write: ["editors"] }, "write", "viewer")).toBe(false);
    expect(aclAllows({ write: ["editors"] }, "write", "owner")).toBe(true);
  });

  it("submitters group is submitter + owner", () => {
    expect(aclAllows({ write: ["submitters"] }, "write", "submitter")).toBe(true);
    expect(aclAllows({ write: ["submitters"] }, "write", "viewer")).toBe(false);
  });

  it("readers group is editor + viewer + owner", () => {
    expect(aclAllows({ read: ["readers"] }, "read", "viewer")).toBe(true);
    expect(aclAllows({ read: ["readers"] }, "read", "submitter")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/vibe/runtime && pnpm vitest run db-acl-allows.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `vibes.diy/vibe/runtime/db-acl-allows.ts`:

```ts
import type { DbAcl, DbAclSubject } from "@vibes.diy/api-types";
import type { DocAccessLevel } from "@vibes.diy/vibe-types";

export const canRead = (level: DocAccessLevel): boolean => level === "owner" || level === "editor" || level === "viewer";

export const canWrite = (level: DocAccessLevel): boolean => level === "owner" || level === "editor" || level === "submitter";

export function inGroup(level: DocAccessLevel, group: DbAclSubject): boolean {
  if (level === "owner") return true;
  switch (group) {
    case "members":
      return level === "editor" || level === "viewer" || level === "submitter";
    case "editors":
      return level === "editor";
    case "submitters":
      return level === "submitter";
    case "readers":
      return level === "editor" || level === "viewer";
  }
}

export function aclAllows(acl: DbAcl | undefined, cap: "read" | "write" | "delete", access: DocAccessLevel): boolean {
  const subjects = acl?.[cap];
  if (subjects === undefined) {
    return cap === "read" ? canRead(access) : canWrite(access);
  }
  return subjects.some((g) => inGroup(access, g));
}
```

- [ ] **Step 4: Re-export from the runtime barrel**

In `vibes.diy/vibe/runtime/index.ts`, add a line:

```ts
export * from "./db-acl-allows.js";
```

This makes `aclAllows`, `canRead`, `canWrite`, `inGroup` importable from `@vibes.diy/vibe-runtime` for downstream consumers (Task 11's `useViewer` reads it from there).

- [ ] **Step 5: Run test to verify pass**

Run: `cd vibes.diy/vibe/runtime && pnpm vitest run db-acl-allows.test.ts`
Expected: PASS — all six cases.

- [ ] **Step 6: Add a parity test against the host port**

Create `vibes.diy/api/tests/db-acl-allows-parity.test.ts` (same level as other api tests). For a fixed table of (acl, cap, access) inputs, assert both functions return the same value. Pattern:

```ts
import { describe, it, expect } from "vitest";
import { aclAllows as hostAcl } from "../../api/svc/public/db-acl-resolver.js";
import { aclAllows as clientAcl } from "../../vibe/runtime/db-acl-allows.js";

describe("aclAllows host/client parity", () => {
  const acls = [
    undefined,
    { read: ["readers"] as const },
    { write: ["editors"] as const },
    { write: ["submitters"] as const },
    { delete: ["editors"] as const },
    { read: ["members"] as const, write: ["editors"] as const },
  ];
  const accesses = ["owner", "editor", "viewer", "submitter", "none"] as const;
  const caps = ["read", "write", "delete"] as const;

  it.each(acls.flatMap((acl) => accesses.flatMap((acc) => caps.map((cap) => ({ acl, acc, cap }) as const))))(
    "$cap on $acc with $acl matches",
    ({ acl, acc, cap }) => {
      expect(clientAcl(acl, cap, acc)).toBe(hostAcl(acl, cap, acc));
    }
  );
});
```

Run: `cd vibes.diy && pnpm vitest run api/tests/db-acl-allows-parity.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npx prettier --write vibes.diy/vibe/runtime/db-acl-allows.ts vibes.diy/vibe/runtime/db-acl-allows.test.ts vibes.diy/vibe/runtime/index.ts vibes.diy/api/tests/db-acl-allows-parity.test.ts
git add vibes.diy/vibe/runtime/db-acl-allows.ts vibes.diy/vibe/runtime/db-acl-allows.test.ts vibes.diy/vibe/runtime/index.ts vibes.diy/api/tests/db-acl-allows-parity.test.ts
git commit -m "feat(vibe-runtime): aclAllows client port + host parity test

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Extend `vibeMountParams` with `viewerEnv` and `apiBaseUrl`

**Files:**

- Modify: `vibes.diy/vibe/runtime/vibe.ts`

- [ ] **Step 1: Write the failing test**

Append to `vibes.diy/vibe/runtime/vibe.test.ts` (create if absent):

```ts
import { describe, it, expect } from "vitest";
import { vibeMountParams } from "./vibe.js";

describe("vibeMountParams", () => {
  it("accepts minimal params (legacy)", () => {
    expect(vibeMountParams({ usrEnv: {} }) instanceof Error).toBe(false);
  });

  it("accepts viewerEnv with anon viewer", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: null,
        access: "none",
        apiBaseUrl: "https://api.vibes.diy",
      },
    });
    expect(r instanceof Error).toBe(false);
  });

  it("accepts viewerEnv with viewer + dbAcls", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: { userSlug: "alice", displayName: "Alice" },
        access: "owner",
        dbAcls: { comments: { write: ["members"] } },
        apiBaseUrl: "https://api.vibes.diy",
      },
    });
    expect(r instanceof Error).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/vibe/runtime && pnpm vitest run vibe.test.ts`
Expected: FAIL — `viewerEnv` not on schema.

- [ ] **Step 3: Extend the schema**

Replace the contents of `vibes.diy/vibe/runtime/vibe.ts` with:

```ts
import { type } from "arktype";
import { dbAcl } from "@vibes.diy/api-types";
import { viewerPayload, docAccessLevel } from "@vibes.diy/vibe-types";

// the vibe'd react website
export const vibeEnv = type({});

// Server-computed viewer info, embedded into the iframe's HTML by render-vibe
// so the very first React render already has identity.
export const viewerEnv = type({
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "dbAcls?": type({ "[string]": dbAcl }),
  // Absolute origin used by avatarUrlFor() to construct
  // `${apiBaseUrl}/u/${slug}/avatar`. Server fills this in at render time.
  apiBaseUrl: "string",
});
export type ViewerEnv = typeof viewerEnv.infer;

export const vibeMountParams = type({
  usrEnv: vibeEnv,
  "viewerEnv?": viewerEnv,
});

export type VibeMountParams = typeof vibeMountParams.infer;
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd vibes.diy/vibe/runtime && pnpm vitest run vibe.test.ts`
Expected: PASS.

- [ ] **Step 5: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors. If `vibeMountParams` consumers anywhere have strict-shape destructuring that breaks because of the new optional field, fix at the call site (the field is optional, so this should not happen).

- [ ] **Step 6: Commit**

```bash
npx prettier --write vibes.diy/vibe/runtime/vibe.ts vibes.diy/vibe/runtime/vibe.test.ts
git add vibes.diy/vibe/runtime/vibe.ts vibes.diy/vibe/runtime/vibe.test.ts
git commit -m "feat(vibe-runtime): vibeMountParams.viewerEnv (viewer + access + dbAcls + apiBaseUrl)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Update `VibeContext` to carry `viewerEnv` and listen for `viewerChanged`

**Files:**

- Modify: `vibes.diy/vibe/runtime/VibeContext.tsx`
- Test: `vibes.diy/vibe/runtime/VibeContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/vibe/runtime/VibeContext.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { VibeContextProvider, useVibeContext } from "./VibeContext.js";

function Probe({ onCtx }: { onCtx: (ctx: ReturnType<typeof useVibeContext>) => void }) {
  const ctx = useVibeContext();
  onCtx(ctx);
  return null;
}

describe("VibeContextProvider", () => {
  it("exposes mountParams.viewerEnv on the context", () => {
    let captured: any;
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          viewerEnv: {
            viewer: { userSlug: "alice" },
            access: "owner",
            apiBaseUrl: "https://api.example.com",
          },
        }}
      >
        <Probe onCtx={(c) => (captured = c)} />
      </VibeContextProvider>
    );
    expect(captured.mountParams.viewerEnv?.viewer?.userSlug).toBe("alice");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/vibe/runtime && pnpm vitest run VibeContext.test.tsx`
Expected: FAIL — current provider hardcodes `usrEnv: {}` (line 20 of VibeContext.tsx) and ignores `viewerEnv`.

- [ ] **Step 3: Fix the provider**

Replace `vibes.diy/vibe/runtime/VibeContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { VibeMountParams, ViewerEnv } from "./vibe.js";
import { isEvtVibeViewerChanged } from "@vibes.diy/vibe-types";

export interface Vibe {
  readonly mountParams: VibeMountParams;
}

const VibeContext = createContext<Vibe>({
  mountParams: { usrEnv: {} },
});

export interface VibeContextProviderProps {
  readonly mountParams: VibeMountParams;
  readonly children: ReactNode;
}

function LiveCycleVibeContextProvider({ mountParams, children }: VibeContextProviderProps) {
  // Live `viewerEnv` — initialized from server-rendered mountParams,
  // updated on `vibe.evt.viewerChanged` when the viewer's session
  // identity changes mid-iframe (sign in/out, persona switch).
  const [viewerEnv, setViewerEnv] = useState<ViewerEnv | undefined>(mountParams.viewerEnv);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (!isEvtVibeViewerChanged(event.data)) return;
      // Preserve apiBaseUrl from the seed; the event carries identity-only.
      setViewerEnv((prev) => {
        const apiBaseUrl = prev?.apiBaseUrl ?? mountParams.viewerEnv?.apiBaseUrl ?? "";
        return {
          viewer: event.data.viewer,
          access: event.data.access,
          ...(event.data.dbAcls ? { dbAcls: event.data.dbAcls } : {}),
          apiBaseUrl,
        };
      });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mountParams.viewerEnv?.apiBaseUrl]);

  const ctx: Vibe = {
    mountParams: { ...mountParams, viewerEnv },
  };
  return <VibeContext.Provider value={ctx}>{children}</VibeContext.Provider>;
}

export function VibeContextProvider({ mountParams, children }: VibeContextProviderProps) {
  return <LiveCycleVibeContextProvider mountParams={mountParams}>{children}</LiveCycleVibeContextProvider>;
}

export function useVibeContext(): Vibe {
  return useContext(VibeContext);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd vibes.diy/vibe/runtime && pnpm vitest run VibeContext.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add a viewerChanged event test**

Append to `VibeContext.test.tsx`:

```tsx
it("updates viewerEnv when vibe.evt.viewerChanged fires", async () => {
  let captured: any;
  render(
    <VibeContextProvider
      mountParams={{
        usrEnv: {},
        viewerEnv: { viewer: null, access: "none", apiBaseUrl: "https://api" },
      }}
    >
      <Probe onCtx={(c) => (captured = c)} />
    </VibeContextProvider>
  );
  expect(captured.mountParams.viewerEnv?.viewer).toBeNull();

  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "vibe.evt.viewerChanged",
        viewer: { userSlug: "alice", displayName: "Alice" },
        access: "viewer",
      },
    })
  );

  // React schedules state updates; flush by awaiting a microtask.
  await Promise.resolve();
  expect(captured.mountParams.viewerEnv?.viewer?.userSlug).toBe("alice");
  expect(captured.mountParams.viewerEnv?.access).toBe("viewer");
  expect(captured.mountParams.viewerEnv?.apiBaseUrl).toBe("https://api");
});
```

Run: `cd vibes.diy/vibe/runtime && pnpm vitest run VibeContext.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npx prettier --write vibes.diy/vibe/runtime/VibeContext.tsx vibes.diy/vibe/runtime/VibeContext.test.tsx
git add vibes.diy/vibe/runtime/VibeContext.tsx vibes.diy/vibe/runtime/VibeContext.test.tsx
git commit -m "feat(vibe-runtime): VibeContext carries viewerEnv, listens for viewerChanged

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Implement `useViewer()` with `can()` and `avatarUrlFor()` in `use-vibes/base`

**Why this package:** generated app code imports from the public `use-vibes` package (`import { ImgGen } from "use-vibes"`), so `useViewer` must live alongside `useVibes`/`useFireproof` in `@vibes.diy/use-vibes-base` and be re-exported through `use-vibes/pkg/index.ts`. The hook reads `mountParams.viewerEnv` from the runtime's `VibeContext` (`@vibes.diy/vibe-runtime`), which use-vibes-base already depends on.

**Files:**

- Create: `use-vibes/base/hooks/use-viewer.ts`
- Test: `use-vibes/base/hooks/use-viewer.test.tsx`
- Modify: `use-vibes/base/index.ts` (re-export from `./hooks/use-viewer.js`)
- Modify: `use-vibes/pkg/index.ts` (re-export from `@vibes.diy/use-vibes-base`)

- [ ] **Step 1: Write the failing test**

Create `use-vibes/base/hooks/use-viewer.test.tsx`. Note: the test imports `VibeContextProvider` from `@vibes.diy/vibe-runtime` (the runtime context), not from `use-vibes-base` (which has its own larger context). The runtime context is what mountVibe wires up inside the iframe.

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { VibeContextProvider } from "@vibes.diy/vibe-runtime";
import { useViewer } from "./use-viewer.js";

function Probe({ onR }: { onR: (r: ReturnType<typeof useViewer>) => void }) {
  const r = useViewer();
  onR(r);
  return null;
}

const baseEnv = {
  viewer: { userSlug: "alice", displayName: "Alice" },
  access: "owner" as const,
  apiBaseUrl: "https://api.example.com",
};

function renderWith(env: any) {
  let captured: any;
  render(
    <VibeContextProvider mountParams={{ usrEnv: {}, viewerEnv: env }}>
      <Probe onR={(r) => (captured = r)} />
    </VibeContextProvider>
  );
  return captured;
}

describe("useViewer", () => {
  it("exposes viewer + access + dbAcls", () => {
    const r = renderWith({ ...baseEnv, dbAcls: { comments: { write: ["members"] } } });
    expect(r.viewer?.userSlug).toBe("alice");
    expect(r.access).toBe("owner");
    expect(r.dbAcls.comments.write).toEqual(["members"]);
  });

  it("returns sensible defaults when no viewerEnv was provided", () => {
    const r = renderWith(undefined);
    expect(r.viewer).toBeNull();
    expect(r.access).toBe("none");
    expect(r.dbAcls).toEqual({});
  });

  it("can(write, dbName) consults the per-db ACL", () => {
    const r = renderWith({
      viewer: { userSlug: "bob" },
      access: "viewer" as const,
      dbAcls: { comments: { write: ["members"] } },
      apiBaseUrl: "https://api",
    });
    expect(r.can("write", "comments")).toBe(true); // viewer is in members
    expect(r.can("write", "other")).toBe(false); // viewer cannot write by role
  });

  it("can(write) without dbName collapses for single-db case", () => {
    const r = renderWith({ viewer: { userSlug: "bob" }, access: "owner" as const, apiBaseUrl: "x" });
    expect(r.can("write")).toBe(true);
    const r2 = renderWith({ viewer: null, access: "none" as const, apiBaseUrl: "x" });
    expect(r2.can("write")).toBe(false);
  });

  it("can(action) returns false if any configured override denies", () => {
    const r = renderWith({
      viewer: { userSlug: "bob" },
      access: "editor" as const,
      dbAcls: { lockedDb: { write: ["owner"] as any } },
      apiBaseUrl: "x",
    });
    // Editor can write at the role-fallback level for "any other db", but
    // the lockedDb override forces owner-only — so global can("write") is false.
    expect(r.can("write")).toBe(false);
  });

  it("avatarUrlFor(slug) builds {apiBaseUrl}/u/{slug}/avatar", () => {
    const r = renderWith(baseEnv);
    expect(r.avatarUrlFor("bob")).toBe("https://api.example.com/u/bob/avatar");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd use-vibes/base && pnpm vitest run hooks/use-viewer.test.tsx`
Expected: FAIL — `useViewer` not found.

- [ ] **Step 3: Implement**

Create `use-vibes/base/hooks/use-viewer.ts`. The runtime's `useVibeContext` returns the iframe's mountParams holder; rename it on import to disambiguate from use-vibes-base's own (richer, host-side) `useVibeContext`:

```ts
import type { DbAcl } from "@vibes.diy/api-types";
import type { DocAccessLevel, ViewerPayload } from "@vibes.diy/vibe-types";
import { aclAllows, useVibeContext as useRuntimeVibeContext } from "@vibes.diy/vibe-runtime";

export interface UseViewerResult {
  readonly viewer: ViewerPayload | null;
  readonly access: DocAccessLevel;
  readonly dbAcls: Record<string, DbAcl>;
  readonly can: (action: "read" | "write" | "delete", dbName?: string) => boolean;
  readonly avatarUrlFor: (userSlug: string) => string;
}

export function useViewer(): UseViewerResult {
  const { mountParams } = useRuntimeVibeContext();
  const env = mountParams.viewerEnv;
  const viewer = env?.viewer ?? null;
  const access: DocAccessLevel = env?.access ?? "none";
  const dbAcls: Record<string, DbAcl> = env?.dbAcls ?? {};
  const apiBaseUrl = env?.apiBaseUrl ?? "";

  function can(action: "read" | "write" | "delete", dbName?: string): boolean {
    if (dbName !== undefined) {
      return aclAllows(dbAcls[dbName], action, access);
    }
    // No dbName: true iff the action is allowed for *every* db this app
    // could have. The app-scoped fallback (no override) plus every
    // configured override must all allow it. For a 1-db vibe with no
    // custom ACL this collapses to the role check.
    if (!aclAllows(undefined, action, access)) return false;
    for (const acl of Object.values(dbAcls)) {
      if (!aclAllows(acl, action, access)) return false;
    }
    return true;
  }

  function avatarUrlFor(userSlug: string): string {
    return `${apiBaseUrl}/u/${userSlug}/avatar`;
  }

  return { viewer, access, dbAcls, can, avatarUrlFor };
}
```

- [ ] **Step 4: Re-export from `use-vibes-base/index.ts`**

In `use-vibes/base/index.ts`, after the existing hook exports (near `useVibes`), add:

```ts
export { useViewer, type UseViewerResult } from "./hooks/use-viewer.js";
```

- [ ] **Step 5: Re-export from `use-vibes/pkg/index.ts`**

In `use-vibes/pkg/index.ts`, add `useViewer` and `UseViewerResult` to the existing re-export block:

```ts
export {
  // ... existing exports
  useViewer,
  type UseViewerResult,
} from "@vibes.diy/use-vibes-base";
```

This is what makes `import { useViewer } from "use-vibes"` work in generated app code — the same import shape as `import { ImgGen } from "use-vibes"`.

- [ ] **Step 6: Run test to verify pass**

Run: `cd use-vibes/base && pnpm vitest run hooks/use-viewer.test.tsx`
Expected: PASS — all six cases.

- [ ] **Step 7: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors. The use-vibes-base ↔ vibe-runtime dependency already exists ([use-vibes/base/package.json:23](../../../use-vibes/base/package.json#L23)).

- [ ] **Step 8: Commit**

```bash
npx prettier --write use-vibes/base/hooks/use-viewer.ts use-vibes/base/hooks/use-viewer.test.tsx use-vibes/base/index.ts use-vibes/pkg/index.ts
git add use-vibes/base/hooks/use-viewer.ts use-vibes/base/hooks/use-viewer.test.tsx use-vibes/base/index.ts use-vibes/pkg/index.ts
git commit -m "feat(use-vibes): useViewer() — public hook for vibe identity & capabilities

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 — Server-Rendered Mount Seed

### Task 12: Embed `viewerEnv` into render-vibe's `mountJS`

**Files:**

- Modify: `vibes.diy/api/svc/intern/render-vibe.ts`

- [ ] **Step 1: Read the current shape**

Open `vibes.diy/api/svc/intern/render-vibe.ts` lines 80–150 (and the analogous block in `renderPendingVibe`, ~lines 218–235). Note that `mountJS` JSON.stringifies a single `{ usrEnv }` object today.

- [ ] **Step 2: Add a viewer resolution call**

Above the `vsctx` literal in `renderVibe` (around line 129), add:

```ts
import { resolveWhoAmI } from "../public/who-am-i.js";
// (add to the file's import block at the top)

// Compute initial viewerEnv so the iframe's first render has identity.
// `ctx.auth` is populated upstream when the request carried a Clerk session.
const rViewer = await resolveWhoAmI(vctx, {
  auth: ctx.auth, // adapt to whatever the actual request-scoped auth field is
  appSlug: fs.appSlug,
  ownerUserSlug: fs.userSlug,
});
const viewerEnv = rViewer.isOk()
  ? {
      viewer: rViewer.Ok().viewer,
      access: rViewer.Ok().access,
      ...(rViewer.Ok().dbAcls ? { dbAcls: rViewer.Ok().dbAcls } : {}),
      apiBaseUrl: `${requestUrl.protocol}//${requestUrl.host}`,
    }
  : undefined;
```

If `ctx.auth` is not the right field, search `vibes.diy/api/svc/intern/render-vibe.ts` for how `optAuth` or `verifiedAuth` is currently exposed in the same handler (other handlers in `vibes.diy/api/svc/public/` use `req._auth` after `optAuth`-wrapping; for the HTTP render path, look for `ctx.request` and any auth-cookie parsing already done).

- [ ] **Step 3: Wire into mountJS**

Change the existing line:

```ts
`  .then(() => mountVibe([${imports.map((i) => i.var).join(",")}], ${JSON.stringify({ usrEnv })}));`,
```

to:

```ts
`  .then(() => mountVibe([${imports.map((i) => i.var).join(",")}], ${JSON.stringify({
  usrEnv,
  ...(viewerEnv ? { viewerEnv } : {}),
})}));`,
```

Repeat the same change in `renderPendingVibe` for its `mountJS` block (~line 232) — but with `viewerEnv` computed against the pending fsId (using `appSlug, userSlug` already in scope).

- [ ] **Step 4: Add a smoke test**

Find the existing render-vibe test. Add a case asserting that the rendered HTML includes `viewerEnv` in the `mountJS` script for an authenticated request, and omits it (or carries `viewer: null`) for an anonymous request.

- [ ] **Step 5: Run tests**

Run: `cd vibes.diy/api && pnpm vitest run svc/intern/render-vibe.test.ts`
Expected: PASS — both the new and existing cases.

- [ ] **Step 6: Run repo type-check**

Run: `pnpm fast-check 2>&1 | tail -40`
Expected: no new TS errors.

- [ ] **Step 7: Commit**

```bash
npx prettier --write vibes.diy/api/svc/intern/render-vibe.ts vibes.diy/api/svc/intern/render-vibe.test.ts
git add vibes.diy/api/svc/intern/render-vibe.ts vibes.diy/api/svc/intern/render-vibe.test.ts
git commit -m "feat(api): render-vibe seeds mountParams.viewerEnv for first paint

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7 — Settings UI: Avatar upload

### Task 13: Add Avatar + Display Name fields to user settings page

**Files:**

- Modify: the user-settings page component (find it via `grep -rln "userSettingShareing\|defaultUserSlug" vibes.diy/pkg/app/components/ vibes.diy/pkg/app/routes/`).
- Test: a sibling component test alongside the settings page.

- [ ] **Step 1: Read the existing page**

Read the settings page component to learn its layout, how it dispatches `ensureUserSettings` requests, and how it surfaces success/error toasts.

- [ ] **Step 2: Write the failing test**

Add a test that:

1. Renders the settings page with a fake `vibeDiyApi`.
2. Simulates picking a file in the avatar input.
3. Asserts `vibeDiyApi.putAsset` was called with the file.
4. Asserts `vibeDiyApi.ensureUserSettings` was called with a `userSettingProfile` entry containing the returned CID.
5. Renders again with a `displayName` change and asserts `ensureUserSettings` is dispatched with the updated profile.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run <path-to-settings.test.tsx>`
Expected: FAIL — UI doesn't have these inputs yet.

- [ ] **Step 4: Implement the UI**

Add an "Avatar" section to the settings page:

```tsx
<section>
  <h3>Avatar</h3>
  <input
    type="file"
    accept="image/png,image/jpeg,image/webp"
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const rPut = await vibeDiyApi.putAsset(file, file.type);
      if (rPut.isErr()) return toast.error(rPut.Err().message);
      const cid = rPut.Ok().cid;
      await ensureUserSettings([
        {
          type: "profile",
          avatarCid: cid,
          ...(displayName ? { displayName } : {}),
        },
      ]);
      toast.success("Avatar updated");
    }}
  />
  {currentAvatarCid ? (
    <img src={`/u/${userSlug}/avatar`} alt="Current avatar" className="h-16 w-16 rounded-full" />
  ) : null}
</section>

<section>
  <h3>Display name</h3>
  <input
    value={displayName}
    onChange={(e) => setDisplayName(e.target.value)}
    onBlur={async () => {
      await ensureUserSettings([{ type: "profile", displayName }]);
    }}
  />
</section>
```

(The exact API surface — whether the page wraps `ensureUserSettings` in a hook, etc. — depends on the existing page's idiom. Match it.)

When updating one profile field, preserve the other by reading the existing profile entry from the loaded settings and merging.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run <path-to-settings.test.tsx>`
Expected: PASS.

- [ ] **Step 6: Manual smoke test**

Start the dev server, log in, visit `/settings`, upload a small PNG. Confirm:

- The image renders next to the upload input via the `/u/<userSlug>/avatar` URL.
- Refreshing the page still shows the new avatar.
- Reuploading replaces the avatar (the rendered URL didn't change but the bytes did — visible after a hard refresh).

- [ ] **Step 7: Commit**

```bash
npx prettier --write <files>
git add <files>
git commit -m "feat(settings): avatar upload + display-name override

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 8 — Prompt template + Integration test

### Task 14: Document `useViewer()` in the system prompt and llms docs

**Files:**

- Create: `prompts/pkg/llms/use-viewer.md` (parallel to `prompts/pkg/llms/image-gen.md`).
- Modify: `prompts/pkg/system-prompt.md` and `prompts/pkg/system-prompt-initial.md` — one-line mention.
- Modify: `notes/vibes-app-jsx.md` — full reference section.

Public surface to document — only three names: `viewer`, `can(action, dbName?)`, `avatarUrlFor(userSlug)`. Hide `access` and `dbAcls` from the prompt even though the hook returns them; vibes shouldn't lean on raw ACL internals.

- [ ] **Step 1: Create the llms doc**

Mirror the structure of [prompts/pkg/llms/image-gen.md](../../../prompts/pkg/llms/image-gen.md). Create `prompts/pkg/llms/use-viewer.md`:

````markdown
# useViewer Hook

Get the current viewer's identity and capabilities. Use it to render avatars, names, and gate UI on what the viewer can do.

## Basic Usage

```jsx
import { useViewer } from "use-vibes";

function App() {
  const { viewer, can, avatarUrlFor } = useViewer();
  if (!viewer) return <p>Sign in to use this app.</p>;
  return (
    <header>
      <img src={avatarUrlFor(viewer.userSlug)} alt={viewer.userSlug} />
      <span>{viewer.displayName ?? viewer.userSlug}</span>
    </header>
  );
}
```
````

## What you get

- `viewer` — `{ userSlug, displayName? }` or `null` for anonymous visitors.
- `can(action, dbName?)` — `true`/`false` for `"read"`, `"write"`, `"delete"`. Pass a `dbName` for multi-db apps; omit for single-db apps. Use it to hide forms when the viewer can't post.
- `avatarUrlFor(userSlug)` — stable image URL for any user. Updates automatically when a user changes their avatar.

## Gating UI

```jsx
function CommentForm() {
  const { viewer, can } = useViewer();
  if (!viewer) return <p>Sign in to comment.</p>;
  if (!can("write", "comments")) return <p>Only collaborators can post comments.</p>;
  return <form>...</form>;
}
```

## Other users' avatars

Store the author's `userSlug` on each doc, not their `userId`. Render by passing the slug to `avatarUrlFor`:

```jsx
{
  comments.map((c) => (
    <li key={c._id}>
      <img src={avatarUrlFor(c.authorUserSlug)} alt={c.authorUserSlug} />
      {c.body}
    </li>
  ));
}
```

## Notes

- Never use Clerk user IDs. Only `userSlug` crosses into vibe code.
- Avatar URLs are stable per userSlug — when a user changes their avatar, every reference updates automatically.

````

- [ ] **Step 2: Add the one-liner to the system prompts**

In both `prompts/pkg/system-prompt.md` and `prompts/pkg/system-prompt-initial.md`, find the existing line referencing `<ImgGen prompt="..." />` (around line 16) and append a sibling bullet:

```markdown
- For viewer identity and capability gating use `const { viewer, can, avatarUrlFor } = useViewer();` from `"use-vibes"` — see use-viewer docs.
````

- [ ] **Step 3: Add the reference to notes/vibes-app-jsx.md**

Append to `notes/vibes-app-jsx.md`:

````markdown
## Identity & capabilities (`useViewer`)

```jsx
import { useViewer } from "use-vibes";

const { viewer, can, avatarUrlFor } = useViewer();
```
````

- `viewer` — `{ userSlug, displayName? } | null`. `null` for anonymous visitors.
- `can(action, dbName?)` — `"read" | "write" | "delete"`. With a `dbName`, checks that db; without, allowed-everywhere.
- `avatarUrlFor(userSlug)` — stable image URL for any user. Works for the viewer or any author whose userSlug you stored.

Render names with `viewer.displayName ?? viewer.userSlug`. Never look up user IDs — only userSlugs cross into vibe code.

````

- [ ] **Step 4: Run prompt tests**

The repo has a test verifying that llms docs land in the system prompt:

```bash
cd prompts && pnpm test
````

If a test like `image-gen` exists asserting `<imgGen-docs>` is included, add a parallel one for `<useViewer-docs>`. Pattern from `prompts/tests/initial-system-prompt.test.ts`:

```ts
it("useViewer skill picks up the doc", async () => {
  // ... mirror the existing image-gen test
  expect(result.systemPrompt).toMatch(/useViewer/);
});
```

- [ ] **Step 5: Commit**

```bash
npx prettier --write prompts/pkg/llms/use-viewer.md prompts/pkg/system-prompt.md prompts/pkg/system-prompt-initial.md notes/vibes-app-jsx.md
git add prompts/pkg/llms/use-viewer.md prompts/pkg/system-prompt.md prompts/pkg/system-prompt-initial.md notes/vibes-app-jsx.md prompts/tests/
git commit -m "docs(prompts): document useViewer for code generation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: End-to-end integration test

**Files:**

- Create: `vibes.diy/api/tests/iframe-viewer-end-to-end.test.ts` (or extend an existing iframe test like `iframe-source-capture.test.ts`).

- [ ] **Step 1: Write the test**

Boot the test harness that already mounts the iframe runtime, render a small vibe that uses `useViewer`, and assert:

1. Anonymous mount: `viewer === null`, `access === "none"`, `can("write")` returns `false`, the rendered DOM uses the fallback markup.
2. Authenticated owner mount: `viewer.userSlug` matches the expected slug, `access === "owner"`, `can("write", "comments")` returns `true`, an `<img>` for the viewer's avatar has `src` ending in `/u/<userSlug>/avatar`.
3. After the test fires `vibe.evt.viewerChanged` with a new viewer, the rendered DOM reflects the new identity (the `useViewer` hook re-renders).

- [ ] **Step 2: Run the test**

Run: `cd vibes.diy && pnpm vitest run api/tests/iframe-viewer-end-to-end.test.ts`
Expected: PASS for all three cases.

- [ ] **Step 3: Run the full check**

Run: `pnpm check 2>&1 | tail -60`
Expected: format clean, build clean, tests pass, lint clean.

- [ ] **Step 4: Commit**

```bash
npx prettier --write vibes.diy/api/tests/iframe-viewer-end-to-end.test.ts
git add vibes.diy/api/tests/iframe-viewer-end-to-end.test.ts
git commit -m "test(api): end-to-end iframe useViewer integration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Final repo-wide check + push branch

- [ ] **Step 1: Run the full check one more time**

Run: `pnpm check 2>&1 | tee /tmp/whoami-check.log | tail -80`
Expected: all green. If it fails on a flaky test, rerun the failing suite in isolation per [agents/flaky-tests.md](../../agents/flaky-tests.md) — log to VibesDIY/vibes.diy#1515 if it persists.

- [ ] **Step 2: Push**

```bash
git push -u origin <branch-name>
```

- [ ] **Step 3: Open PR**

Body should reference the spec at `docs/superpowers/specs/2026-05-09-vibe-viewer-identity-capabilities-design.md` and call out the non-goals (anonymous-write, persona switching, live ACL push) so reviewers don't flag them as missing.

---

## Notes For The Implementer

**Reading order before you start:** the spec ([docs/superpowers/specs/2026-05-09-vibe-viewer-identity-capabilities-design.md](../specs/2026-05-09-vibe-viewer-identity-capabilities-design.md)), then [vibes.diy/vibe/types/index.ts](../../../vibes.diy/vibe/types/index.ts) section starting around line 426 (existing put-asset types — your model), then [vibes.diy/api/svc/public/list-members.ts](../../../vibes.diy/api/svc/public/list-members.ts) (your handler model), then [vibes.diy/api/svc/public/db-acl-resolver.ts](../../../vibes.diy/api/svc/public/db-acl-resolver.ts) (the host port of `aclAllows` you're mirroring).

**Auth in the HTTP render path:** Task 12 has a `ctx.auth` placeholder. The render-vibe handler uses different auth surface than the Evento path. Read the function header carefully and use whichever field the existing code consults to detect a signed-in user. If the path is currently anonymous-only (no Clerk session detection), the iframe will mount with `viewer: null` until the sandbox calls `vibe.req.whoAmI` after boot — that's still functional, just slightly worse first-paint UX. Land that as a follow-up if the auth wiring is non-trivial.

**Clerk `imageUrl` fallback:** Spec §1a step 2 says the avatar route should fall back to Clerk's profile image when no `avatarCid` is configured. The plan implements step 1 (avatarCid → 302) and step 3 (404 if neither). Step 2 (Clerk fallback) requires looking up Clerk by userId server-side. If the existing codebase already caches Clerk profile fields anywhere (e.g. on the `inviteGrants.foreignInfo` JSON) and you can read them from `userSlugBinding`, add the fallback to `handleGetUserAvatar`. Otherwise leave it as 404 and ship the rest.

**Frequent commits:** every task ends with a commit. Don't bundle.

**`pnpm fast-check` vs `pnpm check`:** use `fast-check` between tasks to keep iteration fast. Run the full `pnpm check` once before pushing the branch. The user's preference: low-risk diffs → `fast-check`; higher-risk → full `check` ([feedback memory](../../../.claude/projects/-Users-jchris-code-fp-vibes-diy/memory/feedback_pnpm_check_only_before_commit.md)).
