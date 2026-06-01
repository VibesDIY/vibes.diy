# Firefly Grant Reduce + Channel Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize channel/role memberships from access function outputs and make `requireAccess`/`requireRole` enforce them, with per-database access function binding via named exports in `access.js`.

**Architecture:** AccessFnDO becomes per-database and stateful, holding an in-memory grant reduce (union of all access function outputs). The reduce is populated via a needsHydrate protocol on first request and updated incrementally per write. Push-time export parsing extracts named exports from access.js and creates per-db binding rows.

**Tech Stack:** QuickJS WASM (`@cf-wasm/quickjs`), Cloudflare Durable Objects (`blockConcurrencyWhile`), Drizzle ORM

**Spec:** `docs/superpowers/specs/2026-05-31-firefly-grant-reduce-design.md`

---

## File Structure

| File                                                       | Responsibility                                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New: `vibes.diy/api/svc/public/grant-reduce.ts`            | Pure grant reduce logic: DocContribution type, addContribution, removeContribution, resolveEffectiveChannels, extractContribution. No DO/QuickJS deps — testable in Node. |
| Modify: `vibes.diy/pkg/workers/access-fn.ts`               | AccessFnDO: add instance state, hydrate endpoint, host function registration, incremental reduce                                                                          |
| Modify: `vibes.diy/api/svc/public/ensure-app-slug-item.ts` | Parse access.js exports at push time, create per-db binding rows                                                                                                          |
| Modify: `vibes.diy/api/svc/public/app-documents.ts`        | Change DO key to per-db, handle needsHydrate, send hydrate                                                                                                                |
| Modify: `vibes.diy/api/svc/cf-serve.ts`                    | Update invokeAccessFn to pass dbName, ownerHandle, appSlug                                                                                                                |
| Modify: `vibes.diy/api/svc/types.ts`                       | Update invokeAccessFn type signature                                                                                                                                      |
| New: `vibes.diy/api/tests/access-fn-reduce.test.ts`        | Unit tests for grant reduce logic                                                                                                                                         |
| Modify: `vibes.diy/api/tests/access-fn-unit.test.ts`       | Add host function tests                                                                                                                                                   |
| Modify: `vibes.diy/api/tests/access-fn-invoke.test.ts`     | Update for hydration protocol                                                                                                                                             |

---

### Task 1: Grant Reduce — Pure Logic Module

The reduce logic is the foundation. Build and test it in isolation before touching the DO.

**Files:**

- Create: `vibes.diy/api/svc/public/grant-reduce.ts`
- Create: `vibes.diy/api/tests/access-fn-reduce.test.ts`

- [ ] **Step 1: Write failing tests for the reduce module**

Create `vibes.diy/api/tests/access-fn-reduce.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GrantReduce, extractContribution } from "../svc/public/grant-reduce.js";
import type { AccessDescriptor } from "@vibes.diy/api-types";

describe("GrantReduce", () => {
  it("union: two docs granting same channel to different users", () => {
    const reduce = new GrantReduce();
    const desc1: AccessDescriptor = {
      grant: { users: { alice: ["chan-general"] } },
    };
    const desc2: AccessDescriptor = {
      grant: { users: { bob: ["chan-general"] } },
    };
    reduce.addDoc("doc1", extractContribution(desc1));
    reduce.addDoc("doc2", extractContribution(desc2));
    expect(reduce.resolveEffectiveChannels("alice").has("chan-general")).toBe(true);
    expect(reduce.resolveEffectiveChannels("bob").has("chan-general")).toBe(true);
    expect(reduce.resolveEffectiveChannels("carol").has("chan-general")).toBe(false);
  });

  it("subtract/rebuild: delete one doc removes its grants only", () => {
    const reduce = new GrantReduce();
    reduce.addDoc(
      "meta1",
      extractContribution({
        grant: { users: { alice: ["chan-general"], bob: ["chan-general"] } },
      })
    );
    reduce.addDoc(
      "invite1",
      extractContribution({
        grant: { users: { carol: ["chan-general"] } },
      })
    );
    expect(reduce.resolveEffectiveChannels("carol").has("chan-general")).toBe(true);
    reduce.removeDoc("invite1");
    expect(reduce.resolveEffectiveChannels("carol").has("chan-general")).toBe(false);
    expect(reduce.resolveEffectiveChannels("alice").has("chan-general")).toBe(true);
  });

  it("two-pass: role-channels + membership → user gets channels via role", () => {
    const reduce = new GrantReduce();
    reduce.addDoc(
      "role-channels",
      extractContribution({
        grant: { roles: { "design-team": ["design-general", "design-reviews"] } },
      })
    );
    reduce.addDoc(
      "membership",
      extractContribution({
        members: { "design-team": ["alice", "bob"] },
      })
    );
    expect(reduce.resolveEffectiveChannels("alice").has("design-general")).toBe(true);
    expect(reduce.resolveEffectiveChannels("alice").has("design-reviews")).toBe(true);
    expect(reduce.resolveEffectiveChannels("carol").has("design-general")).toBe(false);
  });

  it("role removal: delete membership → user loses role-expanded channels", () => {
    const reduce = new GrantReduce();
    reduce.addDoc(
      "role-channels",
      extractContribution({
        grant: { roles: { "design-team": ["design-general"] } },
      })
    );
    reduce.addDoc(
      "membership",
      extractContribution({
        members: { "design-team": ["alice"] },
      })
    );
    expect(reduce.resolveEffectiveChannels("alice").has("design-general")).toBe(true);
    reduce.removeDoc("membership");
    expect(reduce.resolveEffectiveChannels("alice").has("design-general")).toBe(false);
  });

  it("direct + role overlap: removing one doesn't remove the other", () => {
    const reduce = new GrantReduce();
    reduce.addDoc(
      "direct",
      extractContribution({
        grant: { users: { alice: ["chan-general"] } },
      })
    );
    reduce.addDoc(
      "role-channels",
      extractContribution({
        grant: { roles: { team: ["chan-general"] } },
      })
    );
    reduce.addDoc(
      "membership",
      extractContribution({
        members: { team: ["alice"] },
      })
    );
    expect(reduce.resolveEffectiveChannels("alice").has("chan-general")).toBe(true);
    reduce.removeDoc("direct");
    expect(reduce.resolveEffectiveChannels("alice").has("chan-general")).toBe(true);
  });

  it("empty reduce: no docs → no grants", () => {
    const reduce = new GrantReduce();
    expect(reduce.resolveEffectiveChannels("alice").size).toBe(0);
  });

  it("isHydrated tracks state", () => {
    const reduce = new GrantReduce();
    expect(reduce.isHydrated).toBe(false);
    reduce.markHydrated();
    expect(reduce.isHydrated).toBe(true);
  });

  it("hasRole checks effective members", () => {
    const reduce = new GrantReduce();
    reduce.addDoc(
      "m1",
      extractContribution({
        members: { admin: ["alice"] },
      })
    );
    expect(reduce.hasRole("alice", "admin")).toBe(true);
    expect(reduce.hasRole("bob", "admin")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd vibes.diy && pnpm vitest run api/tests/access-fn-reduce.test.ts`
Expected: FAIL — module `grant-reduce.js` does not exist yet.

- [ ] **Step 3: Implement the grant reduce module**

Create `vibes.diy/api/svc/public/grant-reduce.ts`:

```typescript
import type { AccessDescriptor } from "@vibes.diy/api-types";

export interface DocContribution {
  members: Map<string, Set<string>>;
  grantRoles: Map<string, Set<string>>;
  grantUsers: Map<string, Set<string>>;
  grantPublic: Set<string>;
}

export function extractContribution(desc: AccessDescriptor): DocContribution {
  const members = new Map<string, Set<string>>();
  if (desc.members) {
    for (const [role, slugs] of Object.entries(desc.members)) {
      members.set(role, new Set(slugs));
    }
  }

  const grantRoles = new Map<string, Set<string>>();
  if (desc.grant?.roles) {
    for (const [role, channels] of Object.entries(desc.grant.roles)) {
      grantRoles.set(role, new Set(channels));
    }
  }

  const grantUsers = new Map<string, Set<string>>();
  if (desc.grant?.users) {
    for (const [slug, channels] of Object.entries(desc.grant.users)) {
      grantUsers.set(slug, new Set(channels));
    }
  }

  const grantPublic = new Set<string>(desc.grant?.public ?? []);

  return { members, grantRoles, grantUsers, grantPublic };
}

function hasGrants(c: DocContribution): boolean {
  return c.members.size > 0 || c.grantRoles.size > 0 || c.grantUsers.size > 0 || c.grantPublic.size > 0;
}

export class GrantReduce {
  private docContributions = new Map<string, DocContribution>();
  private effectiveMembers = new Map<string, Set<string>>();
  private roleGrants = new Map<string, Set<string>>();
  private userGrants = new Map<string, Set<string>>();
  private publicChannels = new Set<string>();
  private _hydrated = false;

  get isHydrated(): boolean {
    return this._hydrated;
  }

  markHydrated(): void {
    this._hydrated = true;
  }

  addDoc(docId: string, contribution: DocContribution): void {
    if (!hasGrants(contribution)) return;
    const hadOld = this.docContributions.has(docId);
    this.docContributions.set(docId, contribution);
    if (hadOld) {
      this.rebuild();
    } else {
      this.unionContribution(contribution);
    }
  }

  removeDoc(docId: string): void {
    if (!this.docContributions.has(docId)) return;
    this.docContributions.delete(docId);
    this.rebuild();
  }

  resolveEffectiveChannels(userSlug: string): Set<string> {
    const channels = new Set<string>();
    const direct = this.userGrants.get(userSlug);
    if (direct) {
      for (const ch of direct) channels.add(ch);
    }
    for (const [role, members] of this.effectiveMembers) {
      if (members.has(userSlug)) {
        const roleChannels = this.roleGrants.get(role);
        if (roleChannels) {
          for (const ch of roleChannels) channels.add(ch);
        }
      }
    }
    return channels;
  }

  hasRole(userSlug: string, roleName: string): boolean {
    return this.effectiveMembers.get(roleName)?.has(userSlug) ?? false;
  }

  private rebuild(): void {
    this.effectiveMembers.clear();
    this.roleGrants.clear();
    this.userGrants.clear();
    this.publicChannels.clear();
    for (const c of this.docContributions.values()) {
      this.unionContribution(c);
    }
  }

  private unionContribution(c: DocContribution): void {
    for (const [role, slugs] of c.members) {
      let set = this.effectiveMembers.get(role);
      if (!set) {
        set = new Set();
        this.effectiveMembers.set(role, set);
      }
      for (const s of slugs) set.add(s);
    }
    for (const [role, channels] of c.grantRoles) {
      let set = this.roleGrants.get(role);
      if (!set) {
        set = new Set();
        this.roleGrants.set(role, set);
      }
      for (const ch of channels) set.add(ch);
    }
    for (const [slug, channels] of c.grantUsers) {
      let set = this.userGrants.get(slug);
      if (!set) {
        set = new Set();
        this.userGrants.set(slug, set);
      }
      for (const ch of channels) set.add(ch);
    }
    for (const ch of c.grantPublic) this.publicChannels.add(ch);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd vibes.diy && pnpm vitest run api/tests/access-fn-reduce.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write vibes.diy/api/svc/public/grant-reduce.ts vibes.diy/api/tests/access-fn-reduce.test.ts
git add vibes.diy/api/svc/public/grant-reduce.ts vibes.diy/api/tests/access-fn-reduce.test.ts
git commit -m "feat(firefly): add grant reduce module with unit tests

Pure logic for channel/role membership materialization. Union
contributions from access function outputs, re-reduce on subtract,
two-pass channel resolution through role expansion."
```

---

### Task 2: AccessFnDO — Stateful with Hydration Protocol

Rewrite the DO to hold reduce state, support `/invoke` and `/hydrate` endpoints, and register `ctx.requireAccess`/`ctx.requireRole` as QuickJS host functions.

**Files:**

- Modify: `vibes.diy/pkg/workers/access-fn.ts`

- [ ] **Step 1: Write the new AccessFnDO**

Replace `vibes.diy/pkg/workers/access-fn.ts` entirely. The new DO:

- Has instance state: `GrantReduce` instance, cached `source` string
- Routes `POST /invoke` and `POST /hydrate` via URL pathname
- `/invoke`: if not hydrated → return `{ needsHydrate: true }`; otherwise run access fn, update reduce, return result
- `/hydrate`: run access fn on every doc in the payload, build reduce, mark hydrated via `blockConcurrencyWhile`
- Registers `ctx.requireAccess` and `ctx.requireRole` as QuickJS host functions that check the reduce
- Source format: evaluates the function declaration string, then calls it with `(doc, oldDoc, user, ctx)`

```typescript
import { DurableObject, DurableObjectState, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import type { AccessDescriptor, UserContext } from "@vibes.diy/api-types";
import { getQuickJSWASMModule, type QuickJSContext } from "@cf-wasm/quickjs";
import { GrantReduce, extractContribution } from "@vibes.diy/api-svc";

declare const Response: typeof CFResponse;

const JSON_HEADERS = { "Content-Type": "application/json" };

function respondJson(data: unknown, status = 200): CFResponse {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

interface InvokeBody {
  doc: unknown;
  oldDoc: unknown | null;
  user: UserContext | null;
  source: string;
  docId?: string;
  isDelete?: boolean;
}

interface HydrateBody {
  docs: { _id: string; data: unknown }[];
  source: string;
}

export class AccessFnDO implements DurableObject {
  private reduce = new GrantReduce();
  private cachedSource: string | null = null;
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    if (request.method !== "POST") {
      return new Response("expected POST", { status: 400 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/hydrate") {
      return this.handleHydrate(request);
    }
    if (path === "/invoke") {
      return this.handleInvoke(request);
    }
    return new Response("unknown endpoint", { status: 404 });
  }

  private async handleHydrate(request: CFRequest): Promise<CFResponse> {
    let body: HydrateBody;
    try {
      body = (await request.json()) as HydrateBody;
    } catch {
      return respondJson({ forbidden: "invalid hydrate body" }, 400);
    }

    if (!body.source || !Array.isArray(body.docs)) {
      return respondJson({ forbidden: "hydrate requires source and docs array" }, 400);
    }

    await this.state.blockConcurrencyWhile(async () => {
      this.cachedSource = body.source;
      this.reduce = new GrantReduce();
      const QuickJS = await getQuickJSWASMModule();

      for (const doc of body.docs) {
        const vm = QuickJS.newContext();
        try {
          const result = this.evalAccessFn(vm, body.source, doc.data, null, null);
          if (result && !("forbidden" in result)) {
            this.reduce.addDoc(doc._id, extractContribution(result));
          }
        } finally {
          vm.dispose();
        }
      }
      this.reduce.markHydrated();
    });

    return respondJson({ hydrated: true });
  }

  private async handleInvoke(request: CFRequest): Promise<CFResponse> {
    let body: InvokeBody;
    try {
      body = (await request.json()) as InvokeBody;
    } catch {
      return respondJson({ forbidden: "invalid request body" }, 400);
    }

    if (!this.reduce.isHydrated) {
      return respondJson({ needsHydrate: true });
    }

    if (!body.source) {
      return respondJson({ forbidden: "access function source not provided" }, 500);
    }

    this.cachedSource = body.source;

    const QuickJS = await getQuickJSWASMModule();
    const vm = QuickJS.newContext();

    try {
      const result = this.evalAccessFn(vm, body.source, body.doc, body.oldDoc, body.user);

      if (!result) {
        return respondJson({ forbidden: "access function returned no result" }, 500);
      }

      if ("forbidden" in result) {
        return respondJson(result, 500);
      }

      if (body.docId) {
        if (body.isDelete) {
          this.reduce.removeDoc(body.docId);
        } else {
          this.reduce.addDoc(body.docId, extractContribution(result));
        }
      }

      return respondJson(result);
    } finally {
      vm.dispose();
    }
  }

  private evalAccessFn(
    vm: QuickJSContext,
    source: string,
    doc: unknown,
    oldDoc: unknown | null,
    user: UserContext | null
  ): AccessDescriptor | { forbidden: string } | null {
    // Set up globals
    for (const stmt of [
      `const doc = ${JSON.stringify(doc)};`,
      `const oldDoc = ${JSON.stringify(oldDoc)};`,
      `const user = ${JSON.stringify(user)};`,
    ]) {
      const r = vm.evalCode(stmt);
      if (r.error) {
        const errVal = vm.dump(r.error);
        r.error.dispose();
        return { forbidden: `access function setup error: ${String(errVal)}` };
      }
      r.value.dispose();
    }

    // Register ctx with host functions
    const ctxObj = vm.newObject();
    const reduce = this.reduce;

    const requireAccessFn = vm.newFunction("requireAccess", (channelIdHandle) => {
      const channelId = vm.dump(channelIdHandle);
      if (!user) {
        return { error: vm.newError("authentication required") };
      }
      const channels = reduce.resolveEffectiveChannels(user.userHandle);
      if (!channels.has(channelId as string)) {
        return { error: vm.newError(`not in channel: ${channelId}`) };
      }
    });

    const requireRoleFn = vm.newFunction("requireRole", (roleNameHandle) => {
      const roleName = vm.dump(roleNameHandle);
      if (!user) {
        return { error: vm.newError("authentication required") };
      }
      if (!reduce.hasRole(user.userHandle, roleName as string)) {
        return { error: vm.newError(`not in role: ${roleName}`) };
      }
    });

    vm.setProp(ctxObj, "requireAccess", requireAccessFn);
    vm.setProp(ctxObj, "requireRole", requireRoleFn);
    vm.setProp(vm.global, "ctx", ctxObj);
    requireAccessFn.dispose();
    requireRoleFn.dispose();
    ctxObj.dispose();

    // Evaluate the function declaration and call it
    // Source is a stringified function declaration like:
    //   function chat(doc, oldDoc, user, ctx) { ... }
    // We evaluate it and then call it.
    const fnResult = vm.evalCode(`${source}\n;(${this.extractFnName(source)})(doc, oldDoc, user, ctx)`);

    if (fnResult.error) {
      const errVal = vm.dump(fnResult.error);
      fnResult.error.dispose();
      return { forbidden: `access function error: ${String(errVal)}` };
    }

    const result = vm.dump(fnResult.value);
    fnResult.value.dispose();
    return result as AccessDescriptor | null;
  }

  private extractFnName(source: string): string {
    const match = source.match(/^function\s+(\w+)/);
    return match?.[1] ?? "__accessFn";
  }
}
```

**Note:** The `extractFnName` helper parses the function name from the stringified function declaration. The source comes from `Function.toString()` at push time, so it always starts with `function <name>(`.

- [ ] **Step 2: Export `GrantReduce` and `extractContribution` from `@vibes.diy/api-svc`**

Check how the api-svc package exports. Find the barrel file:

```bash
grep -rn "export.*from" vibes.diy/api/svc/index.ts | head -20
```

Add to the barrel file:

```typescript
export { GrantReduce, extractContribution } from "./public/grant-reduce.js";
export type { DocContribution } from "./public/grant-reduce.js";
```

- [ ] **Step 3: Run fast-check**

```bash
cd /path/to/worktree && pnpm fast-check
```

Fix any TypeScript errors. The main risk: `DurableObjectState` import and `blockConcurrencyWhile` types from `@cloudflare/workers-types`.

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write vibes.diy/pkg/workers/access-fn.ts
git add vibes.diy/pkg/workers/access-fn.ts vibes.diy/api/svc/index.ts
git commit -m "feat(firefly): stateful AccessFnDO with hydration protocol

Per-database DO with in-memory grant reduce. Supports /invoke and
/hydrate endpoints. blockConcurrencyWhile protects against thundering
herd during hydration. ctx.requireAccess and ctx.requireRole are
registered as QuickJS host functions checking the reduce."
```

---

### Task 3: Push-Time Export Parsing

Change `ensure-app-slug-item.ts` to parse named exports from access.js at push time and create per-db binding rows.

**Files:**

- Modify: `vibes.diy/api/svc/public/ensure-app-slug-item.ts`

- [ ] **Step 1: Define the JS global names blocklist**

Add a constant at the top of the module (or in `grant-reduce.ts` if preferred):

```typescript
const JS_PROTO_NAMES = new Set([
  "toString",
  "valueOf",
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);
```

- [ ] **Step 2: Replace the single-row upsert with export parsing**

Replace the block at lines 137-171 of `ensure-app-slug-item.ts`. The new logic:

1. Read the access.js source from `accessJsEntry.storage`
2. Evaluate in QuickJS to extract named exports
3. For each valid export name (not in `JS_PROTO_NAMES`, is a function): stringify the function and create a per-db binding row
4. Delete stale rows for exports that no longer exist
5. If access.js is absent, delete all binding rows for this app

```typescript
// Replace the existing access.js binding block with:
const accessJsEntry = fullFileSystem.find(
  (e) => e.vibeFileItem.filename === "/access.js" || e.vibeFileItem.filename.endsWith("/access.js")
);

const tAfb = vctx.sql.tables.accessFunctionBindings;

if (accessJsEntry) {
  const cid = accessJsEntry.storage.cid;
  if (!cid) {
    console.error(`ensureAppSlugItem: access.js has no CID for ${ensured.ownerHandle}/${ensured.appSlug}`);
  } else {
    try {
      // Read the source to parse exports
      const rFetch = await vctx.storage.fetch(accessJsEntry.storage.getURL);
      let accessJsSource: string | undefined;
      if (rFetch.type === "fetch.ok") {
        const reader = rFetch.data.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        accessJsSource = new TextDecoder().decode(merged);
      }

      if (accessJsSource) {
        // Parse exports using QuickJS
        const { getQuickJSWASMModule } = await import("@cf-wasm/quickjs");
        const QuickJS = await getQuickJSWASMModule();
        const vm = QuickJS.newContext();
        const exportNames: string[] = [];

        try {
          // Evaluate the module source (strip export keywords for QuickJS eval)
          const evalSource = accessJsSource.replace(/export\s+/g, "");
          const evalResult = vm.evalCode(evalSource);
          if (evalResult.error) {
            const err = vm.dump(evalResult.error);
            evalResult.error.dispose();
            console.warn(`ensureAppSlugItem: access.js parse failed: ${String(err)}`);
          } else {
            evalResult.value.dispose();

            // Extract function names by checking each identifier
            // Re-parse: find all "export function <name>" patterns
            const fnPattern = /export\s+function\s+(\w+)/g;
            let match: RegExpExecArray | null;
            while ((match = fnPattern.exec(accessJsSource)) !== null) {
              const name = match[1];
              if (name && !JS_PROTO_NAMES.has(name) && name !== "default") {
                // Verify it's a function in the VM
                const checkResult = vm.evalCode(`typeof ${name} === "function" ? ${name}.toString() : null`);
                if (!checkResult.error) {
                  const fnSource = vm.dump(checkResult.value);
                  checkResult.value.dispose();
                  if (typeof fnSource === "string") {
                    exportNames.push(name);
                  }
                } else {
                  checkResult.error.dispose();
                }
              }
            }
          }
        } finally {
          vm.dispose();
        }

        // Upsert one binding row per export
        for (const dbName of exportNames) {
          await vctx.sql.db
            .insert(tAfb)
            .values({
              userSlug: ensured.ownerHandle,
              appSlug: ensured.appSlug,
              dbName,
              accessFnCid: cid,
              accessFnAssetUri: accessJsEntry.storage.getURL,
              updated: new Date().toISOString(),
            })
            .onConflictDoUpdate({
              target: [tAfb.userSlug, tAfb.appSlug, tAfb.dbName],
              set: {
                accessFnCid: cid,
                accessFnAssetUri: accessJsEntry.storage.getURL,
                updated: new Date().toISOString(),
              },
            });
        }

        // Delete stale rows (exports that no longer exist)
        if (exportNames.length > 0) {
          await vctx.sql.db
            .delete(tAfb)
            .where(
              and(eq(tAfb.userSlug, ensured.ownerHandle), eq(tAfb.appSlug, ensured.appSlug), notInArray(tAfb.dbName, exportNames))
            );
        } else {
          // No valid exports → delete all bindings for this app
          await vctx.sql.db.delete(tAfb).where(and(eq(tAfb.userSlug, ensured.ownerHandle), eq(tAfb.appSlug, ensured.appSlug)));
        }
      }
    } catch (err: unknown) {
      console.warn(`ensureAppSlugItem: failed to process access.js for ${ensured.ownerHandle}/${ensured.appSlug}:`, err);
    }
  }
} else {
  // No access.js → delete all bindings for this app
  try {
    await vctx.sql.db.delete(tAfb).where(and(eq(tAfb.userSlug, ensured.ownerHandle), eq(tAfb.appSlug, ensured.appSlug)));
  } catch (err: unknown) {
    console.warn(
      `ensureAppSlugItem: failed to clean up AccessFunctionBindings for ${ensured.ownerHandle}/${ensured.appSlug}:`,
      err
    );
  }
}
```

- [ ] **Step 3: Add `notInArray` import if not already present**

Check Drizzle imports at the top of the file. Add `notInArray` to the destructure from `drizzle-orm` if missing.

- [ ] **Step 4: Run fast-check**

```bash
cd /path/to/worktree && pnpm fast-check
```

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write vibes.diy/api/svc/public/ensure-app-slug-item.ts
git add vibes.diy/api/svc/public/ensure-app-slug-item.ts
git commit -m "feat(firefly): parse access.js named exports at push time

Extracts named function exports from access.js, creates per-db
AccessFunctionBindings rows. Filters JS global names (toString,
constructor, etc). Deletes stale rows on export rename/removal."
```

---

### Task 4: Update Caller — app-documents.ts + cf-serve.ts + types.ts

Wire the per-database DO key and needsHydrate protocol into the write path.

**Files:**

- Modify: `vibes.diy/api/svc/types.ts` (lines 77-83)
- Modify: `vibes.diy/api/svc/cf-serve.ts` (lines 281-300)
- Modify: `vibes.diy/api/svc/public/app-documents.ts` (lines 181-275)

- [ ] **Step 1: Update the `invokeAccessFn` type signature**

In `vibes.diy/api/svc/types.ts`, replace lines 77-83:

```typescript
  invokeAccessFn?(params: {
    cid: string;
    doc: unknown;
    oldDoc: unknown | null;
    user: UserContext | null;
    source?: string;
    ownerHandle: string;
    appSlug: string;
    dbName: string;
    docId?: string;
    isDelete?: boolean;
  }): Promise<AccessDescriptor | { forbidden: string } | { needsHydrate: true }>;

  hydrateAccessFn?(params: {
    ownerHandle: string;
    appSlug: string;
    dbName: string;
    docs: { _id: string; data: unknown }[];
    source: string;
  }): Promise<{ hydrated: true }>;
```

- [ ] **Step 2: Update `cf-serve.ts` to derive DO ID from database identity**

Replace the `invokeAccessFn` block in `vibes.diy/api/svc/cf-serve.ts` (lines 281-300):

```typescript
    invokeAccessFn: async (params): Promise<AccessDescriptor | { forbidden: string } | { needsHydrate: true }> => {
      const doName = `${params.ownerHandle}/${params.appSlug}/${params.dbName}`;
      const id = env.ACCESS_FN_DO.idFromName(doName);
      const stub = env.ACCESS_FN_DO.get(id);
      const res = await stub.fetch(
        new Request("https://internal/invoke", {
          method: "POST",
          body: JSON.stringify({
            doc: params.doc,
            oldDoc: params.oldDoc,
            user: params.user,
            source: params.source,
            docId: params.docId,
            isDelete: params.isDelete,
          }),
          headers: { "Content-Type": "application/json" },
        }) as unknown as CFRequest
      );
      return res.json();
    },
    hydrateAccessFn: async (params) => {
      const doName = `${params.ownerHandle}/${params.appSlug}/${params.dbName}`;
      const id = env.ACCESS_FN_DO.idFromName(doName);
      const stub = env.ACCESS_FN_DO.get(id);
      const res = await stub.fetch(
        new Request("https://internal/hydrate", {
          method: "POST",
          body: JSON.stringify({ docs: params.docs, source: params.source }),
          headers: { "Content-Type": "application/json" },
        }) as unknown as CFRequest
      );
      return res.json();
    },
```

- [ ] **Step 3: Update `app-documents.ts` to handle needsHydrate**

Replace the invocation block in `app-documents.ts` (around lines 261-267). The new flow:

1. Call `invokeAccessFn` with db identity + docId
2. If response is `{ needsHydrate: true }`, fetch all docs for this db and call `hydrateAccessFn`
3. Then retry the invoke

```typescript
// Replace the invokeAccessFn call:
const invokeParams = {
  cid: afbRow.accessFnCid,
  doc: req.doc,
  oldDoc,
  user: userContext,
  source: accessFnSource,
  ownerHandle: req.ownerHandle,
  appSlug: req.appSlug,
  dbName: req.dbName,
  docId: req.docId,
};

let invokeResult = await vctx.invokeAccessFn(invokeParams);

// Handle hydration protocol
if (invokeResult && "needsHydrate" in invokeResult && vctx.hydrateAccessFn) {
  // Fetch all docs for this database
  const tDocs = vctx.sql.tables.appDocuments;
  const allDocs = await vctx.sql.db
    .select({ docId: tDocs.docId, data: tDocs.data })
    .from(tDocs)
    .where(and(eq(tDocs.ownerHandle, req.ownerHandle), eq(tDocs.appSlug, req.appSlug), eq(tDocs.dbName, req.dbName)));

  // Deduplicate to latest per docId (same logic as queryDocs)
  const latestByDocId = new Map<string, unknown>();
  for (const row of allDocs) {
    latestByDocId.set(row.docId, row.data);
  }

  const docs = Array.from(latestByDocId.entries()).map(([_id, data]) => ({ _id, data }));

  if (accessFnSource) {
    await vctx.hydrateAccessFn({
      ownerHandle: req.ownerHandle,
      appSlug: req.appSlug,
      dbName: req.dbName,
      docs,
      source: accessFnSource,
    });
  }

  // Retry invoke after hydration
  invokeResult = await vctx.invokeAccessFn(invokeParams);
}
```

Also update the `afbRow` query to remove the `"*"` wildcard fallback (lines 187-188):

```typescript
        // Replace: inArray(tAfb.dbName, [req.dbName, "*"])
        // With: eq(tAfb.dbName, req.dbName)
        .where(and(eq(tAfb.userSlug, req.ownerHandle), eq(tAfb.appSlug, req.appSlug), eq(tAfb.dbName, req.dbName)))
```

Remove the `orderBy` clause (line 188) since we're no longer falling back to `"*"`.

- [ ] **Step 4: Run fast-check**

```bash
cd /path/to/worktree && pnpm fast-check
```

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write vibes.diy/api/svc/types.ts vibes.diy/api/svc/cf-serve.ts vibes.diy/api/svc/public/app-documents.ts
git add vibes.diy/api/svc/types.ts vibes.diy/api/svc/cf-serve.ts vibes.diy/api/svc/public/app-documents.ts
git commit -m "feat(firefly): per-database DO key + needsHydrate protocol

invokeAccessFn now passes db identity (ownerHandle, appSlug, dbName)
and docId. cf-serve derives DO name from db identity instead of source
hash. app-documents handles needsHydrate by fetching all docs and
sending /hydrate before retrying."
```

---

### Task 5: Update Integration Tests

Update the existing integration tests for the new protocol and add hydration tests.

**Files:**

- Modify: `vibes.diy/api/tests/access-fn-invoke.test.ts`
- Modify: `vibes.diy/api/tests/access-fn-unit.test.ts`

- [ ] **Step 1: Update the mock invokeAccessFn in access-fn-invoke.test.ts**

The mock needs to match the new type signature (accepts `ownerHandle`, `appSlug`, `dbName`, `docId`, returns `{ needsHydrate: true }` on first call to test the protocol). Also add a `hydrateAccessFn` mock.

Update the `InvokeRecorder` interface and `setupCtx` function:

```typescript
interface InvokeRecorder {
  calls: { cid: string; user: unknown; dbName?: string }[];
  result: AccessDescriptor | { forbidden: string } | { needsHydrate: true };
  hydrateCount: number;
}

async function setupCtx(recorder: InvokeRecorder) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
    invokeAccessFn: async (params) => {
      recorder.calls.push({ cid: params.cid, user: params.user, dbName: params.dbName });
      return recorder.result;
    },
    hydrateAccessFn: async () => {
      recorder.hydrateCount++;
      return { hydrated: true as const };
    },
  });
  // ... rest same as before
```

Update the `seedBinding` call to use `dbName: "default"` (already does).

- [ ] **Step 2: Add a test for needsHydrate flow**

```typescript
it("handles needsHydrate by calling hydrateAccessFn then retrying", async () => {
  let callCount = 0;
  recorder.hydrateCount = 0;
  recorder.calls = [];
  // First call returns needsHydrate, second returns the real result
  const originalInvoke = recorder.result;
  // Override with a function that returns needsHydrate first time
  // (This needs the mock to be stateful — update setupCtx accordingly)
});
```

**Note:** The exact test shape depends on how the mock is structured. The key assertion: `recorder.hydrateCount === 1` after a write that triggers hydration.

- [ ] **Step 3: Run tests**

```bash
cd vibes.diy && pnpm vitest run api/tests/access-fn-invoke.test.ts api/tests/access-fn-unit.test.ts
```

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write vibes.diy/api/tests/access-fn-invoke.test.ts vibes.diy/api/tests/access-fn-unit.test.ts
git add vibes.diy/api/tests/access-fn-invoke.test.ts vibes.diy/api/tests/access-fn-unit.test.ts
git commit -m "test(firefly): update integration tests for hydration protocol

Mock invokeAccessFn matches new type signature with db identity and
docId. Add hydrateAccessFn mock and hydration flow test."
```

---

### Task 6: Full Check + Push

- [ ] **Step 1: Run pnpm fast-check**

```bash
cd /path/to/worktree && pnpm fast-check
```

Fix any failures.

- [ ] **Step 2: Review all commits**

```bash
git log --oneline -10
git diff origin/main...HEAD --stat
```

Verify no unintended files, no debug code, no TODO comments.

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat(firefly): grant reduce + channel enforcement (Phase 3)" --body "$(cat <<'EOF'
## Summary

- Grant reduce module: materialize channel/role memberships from access function outputs
- AccessFnDO is now per-database and stateful with in-memory reduce
- Hydration protocol with `blockConcurrencyWhile` thundering herd protection
- `ctx.requireAccess` and `ctx.requireRole` are QuickJS host functions checking the reduce
- Push-time export parsing: named exports in access.js bind to databases by name
- Zero overhead for databases without access functions

## Test plan

- [ ] Grant reduce unit tests (union, subtract, two-pass, role removal, overlap)
- [ ] Integration tests with hydration mock
- [ ] `pnpm fast-check` passes
- [ ] Deploy-preview passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
