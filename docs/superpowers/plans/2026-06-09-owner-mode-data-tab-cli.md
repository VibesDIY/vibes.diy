# Owner-mode data tab + CLI `db query` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a vibe owner see _all_ of their data — across every channel — from both the builder data tab and the `vibes-diy db query` CLI, by making the server read-path honor the existing `override` (admin) access level and having both surfaces request it.

**Architecture:** The owner bypass already exists end-to-end for writes via the connection-level `adminMode` flag (`whoAmI` → `WSSendProvider.adminMode` → `connectionAdminMode(ctx)` → `checkDocAccess` returns `override`). This plan (1) fixes the **read** path so `override` skips channel gating, then (2) makes the **data tab** db-explorer and (3) the **CLI** send `adminMode: true` on connect. The server fix is load-bearing and lands first.

**Tech Stack:** TypeScript, Drizzle, Evento WS handlers, ArkType wire types, Vitest. Spec: [docs/superpowers/specs/2026-06-09-owner-mode-data-tab-cli-design.md](../specs/2026-06-09-owner-mode-data-tab-cli-design.md). Issue: [#2278](https://github.com/VibesDIY/vibes.diy/issues/2278).

**Review decisions (CharlieHelps, [#2286](https://github.com/VibesDIY/vibes.diy/pull/2286)):** default-on `adminMode` (Q1), data tab **always owner-mode** (Q2), **connection-level** transport (Q3), `checkDocAccess` is the only `override` path (Q4), and — because no client-side owner gate exists today — the data tab must gate sending `adminMode: true` on **confirmed owner state** (Q5, Task 5). All five questions are resolved; the tasks below reflect those answers.

**Run tests from:** `vibes.diy/api/` — `pnpm vitest run tests/<file>` (see `package.json` test script for the exact config flag if `vitest` isn't a direct bin).

---

### Task 1: `filterDocsByChannel` honors admin override (unit)

**Files:**

- Modify: `vibes.diy/api/svc/public/channel-read-filter.ts`
- Test: `vibes.diy/api/tests/access-fn-channel-read-unit.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `vibes.diy/api/tests/access-fn-channel-read-unit.test.ts` inside the existing `describe("filterDocsByChannel (unit)", ...)` block:

```typescript
it("returns all docs unfiltered when adminOverride is true", () => {
  const docs = [
    { _id: "d1", title: "in-channel" },
    { _id: "d2", title: "secret-channel" },
  ];
  const outputs = [mkOutput("d1", { channels: ["general"] }), mkOutput("d2", { channels: ["secret"] })];
  const effectiveChannels = new Set(["general"]); // user only in "general"
  const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, new Set(), true);
  expect(result).toEqual(docs); // both returned despite "secret" not in effectiveChannels
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/api && pnpm vitest run tests/access-fn-channel-read-unit.test.ts`
Expected: FAIL — `filterDocsByChannel` ignores the 6th arg, so `d2` is filtered out (`result.length === 1`).

- [ ] **Step 3: Add the `adminOverride` parameter**

In `vibes.diy/api/svc/public/channel-read-filter.ts`, change the signature and add an early return:

```typescript
export function filterDocsByChannel(
  docs: Doc[],
  outputRows: OutputRow[],
  userHandle: string | null,
  effectiveChannels: Set<string>,
  publicChannels: Set<string>,
  adminOverride = false
): Doc[] {
  if (adminOverride) return docs;
  if (outputRows.length === 0) return docs;
  // ...rest unchanged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/api && pnpm vitest run tests/access-fn-channel-read-unit.test.ts`
Expected: PASS (all cases, including the new one).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/channel-read-filter.ts vibes.diy/api/tests/access-fn-channel-read-unit.test.ts
git commit -m "feat(firefly): filterDocsByChannel honors adminOverride bypass"
```

---

### Task 2: `queryDocs` + `getDoc` skip channel gating under `override`

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-read-eventos.ts` (queryDocs ~line 324; getDoc ~line 110)
- Test: `vibes.diy/api/tests/access-fn-channel-read.test.ts`

- [ ] **Step 1: Write the failing integration test**

Append a test to the `describe("channel-gated reads (integration)", ...)` block in `vibes.diy/api/tests/access-fn-channel-read.test.ts`. It reuses the existing `ownerApi`/`appSlug`/`ownerHandle`/`dbName` set up in `beforeAll`. The owner enables admin mode via `whoAmI`, then queries a db whose docs are gated to a channel the owner is NOT a member of, and expects to see them anyway:

```typescript
it("owner in adminMode sees docs across all channels (queryDocs)", async () => {
  // Owner turns on admin/override for this connection.
  const who = await ownerApi.whoAmI({ tid: crypto.randomUUID(), appSlug, ownerHandle, adminMode: true });
  assert(who.isOk(), "whoAmI adminMode should succeed");

  const r = await ownerApi.queryDocs({ appSlug, ownerHandle, dbName: "secret-room" });
  assert(r.isOk(), `queryDocs failed: ${r.isErr() ? r.Err().message : ""}`);
  const ids = r
    .Ok()
    .docs.map((d) => d._id)
    .sort();
  expect(ids).toContain("gated-doc"); // a doc whose access output channels exclude the owner
});
```

If `beforeAll` does not already seed a `secret-room` db with a doc gated to a non-owner channel, add that seeding to `beforeAll` mirroring the existing `ensureAppSlug` + `putDoc` calls, with the recorder returning `{ channels: ["vip"], allowAnonymous: false }` for that doc so the owner (not in `vip`) would normally be filtered out.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/api && pnpm vitest run tests/access-fn-channel-read.test.ts`
Expected: FAIL — owner is filtered out of `vip` channel; `ids` does not contain `gated-doc`.

- [ ] **Step 3: Thread `override` into both read handlers**

In `vibes.diy/api/svc/public/app-documents-read-eventos.ts`:

queryDocs — pass the override flag into the filter (~line 324):

```typescript
channelFilteredDocs = filterDocsByChannel(
  docs,
  allOutputs,
  userHandle,
  effectiveChannels,
  reduce.publicChannels,
  access === "override"
);
```

getDoc — guard the inline channel gate so it is skipped under override (~line 110):

```typescript
if (afbRowG?.accessFnCid && access !== "override") {
```

(`access` is already in scope in both handlers from the `checkDocAccess` call.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/api && pnpm vitest run tests/access-fn-channel-read.test.ts`
Expected: PASS — owner sees `gated-doc`. Pre-existing non-owner channel tests still pass.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-read-eventos.ts vibes.diy/api/tests/access-fn-channel-read.test.ts
git commit -m "feat(firefly): override access bypasses channel gating on getDoc/queryDocs"
```

---

### Task 3: Regression — non-owner adminMode is NOT elevated

**Files:**

- Test: `vibes.diy/api/tests/access-fn-channel-read.test.ts`

> **Test must isolate the channel filter, not the ACL gate** (per Codex review on this plan). A bare outsider with no read grant is rejected earlier by `readAllowed` (`canRead("none") || isPublicReadable(...)`), so `queryDocs` would return access-denied and the test would pass for the wrong reason — never exercising `filterDocsByChannel`. The outsider must clear the ACL gate (have read access) but be **out of the `vip` channel**, so that channel filtering is the _only_ thing that can exclude `gated-doc`.

- [ ] **Step 1: Write the test**

Add a test using a second, non-owner user (mirror the `mkUser` pattern already in the file with a distinct `seqOffset`). Grant that outsider read access to the db (via the same invite/grant path the existing collaborator tests in this suite use — keep them a non-`vip` reader), then have them send `whoAmI({ adminMode: true })` and confirm they are still channel-filtered:

```typescript
it("non-owner with read access + adminMode is still channel-gated (no override)", async () => {
  const { api: outsiderApi, user: outsider } = await mkUser(sthis, deviceCA, wsPair, 950);

  // Give the outsider plain read access so they clear the ACL gate — but NOT the "vip" channel.
  // Use the same grant mechanism the existing collaborator-read tests in this file use
  // (e.g. owner grants reader role / accepts invite for `outsider`), so readAllowed passes.
  await grantReader(ownerApi, { appSlug, ownerHandle, dbName: "secret-room", userHandle: outsider.handle });

  const who = await outsiderApi.whoAmI({ tid: crypto.randomUUID(), appSlug, ownerHandle, adminMode: true });
  assert(who.isOk());

  const r = await outsiderApi.queryDocs({ appSlug, ownerHandle, dbName: "secret-room" });
  assert(r.isOk(), "reader should clear the ACL gate (Ok), then be channel-filtered");
  const ids = r.Ok().docs.map((d) => d._id);
  expect(ids).not.toContain("gated-doc"); // filtered by channel — adminMode did NOT elevate a non-owner
});
```

`sthis`/`deviceCA`/`wsPair` must be reachable here; if `beforeAll` does not already hoist them to the describe scope, store them on describe-level `let` bindings when created (same pattern as `ownerApi`). Replace `grantReader(...)` with whatever read-grant helper/flow the existing collaborator tests in this file already use — do not invent a new grant API.

- [ ] **Step 2: Run test to verify it passes**

Run: `cd vibes.diy/api && pnpm vitest run tests/access-fn-channel-read.test.ts`
Expected: PASS — the read clears the ACL gate (`Ok`), and `checkDocAccess` returns `editor` (not `override`) for the non-owner regardless of `adminMode`, so `filterDocsByChannel` still excludes `gated-doc`. This guards the safety property in the spec. (Verify in the assertion message / run output that the result was `Ok`, not an access-denied error — otherwise the test isn't exercising the channel filter.)

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/access-fn-channel-read.test.ts
git commit -m "test(firefly): non-owner adminMode stays channel-gated"
```

---

### Task 4: CLI `db query` connects in admin/override mode

> Implements the **default-on** answer to spec Q1. If review chooses an explicit flag, add an `admin` boolean option to the command args instead and pass it through in place of the literal `true`.

**Files:**

- Modify: `vibes-diy/cli/cmds/db/query-cmd.ts` (handler ~lines 49–127)
- Modify: `vibes.diy/api/impl/firefly-api-adapter.ts` (constructor opts / connect path ~lines 36–99)
- Test: CLI command test alongside `query-cmd.ts` (match the existing `*-cmd.test.ts` pattern in `vibes-diy/cli/cmds/db/` if present; otherwise add `query-cmd.test.ts`)

- [ ] **Step 1: Write the failing test**

Assert that running `db query` issues a `whoAmI` with `adminMode: true` before `queryDocs`. Use the CLI's existing test harness (a `VibesDiyApi` over `TestWSPair`, as in `access-fn-channel-read.test.ts`). Seed a db with a doc gated to a channel the owner isn't in, run the query command as the owner, and assert the gated doc appears in the command's output.

```typescript
it("db query returns owner's docs across all channels", async () => {
  // ...seed owner app + a doc gated to "vip" (owner not in vip), per harness...
  const out = await runDbQuery({ appSlug, ownerHandle, dbName: "secret-room" }); // helper drives the cmd handler
  expect(out.docs.map((d) => d._id)).toContain("gated-doc");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes-diy/cli && pnpm vitest run cmds/db/query-cmd.test.ts`
Expected: FAIL — current handler never calls `whoAmI`, so the owner is channel-filtered and `gated-doc` is absent.

- [ ] **Step 3: Send adminMode on connect**

In `vibes.diy/api/impl/firefly-api-adapter.ts`, add an `adminMode?: boolean` to the adapter options and, when set, call `whoAmI({ adminMode: true })` once after the connection is established and before the first read. In `vibes-diy/cli/cmds/db/query-cmd.ts` (handler ~line 49), construct the adapter with `{ ownerHandle: rUser.Ok(), adminMode: true }`:

```typescript
const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { ownerHandle: rUser.Ok(), adminMode: true });
const r = await adapter.queryDocs(ctx.validated.dbName);
```

Adapter sketch (in `resolveOwnerHandle`/connect path):

```typescript
if (this.opts.adminMode) {
  await this.api.whoAmI({ tid: crypto.randomUUID(), appSlug: this.svc.vibeApp.appSlug, ownerHandle, adminMode: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes-diy/cli && pnpm vitest run cmds/db/query-cmd.test.ts`
Expected: PASS — gated doc now returned.

- [ ] **Step 5: Apply the same to `db get` / `db ls`**

For consistency (spec §3), construct their adapters with `adminMode: true` too. Add one assertion per command that an owner-gated doc / the full db list is returned. Run their test files; expect PASS.

- [ ] **Step 6: Commit**

```bash
git add vibes-diy/cli/cmds/db/ vibes.diy/api/impl/firefly-api-adapter.ts
git commit -m "feat(cli): db query/get/ls run in owner admin mode"
```

---

### Task 5: Data tab db-explorer connects in admin/override mode

> Review decisions (CharlieHelps on [#2286](https://github.com/VibesDIY/vibes.diy/pull/2286)): the data tab runs **always owner-mode** (Q2), default-on (Q1). **But** — there is no client-side owner gate on the db-explorer render path today (Q5), and the server only refuses to _elevate_ a non-owner; it doesn't stop us sending a misleading `adminMode: true`. So gate the flag on **confirmed owner state** client-side: only set `adminMode: true` when the surrounding builder context has established `isOwner === true` (the same owner signal the chrome admin toggle is conditioned on in `vibe.$ownerHandle.$appSlug.tsx`). If owner state isn't confirmed, send no `adminMode`.

**Files:**

- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts` (`whoAmI()` ~lines 305–314)
- Modify: caller that builds the runtime for the db-explorer preview context (the `?preview=yes` path; trace from `vibes.diy/pkg/app/components/ResultPreview/DataView.tsx` and `PreviewApp.tsx`) — pass the flag through **only when owner is confirmed**
- Test: runtime unit test for `whoAmI()` (match existing runtime test pattern under `vibes.diy/vibe/runtime/`)

- [ ] **Step 1: Write the failing test**

Assert that when the runtime is constructed in admin/preview mode, `whoAmI()` includes `adminMode: true` in the request payload (spy/capture the request like existing runtime tests do):

```typescript
it("whoAmI includes adminMode when runtime is in admin mode", async () => {
  const svc = makeTestRuntime({ adminMode: true }); // existing test factory + new opt
  await svc.whoAmI();
  expect(lastRequest.adminMode).toBe(true);
});

it("whoAmI omits adminMode when owner is not confirmed", async () => {
  const svc = makeTestRuntime({ adminMode: false });
  await svc.whoAmI();
  expect(lastRequest.adminMode).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/vibe && pnpm vitest run runtime/<whoami-test-file>.test.ts`
Expected: FAIL — `whoAmI()` omits `adminMode`.

- [ ] **Step 3: Thread adminMode into `whoAmI()`**

In `vibes.diy/vibe/runtime/register-dependencies.ts`, read an `adminMode` flag off the runtime svc/config and include it:

```typescript
whoAmI(): Promise<Result<ResVibeWhoAmI>> {
  return this.request<ReqVibeWhoAmI, ResVibeWhoAmI>(
    {
      type: "vibe.req.whoAmI",
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle: this.svc.vibeApp.ownerHandle,
      ...(this.svc.adminMode ? { adminMode: true } : {}),
    },
    { wait: isResVibeWhoAmI, timeout: 10000 }
  );
}
```

Set `adminMode` on the runtime svc only for the db-explorer preview path (`?preview=yes`) **and only when owner state is confirmed** (Q5). Trace the construction site from `DataView.tsx`/`PreviewApp.tsx`; gate the flag on the same `isOwner` signal the chrome admin toggle uses (`vibe.$ownerHandle.$appSlug.tsx`), so a non-owner viewing the surface never sends `adminMode: true`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/vibe && pnpm vitest run runtime/<whoami-test-file>.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/register-dependencies.ts vibes.diy/pkg/app/components/ResultPreview/
git commit -m "feat(data-tab): db-explorer preview connects in owner admin mode"
```

---

### Task 6: Full check

- [ ] **Step 1: Run repo checks**

Run: `pnpm check` (from repo root). Expected: format + build + test + lint all pass. If a flaky failure appears, rerun per `agents/flaky-tests.md` before treating it as real.

- [ ] **Step 2: Commit any formatting fixups**

```bash
npx prettier --write <changed files>
git add -A && git commit -m "chore: prettier"
```

---

## Self-Review

- **Spec coverage:** §"Server" → Tasks 1–3; §"Data tab" → Task 5; §"CLI" → Task 4; safety property → Task 3. `listDbNames` needs no change (already `isOwner`-gated; owners pass) — called out in spec, no task required.
- **Type consistency:** `adminOverride` (filter arg), `adminMode` (wire field / connection flag / adapter opt) used consistently. `filterDocsByChannel` 6-arg signature matches both the unit test (Task 1) and the call site (Task 2).
- **Dependency order:** Task 1 → 2 (filter arg before call site); Tasks 4–5 depend on the Task 2 server fix being merged to be observable end-to-end, and on Q1/Q2 being resolved.
- **Open items:** Q3–Q5 in the spec don't block the default path but should be confirmed in review; Task 3 encodes the Q4 safety expectation as a test.
