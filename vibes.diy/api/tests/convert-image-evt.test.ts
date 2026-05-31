import { describe, expect, it } from "vitest";
import { convertImageEvtToFileRef } from "@vibes.diy/api-svc";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import type { BlockImageMsg } from "@vibes.diy/call-ai-v2";

// Coverage for the `block.image` URL → file-ref conversion that
// `appendBlockEvent` performs server-side. Both inline `data:` and
// remote `https:` URLs flow through `storeAndAuditAsset` so the
// persisted block always carries `{uploadId, cid, mimeType, size}`
// and never a raw `url` (the bridge in srv-sandbox.ts drops url-only
// blocks).

const baseEvt = {
  type: "block.image" as const,
  sectionId: "section-1",
  blockId: "block-1",
  streamId: "stream-1",
  seq: 0,
  blockNr: 0,
  timestamp: new Date(),
  stats: { lines: 0, bytes: 0 },
};

function makeEvt(extra: Partial<BlockImageMsg>): BlockImageMsg {
  return { ...baseEvt, ...extra } as BlockImageMsg;
}

const tinyPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xde, 0xad, 0xbe, 0xef]);
const tinyPngB64 = "iVBORw0KGgoAAAAA"; // not the real bytes — content-addressed storage doesn't care

describe("convertImageEvtToFileRef", () => {
  it("converts a data: URL into the file-ref shape and writes an AssetUploads row", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA);

    const evt = makeEvt({ url: `data:image/png;base64,${tinyPngB64}` });
    const r = await convertImageEvtToFileRef(ctx.vibesCtx, {
      evt,
      userId: "u-1",
      ownerHandle: "user-slug-1",
      appSlug: "app-slug-1",
    });
    expect(r.isOk()).toBe(true);
    const out = r.Ok();
    expect(out.url).toBeUndefined();
    expect(out.uploadId).toMatch(/.+/);
    expect(out.cid).toMatch(/.+/);
    expect(out.mimeType).toBe("image/png");
    expect(out.size).toBeGreaterThan(0);

    const uploadId = out.uploadId ?? "";
    const t = ctx.vibesCtx.sql.tables.assetUploads;
    const rows = await ctx.vibesCtx.sql.db.select().from(t).where(eq(t.uploadId, uploadId));
    expect(rows).toHaveLength(1);
    expect(rows[0].ownerHandle).toBe("user-slug-1");
    expect(rows[0].appSlug).toBe("app-slug-1");
    expect(rows[0].mimeType).toBe("image/png");
  });

  it("fetches a remote URL and converts via injected fetchFn", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA);

    let fetchedUrl: string | undefined;
    const fakeFetch: typeof fetch = async (input) => {
      fetchedUrl = typeof input === "string" ? input : input.toString();
      return new Response(tinyPng, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    };

    const evt = makeEvt({ url: "https://example.com/img.png" });
    const r = await convertImageEvtToFileRef(ctx.vibesCtx, {
      evt,
      userId: "u-2",
      ownerHandle: "user-slug-2",
      appSlug: "app-slug-2",
      fetchFn: fakeFetch,
    });
    expect(r.isOk()).toBe(true);
    const out = r.Ok();
    expect(fetchedUrl).toBe("https://example.com/img.png");
    expect(out.url).toBeUndefined();
    expect(out.uploadId).toMatch(/.+/);
    expect(out.cid).toMatch(/.+/);
    expect(out.mimeType).toBe("image/jpeg");
    expect(out.size).toBe(tinyPng.byteLength);

    const uploadId = out.uploadId ?? "";
    const t = ctx.vibesCtx.sql.tables.assetUploads;
    const rows = await ctx.vibesCtx.sql.db.select().from(t).where(eq(t.uploadId, uploadId));
    expect(rows).toHaveLength(1);
    expect(rows[0].mimeType).toBe("image/jpeg");
    expect(rows[0].size).toBe(tinyPng.byteLength);
  });

  it("returns Err with the status when fetch returns non-OK", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA);

    const fakeFetch: typeof fetch = async () => new Response("nope", { status: 404 });

    const r = await convertImageEvtToFileRef(ctx.vibesCtx, {
      evt: makeEvt({ url: "https://example.com/missing.png" }),
      userId: "u-3",
      ownerHandle: "user-slug-3",
      appSlug: "app-slug-3",
      fetchFn: fakeFetch,
    });
    expect(r.isErr()).toBe(true);
    expect(String(r.Err())).toContain("404");
  });

  it("passes through events with no url unchanged", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA);

    const evt = makeEvt({
      uploadId: "already-set",
      cid: "cid-already-set",
      mimeType: "image/png",
      size: 42,
    });
    const r = await convertImageEvtToFileRef(ctx.vibesCtx, {
      evt,
      userId: "u-4",
      ownerHandle: "user-slug-4",
      appSlug: "app-slug-4",
    });
    expect(r.isOk()).toBe(true);
    expect(r.Ok()).toBe(evt);
  });

  it("returns Err for a malformed data: URL", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA);

    const r = await convertImageEvtToFileRef(ctx.vibesCtx, {
      evt: makeEvt({ url: "data:image/png;not-base64-here" }),
      userId: "u-5",
      ownerHandle: "user-slug-5",
      appSlug: "app-slug-5",
    });
    expect(r.isErr()).toBe(true);
    expect(String(r.Err())).toContain("data:");
  });
});
