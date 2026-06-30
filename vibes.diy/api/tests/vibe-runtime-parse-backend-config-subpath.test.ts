import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const runtimePackageJson = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../vibe/runtime/package.json"), "utf8")
) as {
  exports?: Record<string, string>;
};

// `ensure-app-slug-item` now consumes the parser through the package subpath
// `@vibes.diy/vibe-runtime/parse-backend-config.js`. Keep that subpath exported
// so build/test lanes cannot regress on a missing package export.
describe("vibe-runtime parse-backend-config subpath export", () => {
  it("declares the parser subpath in the package exports map", () => {
    expect(runtimePackageJson.exports?.["./parse-backend-config.js"]).toBe("./parse-backend-config.js");
  });

  it("is importable through the package exports map", async () => {
    const { parseBackendConfig } = await import("@vibes.diy/vibe-runtime/parse-backend-config.js");

    expect(parseBackendConfig(`export async function fetch() {}`)).toMatchObject({
      handlers: ["fetch"],
      errors: [],
    });
  });
});
