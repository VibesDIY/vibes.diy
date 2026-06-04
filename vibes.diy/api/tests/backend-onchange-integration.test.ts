import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import type { MsgBase } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import type { EvtBackendOnChange } from "../types/app-documents.js";

// Integration tests for the backend.js onChange flow.
//
// Covers:
//   1. processBackendBindings creates a BackendFunctionBindings row when a vibe
//      is pushed with /backend.js that exports onChange.
//   2. processBackendBindings deletes the row when the same vibe is re-pushed
//      without /backend.js.
//   3. putDocEvento enqueues an EvtBackendOnChange queue message when the app
//      has a BackendFunctionBindings row with hasOnChange === true.
//   4. putDocEvento does NOT enqueue when no binding row exists.

const BACKEND_JS_ONCHANGE = `export async function onChange(event, ctx) {
  console.log("onChange called", event);
}`;

const APP_JSX = `function App() { return null; } App();`;

// Each suite must pass a distinct apiUrlPort so the VibesDiyApi WS connection
// cache (keyed by URL) doesn't reuse a previous suite's WebSocket and route
// messages to the wrong AppContext / SQLite DB.
async function setupCtx(queueMessages: MsgBase[], seqOffset: number, apiUrlPort: number) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

  // Override postQueue to capture enqueued messages for assertions.
  appCtx.vibesCtx.postQueue = async (msg: MsgBase) => {
    queueMessages.push(msg);
  };

  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  appCtx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };

  const testUser = await createTestUser({ sthis, deviceCA, seqUserId: seqOffset });
  const api = new VibesDiyApi({
    apiUrl: `http://localhost:${apiUrlPort}/api`,
    ws: wsPair.p1 as unknown as WebSocket,
    timeoutMs: 15000,
    getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
  });

  return { appCtx, api, sthis };
}

function queryBackendBindings(ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>, ownerHandle: string, appSlug: string) {
  const tBfb = ctx.vibesCtx.sql.tables.backendFunctionBindings;
  return ctx.vibesCtx.sql.db
    .select({
      ownerHandle: tBfb.ownerHandle,
      appSlug: tBfb.appSlug,
      hasOnChange: tBfb.hasOnChange,
      hasFetch: tBfb.hasFetch,
      hasScheduled: tBfb.hasScheduled,
      backendCid: tBfb.backendCid,
    })
    .from(tBfb)
    .where(and(eq(tBfb.ownerHandle, ownerHandle), eq(tBfb.appSlug, appSlug)));
}

// ── Test Suite 1: Binding row lifecycle ─────────────────────────────────────

describe("processBackendBindings — BackendFunctionBindings row lifecycle", { timeout: 30000 }, () => {
  const queueMessages: MsgBase[] = [];
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let api: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;

  beforeAll(async () => {
    const setup = await setupCtx(queueMessages, 9100, 19100);
    appCtx = setup.appCtx;
    api = setup.api;
  });

  it("creates BackendFunctionBindings row with hasOnChange=true when backend.js is pushed", async () => {
    const r = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/backend.js", content: BACKEND_JS_ONCHANGE },
      ],
    });
    assert(r.isOk(), `ensureAppSlug failed: ${r.isErr() ? String(r.Err()) : ""}`);
    const res = r.Ok();
    assert(isResEnsureAppSlugOk(res), "expected ResEnsureAppSlugOk");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    const rows = await queryBackendBindings(appCtx, ownerHandle, appSlug);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    assert(row !== undefined, "expected one BackendFunctionBindings row");
    expect(row.hasOnChange).toBe(true);
    expect(row.hasFetch).toBe(false);
    expect(row.hasScheduled).toBe(false);
    expect(row.backendCid).toBeTruthy();
  });

  it("deletes BackendFunctionBindings row when backend.js is removed from push", async () => {
    // Re-push without backend.js
    const r = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX }],
    });
    assert(r.isOk(), `ensureAppSlug (no backend.js) failed: ${r.isErr() ? String(r.Err()) : ""}`);

    const rows = await queryBackendBindings(appCtx, ownerHandle, appSlug);
    expect(rows).toHaveLength(0);
  });

  it("recreates binding row when backend.js is pushed again", async () => {
    const r = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/backend.js", content: BACKEND_JS_ONCHANGE },
      ],
    });
    assert(r.isOk(), `ensureAppSlug (re-push) failed: ${r.isErr() ? String(r.Err()) : ""}`);

    const rows = await queryBackendBindings(appCtx, ownerHandle, appSlug);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.hasOnChange).toBe(true);
  });
});

// ── Test Suite 2: hasFetch and hasScheduled detection ───────────────────────

describe("processBackendBindings — export type detection", { timeout: 30000 }, () => {
  const queueMessages: MsgBase[] = [];
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let api: VibesDiyApi;

  beforeAll(async () => {
    const setup = await setupCtx(queueMessages, 9200, 19200);
    appCtx = setup.appCtx;
    api = setup.api;
  });

  it("detects hasFetch=true when backend.js exports fetch", async () => {
    const r = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        {
          type: "code-block",
          lang: "js",
          filename: "/backend.js",
          content: `export async function fetch(request, ctx) { return new Response("ok"); }`,
        },
      ],
    });
    assert(r.isOk(), `ensureAppSlug failed: ${r.isErr() ? String(r.Err()) : ""}`);
    const res = r.Ok();
    assert(isResEnsureAppSlugOk(res), "expected ResEnsureAppSlugOk");

    const rows = await queryBackendBindings(appCtx, res.ownerHandle, res.appSlug);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.hasFetch).toBe(true);
    expect(rows[0]?.hasOnChange).toBe(false);
  });

  it("detects hasOnChange=true and hasFetch=true when both are exported", async () => {
    const r = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        {
          type: "code-block",
          lang: "js",
          filename: "/backend.js",
          content: `export async function onChange(event, ctx) {}
export async function fetch(request, ctx) { return new Response("ok"); }`,
        },
      ],
    });
    assert(r.isOk(), `ensureAppSlug failed: ${r.isErr() ? String(r.Err()) : ""}`);
    const res = r.Ok();
    assert(isResEnsureAppSlugOk(res), "expected ResEnsureAppSlugOk");

    const rows = await queryBackendBindings(appCtx, res.ownerHandle, res.appSlug);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.hasOnChange).toBe(true);
    expect(rows[0]?.hasFetch).toBe(true);
  });

  it("deletes binding row when backend.js has no recognized exports", async () => {
    // First push with a binding
    const r1 = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/backend.js", content: BACKEND_JS_ONCHANGE },
      ],
    });
    assert(r1.isOk(), "first push failed");
    const res1 = r1.Ok();
    assert(isResEnsureAppSlugOk(res1), "expected ResEnsureAppSlugOk");

    // Re-push with backend.js that has no recognized exports
    const r2 = await api.ensureAppSlug({
      mode: "dev",
      appSlug: res1.appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        {
          type: "code-block",
          lang: "js",
          filename: "/backend.js",
          content: `// no exported functions`,
        },
      ],
    });
    assert(r2.isOk(), "second push failed");

    // No recognized exports → binding row should be deleted
    const rows = await queryBackendBindings(appCtx, res1.ownerHandle, res1.appSlug);
    expect(rows).toHaveLength(0);
  });
});

// ── Test Suite 3: Queue event enqueue on putDoc ──────────────────────────────

describe("putDocEvento — EvtBackendOnChange queue event", { timeout: 30000 }, () => {
  const queueMessages: MsgBase[] = [];
  let _appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let api: VibesDiyApi;
  let appSlugWithBackend: string;
  let ownerHandle: string;
  let appSlugNoBackend: string;

  beforeAll(async () => {
    const setup = await setupCtx(queueMessages, 9300, 19300);
    _appCtx = setup.appCtx;
    api = setup.api;

    // App WITH backend.js onChange
    const r1 = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/backend.js", content: BACKEND_JS_ONCHANGE },
      ],
    });
    assert(r1.isOk(), `ensureAppSlug (with backend.js) failed: ${r1.isErr() ? String(r1.Err()) : ""}`);
    const res1 = r1.Ok();
    assert(isResEnsureAppSlugOk(res1), "expected ResEnsureAppSlugOk (with backend.js)");
    appSlugWithBackend = res1.appSlug;
    ownerHandle = res1.ownerHandle;

    // App WITHOUT backend.js
    const r2 = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX }],
    });
    assert(r2.isOk(), `ensureAppSlug (no backend.js) failed: ${r2.isErr() ? String(r2.Err()) : ""}`);
    const res2 = r2.Ok();
    assert(isResEnsureAppSlugOk(res2), "expected ResEnsureAppSlugOk (no backend.js)");
    appSlugNoBackend = res2.appSlug;
  });

  it("enqueues EvtBackendOnChange when app has backend.js with onChange", async () => {
    queueMessages.length = 0;

    const rPut = await api.putDoc({
      ownerHandle,
      appSlug: appSlugWithBackend,
      dbName: "default",
      doc: { title: "trigger onChange" },
    });
    expect(rPut.isOk()).toBe(true);
    const docId = rPut.Ok().id;

    const onchangeMsgs = queueMessages.filter(
      (m) => (m.payload as Record<string, unknown>)?.type === "vibes.diy.evt-backend-onchange"
    );
    expect(onchangeMsgs).toHaveLength(1);

    const msg = onchangeMsgs[0];
    assert(msg !== undefined, "expected one evt-backend-onchange message");
    const payload = msg.payload as EvtBackendOnChange;
    expect(payload.type).toBe("vibes.diy.evt-backend-onchange");
    expect(payload.ownerHandle).toBe(ownerHandle);
    expect(payload.appSlug).toBe(appSlugWithBackend);
    expect(payload.dbName).toBe("default");
    expect(payload.docId).toBe(docId);
    expect(payload.doc).toMatchObject({ title: "trigger onChange" });
    expect(payload.oldDoc).toBeNull();
    expect(payload.created).toBeTruthy();
  });

  it("populates oldDoc on second write to the same docId", async () => {
    queueMessages.length = 0;
    const docId = "onchange-update-test";

    // First write
    await api.putDoc({
      ownerHandle,
      appSlug: appSlugWithBackend,
      dbName: "default",
      doc: { title: "original" },
      docId,
    });

    queueMessages.length = 0;

    // Second write to same docId
    const rPut2 = await api.putDoc({
      ownerHandle,
      appSlug: appSlugWithBackend,
      dbName: "default",
      doc: { title: "updated" },
      docId,
    });
    expect(rPut2.isOk()).toBe(true);

    const onchangeMsgs = queueMessages.filter(
      (m) => (m.payload as Record<string, unknown>)?.type === "vibes.diy.evt-backend-onchange"
    );
    expect(onchangeMsgs).toHaveLength(1);

    const payload = onchangeMsgs[0]?.payload as EvtBackendOnChange;
    expect((payload.doc as Record<string, unknown>).title).toBe("updated");
    expect((payload.oldDoc as Record<string, unknown>).title).toBe("original");
  });

  it("does NOT enqueue EvtBackendOnChange when app has no backend.js", async () => {
    queueMessages.length = 0;

    const rPut = await api.putDoc({
      ownerHandle,
      appSlug: appSlugNoBackend,
      dbName: "default",
      doc: { title: "no backend" },
    });
    expect(rPut.isOk()).toBe(true);

    const onchangeMsgs = queueMessages.filter(
      (m) => (m.payload as Record<string, unknown>)?.type === "vibes.diy.evt-backend-onchange"
    );
    expect(onchangeMsgs).toHaveLength(0);
  });

  it("queue message tid and src are set correctly", async () => {
    queueMessages.length = 0;

    await api.putDoc({
      ownerHandle,
      appSlug: appSlugWithBackend,
      dbName: "default",
      doc: { check: "meta" },
    });

    const msg = queueMessages.find((m) => (m.payload as Record<string, unknown>)?.type === "vibes.diy.evt-backend-onchange");
    assert(msg !== undefined, "expected evt-backend-onchange message");
    expect(msg.tid).toBe("queue-event");
    expect(msg.src).toBe("putDoc");
    expect(msg.dst).toBe("vibes-service");
    expect(msg.ttl).toBe(1);
  });
});
