// Accepts either a Blob/File or a Fireproof DocFileMeta-like object
// ({ file: () => Promise<File> }) so callers can pass `_files.<name>`
// straight through from a Fireproof doc without resolving first.
type BlobLike = Blob | { file: () => Promise<Blob> };

export async function resizeImageToBase64(input: BlobLike, maxDim = 1024, quality = 0.85): Promise<string> {
  const blob =
    typeof (input as { file?: unknown }).file === "function"
      ? await (input as { file: () => Promise<Blob> }).file()
      : (input as Blob);

  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2d context from OffscreenCanvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const out = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(out);
  });
}
