#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";

function resolvePath(inputPath) {
  if (!inputPath) return null;
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "../", inputPath);
}

const requestArg = process.argv[2] || "fixtures/openai-fireproof-stream-request.json";
const responseArg = process.argv[3] || "fixtures/openai-fireproof-stream-response.txt";

const requestPath = resolvePath(requestArg);
const responsePath = resolvePath(responseArg);

let apiKey = process.env.CALLAI_API_KEY || process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  // Attempt to load a .env file up the tree
  const possibleEnvPaths = [
    "../../../../.env",
    "../../../.env",
    "../../.env",
    "../.env",
    ".env",
  ].map((relativePath) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativePath));

  for (const envPath of possibleEnvPaths) {
    try {
      const envText = readFileSync(envPath, "utf8");
      envText.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=");
        if (key === "CALLAI_API_KEY" || key === "OPENROUTER_API_KEY") {
          apiKey = value;
        }
      });
      if (apiKey) break;
    } catch (error) {
      // ignore missing files
    }
  }
}

if (!apiKey) {
  console.error("❌ Missing CALLAI_API_KEY or OPENROUTER_API_KEY environment variable.");
  process.exit(1);
}

const requestBody = readFileSync(requestPath, "utf8");

const curlArgs = [
  "-X",
  "POST",
  "https://openrouter.ai/api/v1/chat/completions",
  "-H",
  "Content-Type: application/json",
  "-H",
  "Accept: text/event-stream",
  "-H",
  `Authorization: Bearer ${apiKey}`,
  "-sS",
  "-N",
  "--data",
  requestBody,
];

console.log(`🚀 Capturing stream from OpenRouter using ${requestPath}`);
try {
  const output = execFileSync("curl", curlArgs, { encoding: "utf8" });
  writeFileSync(responsePath, output, "utf8");
  console.log(`✅ Streaming response saved to ${responsePath}`);
} catch (error) {
  console.error("❌ Failed to capture stream:", error.message);
  if (error.stdout) {
    writeFileSync(responsePath, error.stdout.toString(), "utf8");
    console.error("Partial response saved before failure.");
  }
  process.exit(1);
}
