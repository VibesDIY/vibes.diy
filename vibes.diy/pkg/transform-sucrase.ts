import { transform } from "sucrase";

/**
 * Extract all import sources from the code using regex
 * @param code - The source code to parse
 * @returns Array of unique import sources (dependency names)
 */
export function extractImports(code: string): string[] {
  const imports: string[] = [];

  // Match import statements: import ... from 'module' or import ... from "module"
  const importRegex =
    /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;

  // Match export from statements: export ... from 'module'
  const exportFromRegex =
    /export\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/g;

  let match;

  // Extract import statements
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  // Extract export from statements
  while ((match = exportFromRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  // Return unique imports
  return [...new Set(imports)];
}

/**
 * Transform TSX/TS string to JavaScript using Sucrase
 * @param code - The TypeScript/TSX source code as a string
 * @param filename - Filename for the transformation (e.g., 'input.tsx')
 * @returns Transformed JavaScript code
 */
export function transformString(code: string, filename = "input.tsx"): string {
  try {
    const result = transform(code, {
      transforms: ["typescript", "jsx"],
      jsxRuntime: "automatic",
      production: false,
      filePath: filename,
    });

    return result.code;
  } catch (err) {
    throw new Error(
      "Failed to transform: " +
        (err instanceof Error ? err.message : String(err)),
    );
  }
}
