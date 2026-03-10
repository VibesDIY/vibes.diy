import { Buffer } from "node:buffer";
import { resolve, join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import type { CliOutput } from "../../pkg/commands/cli-output.js";

// Redirect keybag to a unique /tmp path so tests don't need ~/.fireproof write access
// and don't leak state across runs
if (!Deno.env.get("FP_KEYBAG_URL")) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  Deno.env.set("FP_KEYBAG_URL", `file:///tmp/use-vibes-test-keybag-${runId}`);
}

export const MAIN_DENO = resolve(import.meta.dirname, "../../pkg/main.deno.ts");
export const DENO_CONFIG = resolve(import.meta.dirname, "../../pkg/deno.json");

export interface CliSpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

export function assertTrue(condition: boolean, message: string): void {
  if (condition !== true) {
    throw new Error(message);
  }
}

export function assertContains(text: string, expected: string, message: string): void {
  assertTrue(text.includes(expected), `${message}\nExpected to find: ${expected}\nOutput:\n${text}`);
}

export function captureOutput(): { output: CliOutput; stdout: () => string; stderr: () => string } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    output: {
      stdout(text: string): void {
        out.push(text);
      },
      stderr(text: string): void {
        err.push(text);
      },
    },
    stdout: () => out.join(""),
    stderr: () => err.join(""),
  };
}

export async function spawnCli(args: readonly string[], opts?: { cwd?: string }): Promise<CliSpawnResult> {
  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--config",
      DENO_CONFIG,
      "--unstable-sloppy-imports",
      "--allow-read",
      "--allow-env",
      "--allow-write=/tmp",
      MAIN_DENO,
      ...args,
    ],
    stdout: "piped",
    stderr: "piped",
    cwd: opts?.cwd,
  });

  const output = await command.output();
  return {
    stdout: Buffer.from(output.stdout).toString("utf8"),
    stderr: Buffer.from(output.stderr).toString("utf8"),
    code: output.code,
  };
}

export async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = join("/tmp", `use-vibes-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
