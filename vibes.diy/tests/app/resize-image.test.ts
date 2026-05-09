import { describe, expect, it } from "vitest";
import { resizeImageToBase64 } from "@vibes.diy/vibe-runtime";

// 1x1 red PNG.
const RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function makePngBlob(): Blob {
  const bytes = decodeBase64ToBytes(RED_PNG_BASE64);
  // Copy into a fresh ArrayBuffer-backed Uint8Array to satisfy BlobPart's
  // ArrayBufferView<ArrayBuffer> typing under recent TS lib.dom changes.
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Blob([buf], { type: "image/png" });
}

describe("resizeImageToBase64", () => {
  it("accepts a raw Blob/File", async () => {
    const blob = makePngBlob();
    const dataUrl = await resizeImageToBase64(blob, 64, 0.9);
    expect(dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("accepts a Fireproof DocFileMeta-like object via .file()", async () => {
    const blob = makePngBlob();
    let fileCalls = 0;
    const fileMeta = {
      type: "image/png",
      size: blob.size,
      lastModified: 0,
      file: async () => {
        fileCalls++;
        return blob;
      },
    };
    const dataUrl = await resizeImageToBase64(fileMeta, 64, 0.9);
    expect(fileCalls).toBe(1);
    expect(dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
  });
});
