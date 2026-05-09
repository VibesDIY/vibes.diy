#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const allowlistPath = resolve(scriptDir, "rules-bag-constructors.allowlist.txt");

const targetPaths = ["vibes.diy/pkg", "vibes-diy/cli", "call-ai/v2"];
const bannedPatterns = ["new URL(", "new TextEncoder(", "new TextDecoder("];

// Prompt-generated App.jsx output is intentionally exempt from this guardrail.
const excludedGlobs = ["**/App.jsx"];

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

const rgArgs = ["--line-number", "--no-heading", "--color=never", "--fixed-strings"];

for (const pattern of bannedPatterns) {
  rgArgs.push("-e", pattern);
}

for (const glob of excludedGlobs) {
  rgArgs.push("--glob", `!${glob}`);
}

rgArgs.push(...targetPaths);

const rgResult = spawnSync("rg", rgArgs, {
  cwd: repoRoot,
  encoding: "utf8",
});

if (rgResult.status !== 0 && rgResult.status !== 1) {
  process.stderr.write(rgResult.stderr || "Failed to run ripgrep for rules-bag constructor guardrail.\n");
  process.exit(rgResult.status ?? 2);
}

const matches = (rgResult.stdout || "")
  .split("\n")
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
