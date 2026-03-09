import { Buffer } from "node:buffer";
import { resolve } from "node:path";
import { runCli } from "../../pkg/run-cli.js";
import { runSkills } from "../../pkg/commands/skills.js";
import { runSystem } from "../../pkg/commands/system.js";
import { runWhoami } from "../../pkg/commands/whoami.js";
import { notImplemented } from "../../pkg/commands/not-implemented.js";
import type { CliOutput } from "../../pkg/commands/cli-output.js";

const MAIN_DENO = resolve(import.meta.dirname, "../../pkg/main.deno.ts");
const DENO_CONFIG = resolve(import.meta.dirname, "../../pkg/deno.json");

interface CliSpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

function assertTrue(condition: boolean, message: string): void {
  if (condition !== true) {
    throw new Error(message);
  }
}

function assertContains(text: string, expected: string, message: string): void {
  assertTrue(text.includes(expected), `${message}\nExpected to find: ${expected}\nOutput:\n${text}`);
}

function captureOutput(): { output: CliOutput; stdout: () => string; stderr: () => string } {
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

async function spawnCli(args: readonly string[]): Promise<CliSpawnResult> {
  const command = new Deno.Command("deno", {
    args: [
      "run",
      "--config",
      DENO_CONFIG,
      "--unstable-sloppy-imports",
      "--allow-read",
      "--allow-env",
      MAIN_DENO,
      ...args,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const output = await command.output();
  return {
    stdout: Buffer.from(output.stdout).toString("utf8"),
    stderr: Buffer.from(output.stderr).toString("utf8"),
    code: output.code,
  };
}

Deno.test("help (unit): outputs usage text", async function testHelpUnit(): Promise<void> {
  const captured = captureOutput();
  await runCli([], {
    output: captured.output,
    setExitCode(_code: number): void {},
  });
  assertContains(captured.stdout(), "use-vibes", "help output should include command name");
  assertContains(captured.stdout(), "skills", "help output should include skills command");
});

Deno.test("whoami (unit): returns error when not logged in", async function testWhoamiUnit(): Promise<void> {
  const result = await runWhoami();
  assertTrue(result.isErr(), "whoami should return err");
  assertContains(String(result.Err()), "Not logged in", "whoami should mention login requirement");
});

Deno.test("skills (unit): lists catalog", async function testSkillsUnit(): Promise<void> {
  const captured = captureOutput();
  const result = await runSkills(captured.output);
  assertTrue(result.isOk(), "skills should return ok");
  assertContains(captured.stdout(), "fireproof", "skills output should include fireproof");
  const lines = captured.stdout().trim().split("\n");
  assertTrue(lines.length >= 3, "skills output should include multiple entries");
});

Deno.test("system (unit): outputs default prompt", async function testSystemDefaultUnit(): Promise<void> {
  const captured = captureOutput();
  const result = await runSystem({}, captured.output);
  assertTrue(result.isOk(), "system should return ok with default skills");
  assertTrue(captured.stdout().length > 100, "system prompt should be non-trivial");
  assertContains(captured.stdout(), "fireproof", "default system prompt should include fireproof");
});

Deno.test("system (unit): --skills fireproof selects specific skill", async function testSystemSpecificSkillUnit(): Promise<void> {
  const captured = captureOutput();
  const result = await runSystem({ skillsCsv: "fireproof" }, captured.output);
  assertTrue(result.isOk(), "system with explicit skills should return ok");
  assertContains(captured.stdout(), "fireproof", "system output should include selected skill");
});

Deno.test("system (unit): --skills with empty value returns error", async function testSystemEmptySkillsUnit(): Promise<void> {
  const result = await runSystem({ skillsCsv: "" });
  assertTrue(result.isErr(), "system should fail for empty --skills value");
  assertContains(String(result.Err()), "--skills requires a value", "system should return value-required error");
});

Deno.test("system (unit): --skills bogus returns error", async function testSystemUnknownSkillUnit(): Promise<void> {
  const result = await runSystem({ skillsCsv: "bogus" });
  assertTrue(result.isErr(), "system should fail for unknown skill");
  assertContains(String(result.Err()), "Unknown skills: bogus", "system should report unknown skill");
});

for (const cmd of ["login", "dev", "live", "generate", "edit", "publish", "invite"] as const) {
  Deno.test(`not-implemented (unit): ${cmd} returns not-yet-implemented`, async function testStubUnit(): Promise<void> {
    const result = await notImplemented({ name: cmd })();
    assertTrue(result.isErr(), `${cmd} should return not implemented`);
    assertContains(String(result.Err()), "not yet implemented", `${cmd} should report not-yet-implemented`);
  });
}

Deno.test("smoke: no args shows help (exit 0)", async function testSmokeNoArgs(): Promise<void> {
  const result = await spawnCli([]);
  assertTrue(result.code === 0, "no-args CLI invocation should exit 0");
  assertContains(result.stdout, "use-vibes", "no-args output should include help text");
});

Deno.test("smoke: help subcommand (exit 0)", async function testSmokeHelpSubcommand(): Promise<void> {
  const result = await spawnCli(["help"]);
  assertTrue(result.code === 0, "help subcommand should exit 0");
  assertContains(result.stdout, "use-vibes", "help subcommand output should include help text");
});

Deno.test("smoke: --help flag (exit 0)", async function testSmokeHelpFlag(): Promise<void> {
  const result = await spawnCli(["--help"]);
  assertTrue(result.code === 0, "--help should exit 0");
  assertContains(result.stdout, "use-vibes", "--help output should include help text");
});

Deno.test("smoke: -h flag (exit 0)", async function testSmokeShortHelpFlag(): Promise<void> {
  const result = await spawnCli(["-h"]);
  assertTrue(result.code === 0, "-h should exit 0");
  assertContains(result.stdout, "use-vibes", "-h output should include help text");
});

Deno.test("smoke: unknown command exits 1", async function testSmokeUnknownCommand(): Promise<void> {
  const result = await spawnCli(["xyzzy"]);
  assertTrue(result.code === 1, "unknown command should exit 1");
});

Deno.test("smoke: generate foo bar exits 1 with not-yet-implemented", async function testSmokeStubCommand(): Promise<void> {
  const result = await spawnCli(["generate", "foo", "bar"]);
  assertTrue(result.code === 1, "stub generate command should exit 1");
  assertContains(result.stderr, "not yet implemented", "stub generate command should report not implemented");
});

Deno.test("smoke: system --skills fireproof outputs prompt", async function testSmokeSystemSpecificSkill(): Promise<void> {
  const result = await spawnCli(["system", "--skills", "fireproof"]);
  assertTrue(result.code === 0, "system with explicit skill should exit 0");
  assertTrue(result.stdout.length > 100, "system output should be non-trivial");
});

Deno.test("smoke: system --skills (missing value) falls back to defaults", async function testSmokeSystemDefaultSkills(): Promise<void> {
  const result = await spawnCli(["system", "--skills"]);
  assertTrue(result.code === 0, "system missing value should fall back to defaults");
  assertTrue(result.stdout.length > 100, "system output should be non-trivial");
});
