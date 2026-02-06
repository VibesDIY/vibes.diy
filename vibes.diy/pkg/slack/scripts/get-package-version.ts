#!/usr/bin/env tsx

import { readWantedLockfile } from "@pnpm/lockfile-file";
import type { Lockfile } from "@pnpm/lockfile-file";
import { join, dirname } from "path";
import { findUp } from "find-up";

/**
 * Find the lockfile by searching upwards from the current directory
 * @param lockfileName - Name of the lockfile (e.g., "pnpm-lock.yaml", "package-lock.json")
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns Path to the directory containing the lockfile, or null if not found
 */
async function findLockfileDir(
  lockfileName: string,
  startDir?: string,
): Promise<string | null> {
  const lockfilePath = await findUp(lockfileName, {
    cwd: startDir || process.cwd(),
  });

  if (!lockfilePath) {
    return null;
  }

  return dirname(lockfilePath);
}

/**
 * Get the version of a package from a parsed lockfile
 * @param lockfile - Parsed pnpm lockfile object
 * @param packageName - Name of the package (e.g., "react", "@vibes.diy/prompts")
 * @returns Version string (or link: path for workspace packages) or null if not found
 */
export function getVersionFromLockfile(
  lockfile: Lockfile,
  packageName: string,
): string | null {
  // First check if it's a workspace package in importers
  if (lockfile.importers) {
    for (const [importerPath, importer] of Object.entries(lockfile.importers)) {
      const allDeps = {
        ...importer.dependencies,
        ...importer.devDependencies,
      };

      for (const [pkgName, version] of Object.entries(allDeps)) {
        if (
          pkgName === packageName &&
          typeof version === "string" &&
          version.startsWith("link:")
        ) {
          return version; // Return the link path
        }
      }
    }
  }

  // If not a workspace package, check regular packages
  if (!lockfile.packages) {
    return null;
  }

  for (const [key] of Object.entries(lockfile.packages)) {
    const cleanKey = key.split("(")[0].replace(":", "");
    let pkgName: string;
    let pkgVersion: string;

    if (cleanKey.startsWith("@")) {
      const scopeEnd = cleanKey.indexOf("/");
      if (scopeEnd > 0) {
        const nameEnd = cleanKey.indexOf("@", scopeEnd);
        pkgName = cleanKey.substring(0, nameEnd);
        pkgVersion = cleanKey.substring(nameEnd + 1);
      } else {
        continue;
      }
    } else {
      const atIndex = cleanKey.indexOf("@");
      if (atIndex > 0) {
        pkgName = cleanKey.substring(0, atIndex);
        pkgVersion = cleanKey.substring(atIndex + 1);
      } else {
        continue;
      }
    }

    if (pkgName === packageName) {
      return pkgVersion;
    }
  }

  return null;
}

/**
 * Get the version of a package from lockfile
 * @param packageName - Name of the package (e.g., "react", "@vibes.diy/prompts")
 * @param lockfileName - Name of the lockfile to search for
 * @returns Version string or null if not found
 */
export async function getPackageVersion(
  packageName: string,
  lockfileName: string,
): Promise<string | null> {
  const lockfileDir = await findLockfileDir(lockfileName);
  if (!lockfileDir) {
    console.error(`Could not find ${lockfileName}`);
    return null;
  }

  try {
    const lockfile = await readWantedLockfile(lockfileDir, {
      ignoreIncompatible: true,
    });

    if (!lockfile) {
      return null;
    }

    return getVersionFromLockfile(lockfile, packageName);
  } catch (error) {
    console.error("Error reading lockfile:", error);
    return null;
  }
}

export interface DependencyNode {
  name: string;
  version: string;
  dependencies: DependencyNode[];
}

/**
 * Get the dependency tree for a package from a parsed lockfile
 * @param lockfile - Parsed pnpm lockfile object
 * @param packageName - Name of the package (e.g., "react", "@fireproof/core")
 * @param maxDepth - Maximum depth to traverse (default: 10, prevents infinite loops)
 * @returns Dependency tree or null if package not found
 */
export function getDependencyTree(
  lockfile: Lockfile,
  packageName: string,
  maxDepth: number = 10,
): DependencyNode | null {
  // First check if it's a workspace package in importers
  if (lockfile.importers) {
    for (const [importerPath, importer] of Object.entries(lockfile.importers)) {
      const allDeps = {
        ...importer.dependencies,
        ...importer.devDependencies,
      };

      for (const [pkgName, version] of Object.entries(allDeps)) {
        if (
          pkgName === packageName &&
          typeof version === "string" &&
          version.startsWith("link:")
        ) {
          // For workspace packages, return tree with dependencies from importer
          const node: DependencyNode = {
            name: packageName,
            version: version,
            dependencies: [],
          };

          // Get dependencies of this workspace package from its importer entry
          // The link path is relative (e.g., "link:../../prompts/pkg"), we need to resolve it
          // Look through all importers to find one that matches this package name
          let workspaceImporter = null;
          if (lockfile.importers) {
            for (const [path, imp] of Object.entries(lockfile.importers)) {
              // Check if this importer path ends with the package name structure
              // For @vibes.diy/prompts, look for paths like "prompts/pkg"
              // For call-ai, look for paths like "call-ai/pkg"
              if (
                path.includes(
                  packageName.replace("@vibes.diy/", "").replace("@", ""),
                )
              ) {
                workspaceImporter = imp;
                break;
              }
            }
          }

          if (workspaceImporter) {
            const workspaceDeps = {
              ...workspaceImporter.dependencies,
              ...workspaceImporter.optionalDependencies,
            };

            for (const [depName, depVersion] of Object.entries(workspaceDeps)) {
              if (typeof depVersion === "string") {
                // Recursively get dependency trees
                const depTree = getDependencyTree(lockfile, depName, maxDepth);
                if (depTree) {
                  node.dependencies.push(depTree);
                }
              }
            }
          }

          return node;
        }
      }
    }
  }

  // If not a workspace package, check regular packages
  if (!lockfile.packages) {
    return null;
  }

  // Find the package entry in the lockfile
  let packageKey: string | null = null;
  let packageVersion: string | null = null;

  for (const [key] of Object.entries(lockfile.packages)) {
    const cleanKey = key.split("(")[0].replace(":", "");
    let pkgName: string;
    let pkgVersion: string;

    if (cleanKey.startsWith("@")) {
      const scopeEnd = cleanKey.indexOf("/");
      if (scopeEnd > 0) {
        const nameEnd = cleanKey.indexOf("@", scopeEnd);
        pkgName = cleanKey.substring(0, nameEnd);
        pkgVersion = cleanKey.substring(nameEnd + 1);
      } else {
        continue;
      }
    } else {
      const atIndex = cleanKey.indexOf("@");
      if (atIndex > 0) {
        pkgName = cleanKey.substring(0, atIndex);
        pkgVersion = cleanKey.substring(atIndex + 1);
      } else {
        continue;
      }
    }

    if (pkgName === packageName) {
      packageKey = key;
      packageVersion = pkgVersion;
      break;
    }
  }

  if (!packageKey || !packageVersion) {
    return null;
  }

  // Build the tree recursively
  const visited = new Set<string>();

  function buildTree(
    pkgKey: string,
    pkgName: string,
    pkgVersion: string,
    depth: number,
  ): DependencyNode {
    const node: DependencyNode = {
      name: pkgName,
      version: pkgVersion,
      dependencies: [],
    };

    // Prevent infinite loops and limit depth
    if (depth >= maxDepth || visited.has(pkgKey)) {
      return node;
    }

    visited.add(pkgKey);

    // Get the package entry
    const pkgEntry = (lockfile.packages as Record<string, any>)?.[pkgKey];
    if (!pkgEntry) {
      return node;
    }

    // Get all dependencies
    const allDeps = {
      ...pkgEntry.dependencies,
      ...pkgEntry.optionalDependencies,
    };

    if (!allDeps) {
      return node;
    }

    // Process each dependency
    for (const [depName, depVersion] of Object.entries(allDeps)) {
      if (typeof depVersion !== "string") continue;

      // Find the dependency in the lockfile packages
      for (const [key] of Object.entries(lockfile.packages || {})) {
        const cleanKey = key.split("(")[0].replace(":", "");
        let keyPkgName: string;
        let keyPkgVersion: string;

        if (cleanKey.startsWith("@")) {
          const scopeEnd = cleanKey.indexOf("/");
          if (scopeEnd > 0) {
            const nameEnd = cleanKey.indexOf("@", scopeEnd);
            keyPkgName = cleanKey.substring(0, nameEnd);
            keyPkgVersion = cleanKey.substring(nameEnd + 1);
          } else {
            continue;
          }
        } else {
          const atIndex = cleanKey.indexOf("@");
          if (atIndex > 0) {
            keyPkgName = cleanKey.substring(0, atIndex);
            keyPkgVersion = cleanKey.substring(atIndex + 1);
          } else {
            continue;
          }
        }

        if (keyPkgName === depName) {
          const childNode = buildTree(
            key,
            keyPkgName,
            keyPkgVersion,
            depth + 1,
          );
          node.dependencies.push(childNode);
          break;
        }
      }
    }

    return node;
  }

  return buildTree(packageKey, packageName, packageVersion, 0);
}

/**
 * Get the dependency tree for a package from lockfile
 * @param packageName - Name of the package
 * @param lockfileName - Name of the lockfile to search for
 * @param maxDepth - Maximum depth to traverse (default: 10)
 * @returns Dependency tree or null if package not found
 */
export async function getPackageDependencyTree(
  packageName: string,
  lockfileName: string,
  maxDepth: number = 10,
): Promise<DependencyNode | null> {
  const lockfileDir = await findLockfileDir(lockfileName);
  if (!lockfileDir) {
    console.error(`Could not find ${lockfileName}`);
    return null;
  }

  try {
    const lockfile = await readWantedLockfile(lockfileDir, {
      ignoreIncompatible: true,
    });

    if (!lockfile) {
      return null;
    }

    return getDependencyTree(lockfile, packageName, maxDepth);
  } catch (error) {
    console.error("Error reading lockfile:", error);
    return null;
  }
}

export interface FlatDependency {
  name: string;
  version: string;
}

/**
 * Flatten a dependency tree into a list of unique packages
 * @param tree - Dependency tree node
 * @returns Array of unique dependencies with name and version (sorted by name)
 */
export function flattenDependencyTree(tree: DependencyNode): FlatDependency[] {
  const seen = new Set<string>();
  const result: FlatDependency[] = [];

  function traverse(node: DependencyNode) {
    const key = `${node.name}@${node.version}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push({
      name: node.name,
      version: node.version,
    });

    for (const dep of node.dependencies) {
      traverse(dep);
    }
  }

  traverse(tree);

  // Sort by name
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all dependencies from a package.json file and flatten their trees
 * @param lockfile - Parsed pnpm lockfile object
 * @param packageJsonPath - Path to package.json file
 * @returns Array of unique dependencies across all package.json dependencies (production only)
 */
export async function getAllDependenciesFromPackageJson(
  lockfile: Lockfile,
  packageJsonPath: string,
): Promise<FlatDependency[]> {
  const fs = await import("fs/promises");
  const { resolve } = await import("path");

  try {
    const pkgJsonContent = await fs.readFile(resolve(packageJsonPath), "utf-8");
    const pkgJson = JSON.parse(pkgJsonContent);

    // Only get production dependencies
    const deps = pkgJson.dependencies || {};

    const seen = new Set<string>();
    const result: FlatDependency[] = [];

    // Process each dependency
    for (const depName of Object.keys(deps)) {
      const tree = getDependencyTree(lockfile, depName);
      if (tree) {
        const flatList = flattenDependencyTree(tree);
        for (const dep of flatList) {
          const key = `${dep.name}@${dep.version}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push(dep);
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Error reading package.json:", error);
    return [];
  }
}

/**
 * Get all dependencies from a package.json file (convenience wrapper)
 * @param packageJsonPath - Path to package.json file
 * @param lockfileName - Name of the lockfile to search for
 * @returns Array of unique dependencies across all package.json dependencies (production only)
 */
export async function getPackageJsonDependencies(
  packageJsonPath: string,
  lockfileName: string,
): Promise<FlatDependency[]> {
  const lockfileDir = await findLockfileDir(lockfileName);
  if (!lockfileDir) {
    console.error(`Could not find ${lockfileName}`);
    return [];
  }

  try {
    const lockfile = await readWantedLockfile(lockfileDir, {
      ignoreIncompatible: true,
    });

    if (!lockfile) {
      return [];
    }

    return getAllDependenciesFromPackageJson(lockfile, packageJsonPath);
  } catch (error) {
    console.error("Error reading lockfile:", error);
    return [];
  }
}

// Helper function to print dependency tree
function printTree(
  node: DependencyNode,
  prefix: string = "",
  isLast: boolean = true,
) {
  const connector = isLast ? "└─" : "├─";
  console.log(`${prefix}${connector} ${node.name}@${node.version}`);

  const newPrefix = prefix + (isLast ? "   " : "│  ");

  for (let i = 0; i < node.dependencies.length; i++) {
    const isLastChild = i === node.dependencies.length - 1;
    printTree(node.dependencies[i], newPrefix, isLastChild);
  }
}

// CLI usage with cmd-ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const { run, subcommands, command, string, option, positional, flag } =
    await import("cmd-ts");

  const pnpmLockOption = option({
    type: string,
    long: "pnpmLock",
    description: "Lockfile name to search for (searches upwards from cwd)",
    defaultValue: () => "pnpm-lock.yaml",
  });

  const versionCmd = command({
    name: "version",
    description: "Get the version of a package",
    args: {
      package: positional({
        type: string,
        displayName: "package",
        description: "Package name (e.g., react, @vibes.diy/prompts)",
      }),
      pnpmLock: pnpmLockOption,
    },
    handler: async ({ package: pkg, pnpmLock }) => {
      const version = await getPackageVersion(pkg, pnpmLock);
      if (version) {
        console.log(version);
      } else {
        console.error(`Package not found: ${pkg}`);
        process.exit(1);
      }
    },
  });

  const treeCmd = command({
    name: "tree",
    description: "Show dependency tree for a package",
    args: {
      package: positional({
        type: string,
        displayName: "package",
        description: "Package name",
      }),
      pnpmLock: pnpmLockOption,
    },
    handler: async ({ package: pkg, pnpmLock }) => {
      const tree = await getPackageDependencyTree(pkg, pnpmLock);
      if (tree) {
        console.log(`${tree.name}@${tree.version}`);
        for (let i = 0; i < tree.dependencies.length; i++) {
          const isLast = i === tree.dependencies.length - 1;
          printTree(tree.dependencies[i], "", isLast);
        }
      } else {
        console.error(`Package not found: ${pkg}`);
        process.exit(1);
      }
    },
  });

  const listCmd = command({
    name: "list",
    description: "Show flat list of all dependencies for a package",
    args: {
      package: positional({
        type: string,
        displayName: "package",
        description: "Package name",
      }),
      pnpmLock: pnpmLockOption,
    },
    handler: async ({ package: pkg, pnpmLock }) => {
      const tree = await getPackageDependencyTree(pkg, pnpmLock);
      if (tree) {
        const flatList = flattenDependencyTree(tree);
        flatList.forEach((dep) => {
          console.log(`${dep.name}@${dep.version}`);
        });
      } else {
        console.error(`Package not found: ${pkg}`);
        process.exit(1);
      }
    },
  });

  const pkgJsonCmd = command({
    name: "pkg-json",
    description: "Show all dependencies from a package.json file",
    args: {
      path: positional({
        type: string,
        displayName: "path",
        description: "Path to package.json file",
      }),
      pnpmLock: pnpmLockOption,
    },
    handler: async ({ path, pnpmLock }) => {
      const deps = await getPackageJsonDependencies(path, pnpmLock);
      if (deps.length > 0) {
        console.log(`Total unique dependencies: ${deps.length}`);
        deps.forEach((dep) => {
          console.log(`${dep.name}@${dep.version}`);
        });
      } else {
        console.error(`No dependencies found or error reading package.json`);
        process.exit(1);
      }
    },
  });

  const app = subcommands({
    name: "get-package-version",
    description: "Query package versions and dependencies from pnpm-lock.yaml",
    cmds: {
      version: versionCmd,
      tree: treeCmd,
      list: listCmd,
      "pkg-json": pkgJsonCmd,
    },
  });

  run(app, process.argv.slice(2));
}
