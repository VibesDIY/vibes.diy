import importMapData from "../config/library-import-map.json";

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
        new RegExp(`['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`),
        `"https://esm.sh/${importPath}"`
      );
    }
  );

  // Normalize the default export function name to "App"
  transformedCode = transformedCode.replace(/export\s+default\s+function\s+\w+\s*\(/g, "export default function App(");

  return transformedCode;
}
