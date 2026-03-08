import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "../../pkg/cli.ts");

function findTsxLoaderPath(): string {
  const pnpmStorePath = resolve(__dirname, "../../../node_modules/.pnpm");
  for (const entry of readdirSync(pnpmStorePath, { withFileTypes: true })) {
    if (entry.isDirectory() === false) {
      continue;
    }
    if (entry.name.startsWith("tsx@") === false) {
      continue;
    }

    const loaderPath = resolve(pnpmStorePath, entry.name, "node_modules/tsx/dist/loader.mjs");
    if (existsSync(loaderPath)) {
      return loaderPath;
    }
  }

  throw new Error("Unable to resolve tsx loader for CLI tests");
}

const TSX_LOADER = findTsxLoaderPath();

function run(
  ...args: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", TSX_LOADER, CLI, ...args], { stdio: "pipe" });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d));
    child.stderr.on("data", (d: Buffer) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

describe("help", () => {
  it("exits 0 with usage text", async () => {
    const r = await run("help");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("use-vibes");
    expect(r.stdout).toContain("skills");
  });

  it("--help alias works", async () => {
    const r = await run("--help");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("use-vibes");
  });

  it("-h alias works", async () => {
    const r = await run("-h");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("use-vibes");
  });

  it("no args shows help", async () => {
    const r = await run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("use-vibes");
  });
});

describe("whoami", () => {
  it("exits 1 when not logged in", async () => {
    const r = await run("whoami");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("Not logged in");
  });
});

describe("skills", () => {
  it("lists catalog with exit 0", async () => {
    const r = await run("skills");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("fireproof");
    const lines = r.stdout.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(6);
  });
});

describe("system", () => {
  it("outputs default prompt", async () => {
    const r = await run("system");
    expect(r.code).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(100);
    expect(r.stdout).toContain("fireproof");
  });

  it("--skills fireproof selects specific skill", async () => {
    const r = await run("system", "--skills", "fireproof");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("fireproof");
  });

  it("--skills=fireproof equals syntax works", async () => {
    const r = await run("system", "--skills=fireproof");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("fireproof");
  });

  it("--skills with no value exits 1", async () => {
    const r = await run("system", "--skills");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("--skills requires a value");
  });

  it("--skills bogus exits 1 with error", async () => {
    const r = await run("system", "--skills", "bogus");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("Unknown skills: bogus");
  });
});

describe("unknown command", () => {
  it("exits 1 with error", async () => {
    const r = await run("xyzzy");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("Unknown command");
  });
});

describe("not-implemented stubs", () => {
  for (const cmd of ["login", "dev", "live", "generate", "edit", "publish", "invite"]) {
    it(`${cmd} exits 1`, async () => {
      const r = await run(cmd);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("not yet implemented");
    });
  }
});
