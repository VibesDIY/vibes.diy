import { dispatch } from "../../pkg/dispatcher.js";
import { runSkills } from "../../pkg/commands/skills.js";
import { runSystem } from "../../pkg/commands/system.js";
import { runWhoami } from "../../pkg/commands/whoami.js";
import { assertTrue, assertContains, captureOutput, spawnCli } from "./test-helpers.js";

Deno.test("help (unit): outputs usage text", async function (): Promise<void> {
  const captured = captureOutput();
  await dispatch([], {
    output: captured.output,
    setExitCode(_code: number): void {},
  });
  assertContains(captured.stdout(), "use-vibes", "help output should include command name");
  assertContains(captured.stdout(), "skills", "help output should include skills command");
});

Deno.test("whoami (unit): returns error when not logged in", async function (): Promise<void> {
  const result = await runWhoami();
  assertTrue(result.isErr(), "whoami should return err");
  assertContains(String(result.Err()), "Not logged in", "whoami should mention login requirement");
});

Deno.test("skills (unit): lists catalog", async function (): Promise<void> {
  const captured = captureOutput();
  const result = await runSkills(captured.output);
  assertTrue(result.isOk(), "skills should return ok");
  assertContains(captured.stdout(), "fireproof", "skills output should include fireproof");
  const lines = captured.stdout().trim().split("\n");
  assertTrue(lines.length >= 3, "skills output should include multiple entries");
});

Deno.test("system (unit): outputs default prompt", async function (): Promise<void> {
  const captured = captureOutput();
  const result = await runSystem({}, captured.output);
  assertTrue(result.isOk(), "system should return ok with default skills");
  assertTrue(captured.stdout().length > 100, "system prompt should be non-trivial");
  assertContains(captured.stdout(), "fireproof", "default system prompt should include fireproof");
});

Deno.test("system (unit): --skills fireproof selects specific skill", async function (): Promise<void> {
  const captured = captureOutput();
  const result = await runSystem({ skillsCsv: "fireproof" }, captured.output);
  assertTrue(result.isOk(), "system with explicit skills should return ok");
  assertContains(captured.stdout(), "fireproof", "system output should include selected skill");
});

Deno.test("system (unit): --skills with empty value returns error", async function (): Promise<void> {
  const result = await runSystem({ skillsCsv: "" });
  assertTrue(result.isErr(), "system should fail for empty --skills value");
  assertContains(String(result.Err()), "--skills requires a value", "system should return value-required error");
});

Deno.test("system (unit): --skills bogus returns error", async function (): Promise<void> {
  const result = await runSystem({ skillsCsv: "bogus" });
  assertTrue(result.isErr(), "system should fail for unknown skill");
  assertContains(String(result.Err()), "Unknown skills: bogus", "system should report unknown skill");
});

Deno.test("smoke: no args shows help (exit 0)", async function (): Promise<void> {
  const result = await spawnCli([]);
  assertTrue(result.code === 0, "no-args CLI invocation should exit 0");
  assertContains(result.stdout, "use-vibes", "no-args output should include help text");
});

Deno.test("smoke: help subcommand (exit 0)", async function (): Promise<void> {
  const result = await spawnCli(["help"]);
  assertTrue(result.code === 0, "help subcommand should exit 0");
  assertContains(result.stdout, "use-vibes", "help subcommand output should include help text");
});

Deno.test("smoke: --help flag (exit 0)", async function (): Promise<void> {
  const result = await spawnCli(["--help"]);
  assertTrue(result.code === 0, "--help should exit 0");
  assertContains(result.stdout, "use-vibes", "--help output should include help text");
});

Deno.test("smoke: -h flag (exit 0)", async function (): Promise<void> {
  const result = await spawnCli(["-h"]);
  assertTrue(result.code === 0, "-h should exit 0");
  assertContains(result.stdout, "use-vibes", "-h output should include help text");
});

Deno.test("smoke: unknown command exits 1", async function (): Promise<void> {
  const result = await spawnCli(["xyzzy"]);
  assertTrue(result.code === 1, "unknown command should exit 1");
});

Deno.test("smoke: removed commands exit 1 as unknown", async function (): Promise<void> {
  const result = await spawnCli(["generate", "foo", "bar"]);
  assertTrue(result.code === 1, "removed command should exit 1");
  assertContains(result.stderr, "Unknown command", "removed command should report unknown");
});

Deno.test("smoke: system --skills fireproof outputs prompt", async function (): Promise<void> {
  const result = await spawnCli(["system", "--skills", "fireproof"]);
  assertTrue(result.code === 0, "system with explicit skill should exit 0");
  assertTrue(result.stdout.length > 100, "system output should be non-trivial");
});

Deno.test("smoke: system --skills (missing value) falls back to defaults", async function (): Promise<void> {
  const result = await spawnCli(["system", "--skills"]);
  assertTrue(result.code === 0, "system missing value should fall back to defaults");
  assertTrue(result.stdout.length > 100, "system output should be non-trivial");
});
