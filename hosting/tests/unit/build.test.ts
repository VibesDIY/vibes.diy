// Basic build verification test
import { existsSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("Build Tests", () => {
  it("has required configuration files", () => {
    const wranglerConfig = resolve(__dirname, "../../pkg/wrangler.toml");
    const packageJson = resolve(__dirname, "../../pkg/package.json");

    expect(existsSync(wranglerConfig)).toBe(true);
    expect(existsSync(packageJson)).toBe(true);
  });
});
