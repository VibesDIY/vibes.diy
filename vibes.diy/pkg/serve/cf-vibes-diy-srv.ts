import { Lazy } from "@adviser/cement";
import { vibesDiyHandler } from "./vibes-diy-srv.js";
import { VibesDiyServCtx } from "./render.js";
import * as esbuild from "esbuild-wasm";
import { VibesCtx } from "@vibes.diy/use-vibes-base";

const ctx = Lazy(async (): Promise<VibesDiyServCtx> => {
  console.log("Initializing VibesDiyServCtx...");
  const bundleJs = "../bundle.js";
  const bundle = await import(bundleJs);
  console.log("Initializing VibesDiyServCtx...0");
  await esbuild.initialize({
    wasmURL: "https://esm.sh/esbuild-wasm/esbuild.wasm",
    worker: false,
  });

  console.log("Initializing VibesDiyServCtx...1");
  const packageJsonStr = await bundle.readFile(`package.json`);
  console.log("packageJsonStr:", packageJsonStr);
  const packageJson = JSON.parse(packageJsonStr);
  const FP = (
    packageJson.dependencies["@fireproof/core-cli"] ??
    packageJson.devDependencies["@fireproof/core-cli"]
  ).replace(/^[^0-9]*/, "");
  console.log("Fireproof-Version:", FP);
  const loadFile = async (file: string): Promise<string | undefined> => {
    const stripExt = file
      .replace(/\.[^/.]+$/, "")
      .replace(/\.\//, "/")
      .replace(/\/+/g, "/");
    for (const ext of ["ts", "tsx", "js", "jsx"]) {
      const file = `${stripExt}.${ext}`;
      try {
        console.log("loadFile:", file, "->", stripExt);
        const path = await bundle.readFile(file);
        // const ret = await Deno.readTextFile(path).catch(() => undefined);
        if (path) {
          return path;
        }
      } catch (_e) {
        // ignore
      }
    }
    return undefined;
  };
  const loadFileBinary = async (
    file: string,
  ): Promise<Uint8Array | undefined> => {
    try {
      const path = await bundle.readFile(file);
      if (path) {
        return new Uint8Array(Buffer.from(path));
      }
    } catch (_e) {
      // ignore
    }
    return undefined;
  };
  return Promise.resolve({
    versions: { FP },
    vibesCtx: {} as VibesCtx,
    basePath: ".",
    loadFile,
    loadFileBinary,
  });
});

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    return vibesDiyHandler(ctx)(request) as Promise<Response>;
  },
};
