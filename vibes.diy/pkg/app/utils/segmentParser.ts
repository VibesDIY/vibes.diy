import type { Segment } from "@vibes.diy/prompts";

/**
 * Parse content into segments of markdown and code
 * This is a pure function that doesn't rely on any state
 */
export function parseContent(text: string): {
  segments: Segment[];
} {
  const segments: Segment[] = [];

  // Extract dependencies from the beginning if they exist
  // Format 1: {"dependencies": {}}
  // Format 2: {"react": "^18.2.0", "react-dom": "^18.2.0"}}
  // Format 3: {"dependencies": {"react-modal": "^3.16.1", ...}}
  // Format 4: {"dependencies": { multi-line with nested dependencies }}
  const depsFormat1 = text.match(/^({"dependencies":\s*{}})/);
  const depsFormat2 = text.match(/^({(?:"[^"]+"\s*:\s*"[^"]+"(?:,\s*)?)+}})/);
  const depsFormat3 = text.match(
    /^({"dependencies":\s*{(?:"[^"]+"\s*:\s*"[^"]+"(?:,\s*)?)+}})/,
  );
  // Handle multi-line dependency format with nested structure
  const depsFormat4 = text.match(/^({"dependencies":\s*{[\s\S]*?^}})/m);

  if (depsFormat1 && depsFormat1[1]) {
    // Remove the dependencies part from the text
    text = text
      .substring(text.indexOf(depsFormat1[1]) + depsFormat1[1].length)
      .trim();
  } else if (depsFormat2 && depsFormat2[1]) {
    // Remove the dependencies part from the text
    text = text
      .substring(text.indexOf(depsFormat2[1]) + depsFormat2[1].length)
      .trim();
  } else if (depsFormat3 && depsFormat3[1]) {
    // Remove the dependencies part from the text
    text = text
      .substring(text.indexOf(depsFormat3[1]) + depsFormat3[1].length)
      .trim();
  } else if (depsFormat4 && depsFormat4[1]) {
    // Remove the dependencies part from the text
    text = text
      .substring(text.indexOf(depsFormat4[1]) + depsFormat4[1].length)
      .trim();
  }

  // Find all complete code blocks
  const codeBlockRegex =
    /(?:^|\n)[ \t]*```(?:js|jsx|javascript|)[ \t]*\n([\s\S]*?)(?:^|\n)[ \t]*```[ \t]*(?:\n|$)/g;
  const codeBlocks = [];

  // Get all matches
  let match;

  // Find all code blocks and their positions
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const codeContent = match[1]?.trim() || "";
    const startIdx = match.index;
    const endIdx = startIdx + fullMatch.length;

    codeBlocks.push({
      fullBlock: fullMatch,
      content: codeContent,
      startIdx,
      endIdx,
      length: codeContent.length,
    });
  }

  // Now check for incomplete code blocks at the end of the file
  const incompleteCodeBlockMatch = text.match(
    /(?:^|\n)[ \t]*```(?:js|jsx|javascript|)[ \t]*\n([\s\S]*)$/s,
  );
  if (
    incompleteCodeBlockMatch &&
    incompleteCodeBlockMatch.index !== undefined
  ) {
    // Check that this isn't just a duplicate of an already found block
    const startIdx = incompleteCodeBlockMatch.index;
    const isDuplicate = codeBlocks.some((block) => block.startIdx === startIdx);

    if (!isDuplicate) {
      const fullMatch = incompleteCodeBlockMatch[0];
      const codeContent = incompleteCodeBlockMatch[1]?.trim() || "";
      const endIdx = text.length;

      codeBlocks.push({
        fullBlock: fullMatch,
        content: codeContent,
        startIdx,
        endIdx,
        length: codeContent.length,
        incomplete: true,
      });
    }
  }

  // If there are no code blocks, treat the whole content as markdown
  if (codeBlocks.length === 0) {
    segments.push({
      type: "markdown",
      content: text,
    });
    return { segments };
  }

  // Find the longest code block
  let longestBlockIndex = 0;
  let maxLength = 0;

  for (let i = 0; i < codeBlocks.length; i++) {
    if (codeBlocks[i].length > maxLength) {
      maxLength = codeBlocks[i].length;
      longestBlockIndex = i;
    }
  }

  // Sort code blocks by start index
  codeBlocks.sort((a, b) => a.startIdx - b.startIdx);

  // Get the longest block
  const longestBlock = codeBlocks[longestBlockIndex];

  // First markdown segment: text before the longest code block
  let beforeContent = "";
  if (longestBlock.startIdx > 0) {
    // Include any other code blocks that appear before the longest one
    let currentPos = 0;

    for (const block of codeBlocks) {
      if (block === longestBlock) {
        // Add any text between the previous position and the longest block
        beforeContent += text.substring(currentPos, block.startIdx);
        break;
      } else if (
        block.startIdx >= currentPos &&
        block.endIdx <= longestBlock.startIdx
      ) {
        // Add text between the current position and this block
        beforeContent += text.substring(currentPos, block.startIdx);
        // Add the code block itself to the markdown
        beforeContent += block.fullBlock;
        // Update current position
        currentPos = block.endIdx;
      }
    }

    // If no blocks were processed, just include all text before the longest block
    if (beforeContent === "") {
      beforeContent = text.substring(0, longestBlock.startIdx);
    }
  }

  // Add the first markdown segment
  if (beforeContent.trim().length > 0) {
    segments.push({
      type: "markdown",
      content: beforeContent.trim(),
    });
  }

  // Add the longest code block as its own segment
  segments.push({
    type: "code",
    content: longestBlock.content,
  });

  // No special cases - just proceed with normal processing

  // Last markdown segment: text after the longest code block
  let afterContent = "";
  if (longestBlock.endIdx < text.length) {
    // Include any other code blocks that appear after the longest one
    let currentPos = longestBlock.endIdx;
    let processedBlocks = false;

    for (const block of codeBlocks) {
      if (block !== longestBlock && block.startIdx >= longestBlock.endIdx) {
        // Add text between the current position and this block
        afterContent += text.substring(currentPos, block.startIdx);
        // Add the code block itself to the markdown
        afterContent += block.fullBlock;
        // Update current position
        currentPos = block.endIdx;
        processedBlocks = true;
      }
    }

    // Add any remaining text
    if (currentPos < text.length) {
      afterContent += text.substring(currentPos);
    }

    // If no blocks were processed, include all text after the longest block
    if (!processedBlocks) {
      afterContent = text.substring(longestBlock.endIdx);
    }
  }

  // Add the final markdown segment only if there is remaining content
  if (afterContent.trim().length > 0) {
    segments.push({
      type: "markdown",
      content: afterContent.trim(),
    });
  }

  return { segments };
}

/**
 * Extract dependencies as a Record from the dependencies string
 */
export function parseDependencies(
  dependenciesString?: string,
): Record<string, string> {
  if (!dependenciesString) return {};

  const dependencies: Record<string, string> = {};
  const matches = dependenciesString.match(/"([^"]+)"\s*:\s*"([^"]+)"/g);

  if (matches) {
    matches.forEach((match) => {
      const keyMatch = match.match(/"([^"]+)"\s*:/);
      const valueMatch = match.match(/:\s*"([^"]+)"/);

      if (keyMatch?.[1] && valueMatch?.[1]) {
        const key = keyMatch[1].trim();
        const value = valueMatch[1].trim();

        if (key && value) {
          dependencies[key] = value;
        }
      }
    });
  }

  return dependencies;
}
