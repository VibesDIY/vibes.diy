export function base64ToFile(
  base64Data: string,
  filename = 'generated-image.png',
  mimeType = 'image/png'
): File {
  // Remove data URL prefix if present
  const base64Content = base64Data.includes('base64,')
    ? base64Data.split('base64,')[1]
    : base64Data;

  // Convert base64 to binary
  const binaryStr = atob(base64Content);

  // Create array buffer
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Create blob and file
  const blob = new Blob([bytes], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}
