// Basic build verification test
import { execSync } from "child_process";
import { describe, expect, it } from "vitest";

describe("Build Tests", () => {
  it("builds without errors", { timeout: 10000 }, () => {
    try {
      // Run wrangler build in dev mode (doesn't deploy, just builds)
      const output = execSync("pnpm exec wrangler deploy --dry-run", {
        encoding: "utf8",
        stdio: "pipe",
      });
      console.log("Build output:", output);
      expect(true).toBe(true);
    } catch (error: any) {
      console.error("Build failed:", error.stdout);
      throw new Error("Build failed: " + error.message);
    }
  });
});
