import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import process from "node:process";
import { dispatch } from "../../pkg/dispatcher.js";
import type { CliOutput } from "../../pkg/commands/cli-output-node.js";
import type { CliRuntime } from "../../pkg/cli/executable.js";

export interface CliSpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

export function makeTestRuntime(opts?: { cwd?: string }): { runtime: CliRuntime; stdout: () => string; stderr: () => string } {
  const captured = captureOutput();
  return {
    runtime: {
      cwd: opts?.cwd ?? process.cwd(),
      output: captured.output,
      setExitCode(_nextCode: number): void {
        /* no-op in unit tests — use runCli for exit code testing */
      },
    },
    stdout: captured.stdout,
    stderr: captured.stderr,
  };
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

export async function runCli(args: readonly string[], opts?: { cwd?: string }): Promise<CliSpawnResult> {
  const captured = captureOutput();
  let code = 0;
  await dispatch([...args], {
    cwd: opts?.cwd ?? process.cwd(),
    output: captured.output,
    setExitCode(nextCode: number): void {
      code = nextCode;
    },
  });
  return {
    stdout: captured.stdout(),
    stderr: captured.stderr(),
    code,
  };
}

export async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "use-vibes-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
