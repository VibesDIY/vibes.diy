import { applyEdits, parseFenceBody } from "@vibes.diy/call-ai-v2";
import type { Segment } from "./chat.js";

interface FoundBlock {
  readonly fullBlock: string;
  readonly content: string;
  readonly startIdx: number;
  readonly endIdx: number;
  readonly length: number;
  readonly incomplete?: boolean;
}

const SEARCH_MARKER = /^<{7}\s+SEARCH\s*$/m;

function stripDependenciesPrefix(text: string): string {
  // Format 1: {"dependencies": {}}
  // Format 2: {"react": "^18.2.0", "react-dom": "^18.2.0"}}
  // Format 3: {"dependencies": {"react-modal": "^3.16.1", ...}}
  // Format 4: {"dependencies": { multi-line with nested dependencies }}
  const depsFormat1 = text.match(/^({"dependencies":\s*{}})/);
  const depsFormat2 = text.match(/^({(?:"[^"]+"\s*:\s*"[^"]+"(?:,\s*)?)+}})/);
  const depsFormat3 = text.match(/^({"dependencies":\s*{(?:"[^"]+"\s*:\s*"[^"]+"(?:,\s*)?)+}})/);
  const depsFormat4 = text.match(/^({"dependencies":\s*{[\s\S]*?^}})/m);
  const match = depsFormat1 ?? depsFormat2 ?? depsFormat3 ?? depsFormat4;
  if (match && match[1]) {
    return text.substring(text.indexOf(match[1]) + match[1].length).trim();
  }
  return text;
}

function findFencedBlocks(text: string): FoundBlock[] {
  const blocks: FoundBlock[] = [];
  // Match info-string of the form ```lang [path [op]] — fall back to plain ```
  const codeBlockRegex = /(?:^|\n)[ \t]*```(?:\w+)?(?:[ \t]+\S+(?:[ \t]+\S+)?)?[ \t]*\n([\s\S]*?)(?:^|\n)[ \t]*```[ \t]*(?:\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const codeContent = (match[1] ?? "").trim();
    blocks.push({
      fullBlock: fullMatch,
      content: codeContent,
      startIdx: match.index,
      endIdx: match.index + fullMatch.length,
      length: codeContent.length,
    });
  }
  // Detect an incomplete trailing block (still streaming)
  const incomplete = text.match(/(?:^|\n)[ \t]*```(?:\w+)?(?:[ \t]+\S+(?:[ \t]+\S+)?)?[ \t]*\n([\s\S]*)$/s);
  if (incomplete && incomplete.index !== undefined) {
    const startIdx = incomplete.index;
    if (!blocks.some((b) => b.startIdx === startIdx)) {
      const codeContent = (incomplete[1] ?? "").trim();
      blocks.push({
        fullBlock: incomplete[0],
        content: codeContent,
        startIdx,
        endIdx: text.length,
        length: codeContent.length,
        incomplete: true,
      });
    }
  }
  return blocks;
}

function legacyParse(stripped: string, blocks: FoundBlock[]): { segments: Segment[] } {
  // Legacy semantics: longest block is the "real" code; other blocks fold into
  // the surrounding markdown as illustration. Used for messages that contain
  // no SEARCH markers (i.e. pre-aider-edits message format).
  let longestIdx = 0;
  let maxLen = 0;
  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i].length > maxLen) {
      maxLen = blocks[i].length;
      longestIdx = i;
    }
  }
  const sorted = [...blocks].sort((a, b) => a.startIdx - b.startIdx);
  const longest = blocks[longestIdx];

  let beforeText = "";
  if (longest.startIdx > 0) {
    let pos = 0;
    let processed = false;
    for (const b of sorted) {
      if (b === longest) {
        beforeText += stripped.substring(pos, b.startIdx);
        break;
      }
      if (b.startIdx >= pos && b.endIdx <= longest.startIdx) {
        beforeText += stripped.substring(pos, b.startIdx);
        beforeText += b.fullBlock;
        pos = b.endIdx;
        processed = true;
      }
    }
    if (!processed && beforeText.length === 0) {
      beforeText = stripped.substring(0, longest.startIdx);
    }
  }

  let afterText = "";
  if (longest.endIdx < stripped.length) {
    let pos = longest.endIdx;
    let processed = false;
    for (const b of sorted) {
      if (b !== longest && b.startIdx >= longest.endIdx) {
        afterText += stripped.substring(pos, b.startIdx);
        afterText += b.fullBlock;
        pos = b.endIdx;
        processed = true;
      }
    }
    if (pos < stripped.length) afterText += stripped.substring(pos);
    if (!processed) afterText = stripped.substring(longest.endIdx);
  }

  const segments: Segment[] = [];
  if (beforeText.trim().length > 0) segments.push({ type: "markdown", content: beforeText.trim() });
  segments.push({ type: "code", content: longest.content });
  if (afterText.trim().length > 0) segments.push({ type: "markdown", content: afterText.trim() });
  return { segments };
}

function aiderParse(stripped: string, blocks: FoundBlock[]): { segments: Segment[] } {
  // New semantics: all fenced blocks are file operations. Apply each in order
  // via parseFenceBody + applyEdits to compute the final file content.
  let resolved = "";
  for (const block of blocks) {
    const lines = block.content.split("\n");
    const parsed = parseFenceBody(lines);
    const result = applyEdits(resolved, parsed.edits);
    resolved = result.content;
  }

  let cursor = 0;
  let beforeText = "";
  let afterText = "";
  blocks.forEach((b, i) => {
    const piece = stripped.substring(cursor, b.startIdx);
    if (i === 0) beforeText = piece;
    else afterText += piece;
    cursor = b.endIdx;
  });
  afterText += stripped.substring(cursor);

  const segments: Segment[] = [];
  if (beforeText.trim().length > 0) segments.push({ type: "markdown", content: beforeText.trim() });
  segments.push({ type: "code", content: resolved });
  if (afterText.trim().length > 0) segments.push({ type: "markdown", content: afterText.trim() });
  return { segments };
}

/**
 * Parse content into segments of markdown and code.
 *
 * Two modes, selected by content:
 * - **Legacy** (no SEARCH markers anywhere): longest fenced block is the
 *   "real" code; other blocks fold into surrounding markdown. Preserves
 *   pre-aider behavior for historical messages and messages with
 *   illustration code alongside the real component.
 * - **Aider edits** (any block contains `<<<<<<< SEARCH`): every fenced
 *   block is a file operation; apply create + replace edits in order via
 *   parseFenceBody + applyEdits, and emit the resolved content as the
 *   single code segment.
 */
export function parseContent(text: string): { segments: Segment[] } {
  const stripped = stripDependenciesPrefix(text);
  const blocks = findFencedBlocks(stripped);

  if (blocks.length === 0) {
    return { segments: [{ type: "markdown", content: stripped }] };
  }

  const hasSearchMarker = blocks.some((b) => SEARCH_MARKER.test(b.content));
  return hasSearchMarker ? aiderParse(stripped, blocks) : legacyParse(stripped, blocks);
}
