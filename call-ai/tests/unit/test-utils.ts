import { OpenRouterParser, SegmentAccumulator } from "@vibes.diy/call-ai-base";
import { LineStreamParser } from "@vibes.diy/call-ai-base";
import { SSEDataParser } from "@vibes.diy/call-ai-base";
import { JsonParser } from "@vibes.diy/call-ai-base";

/**
 * Creates a random number generator, optionally seeded for reproducibility.
 */
function createRandom(seed?: number): () => number {
  if (seed === undefined) {
    return Math.random;
  }
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Feeds raw fixture data to a parser with random chunk sizes.
 * This simulates real network conditions where data may be split at arbitrary points.
 *
 * @param parser - The parser instance to feed (LineStreamParser or SSEDataParser)
 * @param fixture - The raw fixture string
 * @param options - Optional configuration
 * @param options.minChunkSize - Minimum chunk size (default: 1)
 * @param options.maxChunkSize - Maximum chunk size (default: 50)
 * @param options.seed - Random seed for reproducibility (default: uses Math.random)
 */
export function feedFixtureRandomly(
  parser: LineStreamParser | SSEDataParser | JsonParser | OpenRouterParser | SegmentAccumulator,
  fixture: string,
  options: {
    minChunkSize?: number;
    maxChunkSize?: number;
    seed?: number;
  } = {},
): void {
  const { minChunkSize = 1, maxChunkSize = 50, seed } = options;
  const random = createRandom(seed);

  let pos = 0;
  while (pos < fixture.length) {
    const chunkSize = Math.floor(random() * (maxChunkSize - minChunkSize + 1)) + minChunkSize;
    const chunk = fixture.slice(pos, pos + chunkSize);
    parser.processChunk(chunk);
    pos += chunkSize;
  }
}

/**
 * Generates random chunk boundaries for a fixture string.
 * Returns an array of chunks that when joined equal the original fixture.
 */
export function randomChunks(
  fixture: string,
  options: {
    minChunkSize?: number;
    maxChunkSize?: number;
    seed?: number;
  } = {},
): string[] {
  const { minChunkSize = 1, maxChunkSize = 50, seed } = options;
  const random = createRandom(seed);

  const chunks: string[] = [];
  let pos = 0;
  while (pos < fixture.length) {
    const chunkSize = Math.floor(random() * (maxChunkSize - minChunkSize + 1)) + minChunkSize;
    chunks.push(fixture.slice(pos, pos + chunkSize));
    pos += chunkSize;
  }
  return chunks;
}
