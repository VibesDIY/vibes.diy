import type { Segment } from '../types/chat';

/**
 * Parse content into segments of markdown and code
 * This is a pure function that doesn't rely on any state
 */
export function parseContent(text: string): {
  segments: Segment[];
  dependenciesString: string | undefined;
} {
  const segments: Segment[] = [];
  let dependenciesString: string | undefined;

  // Extract dependencies from the beginning if they exist
  // Format 1: {"dependencies": {}}
  // Format 2: {"react": "^18.2.0", "react-dom": "^18.2.0"}}
  // Format 3: {"dependencies": {"react-modal": "^3.16.1", ...}}
  // Format 4: {"dependencies": { multi-line with nested dependencies }}
  const depsFormat1 = text.match(/^({"dependencies":\s*{}})/);
  const depsFormat2 = text.match(/^({(?:"[^"]+"\s*:\s*"[^"]+"(?:,\s*)?)+}})/);
  const depsFormat3 = text.match(/^({"dependencies":\s*{(?:"[^"]+"\s*:\s*"[^"]+"(?:,\s*)?)+}})/);
  // Handle multi-line dependency format with nested structure
  const depsFormat4 = text.match(/^({"dependencies":\s*{[\s\S]*?^}})/m);

  if (depsFormat1 && depsFormat1[1]) {
    dependenciesString = depsFormat1[1];
    // Remove the dependencies part from the text
    text = text.substring(text.indexOf(depsFormat1[1]) + depsFormat1[1].length).trim();
  } else if (depsFormat2 && depsFormat2[1]) {
    dependenciesString = depsFormat2[1];
    // Remove the dependencies part from the text
    text = text.substring(text.indexOf(depsFormat2[1]) + depsFormat2[1].length).trim();
  } else if (depsFormat3 && depsFormat3[1]) {
    dependenciesString = depsFormat3[1];
    // Remove the dependencies part from the text
    text = text.substring(text.indexOf(depsFormat3[1]) + depsFormat3[1].length).trim();
  } else if (depsFormat4 && depsFormat4[1]) {
    dependenciesString = depsFormat4[1];
    // Remove the dependencies part from the text
    text = text.substring(text.indexOf(depsFormat4[1]) + depsFormat4[1].length).trim();
  }

  // First look for complete code blocks delimited by ```js or ```jsx and a closing ```
  // In proper markdown, delimiters need to be at the start of a line (with optional whitespace)
  const completeCodeBlockMatch = text.match(/([\s\S]*?)(?:^|\n)[ \t]*```(?:js|jsx|javascript|)[ \t]*\n([\s\S]*?)(?:^|\n)[ \t]*```[ \t]*(?:\n|$)([\s\S]*)/);

  // Then check for incomplete code blocks with just the opening delimiter
  const incompleteCodeBlockMatch = text.match(/([\s\S]*?)(?:^|\n)[ \t]*```(?:js|jsx|javascript|)[ \t]*\n([\s\S]*?)$/s);

  if (completeCodeBlockMatch) {
    const beforeCode = completeCodeBlockMatch[1]?.trim();
    const codeContent = completeCodeBlockMatch[2]?.trim();
    const afterCode = completeCodeBlockMatch[3]?.trim();
    
    // Add the markdown content before the code block if it exists
    if (beforeCode) {
      segments.push({
        type: 'markdown',
        content: beforeCode,
      });
    }

    // Add the code block
    if (codeContent) {
      segments.push({
        type: 'code',
        content: codeContent,
      });
    }

    // Add the markdown content after the code block if it exists
    if (afterCode) {
      segments.push({
        type: 'markdown',
        content: afterCode,
      });
    }
  } else if (incompleteCodeBlockMatch) {
    // Handle incomplete code blocks (missing closing delimiter)
    const beforeCode = incompleteCodeBlockMatch[1]?.trim();
    const codeContent = incompleteCodeBlockMatch[2]?.trim();

    // Add the markdown content before the code block if it exists
    if (beforeCode) {
      segments.push({
        type: 'markdown',
        content: beforeCode,
      });
    }

    // Add the incomplete code block
    if (codeContent) {
      segments.push({
        type: 'code',
        content: codeContent,
      });
    }
  } else {
    // If no code blocks are found, treat the whole content as markdown
    segments.push({
      type: 'markdown',
      content: text,
    });
  }

  return { segments, dependenciesString };
}

/**
 * Extract dependencies as a Record from the dependencies string
 */
export function parseDependencies(dependenciesString?: string): Record<string, string> {
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
