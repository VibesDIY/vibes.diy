/**
 * Shared test helpers for parser-based testing
 */

/**
 * Creates a seeded random number generator for reproducibility.
 */
function createRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Feed fixture to parser with simulated network fragmentation using random chunk sizes.
 * Uses a fixed seed for reproducible tests.
 *
 * @param parser - Parser with processChunk method
 * @param content - The fixture content to feed
 * @param chunkSize - Max chunk size for random chunking (default 15), or 0 for no fragmentation
 */
export function feedFixtureToParser(parser: { processChunk: (s: string) => void }, content: string, chunkSize = 15) {
  if (chunkSize === 0) {
    parser.processChunk(content);
    return;
  }

  // Use seeded random for reproducibility (seed based on content length)
  const random = createRandom(content.length);
  const minChunkSize = 1;
  const maxChunkSize = chunkSize;

  let pos = 0;
  while (pos < content.length) {
    const size = Math.floor(random() * (maxChunkSize - minChunkSize + 1)) + minChunkSize;
    const chunk = content.slice(pos, pos + size);
    parser.processChunk(chunk);
    pos += size;
  }
}

/**
 * Helper to create SSE encoded data
 */
export function toSSE(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
