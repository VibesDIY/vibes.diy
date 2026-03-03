import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const cliDir = dirname(fileURLToPath(import.meta.url));

describe("cli --dry-run", () => {
  it("prints request body without requiring API key", () => {
    const env = { ...process.env };
    delete env.OPENROUTER_API_KEY;

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "cli.ts", "--prompt", "Describe a sandwich", "--dry-run", "--api-key", ""],
      {
        cwd: cliDir,
        env,
        encoding: "utf-8",
      }
    );

    expect(result.status).toBe(0);
    const body = JSON.parse(result.stdout);
    expect(body).toEqual({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "Describe a sandwich" }],
      stream: true,
    });
  });
});

describe("cli --text --src", () => {
  it("outputs accumulated text from a fixture file", () => {
    const fixture = join(cliDir, "fixtures", "openrouter-gpt-json-schema.llm.txt");
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "cli.ts", "--text", "--src", fixture],
      {
        cwd: cliDir,
        encoding: "utf-8",
      }
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed).toHaveProperty("name");
    expect(parsed).toHaveProperty("layers");
    expect(typeof parsed.name).toBe("string");
    expect(Array.isArray(parsed.layers)).toBe(true);
  });
});
