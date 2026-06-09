# Reject Unreadable Writes (zero-channel access results) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a write is governed by an access function that places the doc in **zero channels**, reject the write with a clear `unreadable` error instead of silently persisting a doc no one — not even its author — can ever read.

**Architecture:** Add a pure, doc-local predicate `isReadableResult(descriptor)` (true iff the access result lists ≥1 channel). Call it in the document-write gate right after the access function is evaluated and before the row is inserted; if the result is not readable, send a `vibes.diy.res-error` carrying a stable `code: "unreadable"` plus an actionable message pointing at the existing channel+grant pattern, and skip the insert. The check is **doc-local on purpose** — it only looks at this write's `channels`, never the cross-doc grant graph (no grant chasing).

**Tech Stack:** TypeScript, Drizzle (server tables), Vitest. Access functions run as JS in QuickJS server-side; this guard is a runtime check on their returned `AccessDescriptor`.

---

## Background (read before starting)

- **Why this exists:** The read gate refuses to return any doc whose access result has no `channels` ([app-documents-read-eventos.ts:130-137](../../../vibes.diy/api/svc/public/app-documents-read-eventos.ts#L130-L137)), and there is no owner/author bypass. So an access function that returns `{}` for a doc type (a common LLM catch-all) writes a doc that is unreadable by everyone, **silently**. This guard turns that silent orphaning into a loud, actionable error at write time. See VibesDIY/vibes.diy#2273 for the full root cause.
- **Scope decision (intentional):** The guard fires only on the **provably dead** case — the write declares **no channel at all**. The softer "doc is in a channel but no grant makes that channel reachable" case is deliberately NOT checked here: grants can legitimately be declared on other docs or arrive later, and resolving that graph at write time would be fragile. Zero channels is doc-local, unambiguous, and stable.
- **Only applies under an access function.** Apps with no `access.js` binding have no channel gating, so writes there must continue to succeed untouched. The guard lives inside the existing `if (afbRow?.accessFnCid && vctx.invokeAccessFn)` block.
- **Mutually exclusive with the "author-readable default" (Option C) in #2273.** This plan implements the strict fork: declare readability or be rejected.

## File Structure

- `vibes.diy/api/svc/public/access-function.ts` — **modify.** Add the pure `isReadableResult` predicate next to the existing `enforceAllowAnonymous`. One clear responsibility: pure predicates/guards over an `AccessDescriptor`. No DB, no IO — trivially unit-testable.
- `vibes.diy/api/tests/access-function.test.ts` — **modify.** Add a `describe("isReadableResult")` unit block mirroring the existing `enforceAllowAnonymous` block.
- `vibes.diy/api/svc/public/app-documents-write-eventos.ts` — **modify.** Call `isReadableResult` in the write gate after `accessResult = invokeResult` and before the insert; send the `unreadable` error and skip the insert when not readable.
- `vibes.diy/api/tests/access-fn-unreadable-write.test.ts` — **create.** Integration test: an access fn that returns zero channels is rejected; one that returns a channel succeeds; an app with no access fn is unaffected.

---

## Task 1: Pure `isReadableResult` predicate + unit tests

**Files:**

- Modify: `vibes.diy/api/svc/public/access-function.ts`
- Test: `vibes.diy/api/tests/access-function.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Add this block to `vibes.diy/api/tests/access-function.test.ts` (after the existing `enforceAllowAnonymous` describe block). Also add `isReadableResult` to the existing import from `../svc/public/access-function.js`.

```ts
import { enforceAllowAnonymous, isReadableResult, makeHelpers } from "../svc/public/access-function.js";

describe("isReadableResult", () => {
  it("false for empty descriptor (the {} catch-all)", () => {
    expect(isReadableResult({})).toBe(false);
  });

  it("false when channels is an empty array", () => {
    expect(isReadableResult({ channels: [] })).toBe(false);
  });

  it("false when only a grant is present but no channel (grant alone is not readability)", () => {
    expect(isReadableResult({ grant: { public: ["ch"] } })).toBe(false);
  });

  it("false when only members/expiry/allowAnonymous are present (no channel)", () => {
    expect(isReadableResult({ members: { editor: ["alice"] } })).toBe(false);
    expect(isReadableResult({ expiry: null })).toBe(false);
    expect(isReadableResult({ allowAnonymous: true })).toBe(false);
  });

  it("true when at least one channel is declared", () => {
    expect(isReadableResult({ channels: ["cabinet"] })).toBe(true);
  });

  it("true with the documented private-to-author pattern", () => {
    expect(isReadableResult({ channels: ["doc-1"], grant: { users: { alice: ["doc-1"] } } })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd vibes.diy/tests && pnpm test --config ../api/tests/vitest.config.ts access-function`
Expected: FAIL — `isReadableResult is not exported` / `is not a function`.

- [ ] **Step 3: Implement the predicate**

Add to `vibes.diy/api/svc/public/access-function.ts` (place it directly after the `enforceAllowAnonymous` function):

```ts
/**
 * True iff the access result makes the doc readable by *someone* — i.e. it
 * places the doc in at least one channel. This is a deliberately doc-local
 * check: it inspects only this write's `channels`, never the cross-doc grant
 * graph. A doc in zero channels is provably unreadable by everyone (the read
 * gate refuses any doc with no channels, with no owner bypass), so it is the
 * one case worth rejecting at write time. "In a channel but no grant reaches
 * it" is intentionally NOT covered here — grants may live on other docs or
 * arrive later.
 */
export function isReadableResult(result: AccessDescriptor): boolean {
  return Array.isArray(result.channels) && result.channels.length > 0;
}
```

Confirm `AccessDescriptor` is already imported/exported in this file (it is — line 16/18). No new import needed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd vibes.diy/tests && pnpm test --config ../api/tests/vitest.config.ts access-function`
Expected: PASS — all `isReadableResult` cases green, existing `enforceAllowAnonymous`/`makeHelpers` cases still green.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/access-function.ts vibes.diy/api/tests/access-function.test.ts
git commit -m "feat(access): add isReadableResult predicate (zero-channel = unreadable)"
```

---

## Task 2: Wire the guard into the document-write gate + integration test

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-write-eventos.ts:328` (insert guard immediately after `accessResult = invokeResult;`)
- Create: `vibes.diy/api/tests/access-fn-unreadable-write.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `vibes.diy/api/tests/access-fn-unreadable-write.test.ts`. It installs an access.js binding via `ensureAppSlug`, stubs `invokeAccessFn` to return a controlled descriptor per doc `type`, then asserts the write gate's behavior. Model harness on `access-fn-channel-read.test.ts` (stubbed `invokeAccessFn` + `ensureAppSlug` with an `/access.js` code-block) and `app-documents-access.test.ts` (TestWSPair wiring).

```ts
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// access.js installed for the vibe. The stubbed invokeAccessFn below is what
// actually decides the result; this source only needs to exist so a binding
// row is created for the db.
const ACCESS_JS = `export default function (doc, oldDoc, user) {
  if (doc.type === "hat") return { channels: ["cabinet"], grant: { public: ["cabinet"] } };
  return {};
}`;

describe("write gate rejects unreadable (zero-channel) writes", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, {
      // Stub: mirror ACCESS_JS — "hat" gets a channel, everything else gets {}.
      invokeAccessFn: async (params) => {
        const doc = params.doc as { type?: string };
        if (doc.type === "hat") return { channels: ["cabinet"], grant: { public: ["cabinet"] } };
        return {};
      },
    });

    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 100 });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await ownerUser.getDashBoardToken()),
    });

    const rSlug = await ownerApi.ensureAppSlug({
      sections: [{ type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS }],
    });
    if (!isResEnsureAppSlugOk(rSlug.unwrap())) throw new Error("ensureAppSlug failed");
    const ok = rSlug.unwrap();
    appSlug = ok.appSlug;
    ownerHandle = ok.ownerHandle;
  });

  it("rejects a write whose access result has no channels", async () => {
    const rRes = await ownerApi.putDoc({
      appSlug,
      ownerHandle,
      dbName: "ImgGen",
      doc: { type: "image", prompt: "a hat" },
    });
    expect(rRes.isErr()).toBe(true);
    expect(rRes.Err().message).toMatch(/no channel|unreadable/i);
    // Stable machine-readable code (Q3) — surfaced via mkResError(message, code).
    expect(rRes.Err().code).toBe("unreadable");
  });

  it("allows a write whose access result has a channel", async () => {
    const rRes = await ownerApi.putDoc({
      appSlug,
      ownerHandle,
      dbName: "hatSmeller",
      doc: { type: "hat", name: "Cumulus Crown" },
    });
    expect(rRes.isOk()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd vibes.diy/tests && pnpm test --config ../api/tests/vitest.config.ts access-fn-unreadable-write`
Expected: FAIL — the first case currently **succeeds** (the orphaned doc is written), so `rRes.isErr()` is false.

- [ ] **Step 3: Wire the guard into the write gate**

In `vibes.diy/api/svc/public/app-documents-write-eventos.ts`, the access-fn block ends with `accessResult = invokeResult;` at line 328. Immediately after it (still inside the `if (afbRow?.accessFnCid && vctx.invokeAccessFn)` block), insert the guard. Also add `isReadableResult` to the existing import from `./access-function.js` (currently imports `enforceAllowAnonymous, ForbiddenError, extractExportSource, type AccessDescriptor`).

Change the import line (currently line 29):

```ts
import {
  enforceAllowAnonymous,
  ForbiddenError,
  extractExportSource,
  isReadableResult,
  type AccessDescriptor,
} from "./access-function.js";
```

Insert immediately after `accessResult = invokeResult;` (line 328), before the closing `}` of the access-fn block:

```ts
// Reject writes that place the doc in zero channels: the read gate
// refuses any channel-less doc (no owner bypass), so persisting it
// would create a doc unreadable by everyone, silently. Point the
// builder at the existing channel+grant pattern. Doc-local check —
// we do not chase the cross-doc grant graph here.
if (!isReadableResult(invokeResult)) {
  await ctx.send.send(ctx, {
    type: "vibes.diy.res-error",
    error: {
      // Stable machine-readable code so the runtime / codegen-eval loop can
      // self-correct without string-matching the message. `ResError.error`
      // already supports an optional `code` (see api/types/common.ts).
      code: "unreadable",
      message:
        "Unreadable write: access.js placed this doc in no channel, so no one can read it — not even its author. " +
        "Return a channel + grant. Private to author: " +
        "return { channels: [doc._id], grant: { users: { [user.userHandle]: [doc._id] } } }. " +
        "Public: return { channels: [doc._id], grant: { public: [doc._id] } }.",
    },
  } satisfies ResError);
  return Result.Ok(EventoResult.Continue);
}
```

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `cd vibes.diy/tests && pnpm test --config ../api/tests/vitest.config.ts access-fn-unreadable-write`
Expected: PASS — the zero-channel `type:"image"` write is rejected with the unreadable message; the `type:"hat"` write (channel `cabinet`) succeeds.

- [ ] **Step 5: Run the broader access-fn suite to catch regressions**

Run: `cd vibes.diy/tests && pnpm test --config ../api/tests/vitest.config.ts access`
Expected: PASS — existing access-fn write/read/channel tests stay green (anonymous-write, editor/viewer grants, channel reads). If any previously-passing test wrote a doc through an access fn that returned `{}` _and expected success_, that is now a real behavior change — update that test to return a channel, and note it in the commit body.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-write-eventos.ts vibes.diy/api/tests/access-fn-unreadable-write.test.ts
git commit -m "feat(access): reject zero-channel writes with unreadable error"
```

---

## Task 3: Guard the no-access-fn path against false positives (explicit regression test)

The guard lives inside the `if (afbRow?.accessFnCid && vctx.invokeAccessFn)` block, so apps without an access function are structurally unaffected. Lock that in with an explicit test so a future refactor can't move the guard out of the block and start rejecting ungated writes.

**Files:**

- Test: `vibes.diy/api/tests/access-fn-unreadable-write.test.ts` (add a sibling describe)

- [ ] **Step 1: Write the regression test**

Append to `vibes.diy/api/tests/access-fn-unreadable-write.test.ts`:

```ts
describe("write gate leaves no-access-fn apps untouched", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    // No invokeAccessFn stub and no /access.js → no binding → no channel gating.
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 101 });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await ownerUser.getDashBoardToken()),
    });

    const rSlug = await ownerApi.ensureAppSlug({ sections: [] });
    const ok = rSlug.unwrap();
    appSlug = ok.appSlug;
    ownerHandle = ok.ownerHandle;
  });

  it("a channel-less doc still writes fine when there is no access fn", async () => {
    const rRes = await ownerApi.putDoc({
      appSlug,
      ownerHandle,
      dbName: "default",
      doc: { type: "image", prompt: "no access fn here" },
    });
    expect(rRes.isOk()).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it passes**

Run: `cd vibes.diy/tests && pnpm test --config ../api/tests/vitest.config.ts access-fn-unreadable-write`
Expected: PASS — both describes green. (If this fails, the guard is firing outside the access-fn block — a bug.)

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/access-fn-unreadable-write.test.ts
git commit -m "test(access): no-access-fn apps unaffected by unreadable guard"
```

---

## Out of scope (do NOT implement here)

- **Channel-but-no-grant detection.** Deliberately excluded — see Background. A doc with `channels: ["x"]` and no reaching grant passes this guard; that soft case is left to authoring guidance / a separate warn signal.
- **The "author-readable default" (Option C).** Mutually exclusive with this strict guard. If C is later chosen, this guard would be removed, not stacked.
- **ImgGen hook changes** (augment-not-replace, host-doc attach) — tracked in VibesDIY/vibes.diy#2279.
- **Prompt/LLM/md guidance updates** teaching builders to channel every readable doc type — a docs change, separate PR.

## Rollout (decided)

**Hard-enforce globally from day one — no phased migration.** Charlie proposed a staged observe → warn-existing → enforce rollout; the owner decided against it: go straight to full enforcement and **let old usage break**. Apps whose access.js returns `{}` for a read-back doc type will start failing those writes immediately, surfacing as the `unreadable` error (`code: "unreadable"`). No observe phase, no warn-existing phase, no new-vs-existing app gating, no kill switch. The fix for a broken app is a one-line access.js change (channel + grant), and the error message + code tell the builder exactly what to do.

Consequence to accept knowingly: any currently-deployed app relying on `{}` to write read-back docs breaks on its next such write until its access.js is updated.

## Self-Review

- **Spec coverage:** zero-channel reject (Task 2), pure predicate (Task 1), no-access-fn unaffected (Task 3), actionable message pointing at the documented channel+grant pattern (Task 2 Step 3). The doc-local / no-grant-chasing constraint is encoded in the predicate and documented.
- **Type consistency:** `isReadableResult(result: AccessDescriptor): boolean` is the single name used in Task 1 (definition + tests), Task 2 (import + call site). The error uses the existing `ResError` shape (`{ type: "vibes.diy.res-error", error: { message } }`) already used by the forbidden and `enforceAllowAnonymous` paths in the same file.
- **Placeholder scan:** all steps contain real code/commands; no TBD/TODO.
