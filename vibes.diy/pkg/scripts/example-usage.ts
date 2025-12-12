#!/usr/bin/env tsx

import {
  getPackageVersion,
  getPackageDependencyTree,
  getVersionFromLockfile,
  getDependencyTree,
  flattenDependencyTree,
  getPackageJsonDependencies,
  getAllDependenciesFromPackageJson
} from "./get-package-version.js";
import { readWantedLockfile } from "@pnpm/lockfile-file";

async function main() {
  console.log("=== Example 1: Get Package Version (default: pnpm-lock.yaml) ===");

  // Get version - searches upwards for pnpm-lock.yaml
  const reactVersion = await getPackageVersion("react", "pnpm-lock.yaml");
  console.log(`react: ${reactVersion}`);

  const cborgVersion = await getPackageVersion("cborg", "pnpm-lock.yaml");
  console.log(`cborg: ${cborgVersion}`);

  console.log("\n=== Example 2: Get Dependency Tree ===");

  // Get dependency tree for a package
  const tree = await getPackageDependencyTree("@ipld/dag-cbor", "pnpm-lock.yaml");
  if (tree) {
    console.log(`${tree.name}@${tree.version}`);
    console.log(`Dependencies: ${tree.dependencies.length}`);
    tree.dependencies.forEach(dep => {
      console.log(`  - ${dep.name}@${dep.version}`);
    });
  }

  console.log("\n=== Example 3: Flatten Dependency Tree ===");

  // Get flat list of all dependencies
  const routerTree = await getPackageDependencyTree("react-router-dom", "pnpm-lock.yaml");
  if (routerTree) {
    const flatList = flattenDependencyTree(routerTree);
    console.log(`Total unique dependencies: ${flatList.length}`);
    flatList.slice(0, 5).forEach(dep => {
      console.log(`  ${dep.name}@${dep.version}`);
    });
    console.log(`  ... and ${flatList.length - 5} more`);
  }

  console.log("\n=== Example 4: All Dependencies from package.json ===");

  // Get all dependencies from a package.json file
  const allDeps = await getPackageJsonDependencies("./package.json", "pnpm-lock.yaml");
  console.log(`Total unique dependencies from package.json: ${allDeps.length}`);
  console.log("First 5 dependencies:");
  allDeps.slice(0, 5).forEach(dep => {
    console.log(`  ${dep.name}@${dep.version}`);
  });

  console.log("\n=== Example 5: Using Parsed Lockfile (most efficient) ===");

  // Read lockfile once and reuse it for multiple operations
  const lockfile = await readWantedLockfile("../..", {
    ignoreIncompatible: false
  });
  if (lockfile) {
    // Get multiple versions efficiently
    const packages = ["react", "react-dom", "cborg"];
    for (const pkg of packages) {
      const version = getVersionFromLockfile(lockfile, pkg);
      console.log(`${pkg}: ${version}`);
    }

    // Get all dependencies from package.json using parsed lockfile
    const deps = await getAllDependenciesFromPackageJson(lockfile, "./package.json");
    console.log(`\nTotal dependencies from package.json: ${deps.length}`);
  }
}

main().catch(console.error);
