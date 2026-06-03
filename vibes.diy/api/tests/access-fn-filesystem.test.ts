import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { calcEntryPointUrl, CFInject, cfServe, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, parseArray, fileSystemItem } from "@vibes.diy/api-types";
import type { AccessDescriptor, FileSystemItem } from "@vibes.diy/api-types";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

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
  fetchFn?: typeof fetch
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
    .where(and(eq(tAfb.userSlug, ownerHandle), eq(tAfb.appSlug, appSlug)));
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
});
