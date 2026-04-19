export async function resizeImageToBase64(file: File, maxDim = 1024, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2d context from OffscreenCanvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
