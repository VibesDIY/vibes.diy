import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@vibes.diy/identity/testing";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// #2902 — Saving an unpublished dev draft must NOT re-bind the live access
// function for a *published* app. The AccessFunctionBindings row that
// enforcement reads (keyed by ownerHandle/appSlug/dbName) must track the
// PUBLISHED version once one exists; dev drafts are inert until published.
// When no published version exists yet, the latest dev draft governs (so a
// never-published app's owner can still iterate on access.js).

const ACCESS_RESTRICTIVE = `export default function (doc) {
  return { allowAnonymous: false };
}`;
const ACCESS_PERMISSIVE = `export default function (doc) {
  return { allowAnonymous: true };
}`;

async function setup() {
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
  const owner = await createTestUser({ sthis, deviceCA, seqUserId: 902 });
  const api = new VibesDiyApi({
    apiUrl: "http://localhost:8787/api",
    ws: wsPair.p1 as unknown as WebSocket,
    timeoutMs: 10000,
    getToken: async () => Result.Ok(await owner.getDashBoardToken()),
  });
  return { ctx, api, sthis };
}

async function bindingCid(
  ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>,
  ownerHandle: string,
  appSlug: string
): Promise<string | undefined> {
  const tAfb = ctx.vibesCtx.sql.tables.accessFunctionBindings;
  const rows = await ctx.vibesCtx.sql.db
    .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
    .from(tAfb)
    .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
  return rows.find((r) => r.dbName === "*")?.accessFnCid;
}

async function ensure(
  api: VibesDiyApi,
  appSlug: string | undefined,
  access: string,
  opts: { mode?: "dev" | "production"; runId?: string } = {}
) {
  const r = await api.ensureAppSlug({
    ...(appSlug ? { appSlug } : {}),
    mode: opts.mode ?? "dev",
    ...(opts.runId ? { runId: opts.runId } : {}),
    fileSystem: [
      { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
      { type: "code-block", lang: "js", filename: "/access.js", content: access },
    ],
  });
  const res = r.Ok();
  if (!isResEnsureAppSlugOk(res)) assert.fail(`ensureAppSlug failed: ${JSON.stringify(res)}`);
  return res;
}

describe("#2902 dev draft does not re-bind a published app's access fn", { timeout: 30000 }, () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let api: VibesDiyApi;
  let sthis: ReturnType<typeof ensureSuperThis>;

  beforeAll(async () => {
    const s = await setup();
    ctx = s.ctx;
    api = s.api;
    sthis = s.sthis;
  }, 30000);

  it("a never-published app's latest dev draft governs the binding", async () => {
    // No production version exists, so each dev draft re-binds the access fn —
    // an owner can iterate on access.js before the first publish.
    const v1 = await ensure(api, undefined, ACCESS_RESTRICTIVE);
    const { appSlug, ownerHandle } = v1;
    const cidRestrictive = await bindingCid(ctx, ownerHandle, appSlug);
    expect(cidRestrictive).toBeDefined();

    await ensure(api, appSlug, ACCESS_PERMISSIVE);
    const cidPermissive = await bindingCid(ctx, ownerHandle, appSlug);
    expect(cidPermissive).toBeDefined();
    expect(cidPermissive).not.toBe(cidRestrictive);
  });

  it("once published, an unpublished dev draft does NOT re-bind the live access fn", async () => {
    // Publish a restrictive access.js. The binding tracks the published version.
    const v1 = await ensure(api, undefined, ACCESS_RESTRICTIVE);
    const { appSlug, ownerHandle } = v1;
    const cidRestrictive = await bindingCid(ctx, ownerHandle, appSlug);
    expect(cidRestrictive).toBeDefined();

    const rPub = await api.publishApp({ appSlug, ownerHandle });
    if (rPub.isErr()) assert.fail(`publishApp failed: ${JSON.stringify(rPub.Err())}`);
    expect(await bindingCid(ctx, ownerHandle, appSlug)).toBe(cidRestrictive);

    // THE BUG (#2902): saving an unpublished dev draft that loosens access.js
    // must NOT change the live binding now that a published version exists.
    await ensure(api, appSlug, ACCESS_PERMISSIVE);
    expect(await bindingCid(ctx, ownerHandle, appSlug)).toBe(cidRestrictive);

    // Publishing the loosened draft is the consent step that flips the binding.
    const rPub2 = await api.publishApp({ appSlug, ownerHandle });
    if (rPub2.isErr()) assert.fail(`publishApp(2) failed: ${JSON.stringify(rPub2.Err())}`);
    const cidAfter = await bindingCid(ctx, ownerHandle, appSlug);
    expect(cidAfter).toBeDefined();
    expect(cidAfter).not.toBe(cidRestrictive);
  });

  it("a same-runId late dev write does not re-bind the published access fn (Codex/Charlie P1)", async () => {
    // A production write lands first under runId R (creates the production row +
    // binds restrictive). A later dev write with the SAME runId reconciles in
    // place — ensureApps returns the canonical PRODUCTION mode even though these
    // files are the dev draft. Binding must use the request lane (dev), so the
    // permissive draft stays inert; binding by ensured.mode would flip it live.
    const runId = sthis.nextId(12).str;
    const prod = await ensure(api, undefined, ACCESS_RESTRICTIVE, { mode: "production", runId });
    const { appSlug, ownerHandle } = prod;
    const cidRestrictive = await bindingCid(ctx, ownerHandle, appSlug);
    expect(cidRestrictive).toBeDefined();

    await ensure(api, appSlug, ACCESS_PERMISSIVE, { mode: "dev", runId });
    expect(await bindingCid(ctx, ownerHandle, appSlug)).toBe(cidRestrictive);
  });
});
