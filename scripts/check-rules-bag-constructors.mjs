#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const allowlistPath = resolve(scriptDir, "rules-bag-constructors.allowlist.txt");

const targetPaths = ["vibes.diy/pkg", "vibes-diy/cli", "call-ai/v2"];
const bannedPatterns = ["new URL(", "new TextEncoder(", "new TextDecoder("];

// Prompt-generated App.jsx output and build artifacts are intentionally exempt from this guardrail.
const excludedGlobs = ["**/App.jsx", "**/build/**", "**/dist/**"];

function readAllowlist(filePath) {
  const contents = readFileSync(filePath, "utf8");
  return new Set(
    contents
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith("#");
      }),
  );
}

function normalizeToPosixPath(filePath) {
  return filePath.split("\\").join("/");
}

function globToRegex(globPattern) {
  const escapedPattern = normalizeToPosixPath(globPattern)
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replaceAll("**", "::DOUBLE_STAR::")
    .replaceAll("*", "[^/]*")
    .replaceAll("::DOUBLE_STAR::", ".*");

  return new RegExp(`^${escapedPattern}$`);
}

const excludedRegexes = excludedGlobs.map((globPattern) => globToRegex(globPattern));

function isExcludedPath(relativePath) {
  const posixPath = normalizeToPosixPath(relativePath);
  return excludedRegexes.some((regex) => regex.test(posixPath));
}

function collectFilesRecursively(absolutePath, relativePath, collector) {
  let entries;
  try {
    entries = readdirSync(absolutePath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const nextAbsolutePath = join(absolutePath, entry.name);
    const nextRelativePath = normalizeToPosixPath(join(relativePath, entry.name));

    if (isExcludedPath(nextRelativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectFilesRecursively(nextAbsolutePath, nextRelativePath, collector);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    collector.push({
      absolutePath: nextAbsolutePath,
      relativePath: nextRelativePath,
    });
  }
}

function lineContainsBannedPattern(line) {
  return bannedPatterns.some((pattern) => line.includes(pattern));
}

function findMatchesInFile({ absolutePath, relativePath }) {
  let fileBuffer;
  try {
    fileBuffer = readFileSync(absolutePath);
  } catch {
    return [];
  }

  if (fileBuffer.includes(0)) {
    return [];
  }

  const fileContent = fileBuffer.toString("utf8");
  const lines = fileContent.split("\n");
  const matches = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, "");

    if (!lineContainsBannedPattern(line)) {
      continue;
    }

    matches.push(`${relativePath}:${index + 1}:${line}`);
  }

  return matches;
}

const filesToScan = [];
for (const targetPath of targetPaths) {
  const absoluteTargetPath = resolve(repoRoot, targetPath);
  collectFilesRecursively(absoluteTargetPath, targetPath, filesToScan);
}

const matches = filesToScan
  .flatMap((file) => findMatchesInFile(file))
  .map((line) => line.trimEnd())
  .filter(Boolean)
  .sort();

const allowlistedMatches = readAllowlist(allowlistPath);
const unexpectedMatches = matches.filter((line) => !allowlistedMatches.has(line));

if (unexpectedMatches.length > 0) {
  console.error("❌ rules-bag constructor guardrail failed: found new banned constructor usage.");
  console.error("\nNew violations (path:line:code):");
  for (const line of unexpectedMatches) {
    console.error(`- ${line}`);
  }

  console.error(
    `\nIf a narrow exemption is truly required, add an explicit comment and allowlist entry in ${allowlistPath}.`,
  );

  process.exit(1);
}

const staleAllowlistEntries = [...allowlistedMatches].filter((line) => !matches.includes(line));
if (staleAllowlistEntries.length > 0) {
  console.warn("ℹ️ rules-bag constructor guardrail: stale allowlist entries can be removed:");
  for (const line of staleAllowlistEntries) {
    console.warn(`- ${line}`);
  }
}

console.log(
  `✅ rules-bag constructor guardrail passed (tracked baseline matches: ${matches.length}, new violations: 0).`,
);
