#!/usr/bin/env tsx

import { glob } from "zx";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import { readFile } from "fs/promises";
import { join } from "path";

// Handle default export from @babel/traverse
const traverse = traverseModule.default || traverseModule;

export interface ImportInfo {
  source: string;
  file: string;
}

/**
 * Extract all import statements from a file using Babel parser
 * @param filePath - Path to the file to parse
 * @returns Array of import sources found in the file
 */
export async function extractImportsFromFile(
  filePath: string,
): Promise<ImportInfo[]> {
  try {
    const content = await readFile(filePath, "utf-8");
    const imports: ImportInfo[] = [];

    // Parse the file with Babel
    const ast = parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "classProperties",
        "dynamicImport",
        "exportDefaultFrom",
        "exportNamespaceFrom",
      ],
    });

    // Traverse the AST to find import declarations
    traverse(ast, {
      ImportDeclaration(path) {
        imports.push({
          source: path.node.source.value,
          file: filePath,
        });
      },
      // Handle dynamic imports and require calls
      CallExpression(path) {
        // Dynamic imports: import('module')
        if (
          path.node.callee.type === "Import" &&
          path.node.arguments.length > 0 &&
          path.node.arguments[0].type === "StringLiteral"
        ) {
          imports.push({
            source: path.node.arguments[0].value,
            file: filePath,
          });
        }
        // Require calls: require('module')
        else if (
          path.node.callee.type === "Identifier" &&
          path.node.callee.name === "require" &&
          path.node.arguments.length > 0 &&
          path.node.arguments[0].type === "StringLiteral"
        ) {
          imports.push({
            source: path.node.arguments[0].value,
            file: filePath,
          });
        }
      },
    });

    return imports;
  } catch (error) {
    console.error(
      `Error parsing ${filePath}:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Extract all imports from files matching a glob pattern
 * @param baseDir - Base directory to search from
 * @param pattern - Glob pattern to match files
 * @returns Array of all import information found
 */
export async function extractImportsFromGlob(
  baseDir: string,
  pattern: string,
): Promise<ImportInfo[]> {
  const fullPattern = join(baseDir, pattern);
  const files = await glob(fullPattern, {
    ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
  });

  const allImports: ImportInfo[] = [];

  for (const file of files) {
    const imports = await extractImportsFromFile(file);
    allImports.push(...imports);
  }

  return allImports;
}

/**
 * Get unique import sources from import info
 * @param imports - Array of import info
 * @returns Sorted array of unique import sources
 */
export function getUniqueImportSources(imports: ImportInfo[]): string[] {
  const sources = new Set(imports.map((imp) => imp.source));
  return Array.from(sources).sort();
}

/**
 * Group imports by source
 * @param imports - Array of import info
 * @returns Map of source to array of files that import it
 */
export function groupImportsBySource(
  imports: ImportInfo[],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const imp of imports) {
    if (!grouped.has(imp.source)) {
      grouped.set(imp.source, []);
    }
    grouped.get(imp.source)!.push(imp.file);
  }

  return grouped;
}

// CLI usage with cmd-ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const { run, command, string, option, flag } = await import("cmd-ts");

  const app = command({
    name: "extract-imports",
    description:
      "Extract all import statements from TypeScript/JavaScript files",
    args: {
      baseDir: option({
        type: string,
        long: "base",
        short: "b",
        description: "Base directory to search from",
        defaultValue: () => "./",
      }),
      pattern: option({
        type: string,
        long: "pattern",
        short: "p",
        description: "Glob pattern to match files",
        defaultValue: () => "**/*.{ts,tsx,js,jsx}",
      }),
      unique: flag({
        long: "unique",
        short: "u",
        description: "Show only unique import sources",
        defaultValue: () => false,
      }),
      grouped: flag({
        long: "grouped",
        short: "g",
        description: "Group imports by source and show which files import them",
        defaultValue: () => false,
      }),
      relatives: flag({
        long: "relatives",
        short: "r",
        description: "Include relative imports (starting with ./ or ../)",
        defaultValue: () => false,
      }),
    },
    handler: async ({ baseDir, pattern, unique, grouped, relatives }) => {
      const fullPattern = join(baseDir, pattern);
      console.error(`Extracting imports from: ${fullPattern}`);

      let imports = await extractImportsFromGlob(baseDir, pattern);

      // Filter out relative imports unless requested
      if (!relatives) {
        imports = imports.filter(
          (imp) =>
            !imp.source.startsWith("./") && !imp.source.startsWith("../"),
        );
      }

      if (grouped) {
        const groupedImports = groupImportsBySource(imports);
        const sortedSources = Array.from(groupedImports.keys()).sort();

        for (const source of sortedSources) {
          const files = groupedImports.get(source)!;
          console.log(`\n${source} (${files.length} files):`);
          files.forEach((file) => console.log(`  - ${file}`));
        }
      } else if (unique) {
        const uniqueSources = getUniqueImportSources(imports);
        uniqueSources.forEach((source) => console.log(source));
      } else {
        // Default: show unique imports, sorted
        const uniqueSources = getUniqueImportSources(imports);
        uniqueSources.forEach((source) => console.log(source));
      }

      console.error(`\nTotal imports: ${imports.length}`);
      if (!unique && !grouped) {
        const uniqueCount = getUniqueImportSources(imports).length;
        console.error(`Unique sources: ${uniqueCount}`);
      }
    },
  });

  run(app, process.argv.slice(2));
}
