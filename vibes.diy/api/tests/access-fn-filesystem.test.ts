import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import {
  calcEntryPointUrl,
  CFInject,
  cfServe,
  noopCache,
  vibesMsgEvento,
  WSSendProvider,
  resolveCodeBlocksToFileSystem,
} from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, parseArray, fileSystemItem } from "@vibes.diy/api-types";
import type { AccessDescriptor, FileSystemItem } from "@vibes.diy/api-types";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { loadVersionTimeline } from "../svc/intern/version-timeline.js";

const ACCESS_JS_CHAT_AND_DEFAULT = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}
export default function(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to save" };
  return {};
}`;

const ACCESS_JS_CHAT_ONLY = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}`;

const ACCESS_JS_CHAT_AND_BOARDS = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}
export function boards(doc, oldDoc, user) {
  return { allowAnonymous: true };
}`;

const APP_JSX = `function App() { return null; } App();`;

interface InvokeRecorder {
  calls: { cid: string; doc: unknown; user: unknown }[];
  result: AccessDescriptor | { forbidden: string };
}

async function setupCtx(recorder: InvokeRecorder) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
    invokeAccessFn: async (params) => {
      recorder.calls.push({ cid: params.cid, doc: params.doc, user: params.user });
      return recorder.result;
    },
  });
  const fetchPair = TestFetchPair.create();
  const wsPair = TestWSPair.create();

  fetchPair.server.onServe(async (req: Request) => {
    return cfServe(
      req as unknown as CFRequest,
      {
        appCtx: ctx.appCtx,
        cache: noopCache,
        drizzle: ctx.vibesCtx.sql.db,
        webSocket: {
          connections: new Set(),
          webSocketPair: () => ({
            client: wsPair.p1,
            server: wsPair.p2,
          }),
        },
      } as unknown as ExecutionContext & CFInject
    ) as unknown as Promise<Response>;
  });

  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  ctx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return { ctx, wsPair, fetchPair, sthis, deviceCA };
}

async function mkUser(
  sthis: ReturnType<typeof ensureSuperThis>,
  deviceCA: Awaited<ReturnType<typeof createTestDeviceCA>>,
  wsPair: ReturnType<typeof TestWSPair.create>,
  seqOffset: number,
  fetchFn?: VibesDiyApi["cfg"]["fetch"]
) {
  const user = await createTestUser({ sthis, deviceCA, seqUserId: seqOffset });
  const api = new VibesDiyApi({
    apiUrl: "http://localhost:8787/api",
    ws: wsPair.p1 as unknown as WebSocket,
    fetch: fetchFn,
    timeoutMs: 10000,
    getToken: async () => Result.Ok(await user.getDashBoardToken()),
  });
  return { user, api };
}

function queryBindings(ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>, ownerHandle: string, appSlug: string) {
  const tAfb = ctx.vibesCtx.sql.tables.accessFunctionBindings;
  return ctx.vibesCtx.sql.db
    .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid, accessFnAssetUri: tAfb.accessFnAssetUri })
    .from(tAfb)
    .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
}

function queryAppsFileSystem(
  ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>,
  ownerHandle: string,
  appSlug: string,
  fsId: string
): Promise<FileSystemItem[]> {
  return ctx.vibesCtx.sql.db
    .select({ fileSystem: ctx.vibesCtx.sql.tables.apps.fileSystem })
    .from(ctx.vibesCtx.sql.tables.apps)
    .where(
      and(
        eq(ctx.vibesCtx.sql.tables.apps.ownerHandle, ownerHandle),
        eq(ctx.vibesCtx.sql.tables.apps.appSlug, appSlug),
        eq(ctx.vibesCtx.sql.tables.apps.fsId, fsId)
      )
    )
    .limit(1)
    .then((rows) => {
      if (rows.length === 0) return [];
      return parseArray(rows[0].fileSystem, fileSystemItem);
    });
}

describe("access.js fileSystem invariant (#2188)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let api: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  let fsId: string;
  const recorder: InvokeRecorder = { calls: [], result: { allowAnonymous: true } };

  beforeAll(async () => {
    const { ctx, wsPair, fetchPair, sthis, deviceCA } = await setupCtx(recorder);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 2188, fetchPair.client.fetch);
    api = ownerSetup.api;
  }, 30000);

  it("access.js lands in apps.fileSystem after push", async () => {
    const r = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_AND_DEFAULT },
      ],
    });
    assert(r.isOk(), `ensureAppSlug failed: ${r.isErr() ? String(r.Err()) : ""}`);
    const res = r.Ok();
    assert(isResEnsureAppSlugOk(res), "expected ResEnsureAppSlugOk");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;
    fsId = res.fsId;

    const fsItems = await queryAppsFileSystem(appCtx, ownerHandle, appSlug, fsId);
    const accessEntry = fsItems.find((item) => item.fileName === "/access.js");
    expect(accessEntry).toBeDefined();
    expect(accessEntry?.mimeType).toBe("text/javascript");
  });

  it("sandbox serves /access.js?source=true", async () => {
    const url = calcEntryPointUrl({
      hostnameBase: ".nowhere",
      protocol: "http",
      port: "4711",
      bindings: { appSlug, ownerHandle, fsId },
    });
    // url ends with /~fsId~ (no trailing slash); add /access.js so that
    // extractHostToBindings resolves the fsId and finds the dev-mode app.
    const sourceRes = await api.cfg.fetch(`${url}/access.js?source=true`);
    expect(sourceRes.status).toBe(200);
    const content = await sourceRes.text();
    expect(content).toContain("export function chat");
    expect(content).toContain("export default function");
  });

  it("binding rows created via extraction (not manual DB insert)", async () => {
    const bindings = await queryBindings(appCtx, ownerHandle, appSlug);
    const dbNames = bindings.map((b) => b.dbName).sort();
    expect(dbNames).toContain("chat");
    expect(dbNames).toContain("*");
  });

  it("binding CID matches fileSystem CID (single source of truth)", async () => {
    const fsItems = await queryAppsFileSystem(appCtx, ownerHandle, appSlug, fsId);
    const accessEntry = fsItems.find((item) => item.fileName === "/access.js");
    assert(accessEntry !== undefined, "/access.js not found in fileSystem");

    const bindings = await queryBindings(appCtx, ownerHandle, appSlug);
    expect(bindings.length).toBeGreaterThan(0);
    for (const binding of bindings) {
      expect(binding.accessFnCid).toBe(accessEntry.assetId);
      expect(binding.accessFnAssetUri).toBe(accessEntry.assetURI);
    }
  });

  it("export-as syntax creates binding for non-identifier db name", async () => {
    const ACCESS_JS_EXPORT_AS = `function myHandler(doc, oldDoc, user) {
  return { allowAnonymous: true };
}
export { myHandler as "my-db" }`;

    const r = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_EXPORT_AS },
      ],
    });
    assert(r.isOk(), "push with export-as failed");

    const bindings = await queryBindings(appCtx, ownerHandle, appSlug);
    const dbNames = bindings.map((b) => b.dbName);
    expect(dbNames).toContain("my-db");
  });

  it("JS built-in name like toString works as a database name", async () => {
    const ACCESS_JS_TOSTRING = `export function toString(doc, oldDoc, user) {
  return { allowAnonymous: true };
}`;

    const r = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_TOSTRING },
      ],
    });
    assert(r.isOk(), "push with toString export failed");

    const bindings = await queryBindings(appCtx, ownerHandle, appSlug);
    const dbNames = bindings.map((b) => b.dbName);
    expect(dbNames).toContain("toString");
  });

  it("stale binding rows cleaned up when export removed", async () => {
    const r1 = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_AND_BOARDS },
      ],
    });
    assert(r1.isOk(), "push with chat+boards failed");

    const bindingsBoth = await queryBindings(appCtx, ownerHandle, appSlug);
    const dbNamesBoth = bindingsBoth.map((b) => b.dbName).sort();
    expect(dbNamesBoth).toContain("chat");
    expect(dbNamesBoth).toContain("boards");

    const r2 = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_ONLY },
      ],
    });
    assert(r2.isOk(), "push with chat-only failed");

    const bindingsAfter = await queryBindings(appCtx, ownerHandle, appSlug);
    const dbNamesAfter = bindingsAfter.map((b) => b.dbName);
    expect(dbNamesAfter).toContain("chat");
    expect(dbNamesAfter).not.toContain("boards");
  });

  it("all bindings deleted when access.js removed from push", async () => {
    const r = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX }],
    });
    assert(r.isOk(), "push without access.js failed");

    const bindings = await queryBindings(appCtx, ownerHandle, appSlug);
    expect(bindings.length).toBe(0);
  });

  it("backfill creates accessFnOutputs via front door", async () => {
    recorder.result = { channels: ["general"], allowAnonymous: true };

    const rSetup = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX }],
    });
    assert(rSetup.isOk(), "setup push failed");

    // Temporarily seed a binding so putDoc goes through the gate
    const tAfb = appCtx.vibesCtx.sql.tables.accessFunctionBindings;
    await appCtx.vibesCtx.sql.db.insert(tAfb).values({
      ownerHandle: ownerHandle,
      appSlug,
      dbName: "chat",
      accessFnCid: "temp-seed-cid",
      updated: new Date().toISOString(),
    });

    const r1 = await api.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "backfill-doc-1" } });
    assert(r1.isOk(), "putDoc 1 failed");
    const r2 = await api.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "backfill-doc-2" } });
    assert(r2.isOk(), "putDoc 2 failed");

    // Clean up temp seed
    await appCtx.vibesCtx.sql.db.delete(tAfb).where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFnOutputs)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.ownerHandle, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.appSlug, appSlug)
        )
      );

    recorder.calls = [];

    const rAccess = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_ONLY },
      ],
    });
    assert(rAccess.isOk(), "push with access.js failed");

    const backfillCalls = recorder.calls.filter((c) => c.user === null);
    expect(backfillCalls.length).toBe(2);

    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const outputRows = await appCtx.vibesCtx.sql.db
      .select()
      .from(tOutputs)
      .where(and(eq(tOutputs.ownerHandle, ownerHandle), eq(tOutputs.appSlug, appSlug), eq(tOutputs.dbName, "chat")));
    expect(outputRows.length).toBe(2);
  });

  it("access.js carries forward in version timeline seed", async () => {
    const rPush = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_ONLY },
      ],
    });
    assert(rPush.isOk(), "push with access.js failed");
    const pushRes = rPush.Ok();
    assert(isResEnsureAppSlugOk(pushRes), "expected ResEnsureAppSlugOk");

    const rOpen = await api.openChat({ ownerHandle, appSlug, mode: "chat" });
    assert(rOpen.isOk(), "openChat failed");
    const chat = rOpen.Ok();

    const tlResult = await loadVersionTimeline(appCtx.vibesCtx, chat.chatId);
    assert(tlResult.isOk(), "loadVersionTimeline failed");
    const timeline = tlResult.Ok();
    expect(timeline.length).toBeGreaterThan(0);

    const latestVfs = timeline[timeline.length - 1].vfs;
    expect(latestVfs.has("/access.js")).toBe(true);

    const appEditBlock = {
      begin: {
        type: "block.code.begin" as const,
        blockId: "b1",
        blockNr: 1,
        streamId: "s1",
        seq: 1,
        timestamp: new Date(),
        sectionId: "sec1",
        lang: "jsx",
        path: "App.jsx",
      },
      lines: [
        {
          type: "block.code.line" as const,
          blockId: "b1",
          blockNr: 1,
          streamId: "s1",
          seq: 2,
          timestamp: new Date(),
          sectionId: "sec1",
          lang: "jsx",
          line: "function App() { return null; } // edited",
          lineNr: 1,
        },
      ],
      end: {
        type: "block.code.end" as const,
        blockId: "b1",
        blockNr: 1,
        streamId: "s1",
        seq: 3,
        timestamp: new Date(),
        sectionId: "sec1",
        lang: "jsx",
        stats: { lines: 1, bytes: 50 },
      },
    };

    const resolved = resolveCodeBlocksToFileSystem([appEditBlock], latestVfs);
    const accessFile = resolved.find((f) => f.filename === "/access.js");
    expect(accessFile).toBeDefined();
    expect(accessFile?.type).toBe("code-block");

    await chat.close();
  });
});
