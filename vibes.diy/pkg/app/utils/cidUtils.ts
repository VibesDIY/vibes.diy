/**
 * Utilities for generating content identifiers (CIDs) for deduplication
 */

/**
 * Generate a simple content identifier from a data URL
 * Uses a hash of the base64 content for fast comparison
 */
export async function generateCid(dataUrl: string): Promise<string> {
  // Extract base64 content from data URL
  const base64Content = dataUrl.split(",")[1];
  if (!base64Content) {
    throw new Error("Invalid data URL format");
  }

  // Convert to Uint8Array for hashing
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Generate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256-${hashHex}`;
}

/**
 * Generate CID from a File object
 */
export async function generateCidFromFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256-${hashHex}`;
}
