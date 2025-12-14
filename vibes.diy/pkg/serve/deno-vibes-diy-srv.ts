import { exception2Result, Lazy } from "@adviser/cement";
import { vibesDiyHandler } from "./vibes-diy-srv.js";
import { VibesDiyServCtx } from "./render.js";
import { dotenv } from "zx";
import { VibesCtx, VibesEnvSchema } from "@vibes.diy/use-vibes-base";

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
  const loadFileBinary = async (
    file: string,
  ): Promise<Uint8Array | undefined> => {
    const path = `${Deno.cwd()}/${file}`;
    const ret = await Deno.readFile(path).catch(() => undefined);
    return ret;
  };
  const rDotEnv = exception2Result(() => dotenv.load('.env'));
  const dotEnvVars = {};
  if (rDotEnv.isErr()) {
    console.warn("No .env file found or error loading it.");
  } else {
    console.log("Loaded env vars .env file");
    Object.assign(dotEnvVars, rDotEnv.unwrap());
  }
  const clientEnv = VibesEnvSchema.parse({
    ...process.env,
    ...dotEnvVars,
  })
  console.log("VibesDiyServCtx clientEnv:", JSON.stringify(clientEnv, null, 2));
  return Promise.resolve({
    versions: { FP },
    vibesCtx: {
      env: clientEnv,
    } as VibesCtx,
    basePath: Deno.cwd(),
    loadFile,
    loadFileBinary,
  });
});

Deno.serve({ port: 8001 }, vibesDiyHandler(ctx) as () => Promise<Response>);
