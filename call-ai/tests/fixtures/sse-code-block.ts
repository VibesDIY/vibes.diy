/**
 * SSE Fixtures for testing streaming code block detection
 *
 * These fixtures represent real SSE responses from OpenAI-compatible APIs.
 * Use rebuffer() to simulate different chunking patterns.
 */

/**
 * Simple code block: text intro followed by JS code
 *
 * Expected output:
 * - TEXT_FRAGMENT: "Here's some code:\n"
 * - CODE_START: language="js"
 * - CODE_FRAGMENT: "const x = 1;\n"
 * - CODE_END
 */
export const sseCodeBlock = `data: {"choices":[{"delta":{"content":"Here's some code:\\n"}}]}

data: {"choices":[{"delta":{"content":"\`\`\`js\\n"}}]}

data: {"choices":[{"delta":{"content":"const x = 1;\\n"}}]}

data: {"choices":[{"delta":{"content":"\`\`\`\\n"}}]}

data: [DONE]
`;

/**
 * Multiple code blocks with text between
 *
 * Expected output:
 * - TEXT_FRAGMENT: "First:\n"
 * - CODE_START: language="js"
 * - CODE_FRAGMENT: "a();\n"
 * - CODE_END
 * - TEXT_FRAGMENT: "\nSecond:\n"
 * - CODE_START: language="py"
 * - CODE_FRAGMENT: "b()\n"
 * - CODE_END
 */
export const sseMultipleBlocks = `data: {"choices":[{"delta":{"content":"First:\\n"}}]}

data: {"choices":[{"delta":{"content":"\`\`\`js\\n"}}]}

data: {"choices":[{"delta":{"content":"a();\\n"}}]}

data: {"choices":[{"delta":{"content":"\`\`\`\\n"}}]}

data: {"choices":[{"delta":{"content":"\\nSecond:\\n"}}]}

data: {"choices":[{"delta":{"content":"\`\`\`py\\n"}}]}

data: {"choices":[{"delta":{"content":"b()\\n"}}]}

data: {"choices":[{"delta":{"content":"\`\`\`\\n"}}]}

data: [DONE]
`;

/**
 * Incomplete stream - code block without closing fence
 * Simulates connection drop or timeout
 *
 * Expected output:
 * - CODE_START: language="ts"
 * - CODE_FRAGMENT: "const partial ="
 * - (stream ends without CODE_END)
 */
export const sseIncompleteBlock = `data: {"choices":[{"delta":{"content":"\`\`\`ts\\n"}}]}

data: {"choices":[{"delta":{"content":"const partial ="}}]}

data: [DONE]
`;

/**
 * Parse SSE text into individual content chunks (what parseSSE yields)
 */
export function parseSSEToChunks(sse: string): string[] {
  const chunks: string[] = [];
  const lines = sse.split("\n");

  for (const line of lines) {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      try {
        const json = JSON.parse(line.slice(6));
        if (json.choices?.[0]?.delta?.content) {
          chunks.push(json.choices[0].delta.content);
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  return chunks;
}

/**
 * Rebuffer chunks into different sizes for testing streaming edge cases.
 * Useful for testing how the detector handles content split across chunks.
 *
 * @param chunks - Array of content strings
 * @param pattern - How to group chunks: 'single' (one at a time), 'all' (single batch), or number[] for custom sizes
 * @returns Array of rebuffered strings
 *
 * @example
 * ```typescript
 * const chunks = parseSSEToChunks(sseCodeBlock);
 * // Test char-by-char
 * const charByChar = rebuffer(chunks, 'single');
 * // Test all at once
 * const batch = rebuffer(chunks, 'all');
 * // Test custom grouping
 * const custom = rebuffer(chunks, [2, 1, 2]);
 * ```
 */
export function rebuffer(chunks: string[], pattern: "single" | "all" | number[]): string[] {
  const joined = chunks.join("");

  if (pattern === "all") {
    return [joined];
  }

  if (pattern === "single") {
    // Return each character as a separate chunk
    return joined.split("");
  }

  // Custom sizes
  const result: string[] = [];
  let pos = 0;

  for (const size of pattern) {
    if (pos >= joined.length) break;
    result.push(joined.slice(pos, pos + size));
    pos += size;
  }

  // Add remaining if any
  if (pos < joined.length) {
    result.push(joined.slice(pos));
  }

  return result;
}
