import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, VibesDiyApiIface, VibesDiyError } from "@vibes.diy/api-types";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { ResVibeAccessFnSource } from "@vibes.diy/vibe-types";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { resolveAccessFnSource } from "../svc/public/access-fn-source.js";

// access.js with a named export so the binding rows get an "export function db"
const ACCESS_JS_SOURCE = `export function db(doc, oldDoc, user, ctx) { return { channels: ["c"] }; }`;

// ── resolver unit tests ─────────────────────────────────────────────────────

describe("resolveAccessFnSource", { timeout: 30000 }, () => {
  let vibesCtx: VibesApiSQLCtx;
  let ownerHandle: string;
  let appSlug: string;
  let accessFnCid: string;

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vibesCtx = appCtx.vibesCtx;

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const user = await createTestUser({ sthis, deviceCA, session: "access-fn-source-test", seqUserId: 42 });
    const api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });

    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return null; } App();`,
        },
        {
          type: "code-block",
          lang: "js",
          filename: "/access.js",
          content: ACCESS_JS_SOURCE,
        },
      ],
    });
    assert(rRes.isOk(), `ensureAppSlug failed: ${rRes.isErr() ? String(rRes.Err()) : ""}`);
    const res = rRes.Ok();
    assert(isResEnsureAppSlugOk(res), "expected ResEnsureAppSlugOk");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Retrieve accessFnCid from the binding row created by ensureAppSlug.
    const tAfb = vibesCtx.sql.tables.accessFunctionBindings;
    const rows = await vibesCtx.sql.db
      .select({ accessFnCid: tAfb.accessFnCid })
      .from(tAfb)
      .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
    assert(rows.length > 0, "no accessFunctionBindings rows found");
    accessFnCid = rows[0].accessFnCid;
  });

  it("returns the raw access.js source for a known cid", async () => {
    const r = await resolveAccessFnSource(vibesCtx, { ownerHandle, appSlug, cid: accessFnCid });
    expect(r.isOk()).toBe(true);
    expect(r.Ok().cid).toBe(accessFnCid);
    // Raw source — NOT extractExportSource-reduced — still contains the export keyword.
    expect(r.Ok().source).toContain("export function db");
  });

  it("returns source: null for an unknown cid", async () => {
    const r = await resolveAccessFnSource(vibesCtx, { ownerHandle, appSlug, cid: "bafyUNKNOWN" });
    expect(r.isOk()).toBe(true);
    expect(r.Ok().source).toBeNull();
  });

  it("returns source: null when the cid is real but not bound to the given app (no cross-app Assets leak)", async () => {
    // accessFnCid exists in the global Assets store, but is NOT bound to this
    // (ownerHandle, wrong-appSlug). The legacy fallback must not serve it.
    const r = await resolveAccessFnSource(vibesCtx, { ownerHandle, appSlug: `${appSlug}-not-mine`, cid: accessFnCid });
    expect(r.isOk()).toBe(true);
    expect(r.Ok().source).toBeNull();
  });
});

// ── host-handler end-to-end bridge test ────────────────────────────────────

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  }
});

interface CapturedMsg {
  readonly data: unknown;
  readonly origin: string;
}

function fakeMessageEvent(data: unknown, origin: string, source: Window): MessageEvent {
  return { data, origin, source } as unknown as MessageEvent;
}

function setupSandbox(opts: { accessFnSourceResult: Result<ResVibeAccessFnSource, VibesDiyError> }): {
  sandbox: vibesDiySrvSandbox;
  captured: CapturedMsg[];
  iframe: Window;
} {
  const captured: CapturedMsg[] = [];
  const iframe = {
    postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
  } as unknown as Window;

  const fakeApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
    accessFnSource: async () => opts.accessFnSourceResult,
  };

  const sandbox = new vibesDiySrvSandbox({
    chatApi: fakeApi as VibesDiyApiIface,
    vibeApi: fakeApi as VibesDiyApiIface,
    errorLogger: () => {
      /* noop */
    },
    eventListeners: {
      addEventListener: () => {
        /* noop */
      },
      removeEventListener: () => {
        /* noop */
      },
    },
  });
  return { sandbox, captured, iframe };
}

describe("vibeAccessFnSource host handler", () => {
  it("host handler bridges vibe.req.accessFnSource → api.accessFnSource → vibe.res.accessFnSource", async () => {
    const { sandbox, captured, iframe } = setupSandbox({
      accessFnSourceResult: Result.Ok({
        type: "vibe.res.accessFnSource" as const,
        tid: "t1",
        cid: "bafyX",
        source: "export function db(){}",
      }),
    });
    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibe.req.accessFnSource", tid: "t1", appSlug: "myapp", ownerHandle: "alice", cid: "bafyX" },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.accessFnSource");
    expect(msg?.data).toMatchObject({ tid: "t1", type: "vibe.res.accessFnSource", cid: "bafyX", source: "export function db(){}" });
  });
});
