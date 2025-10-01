/**
 * Utilities for generating content identifiers (CIDs) for deduplication
 */

/**
 * Generate a simple content identifier from a data URL
 * Uses ArrayBuffer fetching for better performance and browser compatibility
 */
export async function generateCid(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    throw new Error("Invalid data URL format");
  }

  try {
    // Fetch the data URL to get ArrayBuffer directly
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return `sha256-${hashHex}`;
  } catch (error) {
    throw new Error(
      `Failed to generate CID: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
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
