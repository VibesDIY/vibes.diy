# Client-Side Access Runner (Plan A · slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, browser-safe module that evaluates a vibe's own `access.js` against a candidate document and returns a write verdict + reason (and a read-visibility check), faithfully mirroring the server's production write path.

**Architecture:** A dependency-free module in `@vibes.diy/vibe-runtime` that (1) extracts the bound export from `access.js` source, (2) compiles it with `new Function`, (3) invokes it with a `ctx` shim that mirrors the production QuickJS helpers (`cf-serve.ts` / `workers/access-fn.ts`) over the materialized `grants` whoAmI already ships, and (4) applies the same post-checks the server applies (`enforceAllowAnonymous`, `isReadableResult`). Anything it cannot evaluate (missing export, compile error, async, non-`forbidden` throw) returns `{ unknown }` so callers fall back to optimistic write + server rejection. A separate pure function mirrors the read gate (`filterDocsByChannel`). Parity with the server is locked by a fixture matrix test that imports both the server's `extractExportSource` and the runtime's port.

**Tech Stack:** TypeScript, `new Function` (runs in the iframe + Node/Vitest; not in Cloudflare DOs — the server keeps QuickJS), Vitest (via the existing `@vibes.diy/api-test` harness).

**Scope:** This is **slice 1** of Phase A — the pure verdict engine only. It exports the runner but does **not** wire it into a hook, deliver `access.js` to the iframe, add telemetry, or touch prompts. Those are follow-on plans:

- _Slice 2_ — bridge delivery of `access.js` source to the sandbox (`accessFnCid` in mount params, request-on-missing, replay on reconnect).
- _Slice 3_ — `useVibe()` hook surface (`{ me, can, ready }`) wiring the runner to `grants` + `adminMode` + pending, plus `unknown` telemetry.
- _Slice 4_ — prompt/guidance update (the reversible new-apps experiment).

Slice 1 is independently valuable and testable: a pure function with a server-parity fixture matrix.

---

## Reference: server semantics this slice mirrors (read before starting)

- Export extraction: [`access-function.ts:100-146`](../../../vibes.diy/api/svc/public/access-function.ts) (`extractExportSource`).
- Invocation construction (named / anon / arrow / legacy-body): [`workers/access-fn.ts:150-158`](../../../vibes.diy/pkg/workers/access-fn.ts).
- Error → reason mapping: [`workers/access-fn.ts:160-168`](../../../vibes.diy/pkg/workers/access-fn.ts) — object with `forbidden` → that string; string → itself; else generic.
- `ctx` helpers (anon → `authentication required` BEFORE membership; `adminMode` no-op): [`cf-serve.ts:282-310`](../../../vibes.diy/api/svc/cf-serve.ts) / [`workers/access-fn.ts:107-135`](../../../vibes.diy/pkg/workers/access-fn.ts).
- Write post-checks, in order — forbidden, then `enforceAllowAnonymous`, then `isReadableResult`: [`app-documents-write-eventos.ts:310-349`](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts) and [`access-function.ts:29-47`](../../../vibes.diy/api/svc/public/access-function.ts).
- Read gate: [`channel-read-filter.ts`](../../../vibes.diy/api/svc/public/channel-read-filter.ts) — intersect **stored access-output channels** (by `docId`) with `effective ∪ public`; `adminOverride` returns all.

## File Structure

- Create `vibes.diy/vibe/runtime/access-extract.ts` — pure port of `extractExportSource` (no imports). One responsibility: find the bound export's source.
- Create `vibes.diy/vibe/runtime/access-runner.ts` — `makeClientCtx`, `evaluateWrite`, `canSeeDoc`, and the shared types. Imports only `access-extract.ts`.
- Modify `vibes.diy/vibe/runtime/index.ts` — re-export the runner's public API.
- Create `vibes.diy/api/tests/access-runner.test.ts` — unit tests (imports the runtime source by relative path; reuses the existing api-test Vitest harness).
- Create `vibes.diy/api/tests/access-runner-parity.test.ts` — parity matrix + extractor parity vs the server.

All test commands run from `vibes.diy/api/tests` (its `test` script is `vitest --run`).

---

### Task 1: Port the export extractor

**Files:**

- Create: `vibes.diy/vibe/runtime/access-extract.ts`
- Test: `vibes.diy/api/tests/access-runner.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/api/tests/access-runner.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractExportSource } from "../../vibe/runtime/access-extract.js";

describe("extractExportSource (runtime port)", () => {
  it("extracts a named export by db name", () => {
    const src = `export function notes(doc, oldDoc, user, ctx) { return { channels: ["n"] }; }`;
    const out = extractExportSource(src, "notes");
    expect(out).toBe(`function notes(doc, oldDoc, user, ctx) { return { channels: ["n"] }; }`);
  });

  it("extracts a default export for '*'", () => {
    const src = `export default function (doc) { return {}; }`;
    expect(extractExportSource(src, "*")).toBe(`function (doc) { return {}; }`);
  });

  it("returns undefined when the named export is absent", () => {
    const src = `export function other(doc) { return {}; }`;
    expect(extractExportSource(src, "notes")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner.test.ts`
Expected: FAIL — cannot resolve `../../vibe/runtime/access-extract.js`.

- [ ] **Step 3: Create the module**

Create `vibes.diy/vibe/runtime/access-extract.ts` by copying the pure implementation from [`access-function.ts:100-146`](../../../vibes.diy/api/svc/public/access-function.ts) verbatim (the three functions `extractExportSource`, `escapeRegExp`, `extractByPattern`), exporting only `extractExportSource`:

```ts
// Pure, browser-safe port of the server's extractExportSource
// (vibes.diy/api/svc/public/access-function.ts). Kept byte-identical in
// behavior; enforced by access-runner-parity.test.ts. No imports.
export function extractExportSource(fullSource: string, bindingDbName: string): string | undefined {
  if (bindingDbName === "*") {
    return extractByPattern(
      fullSource,
      /export\s+default\s+(?:function\s*(?:\w+\s*)?\([^)]*\)\s*\{|\([^)]*\)\s*=>\s*\{|\w+\s*=>\s*\{)/,
      true
    );
  }
  const directPattern = new RegExp(`export\\s+function\\s+${escapeRegExp(bindingDbName)}\\s*\\([^)]*\\)\\s*\\{`);
  const direct = extractByPattern(fullSource, directPattern, false);
  if (direct) return direct;
  const asMatch = fullSource.match(new RegExp(`export\\s*\\{\\s*(\\w+)\\s+as\\s+["']${escapeRegExp(bindingDbName)}["']\\s*\\}`));
  if (asMatch) {
    const localName = asMatch[1];
    const fnPattern = new RegExp(`function\\s+${localName}\\s*\\([^)]*\\)\\s*\\{`);
    return extractByPattern(fullSource, fnPattern, false);
  }
  return undefined;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractByPattern(fullSource: string, pattern: RegExp, isDefault: boolean): string | undefined {
  const match = fullSource.match(pattern);
  if (!match || match.index === undefined) return undefined;
  const start = match.index;
  let depth = 0;
  let end = start;
  for (let i = start; i < fullSource.length; i++) {
    if (fullSource[i] === "{") depth++;
    if (fullSource[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  let extracted = fullSource.slice(start, end).replace(/^export\s+/, "");
  if (isDefault) extracted = extracted.replace(/^default\s+/, "");
  return extracted;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/access-extract.ts vibes.diy/api/tests/access-runner.test.ts
git commit -m "feat(vibe-runtime): browser-safe access.js export extractor"
```

---

### Task 2: `ctx` shim mirroring the production QuickJS helpers

**Files:**

- Create: `vibes.diy/vibe/runtime/access-runner.ts`
- Test: `vibes.diy/api/tests/access-runner.test.ts:append`

- [ ] **Step 1: Write the failing test** — append to `access-runner.test.ts`:

```ts
import { makeClientCtx } from "../../vibe/runtime/access-runner.js";

describe("makeClientCtx", () => {
  const grants = { channels: ["eng"], publicChannels: [], roles: ["mod"] };

  it("anon fails requireAccess with 'authentication required' (before membership)", () => {
    const ctx = makeClientCtx(null, grants, false);
    expect(() => ctx.requireAccess("eng")).toThrow();
    try {
      ctx.requireAccess("eng");
    } catch (e: any) {
      expect(e.forbidden).toBe("authentication required");
    }
  });

  it("signed-in non-member fails with 'not in channel: X'", () => {
    const ctx = makeClientCtx({ userHandle: "a", isOwner: false }, grants, false);
    try {
      ctx.requireAccess("ops");
    } catch (e: any) {
      expect(e.forbidden).toBe("not in channel: ops");
    }
  });

  it("member passes requireAccess and requireRole", () => {
    const ctx = makeClientCtx({ userHandle: "a", isOwner: false }, grants, false);
    expect(() => ctx.requireAccess("eng")).not.toThrow();
    expect(() => ctx.requireRole("mod")).not.toThrow();
  });

  it("adminMode bypasses both checks even for anon", () => {
    const ctx = makeClientCtx(null, { channels: [], publicChannels: [], roles: [] }, true);
    expect(() => ctx.requireAccess("anything")).not.toThrow();
    expect(() => ctx.requireRole("anything")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner.test.ts`
Expected: FAIL — cannot resolve `access-runner.js`.

- [ ] **Step 3: Create `access-runner.ts` with the types + shim**

```ts
import { extractExportSource } from "./access-extract.js";

export interface AccessUser {
  userHandle: string;
  displayName?: string;
  isOwner: boolean;
}
export interface AccessGrants {
  channels: string[];
  publicChannels: string[];
  roles: string[];
}
export interface AccessCtx {
  requireAccess(channelId: string): void;
  requireRole(roleName: string): void;
}

// Mirrors the production QuickJS helpers (cf-serve.ts / workers/access-fn.ts):
// adminMode no-ops; anon throws "authentication required" BEFORE membership.
export function makeClientCtx(user: AccessUser | null, grants: AccessGrants, adminMode: boolean): AccessCtx {
  return {
    requireAccess(channelId: string): void {
      if (adminMode) return;
      if (!user) throw { forbidden: "authentication required" };
      if (!grants.channels.includes(channelId)) throw { forbidden: `not in channel: ${channelId}` };
    },
    requireRole(roleName: string): void {
      if (adminMode) return;
      if (!user) throw { forbidden: "authentication required" };
      if (!grants.roles.includes(roleName)) throw { forbidden: `not in role: ${roleName}` };
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/access-runner.ts vibes.diy/api/tests/access-runner.test.ts
git commit -m "feat(vibe-runtime): ctx shim mirroring production QuickJS auth semantics"
```

---

### Task 3: `evaluateWrite` — invoke + wrapper parity

**Files:**

- Modify: `vibes.diy/vibe/runtime/access-runner.ts`
- Test: `vibes.diy/api/tests/access-runner.test.ts:append`

- [ ] **Step 1: Write the failing test** — append:

```ts
import { evaluateWrite } from "../../vibe/runtime/access-runner.js";

const G = { channels: ["board"], publicChannels: [], roles: [] };
const ownerOnly = `export function db(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };
  if (!user.isOwner) throw { forbidden: "owner only" };
  return { channels: ["board"], grant: { public: ["board"] } };
}`;

describe("evaluateWrite", () => {
  it("owner → ok", () => {
    const v = evaluateWrite({
      source: ownerOnly,
      dbName: "db",
      doc: { type: "tile" },
      oldDoc: null,
      user: { userHandle: "o", isOwner: true },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ ok: true });
  });

  it("signed-in non-owner → owner only", () => {
    const v = evaluateWrite({
      source: ownerOnly,
      dbName: "db",
      doc: { type: "tile" },
      oldDoc: null,
      user: { userHandle: "x", isOwner: false },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ ok: false, reason: "owner only", code: "access-denied" });
  });

  it("anon → sign in (the access fn's own throw)", () => {
    const v = evaluateWrite({
      source: ownerOnly,
      dbName: "db",
      doc: { type: "tile" },
      oldDoc: null,
      user: null,
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ ok: false, reason: "sign in", code: "access-denied" });
  });

  it("anon + no allowAnonymous → authentication required (enforceAllowAnonymous)", () => {
    const src = `export function db(doc, oldDoc, user, ctx) { return { channels: ["c"] }; }`;
    const v = evaluateWrite({ source: src, dbName: "db", doc: {}, oldDoc: null, user: null, grants: G, adminMode: false });
    expect(v).toEqual({ ok: false, reason: "authentication required", code: "access-denied" });
  });

  it("zero-channel result → unreadable", () => {
    const src = `export function db(doc, oldDoc, user, ctx) { return {}; }`;
    const v = evaluateWrite({
      source: src,
      dbName: "db",
      doc: {},
      oldDoc: null,
      user: { userHandle: "x", isOwner: false },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ ok: false, reason: "unreadable write", code: "unreadable" });
  });

  it("missing export → unknown", () => {
    const v = evaluateWrite({
      source: `export function other(){}`,
      dbName: "db",
      doc: {},
      oldDoc: null,
      user: { userHandle: "x", isOwner: false },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ unknown: true, reason: "access function not found" });
  });

  it("async access fn → unknown", () => {
    const src = `export function db(doc, oldDoc, user, ctx) { return Promise.resolve({ channels: ["c"] }); }`;
    const v = evaluateWrite({
      source: src,
      dbName: "db",
      doc: {},
      oldDoc: null,
      user: { userHandle: "x", isOwner: false },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ unknown: true, reason: "async access function" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner.test.ts`
Expected: FAIL — `evaluateWrite` is not exported.

- [ ] **Step 3: Add `evaluateWrite` to `access-runner.ts`**

```ts
export type WriteVerdict =
  | { ok: true }
  | { ok: false; reason: string; code: "access-denied" | "unreadable" }
  | { unknown: true; reason: string };

export interface EvaluateWriteArgs {
  source: string;
  dbName: string;
  doc: unknown;
  oldDoc: unknown;
  user: AccessUser | null;
  grants: AccessGrants;
  adminMode: boolean;
}

type Invoker = (doc: unknown, oldDoc: unknown, user: AccessUser | null, ctx: AccessCtx) => unknown;

// Mirrors workers/access-fn.ts:150-158 — named fn / anon fn / arrow / legacy body.
function buildInvoker(extracted: string): Invoker {
  const cleanSource = extracted.replace(/export\s+/g, "").replace(/^default\s+/, "");
  const fnNameMatch = cleanSource.match(/^function\s+(\w+)\s*\(/);
  const isAnonymousFnOrArrow = /^function\s*\(/.test(cleanSource) || /^\(/.test(cleanSource) || /^\w+\s*=>/.test(cleanSource);
  const body = fnNameMatch
    ? `${cleanSource}\n; return ${fnNameMatch[1]}(doc, oldDoc, user, ctx);`
    : isAnonymousFnOrArrow
      ? `const __accessFn = ${cleanSource}\n; return __accessFn(doc, oldDoc, user, ctx);`
      : `return (function () { ${cleanSource} })();`;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function("doc", "oldDoc", "user", "ctx", body) as Invoker;
}

function forbiddenReason(err: unknown): string | null {
  if (err && typeof err === "object" && "forbidden" in err) return String((err as Record<string, unknown>).forbidden);
  if (typeof err === "string") return err;
  return null;
}

export function evaluateWrite(args: EvaluateWriteArgs): WriteVerdict {
  const { source, dbName, doc, oldDoc, user, grants, adminMode } = args;

  const extracted = extractExportSource(source, dbName);
  if (extracted === undefined) return { unknown: true, reason: "access function not found" };

  let invoker: Invoker;
  try {
    invoker = buildInvoker(extracted);
  } catch {
    return { unknown: true, reason: "access function did not compile" };
  }

  const ctx = makeClientCtx(user, grants, adminMode);
  let result: unknown;
  try {
    result = invoker(doc, oldDoc, user, ctx);
  } catch (err) {
    const reason = forbiddenReason(err);
    if (reason === null) return { unknown: true, reason: "access function threw a non-forbidden error" };
    return { ok: false, reason, code: "access-denied" };
  }

  if (result && typeof (result as { then?: unknown }).then === "function") {
    return { unknown: true, reason: "async access function" };
  }

  const descriptor = (result ?? {}) as { channels?: unknown; allowAnonymous?: unknown };

  // enforceAllowAnonymous (access-function.ts:29-33)
  if (user === null && !descriptor.allowAnonymous) {
    return { ok: false, reason: "authentication required", code: "access-denied" };
  }

  // isReadableResult (access-function.ts:45-47)
  if (!(Array.isArray(descriptor.channels) && descriptor.channels.length > 0)) {
    return { ok: false, reason: "unreadable write", code: "unreadable" };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner.test.ts`
Expected: PASS (all `evaluateWrite` cases).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/access-runner.ts vibes.diy/api/tests/access-runner.test.ts
git commit -m "feat(vibe-runtime): evaluateWrite dry-run with server wrapper parity"
```

---

### Task 4: `canSeeDoc` — read visibility over stored output channels

**Files:**

- Modify: `vibes.diy/vibe/runtime/access-runner.ts`
- Test: `vibes.diy/api/tests/access-runner.test.ts:append`

- [ ] **Step 1: Write the failing test** — append:

```ts
import { canSeeDoc } from "../../vibe/runtime/access-runner.js";

describe("canSeeDoc", () => {
  const grants = { channels: ["board"], publicChannels: ["news"], roles: [] };
  const outputs = new Map<string, string[]>([
    ["d1", ["board"]],
    ["d2", ["secret"]],
    ["d3", ["news"]],
  ]);

  it("true when a stored channel is in effective grants", () => {
    expect(canSeeDoc({ doc: { _id: "d1" }, outputChannels: outputs, grants, adminOverride: false })).toBe(true);
  });
  it("true via public channel", () => {
    expect(canSeeDoc({ doc: { _id: "d3" }, outputChannels: outputs, grants, adminOverride: false })).toBe(true);
  });
  it("false when no stored channel intersects", () => {
    expect(canSeeDoc({ doc: { _id: "d2" }, outputChannels: outputs, grants, adminOverride: false })).toBe(false);
  });
  it("false when the doc has no stored channels", () => {
    expect(canSeeDoc({ doc: { _id: "dX" }, outputChannels: outputs, grants, adminOverride: false })).toBe(false);
  });
  it("true under adminOverride regardless of channels", () => {
    expect(canSeeDoc({ doc: { _id: "dX" }, outputChannels: outputs, grants, adminOverride: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner.test.ts`
Expected: FAIL — `canSeeDoc` is not exported.

- [ ] **Step 3: Add `canSeeDoc` to `access-runner.ts`**

```ts
export interface CanSeeArgs {
  doc: { _id: string };
  // Stored access-fn output channels by docId (NOT a field on the doc).
  outputChannels: Map<string, string[]> | undefined;
  grants: AccessGrants;
  adminOverride: boolean;
}

// Mirrors filterDocsByChannel (channel-read-filter.ts): admin sees all; else a
// doc is visible iff its STORED output channels intersect effective ∪ public.
// A doc with no stored channels is invisible. No owner read bypass.
export function canSeeDoc({ doc, outputChannels, grants, adminOverride }: CanSeeArgs): boolean {
  if (adminOverride) return true;
  const channels = outputChannels?.get(doc._id);
  if (!channels) return false;
  return channels.some((ch) => grants.channels.includes(ch) || grants.publicChannels.includes(ch));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/access-runner.ts vibes.diy/api/tests/access-runner.test.ts
git commit -m "feat(vibe-runtime): canSeeDoc read-visibility over stored output channels"
```

---

### Task 5: Export the runner + extractor-parity guard vs the server

**Files:**

- Modify: `vibes.diy/vibe/runtime/index.ts`
- Create: `vibes.diy/api/tests/access-runner-parity.test.ts`

- [ ] **Step 1: Write the failing parity test**

Create `vibes.diy/api/tests/access-runner-parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractExportSource as serverExtract } from "../svc/public/access-function.js";
import { extractExportSource as clientExtract } from "../../vibe/runtime/access-extract.js";

const SOURCES: Array<[string, string]> = [
  [`export function notes(doc, oldDoc, user, ctx) { return { channels: ["n"] }; }`, "notes"],
  [`export default function (doc) { return {}; }`, "*"],
  [`export default (doc) => { return { channels: ["c"] }; }`, "*"],
  [`function chat(doc) { return {}; }\nexport { chat as "chat-db" }`, "chat-db"],
  [`export function a(){return{}}\nexport function b(){return{channels:["x"]}}`, "b"],
];

describe("extractor parity: runtime port === server", () => {
  for (const [src, db] of SOURCES) {
    it(`matches for db="${db}"`, () => {
      expect(clientExtract(src, db)).toBe(serverExtract(src, db));
    });
  }
});
```

- [ ] **Step 2: Run to verify it passes** (both extractors already exist; this guards against future drift)

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner-parity.test.ts`
Expected: PASS. If any case differs, the port drifted from the server — fix the port to match.

- [ ] **Step 3: Export the public API from the runtime index**

In `vibes.diy/vibe/runtime/index.ts`, add (match the file's existing export style):

```ts
export { evaluateWrite, canSeeDoc, makeClientCtx, type AccessUser, type AccessGrants, type WriteVerdict } from "./access-runner.js";
```

- [ ] **Step 4: Verify the runtime package type-checks with the new module**

Run: `pnpm --filter @vibes.diy/vibe-runtime build`
Expected: build succeeds (no TS errors). If lint flags `new Function`, confirm the `eslint-disable-next-line` comment from Task 3 is present on that line.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/index.ts vibes.diy/api/tests/access-runner-parity.test.ts
git commit -m "feat(vibe-runtime): export access runner + server extractor-parity guard"
```

---

### Task 6: Verdict parity matrix (the spec's §parity matrix)

**Files:**

- Modify: `vibes.diy/api/tests/access-runner-parity.test.ts:append`

- [ ] **Step 1: Write the matrix test** — append to `access-runner-parity.test.ts`:

```ts
import { evaluateWrite } from "../../vibe/runtime/access-runner.js";

// Channel-gated write: only channel members may post; anon hits requireAccess.
const channelDb = `export function db(doc, oldDoc, user, ctx) {
  if (doc.type === "msg") { ctx.requireAccess(doc.channelId); return { channels: [doc.channelId] }; }
  throw { forbidden: "unknown document type" };
}`;
const member = { userHandle: "m", isOwner: false };
const grants = (chs: string[]) => ({ channels: chs, publicChannels: [], roles: [] });

describe("verdict parity matrix", () => {
  it("member in channel → ok", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "msg", channelId: "eng" },
        oldDoc: null,
        user: member,
        grants: grants(["eng"]),
        adminMode: false,
      })
    ).toEqual({ ok: true });
  });
  it("non-member → not in channel", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "msg", channelId: "eng" },
        oldDoc: null,
        user: member,
        grants: grants([]),
        adminMode: false,
      })
    ).toEqual({ ok: false, reason: "not in channel: eng", code: "access-denied" });
  });
  it("anon at a requireAccess gate → authentication required", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "msg", channelId: "eng" },
        oldDoc: null,
        user: null,
        grants: grants([]),
        adminMode: false,
      })
    ).toEqual({ ok: false, reason: "authentication required", code: "access-denied" });
  });
  it("adminMode bypasses the channel gate", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "msg", channelId: "eng" },
        oldDoc: null,
        user: member,
        grants: grants([]),
        adminMode: true,
      })
    ).toEqual({ ok: true });
  });
  it("unknown doc type → its own forbidden reason", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "other" },
        oldDoc: null,
        user: member,
        grants: grants(["eng"]),
        adminMode: false,
      })
    ).toEqual({ ok: false, reason: "unknown document type", code: "access-denied" });
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner-parity.test.ts`
Expected: PASS (extractor parity + matrix).

- [ ] **Step 3: Run both runner test files together**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run access-runner`
Expected: PASS (both `access-runner.test.ts` and `access-runner-parity.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/tests/access-runner-parity.test.ts
git commit -m "test(vibe-runtime): verdict parity matrix for the access runner"
```

---

## Self-Review

**1. Spec coverage (slice 1 only):**

- Dry-run + wrapper (`enforceAllowAnonymous`, `isReadableResult`), in order → Task 3. ✅
- `ctx` shim mirroring the **QuickJS** path (anon `authentication required`, `adminMode` bypass) → Task 2, with the Codex parity fix baked into the tests. ✅
- Frozen `ctx` (only `requireAccess`/`requireRole`); everything else → `unknown` → Tasks 2–3 (`unknown` on missing export / compile error / async / non-forbidden throw). ✅
- `can.see` over **stored output channels**, admin override, no owner bypass → Task 4. ✅
- Reason shape `{ ok, reason, code? }` → Task 3 (`code: "access-denied" | "unreadable"`). ✅
- Parity locked by a fixture matrix + extractor parity vs the server → Tasks 5–6. ✅
- Out of slice (later plans): bridge delivery, `useVibe()` hook, telemetry, prompts — listed in Scope. ✅

**2. Placeholder scan:** every code step contains complete, runnable code; every run step has an exact command + expected result. No TBD/“handle edge cases”. ✅

**3. Type consistency:** `AccessUser`, `AccessGrants`, `AccessCtx`, `WriteVerdict`, `EvaluateWriteArgs`, `CanSeeArgs` defined in Task 2/3/4 and reused verbatim in tests and the index export (Task 5). `evaluateWrite` / `canSeeDoc` / `makeClientCtx` names are consistent across tasks. ✅

**Risk note for the implementer:** the runner deliberately mirrors the server's _current_ behavior, including that a zero-channel result is `unreadable` even with `allowAnonymous` (the server applies both checks). If a runner verdict disagrees with the server on a real `access.js`, treat the **server as truth** and fix the runner — never adjust the server to match the predictor.
