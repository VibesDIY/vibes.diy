import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { eq, and } from "drizzle-orm";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { resolveWhoAmI } from "../svc/public/who-am-i.js";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";

// access.js exporting a `grants` function → extraction creates a binding for the
// "grants" dbName. The function body is real (extraction parses exports) but the
// actual return value comes from the mocked invokeAccessFn recorder below.
const ACCESS_JS_GRANTS = `export function grants(doc, oldDoc, user) {
  return { channels: ["mods"], members: { moderator: [doc.userHandle] }, grant: { roles: { moderator: ["mods"] } } };
}`;

interface InvokeRecorder {
  result: AccessDescriptor | { forbidden: string };
}

// Minimal VerifiedResult shaped like resolveWhoAmI expects (mirrors who-am-i.test.ts).
function makeAuth(userId: string, nick: string) {
  return {
    type: "VerifiedAuthResult" as const,
    inDashAuth: { type: "device-id" as const, token: "fake" },
    verifiedAuth: {
      type: "clerk" as const,
      claims: {
        userId,
        role: "user",
        sub: `sub-${userId}`,
        params: {
          email: `${nick}@example.com`,
          email_verified: true,
          first: nick,
          last: "Test",
          name: `${nick} Test`,
          image_url: "",
          public_meta: undefined,
          nick,
        },
      },
    },
  };
}

describe("revocation by deletion (#2531)", { timeout: 30000 }, () => {
  const recorder: InvokeRecorder = { result: { channels: ["mods"], allowAnonymous: true } };
  let vibesCtx: VibesApiSQLCtx;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  let bobUserId: string;
  let bobSlug: string;
  const MOD_GRANT_DOC_ID = "modgrant-bob";

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async () => recorder.result,
    });
    vibesCtx = ctx.vibesCtx;

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    ctx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const session = "revoke-on-delete-test";
    const aliceUser = await createTestUser({ sthis, deviceCA, session, seqUserId: 1 });
    const bobUser = await createTestUser({ sthis, deviceCA, session, seqUserId: 2 });
    bobUserId = `user-id-${session}-2`;

    function mkApi(user: Awaited<ReturnType<typeof createTestUser>>) {
      return new VibesDiyApi({
        apiUrl: "http://localhost:8787/api",
        ws: wsPair.p1 as unknown as WebSocket,
        timeoutMs: 10000,
        getToken: async () => Result.Ok(await user.getDashBoardToken()),
      });
    }

    ownerApi = mkApi(aliceUser);
    const bobApi = mkApi(bobUser);

    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_GRANTS },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Bob needs a handle binding so resolveActiveHandle resolves his viewer slug.
    const bobInfoRes = await bobApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    const bobInfo = bobInfoRes.Ok();
    if (!isResEnsureAppSlugOk(bobInfo)) assert.fail("Failed to create bob app");
    bobSlug = bobInfo.ownerHandle;
    await bobApi.ensureUserSettings({ settings: [{ type: "defaultHandle", ownerHandle: bobSlug }] });

    // Owner writes a modGrant doc that promotes bob to "moderator".
    recorder.result = {
      channels: ["mods"],
      members: { moderator: [bobSlug] },
      grant: { roles: { moderator: ["mods"] } },
    };
    const rPut = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "grants",
      docId: MOD_GRANT_DOC_ID,
      doc: { _id: MOD_GRANT_DOC_ID, kind: "modGrant", userHandle: bobSlug },
    });
    assert(rPut.isOk(), `modGrant putDoc failed: ${rPut.isErr() ? rPut.Err().message : ""}`);
  });

  async function storedOutputRow() {
    const tOutputs = vibesCtx.sql.tables.accessFnOutputs;
    return vibesCtx.sql.db
      .select({ docId: tOutputs.docId, hasGrants: tOutputs.hasGrants })
      .from(tOutputs)
      .where(
        and(
          eq(tOutputs.ownerHandle, ownerHandle),
          eq(tOutputs.appSlug, appSlug),
          eq(tOutputs.dbName, "grants"),
          eq(tOutputs.docId, MOD_GRANT_DOC_ID)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);
  }

  it("grant applies while the modGrant doc exists", async () => {
    const row = await storedOutputRow();
    expect(row?.hasGrants).toBe(1);

    const res = await resolveWhoAmI(vibesCtx, { auth: makeAuth(bobUserId, "bob"), appSlug, ownerUserSlug: ownerHandle });
    assert(res.isOk(), `resolveWhoAmI failed: ${res.isErr() ? res.Err().message : ""}`);
    expect(res.Ok().viewer?.userHandle).toBe(bobSlug);
    expect(res.Ok().grants?.grants?.roles).toContain("moderator");
  });

  it("deleting the modGrant doc clears its access-fn output and revokes the grant", async () => {
    const rDel = await ownerApi.deleteDoc({ ownerHandle, appSlug, dbName: "grants", docId: MOD_GRANT_DOC_ID });
    assert(rDel.isOk(), `deleteDoc failed: ${rDel.isErr() ? rDel.Err().message : ""}`);

    // The sidecar must have dropped the stored output row.
    const row = await storedOutputRow();
    expect(row).toBeUndefined();

    // who-am-i must no longer reduce the revoked role into bob's grants.
    const res = await resolveWhoAmI(vibesCtx, { auth: makeAuth(bobUserId, "bob"), appSlug, ownerUserSlug: ownerHandle });
    assert(res.isOk(), `resolveWhoAmI failed: ${res.isErr() ? res.Err().message : ""}`);
    expect(res.Ok().grants?.grants?.roles ?? []).not.toContain("moderator");
  });
});
