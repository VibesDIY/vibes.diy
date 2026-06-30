// Slice B5 (#2856): attemptBackendOnChange — one onChange invocation against a real
// pushed vibe + a fake Worker Loader binding.

import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { attemptBackendOnChange } from "@vibes.diy/api-svc/intern/attempt-backend-onchange.js";
import { type WorkerLoaderBinding } from "@vibes.diy/vibe-runtime/worker-loader-executor.js";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const APP_JSX = { type: "code-block" as const, lang: "jsx", filename: "/App.jsx", content: "function App(){return null;} App();" };
const backendFile = (content: string) => ({ type: "code-block" as const, lang: "js", filename: "/backend.js", content });

const ONCHANGE_BACKEND = `
export async function onChange(event, ctx) {}
export const config = {};
`;
const FETCH_ONLY = `export async function fetch(request, ctx) { return new Response("ok"); }`;

interface FakeLoader {
  binding: WorkerLoaderBinding;
  requests: { handler: string; trigger: { userHandle?: string | null; payload?: Record<string, unknown> } }[];
}
// status drives the simulated isolate response: 204 = clean onChange, 500 = handler throw.
function fakeLoader(status = 204): FakeLoader {
  const requests: FakeLoader["requests"] = [];
  const binding: WorkerLoaderBinding = {
    get(_id, factory) {
      factory();
      return {
        getEntrypoint() {
          return {
            fetch: async (req: Request) => {
              requests.push((await req.json()) as FakeLoader["requests"][number]);
              return new Response(null, { status });
            },
          };
        },
      };
    },
  };
  return { binding, requests };
}

async function setupCtx() {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA);
  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  ctx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return { ctx, wsPair, sthis, deviceCA };
}

describe("attemptBackendOnChange (#2856 B5)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let ownerHandle: string;

  const pushVibe = async (appSlug: string, backendSource?: string) => {
    const fileSystem = backendSource ? [APP_JSX, backendFile(backendSource)] : [APP_JSX];
    const r = await ownerApi.ensureAppSlug({ mode: "dev", appSlug, ownerHandle, fileSystem });
    assert(r.isOk() && isResEnsureAppSlugOk(r.Ok()), `push ${appSlug} failed`);
  };

  const baseInput = (appSlug: string, over: Record<string, unknown> = {}) => ({
    ownerHandle,
    appSlug,
    dbName: "vibes",
    docId: "doc-1",
    seq: 7,
    deleted: false,
    doc: { _id: "doc-1", title: "hi" },
    oldDoc: null,
    ...over,
  });

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx();
    appCtx = ctx;
    const user = await createTestUser({ sthis, deviceCA, seqUserId: 921 });
    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });
    const r = await ownerApi.ensureAppSlug({ mode: "dev", fileSystem: [APP_JSX] });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("bootstrap app failed");
    ownerHandle = res.ownerHandle;
  }, 30000);

  it("runs the onChange handler and reports ran:true, forwarding the doc payload", async () => {
    await pushVibe("oc-run", ONCHANGE_BACKEND);
    const f = fakeLoader(204);
    const out = await attemptBackendOnChange(appCtx.vibesCtx, {
      ...baseInput("oc-run"),
      backendJs: "loader",
      loader: f.binding,
    });
    expect(out).toEqual({ ran: true });
    expect(f.requests[0].handler).toBe("onChange");
    expect(f.requests[0].trigger.userHandle).toBe(null);
    expect(f.requests[0].trigger.payload?.docId).toBe("doc-1");
    expect(f.requests[0].trigger.payload?.seq).toBe(7);
    expect(f.requests[0].trigger.payload?.deleted).toBe(false);
  });

  it("is dark when BACKEND_JS=off → backend_disabled", async () => {
    await pushVibe("oc-off", ONCHANGE_BACKEND);
    const out = await attemptBackendOnChange(appCtx.vibesCtx, { ...baseInput("oc-off"), backendJs: "off" });
    expect(out).toEqual({ ran: false, reason: "backend_disabled" });
  });

  it("returns no_onChange_handler when the live release has no onChange export", async () => {
    await pushVibe("oc-fetchonly", FETCH_ONLY);
    const out = await attemptBackendOnChange(appCtx.vibesCtx, {
      ...baseInput("oc-fetchonly"),
      backendJs: "loader",
      loader: fakeLoader().binding,
    });
    expect(out).toEqual({ ran: false, reason: "no_onChange_handler" });
  });

  it("surfaces a 5xx isolate response as a retryable handler_error", async () => {
    await pushVibe("oc-throw", ONCHANGE_BACKEND);
    const out = await attemptBackendOnChange(appCtx.vibesCtx, {
      ...baseInput("oc-throw"),
      backendJs: "loader",
      loader: fakeLoader(500).binding,
    });
    expect(out).toEqual({ ran: false, reason: "handler_error" });
  });

  it("forwards a delete (tombstone) with deleted:true and the prior oldDoc", async () => {
    await pushVibe("oc-del", ONCHANGE_BACKEND);
    const f = fakeLoader(204);
    const out = await attemptBackendOnChange(appCtx.vibesCtx, {
      ...baseInput("oc-del", { deleted: true, doc: {}, oldDoc: { _id: "doc-1", title: "hi" } }),
      backendJs: "loader",
      loader: f.binding,
    });
    expect(out).toEqual({ ran: true });
    expect(f.requests[0].trigger.payload?.deleted).toBe(true);
    expect(f.requests[0].trigger.payload?.oldDoc).toEqual({ _id: "doc-1", title: "hi" });
  });
});
