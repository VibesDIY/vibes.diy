// Basic build verification test
import { execSync } from "child_process";
import { describe, expect, it } from "vitest";

describe("Build Tests", () => {
  it("builds without errors", { timeout: 10000 }, () => {
    try {
      // Run wrangler build in dev mode (doesn't deploy, just builds)
      // Change to the hosting/pkg directory where wrangler.toml exists
      const output = execSync("pnpm exec wrangler deploy --dry-run", {
        encoding: "utf8",
        stdio: "pipe",
        cwd: "../../pkg", // Change to hosting/pkg directory
      });
      console.log("Build output:", output);
      expect(true).toBe(true);
    } catch (error) {
      const execError = error as { message: string; stdout?: string };
      console.error("Build failed:", execError.stdout);
      throw new Error("Build failed: " + execError.message);
    }
  });
});
