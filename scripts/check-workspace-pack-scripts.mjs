#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const allowlistPath = resolve(scriptDir, "workspace-pack-echo-stubs.allowlist.txt");

function readAllowlist(filePath) {
  const contents = readFileSync(filePath, "utf8");
  return new Set(
    contents
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .map((line) => line.replace(/#.*$/, "").trim())
      .filter(Boolean),
  );
}

function loadWorkspacePackages() {
  const command = spawnSync("corepack", ["pnpm", "-r", "list", "--depth", "-1", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (command.error) {
    throw command.error;
  }

  if (command.status !== 0) {
    console.error("❌ Failed to enumerate workspace packages with pnpm.");
    if (command.stderr.trim().length > 0) {
      console.error("\nstderr:");
      console.error(command.stderr.trimEnd());
    }
    if (command.stdout.trim().length > 0) {
      console.error("\nstdout:");
      console.error(command.stdout.trimEnd());
    }
    process.exit(command.status ?? 1);
  }

  try {
    return JSON.parse(command.stdout);
  } catch (error) {
    console.error("❌ Failed to parse workspace list JSON from pnpm.");
    console.error(command.stdout.trimEnd());
    throw error;
  }
}

function isEchoStub(scriptValue) {
  return typeof scriptValue === "string" && /^echo\b/i.test(scriptValue.trim());
}

function toPosixPath(filePath) {
  return filePath.split("\\").join("/");
}

const allowlistedPackages = readAllowlist(allowlistPath);
const workspaceRows = loadWorkspacePackages();

const missingPackScript = [];
const unexpectedEchoStubs = [];
const staleAllowlistEntries = [];
const workspacePackagesByName = new Map();

let nonPrivateWorkspaceCount = 0;

for (const row of workspaceRows) {
  const packageJsonPath = resolve(row.path, "package.json");
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const packageName = manifest.name || row.name || toPosixPath(relative(repoRoot, row.path));
  const isPrivate = manifest.private === true || row.private === true;
  const packScript = manifest.scripts?.pack;
  const hasPackScript = typeof packScript === "string";
  const echoStub = isEchoStub(packScript);
  const relativePath = toPosixPath(relative(repoRoot, row.path));

  workspacePackagesByName.set(packageName, {
    packageName,
    relativePath,
    isPrivate,
    hasPackScript,
    packScript,
    echoStub,
  });

  if (isPrivate) {
    continue;
  }

  nonPrivateWorkspaceCount += 1;

  if (!hasPackScript) {
    missingPackScript.push({ packageName, relativePath });
    continue;
  }

  if (echoStub && !allowlistedPackages.has(packageName)) {
    unexpectedEchoStubs.push({ packageName, relativePath, packScript });
  }
}

for (const packageName of [...allowlistedPackages].sort()) {
  const workspacePackage = workspacePackagesByName.get(packageName);

  if (!workspacePackage) {
    staleAllowlistEntries.push({ packageName, reason: "package is not present in this workspace" });
    continue;
  }

  if (workspacePackage.isPrivate) {
    staleAllowlistEntries.push({
      packageName,
      reason: `package is private (${workspacePackage.relativePath}); allowlist is only for non-private packages`,
    });
    continue;
  }

  if (!workspacePackage.echoStub) {
    const currentPack = workspacePackage.hasPackScript
      ? `current scripts.pack is ${JSON.stringify(workspacePackage.packScript)}`
      : "scripts.pack is missing";
    staleAllowlistEntries.push({ packageName, reason: currentPack });
  }
}

if (missingPackScript.length > 0 || unexpectedEchoStubs.length > 0 || staleAllowlistEntries.length > 0) {
  console.error("❌ Workspace pack script guard failed.");

  if (missingPackScript.length > 0) {
    console.error("\nMissing scripts.pack for non-private workspace packages:");
    for (const item of missingPackScript) {
      console.error(`- ${item.packageName} (${item.relativePath})`);
    }
    console.error("  Action: add a real `scripts.pack` command to each package above.");
  }

  if (unexpectedEchoStubs.length > 0) {
    console.error("\nUnexpected echo stubs for scripts.pack (non-allowlisted):");
    for (const item of unexpectedEchoStubs) {
      console.error(`- ${item.packageName} (${item.relativePath}): ${JSON.stringify(item.packScript)}`);
    }
    console.error(`  Action: replace echo stubs with real pack commands or explicitly add exceptions to ${allowlistPath}.`);
  }

  if (staleAllowlistEntries.length > 0) {
    console.error("\nStale allowlist entries (no longer intentional non-private echo stubs):");
    for (const item of staleAllowlistEntries) {
      console.error(`- ${item.packageName}: ${item.reason}`);
    }
    console.error(`  Action: remove stale entries from ${allowlistPath} or restore intentional echo stubs.`);
  }

  process.exit(1);
}

console.log(
  `✅ Workspace pack script guard passed (checked ${nonPrivateWorkspaceCount} non-private workspace packages; allowlisted echo stubs: ${allowlistedPackages.size}).`,
);
