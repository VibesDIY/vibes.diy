import { describe, expect, it } from "vitest";
import { runSkills } from "../../pkg/commands/skills.js";
import { runSystem } from "../../pkg/commands/system.js";
import { runWhoami } from "../../pkg/commands/whoami.js";
import { runCli, captureOutput } from "./test-helpers.js";

describe("CLI unit commands", () => {
  it("whoami returns error when not logged in", async () => {
    const result = await runWhoami();
    expect(result.isErr()).toBe(true);
    expect(String(result.Err())).toContain("Not logged in");
  });

  it("skills lists catalog", async () => {
    const captured = captureOutput();
    const result = await runSkills(captured.output);
    expect(result.isOk()).toBe(true);
    expect(captured.stdout()).toContain("fireproof");
    expect(captured.stdout().trim().split("\n").length).toBeGreaterThanOrEqual(3);
  });

  it("system outputs default prompt", async () => {
    const captured = captureOutput();
    const result = await runSystem({}, captured.output);
    expect(result.isOk()).toBe(true);
    expect(captured.stdout().length).toBeGreaterThan(100);
    expect(captured.stdout()).toContain("fireproof");
  });

  it("system --skills fireproof selects specific skill", async () => {
    const captured = captureOutput();
    const result = await runSystem({ skillsCsv: "fireproof" }, captured.output);
    expect(result.isOk()).toBe(true);
    expect(captured.stdout()).toContain("fireproof");
  });

  it("system --skills with empty value returns error", async () => {
    const captured = captureOutput();
    const result = await runSystem({ skillsCsv: "" }, captured.output);
    expect(result.isErr()).toBe(true);
    expect(String(result.Err())).toContain("--skills requires a value");
  });

  it("system --skills bogus returns error", async () => {
    const captured = captureOutput();
    const result = await runSystem({ skillsCsv: "bogus" }, captured.output);
    expect(result.isErr()).toBe(true);
    expect(String(result.Err())).toContain("Unknown skills: bogus");
  });
});

describe("CLI dispatch integration", () => {
  it("no args shows help (exit 0)", async () => {
    const result = await runCli([]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("use-vibes");
  });

  it("help subcommand exits 0", async () => {
    const result = await runCli(["help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("use-vibes");
  });

  it("--help flag exits 0", async () => {
    const result = await runCli(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("use-vibes");
  });

  it("-h flag exits 0", async () => {
    const result = await runCli(["-h"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("use-vibes");
  });

  it("unknown command exits 1", async () => {
    const result = await runCli(["xyzzy"]);
    expect(result.code).toBe(1);
  });

  it("removed commands exit 1 as unknown", async () => {
    const result = await runCli(["generate", "foo", "bar"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Unknown command");
  });

  it("system --skills fireproof outputs prompt", async () => {
    const result = await runCli(["system", "--skills", "fireproof"]);
    expect(result.code).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(100);
  });

  it("system --skills (missing value) falls back to defaults", async () => {
    const result = await runCli(["system", "--skills"]);
    expect(result.code).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(100);
  });
});
