import { Lazy } from "@adviser/cement";
import { vibesDiyHandler } from "./vibes-diy-srv.js";
import { VibesDiyServCtx } from "./render.js";

const ctx = Lazy(async (): Promise<VibesDiyServCtx> => {
  const packageJsonStr = await Deno.readTextFile(`package.json`);
  const packageJson = JSON.parse(packageJsonStr);
  const FP = (
    packageJson.dependencies["@fireproof/core-cli"] ??
    packageJson.devDependencies["@fireproof/core-cli"]
  ).replace(/^[^0-9]*/, "");
  console.log("Fireproof-Version:", FP);
  const loadFile = async (file: string): Promise<string | undefined> => {
    // Try exact filename first (for .json, .css, etc.)
    const exactPath = `${Deno.cwd()}/${file}`;
    const exact = await Deno.readTextFile(exactPath).catch(() => undefined);
    if (exact) return exact;

    // Then try extension variants (for .ts/.tsx source files)
    const stripExt = file.replace(/\.[^/.]+$/, "");
    for (const ext of ["ts", "tsx", "js", "jsx"]) {
      const file = `${stripExt}.${ext}`;
      const path = `${Deno.cwd()}/${file}`;
      const ret = await Deno.readTextFile(path).catch(() => undefined);
      if (ret) {
        return ret;
      }
    }
    return undefined;
  };
  return Promise.resolve({
    versions: { FP },
    basePath: Deno.cwd(),
    loadFile,
  });
});

Deno.serve({ port: 8001 }, vibesDiyHandler(ctx) as () => Promise<Response>);
