import { describe, expect, it } from "vitest";
import { addNewVersion, generatePromptKey, generateVersionId } from "@vibes.diy/base/hooks/img-gen/index.js";
import type { FileMeta } from "@vibes.diy/vibe-types";

// Seam G4 contract — `useImgGen` writes to `_files.<versionId>` and the
// version's `id` IS the fileKey (no separate `fileKey` field, no
// per-version `assetUrl: string`). Display reads `doc._files[ver.id].url`
// which the platform mints on read. This test pins the doc shape that
// the hook produces via `addNewVersion`.

const FAKE_FILE_META_V1: FileMeta = {
  uploadId: "upl-1",
  type: "image/png",
  size: 1024,
  lastModified: 1700000000000,
};

const FAKE_FILE_META_V2: FileMeta = {
  uploadId: "upl-2",
  type: "image/png",
  size: 2048,
  lastModified: 1700000001000,
};

describe("ImgGen doc shape (addNewVersion)", () => {
  it("creates the first version with _files.v1 carrying FileMeta", () => {
    const updated = addNewVersion({ _id: "doc-1", type: "image" }, FAKE_FILE_META_V1, "a sunset");
    expect(updated.versions).toHaveLength(1);
    const v1 = updated.versions[0];
    expect(v1.id).toBe("v1");
    expect(v1.promptKey).toBe("p1");
    // The version's `id` doubles as the fileKey — no separate fileKey.
    expect((v1 as unknown as Record<string, unknown>).fileKey).toBeUndefined();
    expect((v1 as unknown as Record<string, unknown>).assetUrl).toBeUndefined();
    expect(updated._files).toEqual({ v1: FAKE_FILE_META_V1 });
    expect(updated.currentVersion).toBe(0);
    expect(updated.prompts).toEqual({ p1: { text: "a sunset", created: expect.any(Number) } });
    expect(updated.currentPromptKey).toBe("p1");
    expect(updated.type).toBe("image");
  });

  it("appends a new version preserving prior _files entries", () => {
    const first = addNewVersion({ _id: "doc-2", type: "image" }, FAKE_FILE_META_V1, "first prompt");
    const second = addNewVersion(first, FAKE_FILE_META_V2, "first prompt");
    expect(second.versions).toHaveLength(2);
    expect(second.versions[1].id).toBe("v2");
    expect(second._files?.v1).toEqual(FAKE_FILE_META_V1);
    expect(second._files?.v2).toEqual(FAKE_FILE_META_V2);
    expect(second.currentVersion).toBe(1);
    // Same prompt text — no new prompt key.
    expect(second.currentPromptKey).toBe("p1");
    expect(Object.keys(second.prompts ?? {})).toEqual(["p1"]);
  });

  it("mints a new prompt key when the prompt text changes", () => {
    const first = addNewVersion({ _id: "doc-3", type: "image" }, FAKE_FILE_META_V1, "first prompt");
    const second = addNewVersion(first, FAKE_FILE_META_V2, "second prompt");
    expect(second.versions[1].promptKey).toBe("p2");
    expect(second.currentPromptKey).toBe("p2");
    expect(second.prompts?.p1?.text).toBe("first prompt");
    expect(second.prompts?.p2?.text).toBe("second prompt");
  });

  it("attaches model to the version when supplied", () => {
    const updated = addNewVersion({ _id: "doc-4", type: "image" }, FAKE_FILE_META_V1, "with model", "openai/gpt-5-image-mini");
    expect(updated.versions[0].model).toBe("openai/gpt-5-image-mini");
  });

  it("ID generators stay stable", () => {
    expect(generateVersionId(1)).toBe("v1");
    expect(generateVersionId(7)).toBe("v7");
    expect(generatePromptKey(1)).toBe("p1");
    expect(generatePromptKey(3)).toBe("p3");
  });
});
