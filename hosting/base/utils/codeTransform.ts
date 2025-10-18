import { libraryImportMap as importMapData } from "../config/library-import-map.js";

export const libraryImportMap = importMapData.imports;

export function transformImports(code: string): string {
  const importKeys = Object.keys(libraryImportMap);
  let transformedCode = code.replace(
    /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+)?['"]([^'"]+)['"];?/g,
    (match, importPath) => {
      // Don't transform if it's in our library map
      if (importKeys.includes(importPath)) {
        return match;
      }
      // Don't transform if it's already a URL (contains :// or starts with http/https)
      if (importPath.includes("://") || importPath.startsWith("http")) {
        return match;
      }
      // Don't transform relative imports (starting with ./ or ../)
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        return match;
      }
      // Replace the import path with ESM.sh URL, preserving the quote style
      return match.replace(
        new RegExp(
          `['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`,
        ),
        `"https://esm.sh/${importPath}"`,
      );
    },
  );

  // Track if we replaced an inline function export
  let replacedInlineFunction = false;

  // Normalize the default export function name to "App" and create a named variable
  transformedCode = transformedCode.replace(
    /export\s+default\s+function\s+\w*\s*\(/g,
    (match) => {
      replacedInlineFunction = true;
      return "function App(";
    }
  );

  // Also handle export default Component -> export default App
  transformedCode = transformedCode.replace(
    /export\s+default\s+Component\s*;?/g,
    "export default App;"
  );

  // Only add the export statement if we replaced an inline function OR if there's no existing export default
  const hasExistingExport = /export\s+default\s+/.test(transformedCode);
  
  if (replacedInlineFunction || !hasExistingExport) {
    transformedCode += "\nexport default App;";
  }

  return transformedCode;
}
