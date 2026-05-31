import { describe, expect, it } from "vitest";
import { storeAndAuditAsset } from "@vibes.diy/api-svc";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Server-side image-gen contract (Seam G2):
// - Prodia bytes go through `storeAndAuditAsset` so AssetUploads owns
//   the audit row.
// - `block.image` carries `{uploadId, cid, mimeType, size}` instead of
//   a `/assets/cid?url=` URL string.
// - The hook reads `_files.v<N>` from the doc; Stage C mints meta.url
//   for display.
//
// This test exercises the helper directly with a synthetic PNG payload.
// The full Prodia round-trip is covered by the demo gate (Seam G6) since
// the test infrastructure can't reach the real Prodia inference service.

describe("img-gen server contract", () => {
  it("stores synthetic PNG bytes and writes an AssetUploads row", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA);

    // Synthetic PNG signature + a few bytes — content-addressed storage
    // does not care if it's a valid image.
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xde, 0xad, 0xbe, 0xef]);

    const rStored = await storeAndAuditAsset(ctx.vibesCtx, {
      bytes: pngBytes,
      userId: "img-gen-test-user",
      ownerHandle: "img-gen-test-slug",
      appSlug: "img-gen-test-app",
      mimeType: "image/png",
    });
    expect(rStored.isOk()).toBe(true);
    const stored = rStored.Ok();
    expect(stored.uploadId).toMatch(/.+/);
    expect(stored.cid).toMatch(/.+/);
    expect(stored.size).toBe(pngBytes.byteLength);
    expect(stored.mimeType).toBe("image/png");

    const t = ctx.vibesCtx.sql.tables.assetUploads;
    const rows = await ctx.vibesCtx.sql.db.select().from(t).where(eq(t.uploadId, stored.uploadId));
    expect(rows).toHaveLength(1);
    expect(rows[0].ownerHandle).toBe("img-gen-test-slug");
    expect(rows[0].appSlug).toBe("img-gen-test-app");
    expect(rows[0].userId).toBe("img-gen-test-user");
    expect(rows[0].mimeType).toBe("image/png");
    expect(rows[0].cid).toBe(stored.cid);
    expect(rows[0].assetURI).toBe(stored.assetURI);
    expect(rows[0].size).toBe(pngBytes.byteLength);
  });
});
