import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { CFInject, cfServe, noopCache, vibesMsgEvento, WSSendProvider, VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

let apiTestIdentityPartition = 0;

export interface CreateApiTestCtxOpts {
  /**
   * Optional fixed base used to partition createTestUser identities.
   *
   * Explicit seqUserId values avoid flaky collisions from createTestUser's
   * default seq derivation (which can produce NaN and alias owner/requester).
   */
  seqUserIdBase?: number;
}

function nextSeqUserIdBase(): number {
  const workerIdRaw = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "0";
  const workerId = Number.parseInt(workerIdRaw, 10);
  const safeWorkerId = Number.isFinite(workerId) ? workerId : 0;

  // Reserve a distinct 100-id block per context within a worker/process.
  return process.pid * 1_000_000 + safeWorkerId * 10_000 + ++apiTestIdentityPartition * 100;
}

export interface ApiTestCtx {
  api: VibesDiyApi;
  api2: VibesDiyApi;
  appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  sthis: ReturnType<typeof ensureSuperThis>;
  createApp: () => Promise<{ appSlug: string; userSlug: string }>;
}

export async function createApiTestCtx(opts: CreateApiTestCtxOpts = {}): Promise<ApiTestCtx> {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
  const seqUserIdBase = opts.seqUserIdBase ?? nextSeqUserIdBase();
  const testUser = await createTestUser({ sthis, deviceCA, seqUserId: seqUserIdBase + 1 });

  const fetchPair = TestFetchPair.create();
  const wsPair = TestWSPair.create();

  fetchPair.server.onServe(async (req: Request) => {
    return cfServe(
      req as unknown as CFRequest,
      {
        appCtx: appCtx.appCtx,
        cache: noopCache,
        drizzle: appCtx.vibesCtx.sql.db,
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

  appCtx.vibesCtx.connections.add(wsSendProvider);

  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };

  const api = new VibesDiyApi({
    apiUrl: "http://localhost:8787/api",
    ws: wsPair.p1 as unknown as WebSocket,
    fetch: fetchPair.client.fetch,
    timeoutMs: 100000,
    getToken: async () => {
      return Result.Ok(await testUser.getDashBoardToken());
    },
  });

  const testUser2 = await createTestUser({ sthis, deviceCA, seqUserId: seqUserIdBase + 2 });
  const api2 = new VibesDiyApi({
    apiUrl: "http://localhost:8787/api",
    ws: wsPair.p1 as unknown as WebSocket,
    fetch: fetchPair.client.fetch,
    timeoutMs: 100000,
    getToken: async () => {
      return Result.Ok(await testUser2.getDashBoardToken());
    },
  });

  async function createApp() {
    const now = sthis.nextId(8).str;
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Hello ${now}</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    }
    return { appSlug: res.appSlug, userSlug: res.userSlug };
  }

  return { api, api2, appCtx, sthis, createApp };
}

export { type VibesApiSQLCtx };
