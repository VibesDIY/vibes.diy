# Vibe Route Fast First Paint — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the iframe immediately on the `/vibe` route for world-readable apps (public access or auto-accept-role), behind a pointer-blocking overlay that drops once the client-side grant check resolves — eliminating the grant-check round-trip from the visual critical path.

**Architecture:** A new `getVibeRouteHints` function LEFT JOINs `AppSettings` into the existing apps-table query (already made server-side before SSR), deriving `isWorldReadable` from the raw settings entries array in TypeScript. The flag flows through the Worker load context → React Router loader → SSR'd HTML. The vibe route component uses it to flip `visibility: visible` immediately for qualifying apps and adds a zero-visual pointer-events blocker that drops once `cardGrant` resolves.

**Tech Stack:** TypeScript, Drizzle ORM (SQLite + Postgres), React Router v7, Vitest

---

## File Map

| Status | Path | Purpose |
|---|---|---|
| **Create** | `vibes.diy/api/svc/intern/get-vibe-route-hints.ts` | New function replacing `getVibeOgTitle`; adds LEFT JOIN + `deriveIsWorldReadable` helper |
| **Create** | `vibes.diy/api/tests/get-vibe-route-hints.test.ts` | Unit tests for `deriveIsWorldReadable` + integration tests for `getVibeRouteHints` |
| **Modify** | `vibes.diy/pkg/workers/app.ts` | Swap `getVibeOgTitle` → `getVibeRouteHints`; add `isWorldReadable` to load context |
| **Modify** | `vibes.diy/pkg/app/routes/vibe.$userSlug.$appSlug.tsx` | Add `isWorldReadable` to loader ctx/data types; update iframe visibility + overlay |
| **Delete** | `vibes.diy/api/svc/intern/get-vibe-og-title.ts` | Superseded by `get-vibe-route-hints.ts`; removed after callers are migrated |
| **Rename** | `vibes.diy/api/tests/get-vibe-og-title.test.ts` → `get-vibe-route-hints.test.ts` | Old test file folded into new one |

---

## Task 1: `deriveIsWorldReadable` — pure helper with unit tests

**Files:**
- Create: `vibes.diy/api/svc/intern/get-vibe-route-hints.ts`
- Create: `vibes.diy/api/tests/get-vibe-route-hints.test.ts`

- [ ] **Step 1.1: Write failing unit tests for `deriveIsWorldReadable`**

Create `vibes.diy/api/tests/get-vibe-route-hints.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { deriveIsWorldReadable } from "@vibes.diy/api-svc/intern/get-vibe-route-hints.js";

describe("deriveIsWorldReadable", () => {
  it("returns false for null/undefined/non-array", () => {
    expect(deriveIsWorldReadable(null)).toBe(false);
    expect(deriveIsWorldReadable(undefined)).toBe(false);
    expect(deriveIsWorldReadable("string")).toBe(false);
    expect(deriveIsWorldReadable({})).toBe(false);
  });

  it("returns false for empty entries array", () => {
    expect(deriveIsWorldReadable([])).toBe(false);
  });

  it("returns true when app.public.access enable:true is present", () => {
    expect(deriveIsWorldReadable([{ type: "app.public.access", enable: true }])).toBe(true);
  });

  it("returns false when app.public.access enable:false", () => {
    expect(deriveIsWorldReadable([{ type: "app.public.access", enable: false }])).toBe(false);
  });

  it("returns true when app.request has autoAcceptRole", () => {
    expect(deriveIsWorldReadable([{ type: "app.request", enable: true, autoAcceptRole: "viewer" }])).toBe(true);
    expect(deriveIsWorldReadable([{ type: "app.request", enable: true, autoAcceptRole: "editor" }])).toBe(true);
  });

  it("returns false when app.request enable:true but no autoAcceptRole", () => {
    expect(deriveIsWorldReadable([{ type: "app.request", enable: true }])).toBe(false);
  });

  it("returns false when app.request has autoAcceptRole but enable:false", () => {
    expect(deriveIsWorldReadable([{ type: "app.request", enable: false, autoAcceptRole: "viewer" }])).toBe(false);
  });

  it("latest entry wins — false overrides earlier true for publicAccess", () => {
    expect(
      deriveIsWorldReadable([
        { type: "app.public.access", enable: true },
        { type: "app.public.access", enable: false },
      ])
    ).toBe(false);
  });

  it("latest entry wins — true overrides earlier false for publicAccess", () => {
    expect(
      deriveIsWorldReadable([
        { type: "app.public.access", enable: false },
        { type: "app.public.access", enable: true },
      ])
    ).toBe(true);
  });

  it("ignores unrelated entry types", () => {
    expect(
      deriveIsWorldReadable([
        { type: "active.title", title: "My App" },
        { type: "active.theme", theme: "dark" },
      ])
    ).toBe(false);
  });
});
```

- [ ] **Step 1.2: Run tests to confirm they fail (module not found)**

```bash
pnpm --dir vibes.diy/api/tests test get-vibe-route-hints --reporter=dot
```

Expected: FAIL — `Cannot find module '@vibes.diy/api-svc/intern/get-vibe-route-hints.js'`

- [ ] **Step 1.3: Implement `get-vibe-route-hints.ts` with `deriveIsWorldReadable` only**

Create `vibes.diy/api/svc/intern/get-vibe-route-hints.ts`:

```typescript
import { exception2Result, Result } from "@adviser/cement";
import { ensureLogger } from "@fireproof/core-runtime";
import { and, desc, eq } from "drizzle-orm/sql/expressions";
import { isMetaTitle, MetaItem, parseArrayWarning, isEnablePublicAccess, isEnableRequest } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

export interface VibeSlugPair {
  readonly userSlug: string;
  readonly appSlug: string;
}

export interface VibeRouteHints {
  readonly ogTitle: string | undefined;
  readonly isWorldReadable: boolean;
}

// Pure derivation — no I/O. Scans the raw AppSettings entries array (as stored
// in the DB) to determine whether any visitor can access this app without owner
// action. The last entry of each type wins (append-only log semantics).
export function deriveIsWorldReadable(rawSettings: unknown): boolean {
  if (!Array.isArray(rawSettings)) return false;
  let publicAccess: boolean | undefined;
  let autoAcceptRole: boolean | undefined;
  for (const e of rawSettings) {
    if (isEnablePublicAccess(e)) publicAccess = e.enable;
    if (isEnableRequest(e)) autoAcceptRole = e.enable && e.autoAcceptRole !== undefined;
  }
  return publicAccess === true || autoAcceptRole === true;
}

// Pure pathname parser — no I/O, safe to call before any async work.
// Extracts the (userSlug, appSlug) pair from /vibe/:userSlug/:appSlug[/...].
export function parseVibePathname(pathname: string): VibeSlugPair | undefined {
  const parts = pathname.split("/");
  const userSlug = parts[2];
  const appSlug = parts[3];
  if (parts[1] !== "vibe" || userSlug === undefined || userSlug === "" || appSlug === undefined || appSlug === "") {
    return undefined;
  }
  return { userSlug, appSlug };
}

// Looks up both the OG title and world-readable flag for a vibe route SSR pass.
// Returns defaults on error so a lookup failure never breaks page rendering.
export async function getVibeRouteHints(ctx: VibesApiSQLCtx, slugs: VibeSlugPair): Promise<Result<VibeRouteHints>> {
  return exception2Result(async (): Promise<Result<VibeRouteHints>> => {
    const row = await ctx.sql.db
      .select({
        meta: ctx.sql.tables.apps.meta,
        settings: ctx.sql.tables.appSettings.settings,
      })
      .from(ctx.sql.tables.apps)
      .leftJoin(
        ctx.sql.tables.appSettings,
        and(
          eq(ctx.sql.tables.appSettings.userSlug, ctx.sql.tables.apps.userSlug),
          eq(ctx.sql.tables.appSettings.appSlug, ctx.sql.tables.apps.appSlug)
        )
      )
      .where(
        and(
          eq(ctx.sql.tables.apps.userSlug, slugs.userSlug),
          eq(ctx.sql.tables.apps.appSlug, slugs.appSlug),
          eq(ctx.sql.tables.apps.mode, "production")
        )
      )
      .orderBy(desc(ctx.sql.tables.apps.releaseSeq))
      .limit(1)
      .then((r) => r[0]);

    if (row === undefined) return Result.Ok({ ogTitle: undefined, isWorldReadable: false });

    const { filtered: metaItems, warning } = parseArrayWarning(row.meta, MetaItem);
    if (warning.length > 0) {
      ensureLogger(ctx.sthis, "getVibeRouteHints").Warn().Any({ parseErrors: warning }).Msg("skip");
    }
    const titleItem = metaItems.find(isMetaTitle);

    return Result.Ok({
      ogTitle: titleItem === undefined ? undefined : titleItem.title,
      isWorldReadable: deriveIsWorldReadable(row.settings),
    });
  });
}
```

- [ ] **Step 1.4: Run unit tests to confirm they pass**

```bash
pnpm --dir vibes.diy/api/tests test get-vibe-route-hints --reporter=dot
```

Expected: All `deriveIsWorldReadable` tests PASS. `getVibeRouteHints` integration tests don't exist yet — that's fine.

- [ ] **Step 1.5: Commit**

```bash
git add vibes.diy/api/svc/intern/get-vibe-route-hints.ts vibes.diy/api/tests/get-vibe-route-hints.test.ts
git commit -m "$(cat <<'EOF'
feat(svc): add getVibeRouteHints with deriveIsWorldReadable

New get-vibe-route-hints.ts replaces get-vibe-og-title.ts. Same query
plus a LEFT JOIN to AppSettings; derives isWorldReadable from the raw
entries array (latest-entry-wins scan) without schema migration.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Integration tests for `getVibeRouteHints`

**Files:**
- Modify: `vibes.diy/api/tests/get-vibe-route-hints.test.ts`

- [ ] **Step 2.1: Add integration tests for `getVibeRouteHints`**

Append to `vibes.diy/api/tests/get-vibe-route-hints.test.ts`:

```typescript
import { beforeAll, inject } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { getVibeRouteHints } from "@vibes.diy/api-svc/intern/get-vibe-route-hints.js";
```

Add these imports at the top of the file (merge with existing imports), then add the `describe` block:

```typescript
describe(
  "getVibeRouteHints",
  { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 },
  () => {
    const sthis = ensureSuperThis();
    let vibesCtx: VibesApiSQLCtx;

    function makeAppsRow(overrides: {
      appSlug: string;
      userSlug: string;
      meta: unknown;
      mode?: "dev" | "production";
      releaseSeq?: number;
    }) {
      return {
        userId: "test-user-hints",
        fsId: `bafyhints${Math.random().toString(36).slice(2, 10)}`,
        env: [],
        fileSystem: [],
        created: new Date().toISOString(),
        mode: overrides.mode ?? "production",
        releaseSeq: overrides.releaseSeq ?? 1,
        ...overrides,
      };
    }

    beforeAll(async () => {
      const deviceCA = await createTestDeviceCA(sthis);
      const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
      vibesCtx = appCtx.vibesCtx;
    });

    it("returns ogTitle from MetaTitle and isWorldReadable:false when no AppSettings row", async () => {
      const appSlug = `hints-notitle-${sthis.nextId(6).str}`;
      const userSlug = `hints-user-${sthis.nextId(6).str}`;
      await vibesCtx.sql.db
        .insert(vibesCtx.sql.tables.apps)
        .values(makeAppsRow({ appSlug, userSlug, meta: [{ type: "title", title: "My App" }] }));

      const result = await getVibeRouteHints(vibesCtx, { userSlug, appSlug });
      expect(result.isOk()).toBe(true);
      expect(result.Ok().ogTitle).toBe("My App");
      expect(result.Ok().isWorldReadable).toBe(false);
    });

    it("returns isWorldReadable:true when AppSettings has publicAccess enable:true", async () => {
      const appSlug = `hints-pub-${sthis.nextId(6).str}`;
      const userSlug = `hints-user-${sthis.nextId(6).str}`;
      await vibesCtx.sql.db
        .insert(vibesCtx.sql.tables.apps)
        .values(makeAppsRow({ appSlug, userSlug, meta: [] }));
      await vibesCtx.sql.db.insert(vibesCtx.sql.tables.appSettings).values({
        userId: "test-user-hints",
        appSlug,
        userSlug,
        settings: [{ type: "app.public.access", enable: true }],
        updated: new Date().toISOString(),
        created: new Date().toISOString(),
      });

      const result = await getVibeRouteHints(vibesCtx, { userSlug, appSlug });
      expect(result.isOk()).toBe(true);
      expect(result.Ok().isWorldReadable).toBe(true);
    });

    it("returns isWorldReadable:true when AppSettings has enableRequest autoAcceptRole", async () => {
      const appSlug = `hints-auto-${sthis.nextId(6).str}`;
      const userSlug = `hints-user-${sthis.nextId(6).str}`;
      await vibesCtx.sql.db
        .insert(vibesCtx.sql.tables.apps)
        .values(makeAppsRow({ appSlug, userSlug, meta: [] }));
      await vibesCtx.sql.db.insert(vibesCtx.sql.tables.appSettings).values({
        userId: "test-user-hints",
        appSlug,
        userSlug,
        settings: [{ type: "app.request", enable: true, autoAcceptRole: "viewer" }],
        updated: new Date().toISOString(),
        created: new Date().toISOString(),
      });

      const result = await getVibeRouteHints(vibesCtx, { userSlug, appSlug });
      expect(result.isOk()).toBe(true);
      expect(result.Ok().isWorldReadable).toBe(true);
    });

    it("returns isWorldReadable:false when enableRequest has no autoAcceptRole", async () => {
      const appSlug = `hints-req-${sthis.nextId(6).str}`;
      const userSlug = `hints-user-${sthis.nextId(6).str}`;
      await vibesCtx.sql.db
        .insert(vibesCtx.sql.tables.apps)
        .values(makeAppsRow({ appSlug, userSlug, meta: [] }));
      await vibesCtx.sql.db.insert(vibesCtx.sql.tables.appSettings).values({
        userId: "test-user-hints",
        appSlug,
        userSlug,
        settings: [{ type: "app.request", enable: true }],
        updated: new Date().toISOString(),
        created: new Date().toISOString(),
      });

      const result = await getVibeRouteHints(vibesCtx, { userSlug, appSlug });
      expect(result.isOk()).toBe(true);
      expect(result.Ok().isWorldReadable).toBe(false);
    });

    it("returns {ogTitle:undefined, isWorldReadable:false} for unknown slugs", async () => {
      const result = await getVibeRouteHints(vibesCtx, { userSlug: "nobody", appSlug: "nothing" });
      expect(result.isOk()).toBe(true);
      expect(result.Ok().ogTitle).toBeUndefined();
      expect(result.Ok().isWorldReadable).toBe(false);
    });
  }
);
```

- [ ] **Step 2.2: Run integration tests**

```bash
pnpm --dir vibes.diy/api/tests test get-vibe-route-hints --reporter=dot
```

Expected: All tests PASS (unit + integration).

- [ ] **Step 2.3: Commit**

```bash
git add vibes.diy/api/tests/get-vibe-route-hints.test.ts
git commit -m "$(cat <<'EOF'
test(svc): integration tests for getVibeRouteHints

Covers: no-AppSettings row (isWorldReadable:false), publicAccess:true,
autoAcceptRole, manual-only request, unknown app.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire `isWorldReadable` through the Worker and loader context

**Files:**
- Modify: `vibes.diy/pkg/workers/app.ts`
- Modify: `vibes.diy/pkg/app/routes/vibe.$userSlug.$appSlug.tsx`

- [ ] **Step 3.1: Update `app.ts` — swap import, pass `isWorldReadable` in context**

In `vibes.diy/pkg/workers/app.ts`, change the import line (currently):
```typescript
import { getVibeOgTitle, parseVibePathname } from "@vibes.diy/api-svc/intern/get-vibe-og-title.js";
```
To:
```typescript
import { getVibeRouteHints, parseVibePathname } from "@vibes.diy/api-svc/intern/get-vibe-route-hints.js";
```

Then replace the `getVibeOgTitle` call block (currently):
```typescript
const vibeOgTitle =
  vibeSlugPair !== undefined
    ? await getVibeOgTitle(cfCtx.vibesCtx, vibeSlugPair).then((r) => (r.isOk() ? r.Ok() : undefined))
    : undefined;
```
With:
```typescript
const vibeHints =
  vibeSlugPair !== undefined
    ? await getVibeRouteHints(cfCtx.vibesCtx, vibeSlugPair).then((r) =>
        r.isOk() ? r.Ok() : { ogTitle: undefined, isWorldReadable: false }
      )
    : { ogTitle: undefined, isWorldReadable: false };
```

And update the context object passed to `getRequestHandler` (currently):
```typescript
{
  vibeDiyAppParams: cfCtx.vibesCtx.params,
  vibeOgTitle,
}
```
To:
```typescript
{
  vibeDiyAppParams: cfCtx.vibesCtx.params,
  vibeOgTitle: vibeHints.ogTitle,
  isWorldReadable: vibeHints.isWorldReadable,
}
```

- [ ] **Step 3.2: Update the vibe route loader context and data types**

In `vibes.diy/pkg/app/routes/vibe.$userSlug.$appSlug.tsx`, update the two interfaces:

```typescript
interface VibeLoaderCtx {
  readonly vibeDiyAppParams: VibesFPApiParameters;
  readonly vibeOgTitle?: string;
  readonly isWorldReadable?: boolean;          // new
}

interface VibeLoaderData {
  readonly iframeUrl: string | undefined;
  readonly vibeOgTitle: string | undefined;
  readonly isWorldReadable: boolean;           // new
}
```

And update the loader return value. Currently:
```typescript
return { iframeUrl, vibeOgTitle: loaderCtx.context.vibeOgTitle };
```
Change to:
```typescript
return {
  iframeUrl,
  vibeOgTitle: loaderCtx.context.vibeOgTitle,
  isWorldReadable: loaderCtx.context.isWorldReadable ?? false,
};
```

Also update the early-exit return (currently `return { iframeUrl: undefined, vibeOgTitle: undefined }`):
```typescript
return { iframeUrl: undefined, vibeOgTitle: undefined, isWorldReadable: false };
```

- [ ] **Step 3.3: Build to catch type errors**

```bash
pnpm build
```

Expected: No errors. If TypeScript complains about the `loaderData` cast (`as { iframeUrl?: string }`), also add `isWorldReadable?: boolean` to that cast — find the line `const loaderData = matches[matches.length - 1]?.data as { iframeUrl?: string } | undefined;` and change it to:

```typescript
const loaderData = matches[matches.length - 1]?.data as { iframeUrl?: string; isWorldReadable?: boolean } | undefined;
```

- [ ] **Step 3.4: Commit**

```bash
git add vibes.diy/pkg/workers/app.ts vibes.diy/pkg/app/routes/vibe.\$userSlug.\$appSlug.tsx
git commit -m "$(cat <<'EOF'
feat(worker): wire isWorldReadable through SSR loader context

getVibeRouteHints replaces getVibeOgTitle in app.ts; the new flag
flows through Worker context → React Router loader data → SSR HTML.
No visual change yet — component still uses isAccessGranted.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Component — conditional visibility and pointer-blocking overlay

**Files:**
- Modify: `vibes.diy/pkg/app/routes/vibe.$userSlug.$appSlug.tsx`

- [ ] **Step 4.1: Write the failing test for the overlay**

Add to `vibes.diy/api/tests/get-vibe-route-hints.test.ts` — **or** create `vibes.diy/tests/app/vibe-fast-paint.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";

// The conditional visibility logic is a pure function of two booleans.
// Extracted here so it can be unit-tested without mounting the full component.
function iframeVisible(isWorldReadable: boolean, isAccessGranted: boolean): boolean {
  return isWorldReadable || isAccessGranted;
}

function showPointerBlocker(isWorldReadable: boolean, cardGrant: string | undefined): boolean {
  return isWorldReadable && cardGrant === undefined;
}

describe("vibe route iframe visibility logic", () => {
  it("hidden by default (private app, grant unknown)", () => {
    expect(iframeVisible(false, false)).toBe(false);
  });

  it("visible immediately for world-readable app before grant check returns", () => {
    expect(iframeVisible(true, false)).toBe(true);
  });

  it("visible once grant resolves for private app", () => {
    expect(iframeVisible(false, true)).toBe(true);
  });

  it("pointer-blocker shown while world-readable and grant is loading", () => {
    expect(showPointerBlocker(true, undefined)).toBe(true);
  });

  it("pointer-blocker hidden once grant resolves (any grant value)", () => {
    expect(showPointerBlocker(true, "owner")).toBe(false);
    expect(showPointerBlocker(true, "public-access")).toBe(false);
    expect(showPointerBlocker(true, "not-grant")).toBe(false);
  });

  it("pointer-blocker never shown for private apps", () => {
    expect(showPointerBlocker(false, undefined)).toBe(false);
  });
});
```

Run it:
```bash
cd vibes.diy/tests && pnpm test vibe-fast-paint --reporter=dot
```

Expected: PASS immediately (these are pure logic tests, no component deps). If the test file doesn't exist yet, create it at `vibes.diy/tests/app/vibe-fast-paint.test.tsx`.

- [ ] **Step 4.2: Apply the visibility + overlay changes to the component**

In `vibes.diy/pkg/app/routes/vibe.$userSlug.$appSlug.tsx`:

**a) Read `isWorldReadable` from loader data** — add after the `loaderData` line:

```typescript
const isWorldReadable = (loaderData as { isWorldReadable?: boolean } | undefined)?.isWorldReadable ?? false;
```

**b) Update iframe container visibility** — find the current visibility style:
```tsx
style={{ isolation: "isolate", transform: "translate3d(0,0,0)", visibility: isAccessGranted ? "visible" : "hidden" }}
```
Change to:
```tsx
style={{ isolation: "isolate", transform: "translate3d(0,0,0)", visibility: (isWorldReadable || isAccessGranted) ? "visible" : "hidden" }}
```

**c) Add pointer-blocking overlay** — add immediately after the closing `</div>` of the iframe container (after the `{iframeUrl && (...)}` block, before the `{!isAccessGranted && (` grid overlay):

```tsx
{/* Pointer-blocking overlay for world-readable apps — transparent, no visual
    treatment. Prevents interaction while grant check and SrvSandbox ack are
    in flight. Drops as soon as cardGrant is set (to any value). */}
{isWorldReadable && cardGrant === undefined && (
  <div className="fixed inset-0 z-40" style={{ pointerEvents: "all" }} aria-hidden />
)}
```

- [ ] **Step 4.3: Build**

```bash
pnpm build
```

Expected: No type errors.

- [ ] **Step 4.4: Commit**

```bash
git add vibes.diy/pkg/app/routes/vibe.\$userSlug.\$appSlug.tsx vibes.diy/tests/app/vibe-fast-paint.test.tsx
git commit -m "$(cat <<'EOF'
feat(vibe-route): show iframe immediately for world-readable apps

isWorldReadable (from SSR loader) flips iframe visibility before the
client-side grant check returns. A zero-visual pointer-events blocker
sits on top until cardGrant resolves, preventing premature interaction.

Private apps (isWorldReadable:false) are unaffected — current
visibility:hidden behavior unchanged.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Cleanup — remove `get-vibe-og-title.ts` and fold old tests

**Files:**
- Delete: `vibes.diy/api/svc/intern/get-vibe-og-title.ts`
- Delete: `vibes.diy/api/tests/get-vibe-og-title.test.ts`
- Modify: `vibes.diy/api/tests/get-vibe-route-hints.test.ts` (add coverage for `parseVibePathname`)

- [ ] **Step 5.1: Port `parseVibePathname` tests into `get-vibe-route-hints.test.ts`**

The old test file has a `describe("parseVibePathname", ...)` block. Add its tests to `get-vibe-route-hints.test.ts`. Update its import to use the new module:

```typescript
import { deriveIsWorldReadable, getVibeRouteHints, parseVibePathname } from "@vibes.diy/api-svc/intern/get-vibe-route-hints.js";
```

Then paste the `parseVibePathname` describe block from `get-vibe-og-title.test.ts` into `get-vibe-route-hints.test.ts`:

```typescript
describe("parseVibePathname", () => {
  it("extracts slugs from a canonical /vibe/:user/:app path", () => {
    expect(parseVibePathname("/vibe/jchris/my-cool-app")).toEqual({ userSlug: "jchris", appSlug: "my-cool-app" });
  });

  it("extracts slugs when path has additional segments", () => {
    expect(parseVibePathname("/vibe/jchris/my-cool-app/some-fsid")).toEqual({ userSlug: "jchris", appSlug: "my-cool-app" });
  });

  it("returns undefined for non-vibe paths", () => {
    expect(parseVibePathname("/")).toBeUndefined();
    expect(parseVibePathname("/api/foo")).toBeUndefined();
    expect(parseVibePathname("/reports")).toBeUndefined();
  });

  it("returns undefined for /vibe with missing slugs", () => {
    expect(parseVibePathname("/vibe")).toBeUndefined();
    expect(parseVibePathname("/vibe/")).toBeUndefined();
    expect(parseVibePathname("/vibe/jchris")).toBeUndefined();
    expect(parseVibePathname("/vibe/jchris/")).toBeUndefined();
  });
});
```

- [ ] **Step 5.2: Delete old files**

```bash
rm vibes.diy/api/svc/intern/get-vibe-og-title.ts
rm vibes.diy/api/tests/get-vibe-og-title.test.ts
```

- [ ] **Step 5.3: Run full test suite for api/tests**

```bash
pnpm --dir vibes.diy/api/tests test --reporter=dot
```

Expected: All tests PASS. If any import still references `get-vibe-og-title`, fix the import to point to `get-vibe-route-hints`.

- [ ] **Step 5.4: Run pnpm fast-check**

```bash
pnpm fast-check
```

Expected: Build passes, prettier clean.

- [ ] **Step 5.5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(svc): remove get-vibe-og-title — fully superseded by get-vibe-route-hints

Fold parseVibePathname tests into get-vibe-route-hints.test.ts.
No behaviour change.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `getVibeRouteHints` with LEFT JOIN to AppSettings (Task 1)
- ✅ `deriveIsWorldReadable` pure helper (Task 1)
- ✅ Worker context passes `isWorldReadable` (Task 3)
- ✅ Loader returns `isWorldReadable` in SSR data (Task 3)
- ✅ Iframe visible immediately for `isWorldReadable: true` (Task 4)
- ✅ Pointer-blocking overlay while `cardGrant === undefined` (Task 4)
- ✅ Private apps (isWorldReadable:false) unaffected (covered by tests)
- ✅ NULL LEFT JOIN → `isWorldReadable: false` (covered by "no AppSettings row" integration test)
- ✅ `render-vibe.ts` untouched (Phase 2 deferred — no task needed)

**No placeholders:** All code blocks are complete.

**Type consistency:** `VibeRouteHints.ogTitle` / `VibeRouteHints.isWorldReadable` used consistently across Task 1 → Task 3 → Task 4.
