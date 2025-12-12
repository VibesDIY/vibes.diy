#!/usr/bin/env tsx

import { extractImportsFromGlob, getUniqueImportSources } from "./extract-imports.js";
import {
  getDependencyTree,
  flattenDependencyTree,
  getVersionFromLockfile,
  type FlatDependency,
} from "./get-package-version.js";
import { readWantedLockfile } from "@pnpm/lockfile-file";
import { findUp } from "find-up";
import { dirname, join } from "path";
import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { glob } from "zx";

/**
 * Find the lockfile directory by searching upwards
 */
async function findLockfileDir(lockfileName: string): Promise<string | null> {
  const lockfilePath = await findUp(lockfileName);
  if (!lockfilePath) {
    return null;
  }
  return dirname(lockfilePath);
}

/**
 * Read pnpm-workspace.yaml and load all workspace package.json files
 * @param lockfileDir - Directory containing pnpm-workspace.yaml
 * @returns Map of relative path -> package.json content
 */
async function loadWorkspacePackageJsons(lockfileDir: string): Promise<Map<string, any>> {
  const workspacePackageJsons = new Map<string, any>();

  try {
    const workspaceYamlPath = join(lockfileDir, "pnpm-workspace.yaml");
    const workspaceYamlContent = await readFile(workspaceYamlPath, "utf-8");
    const workspaceConfig = parseYaml(workspaceYamlContent);

    if (workspaceConfig && workspaceConfig.packages) {
      for (const pkgPattern of workspaceConfig.packages) {
        // Expand glob pattern to find package.json files
        const packageJsonPattern = join(lockfileDir, pkgPattern, "package.json");
        const packageJsonFiles = await glob(packageJsonPattern);

        for (const pkgJsonPath of packageJsonFiles) {
          try {
            const pkgJsonContent = await readFile(pkgJsonPath, "utf-8");
            const pkgJson = JSON.parse(pkgJsonContent);
            // Store with relative path from lockfileDir
            const relativePath = pkgJsonPath.replace(lockfileDir + "/", "");
            workspacePackageJsons.set(relativePath, pkgJson);
          } catch {
            // Skip files we can't read
          }
        }
      }
    }
  } catch {
    // If we can't read pnpm-workspace.yaml, return empty map
  }

  return workspacePackageJsons;
}

/**
 * Extract package name from import path
 * @param importPath - The import path (e.g., "shiki/core", "@fp/shiki/core")
 * @returns Object with packageName and subpath
 */
function parseImportPath(importPath: string): { packageName: string; subpath: string } {
  let packageName: string;
  let subpath: string = "";

  if (importPath.startsWith("@")) {
    // Scoped package: @scope/package or @scope/package/subpath
    const parts = importPath.split("/");
    if (parts.length >= 2) {
      packageName = `${parts[0]}/${parts[1]}`;
      if (parts.length > 2) {
        subpath = "/" + parts.slice(2).join("/");
      }
    } else {
      packageName = importPath;
    }
  } else {
    // Regular package: package or package/subpath
    const slashIndex = importPath.indexOf("/");
    if (slashIndex > 0) {
      packageName = importPath.substring(0, slashIndex);
      subpath = importPath.substring(slashIndex);
    } else {
      packageName = importPath;
    }
  }

  return { packageName, subpath };
}

/**
 * Build URL for import map entry by inserting version after package name
 * @param importPath - The import path (e.g., "shiki/core", "@fp/shiki/core")
 * @param prefix - URL prefix
 * @param version - Package version (or null if not found)
 * @returns Formatted URL
 */
function buildImportUrl(importPath: string, prefix: string, version: string | null): string {
  if (!version) {
    return `${prefix}${importPath}`;
  }

  const { packageName, subpath } = parseImportPath(importPath);
  return `${prefix}${packageName}@${version}${subpath}`;
}

/**
 * Transform imports list into an import map with prefixes
 * @param baseDir - Base directory to search for source files
 * @param pattern - Glob pattern to match files
 * @param lockfileName - Name of the lockfile to use
 * @param globPrefix - Prefix for global (npm) packages
 * @param localPrefix - Prefix for local (relative) imports and workspace packages
 * @param localSuffix - Suffix for workspace packages
 * @param includeRelatives - Whether to include relative imports
 * @returns Import map as a JSON object
 */
export async function createImportMap(
  baseDir: string,
  pattern: string,
  lockfileName: string,
  globPrefix: string,
  localPrefix: string,
  localSuffix: string,
  includeRelatives: boolean = false
): Promise<Record<string, string>> {
  // Step 1: Extract imports from source files
  const imports = await extractImportsFromGlob(baseDir, pattern);

  // Get unique import sources
  const uniqueSources = getUniqueImportSources(imports);

  // Step 2: Find and read the lockfile
  const lockfileDir = await findLockfileDir(lockfileName);
  if (!lockfileDir) {
    throw new Error(`Could not find ${lockfileName}`);
  }

  const lockfile = await readWantedLockfile(lockfileDir, {
    ignoreIncompatible: true,
  });

  if (!lockfile) {
    throw new Error(`Could not read ${lockfileName}`);
  }

  // Step 2.1: Load all workspace package.json files
  const workspacePackageJsons = await loadWorkspacePackageJsons(lockfileDir);

  // Step 2.5: Detect workspace packages from lockfile importers
  const workspacePackages = new Set<string>();

  if (lockfile.importers) {
    for (const [importerPath, importer] of Object.entries(lockfile.importers)) {
      // Check all dependencies in this importer
      const allDeps = {
        ...importer.dependencies,
        ...importer.devDependencies,
      };

      for (const [pkgName, version] of Object.entries(allDeps)) {
        // Check if it's a workspace link
        if (typeof version === "string" && version.startsWith("link:")) {
          workspacePackages.add(pkgName);
        }
      }
    }
  }

  // Step 3: Build import map with dependency tracking
  const importMap: Record<string, string> = {};

  // Build a map of package name -> version for all packages in our import list
  const packageVersionsInImports = new Map<string, string>();
  for (const source of uniqueSources) {
    const isRelative = source.startsWith("./") || source.startsWith("../");
    if (!isRelative) {
      const { packageName } = parseImportPath(source);

      // Skip workspace packages - they won't have versions in lockfile
      if (workspacePackages.has(packageName)) {
        continue;
      }

      const version = getVersionFromLockfile(lockfile, packageName);
      if (version) {
        packageVersionsInImports.set(packageName, version);
      }
    }
  }

  for (const source of uniqueSources) {
    // Check if it's a relative import
    const isRelative = source.startsWith("./") || source.startsWith("../");

    if (isRelative) {
      if (includeRelatives) {
        importMap[source] = `${localPrefix}${source}`;
      }
    } else {
      const { packageName, subpath } = parseImportPath(source);

      // Check if it's a workspace package
      if (workspacePackages.has(packageName)) {
        // Get the link path for workspace packages
        const version = getVersionFromLockfile(lockfile, packageName);
        if (version && version.startsWith("link:")) {
          // Use the link path instead of package name
          let linkPath = version.substring(5); // Remove "link:" prefix
          // Remove all ./ and ../ from the path
          linkPath = linkPath.replace(/\.\.\//g, "").replace(/\.\//g, "");
          importMap[source] = `${localPrefix}/${linkPath}${localSuffix}`;
        } else {
          // Fallback to package name if link path not found
          importMap[source] = `${localPrefix}/${source}${localSuffix}`;
        }
      } else {
        const version = getVersionFromLockfile(lockfile, packageName);

        // Get dependency tree and check for overlaps with our imports
        const tree = getDependencyTree(lockfile, packageName);
        const depsParam: string[] = [];

        if (tree && tree.dependencies.length > 0) {
          for (const dep of tree.dependencies) {
            // Check if this dependency is also in our import list
            if (packageVersionsInImports.has(dep.name)) {
              depsParam.push(`${dep.name}@${dep.version}`);
            }
          }
        }

        let url = buildImportUrl(source, globPrefix, version);

        // Add deps query parameter if there are shared dependencies
        if (depsParam.length > 0) {
          url += `?deps=${depsParam.join(",")}`;
        }

        importMap[source] = url;
      }
    }
  }

  return importMap;
}

/**
 * Analyze dependencies used in source files and get their full dependency trees
 * @param baseDir - Base directory to search for source files
 * @param pattern - Glob pattern to match files
 * @param lockfileName - Name of the lockfile to use
 * @param includeRelatives - Whether to include relative imports
 * @returns Array of all unique dependencies (flattened trees from all imported packages)
 */
export async function analyzeDependencies(
  baseDir: string,
  pattern: string,
  lockfileName: string,
  includeRelatives: boolean = false
): Promise<FlatDependency[]> {
  // Step 1: Extract imports from source files
  const imports = await extractImportsFromGlob(baseDir, pattern);

  // Filter out relative imports unless requested
  let filteredImports = imports;
  if (!includeRelatives) {
    filteredImports = imports.filter(
      (imp) => !imp.source.startsWith("./") && !imp.source.startsWith("../")
    );
  }

  // Get unique import sources
  const uniqueSources = getUniqueImportSources(filteredImports);

  // Step 2: Find and read the lockfile
  const lockfileDir = await findLockfileDir(lockfileName);
  if (!lockfileDir) {
    throw new Error(`Could not find ${lockfileName}`);
  }

  const lockfile = await readWantedLockfile(lockfileDir, {
    ignoreIncompatible: true,
  });

  if (!lockfile) {
    throw new Error(`Could not read ${lockfileName}`);
  }

  // Step 3: Get dependency trees for each imported package
  const seen = new Set<string>();
  const allDeps: FlatDependency[] = [];

  for (const source of uniqueSources) {
    const tree = getDependencyTree(lockfile, source);
    if (tree) {
      const flatList = flattenDependencyTree(tree);
      for (const dep of flatList) {
        const key = `${dep.name}@${dep.version}`;
        if (!seen.has(key)) {
          seen.add(key);
          allDeps.push(dep);
        }
      }
    }
  }

  // Sort by name
  return allDeps.sort((a, b) => a.name.localeCompare(b.name));
}

// CLI usage with cmd-ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const { run, command, string, option, flag } = await import("cmd-ts");

  const app = command({
    name: "analyze-dependencies",
    description: "Analyze all dependencies used in source files by examining imports and building full dependency trees",
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
      pnpmLock: option({
        type: string,
        long: "pnpmLock",
        description: "Lockfile name to search for",
        defaultValue: () => "pnpm-lock.yaml",
      }),
      relatives: flag({
        long: "relatives",
        short: "r",
        description: "Include relative imports",
        defaultValue: () => false,
      }),
      importsOnly: flag({
        long: "imports-only",
        short: "i",
        description: "Show only direct imports (not full dependency trees)",
        defaultValue: () => false,
      }),
      importMap: flag({
        long: "import-map",
        short: "m",
        description: "Generate import map JSON with URL mappings",
        defaultValue: () => false,
      }),
      globPrefix: option({
        type: string,
        long: "glob-prefix",
        description: "Prefix for global (npm) package imports",
        defaultValue: () => "https://esm.sh/",
      }),
      localPrefix: option({
        type: string,
        long: "local-prefix",
        description: "Prefix for local (relative) imports and workspace packages",
        defaultValue: () => "/dist",
      }),
      localSuffix: option({
        type: string,
        long: "local-suffix",
        description: "Suffix for workspace packages",
        defaultValue: () => "/index.js",
      }),
    },
    handler: async ({ baseDir, pattern, pnpmLock, relatives, importsOnly, importMap, globPrefix, localPrefix, localSuffix }) => {
      console.error(`Analyzing dependencies from: ${baseDir}${pattern}`);

      if (importMap) {
        // Generate import map
        const map = await createImportMap(baseDir, pattern, pnpmLock, globPrefix, localPrefix, localSuffix, relatives);
        console.log(JSON.stringify(map, null, 2));
        console.error(`\nTotal imports mapped: ${Object.keys(map).length}`);
      } else if (importsOnly) {
        // Just show the imports from source files
        const imports = await extractImportsFromGlob(baseDir, pattern);
        let filteredImports = imports;
        if (!relatives) {
          filteredImports = imports.filter(
            (imp) => !imp.source.startsWith("./") && !imp.source.startsWith("../")
          );
        }
        const uniqueSources = getUniqueImportSources(filteredImports);
        uniqueSources.forEach((source) => console.log(source));
        console.error(`\nTotal unique imports: ${uniqueSources.length}`);
      } else {
        // Full dependency analysis
        const deps = await analyzeDependencies(baseDir, pattern, pnpmLock, relatives);
        deps.forEach((dep) => console.log(`${dep.name}@${dep.version}`));
        console.error(`\nTotal unique dependencies: ${deps.length}`);
      }
    },
  });

  run(app, process.argv.slice(2));
}
