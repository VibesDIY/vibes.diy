import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { runHelp } from "../../pkg/commands/help.js";
import { runSkills } from "../../pkg/commands/skills.js";
import { runSystem } from "../../pkg/commands/system.js";
import { runWhoami } from "../../pkg/commands/whoami.js";
import { notImplemented } from "../../pkg/commands/not-implemented.js";
import type { CliOutput } from "../../pkg/commands/cli-output.js";

const CLI_JS = resolve(import.meta.dirname, "../../pkg/cli.js");

function captureOutput(): { output: CliOutput; stdout: () => string; stderr: () => string } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    output: { stdout: (t) => out.push(t), stderr: (t) => err.push(t) },
    stdout: () => out.join(""),
    stderr: () => err.join(""),
  };
}

function spawnCli(...args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_JS, ...args], { stdio: "pipe" });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d));
    child.stderr.on("data", (d: Buffer) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

// ── Unit tests (direct import, no spawn) ──────────────────────────────

describe("help (unit)", () => {
  it("outputs usage text", async () => {
    const { output, stdout } = captureOutput();
    const r = await runHelp(output);
    expect(r.isOk()).toBe(true);
    expect(stdout()).toContain("use-vibes");
    expect(stdout()).toContain("skills");
  });
});

describe("whoami (unit)", () => {
  it("returns error when not logged in", async () => {
    const r = await runWhoami();
    expect(r.isErr()).toBe(true);
    expect(String(r.Err())).toContain("Not logged in");
  });
});

describe("skills (unit)", () => {
  it("lists catalog", async () => {
    const { output, stdout } = captureOutput();
    const r = await runSkills(output);
    expect(r.isOk()).toBe(true);
    expect(stdout()).toContain("fireproof");
    const lines = stdout().trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });
});

describe("system (unit)", () => {
  it("outputs default prompt", async () => {
    const { output, stdout } = captureOutput();
    const r = await runSystem({}, output);
    expect(r.isOk()).toBe(true);
    expect(stdout().length).toBeGreaterThan(100);
    expect(stdout()).toContain("fireproof");
  });

  it("--skills fireproof selects specific skill", async () => {
    const { output, stdout } = captureOutput();
    const r = await runSystem({ skillsCsv: "fireproof" }, output);
    expect(r.isOk()).toBe(true);
    expect(stdout()).toContain("fireproof");
  });

  it("--skills with empty value returns error", async () => {
    const r = await runSystem({ skillsCsv: "" });
    expect(r.isErr()).toBe(true);
    expect(String(r.Err())).toContain("--skills requires a value");
  });

  it("--skills bogus returns error", async () => {
    const r = await runSystem({ skillsCsv: "bogus" });
    expect(r.isErr()).toBe(true);
    expect(String(r.Err())).toContain("Unknown skills: bogus");
  });
});

describe("not-implemented stubs (unit)", () => {
  for (const cmd of ["login", "dev", "live", "generate", "edit", "publish", "invite"]) {
    it(`${cmd} returns not-yet-implemented`, async () => {
      const r = await notImplemented({ name: cmd })();
      expect(r.isErr()).toBe(true);
      expect(String(r.Err())).toContain("not yet implemented");
    });
  }
});

// ── Smoke tests (spawn cli.js, full pipeline) ────────────────────────

describe("smoke: cli.js pipeline", () => {
  it("no args shows help (exit 0)", async () => {
    const r = await spawnCli();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("use-vibes");
  });

  it("help subcommand (exit 0)", async () => {
    const r = await spawnCli("help");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("use-vibes");
  });

  it("--help flag (exit 0)", async () => {
    const r = await spawnCli("--help");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("use-vibes");
  });

  it("-h flag (exit 0)", async () => {
    const r = await spawnCli("-h");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("use-vibes");
  });

  it("unknown command exits 1", async () => {
    const r = await spawnCli("xyzzy");
    expect(r.code).toBe(1);
  });

  it("generate foo bar exits 1 with not-yet-implemented", async () => {
    const r = await spawnCli("generate", "foo", "bar");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not yet implemented");
  });

  it("system --skills fireproof outputs prompt", async () => {
    const r = await spawnCli("system", "--skills", "fireproof");
    expect(r.code).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(100);
  });

  it("system --skills (missing value) falls back to defaults", async () => {
    const r = await spawnCli("system", "--skills");
    expect(r.code).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(100);
  });
});
