import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, type AccessDescriptor } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Regression coverage for #2512: the write path caches access.js source bytes
// per access-fn CID on the DO (vctx.accessFnSourceCache). The source is
// content-addressed/immutable per CID, so the first write to an access-bound
// vibe fetches it from storage and every subsequent write reuses the cached
// bytes — removing the per-write storage (R2) round-trip. We toggle the cache
// on a single shared ctx/app to assert: with the cache the source is fetched
// once across many writes; without it the source is fetched on every write
// (unchanged behavior).

const ACCESS_JS = `export default function(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to save" };
  return { channels: ["default"], allowAnonymous: true };
}`;

const recorder = {
  sources: [] as (string | undefined)[],
  result: { channels: ["default"], allowAnonymous: true } as AccessDescriptor,
};
const fetchedUris: string[] = [];

describe("access.js source cache on the write path (#2512)", { timeout: 30000 }, () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  let assetUri: string;

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async (params) => {
        recorder.sources.push(params.source);
        return recorder.result;
      },
    });

    // Spy on storage.fetch so we can count source round-trips during writes.
    const origFetch = ctx.vibesCtx.storage.fetch.bind(ctx.vibesCtx.storage);
    ctx.vibesCtx.storage.fetch = (url: string) => {
      fetchedUris.push(url);
      return origFetch(url);
    };

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    ctx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const user = await createTestUser({ sthis, deviceCA, seqUserId: 910 });
    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });

    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    const tAfb = ctx.vibesCtx.sql.tables.accessFunctionBindings;
    const binding = await ctx.vibesCtx.sql.db
      .select({ accessFnAssetUri: tAfb.accessFnAssetUri })
      .from(tAfb)
      .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug), eq(tAfb.dbName, "*")))
      .then((rows) => rows[0]);
    assert(binding?.accessFnAssetUri, "wildcard binding must have an asset URI");
    assetUri = binding.accessFnAssetUri;
  }, 30000);

  async function writeN(n: number): Promise<void> {
    for (let i = 0; i < n; i++) {
      const res = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "default", doc: { title: `write ${i}` } });
      expect(res.isOk()).toBe(true);
    }
  }

  it("fetches source from storage only once across many writes when the cache is present", async () => {
    // Fresh, empty cache so the first write is a miss regardless of prior tests.
    ctx.vibesCtx.accessFnSourceCache = new Map<string, string>();
    fetchedUris.length = 0;
    recorder.sources = [];

    await writeN(4);

    const sourceFetches = fetchedUris.filter((u) => u === assetUri);
    expect(sourceFetches.length).toBe(1);
    // Every write still received the (identical, correct) source.
    expect(recorder.sources.length).toBe(4);
    for (const src of recorder.sources) {
      expect(src).toContain("allowAnonymous");
    }
  });

  it("fetches source on every write when no cache is provided (unchanged behavior)", async () => {
    ctx.vibesCtx.accessFnSourceCache = undefined;
    fetchedUris.length = 0;
    recorder.sources = [];

    await writeN(3);

    const sourceFetches = fetchedUris.filter((u) => u === assetUri);
    expect(sourceFetches.length).toBe(3);
    expect(recorder.sources.length).toBe(3);
  });
});
