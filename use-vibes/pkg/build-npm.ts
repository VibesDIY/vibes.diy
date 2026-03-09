import { build } from "jsr:@deno/dnt";

const version = Deno.env.get("PACKAGE_VERSION") || "0.0.0";

await build({
  entryPoints: [
    { kind: "bin", name: "use-vibes", path: "./bin.ts" },
    "./index.ts",
  ],
  outDir: "./dist/npm",
  shims: {
    deno: false,
  },
  importMap: "./build-npm-imports.json",
  // ESM only — no CJS output (top-level await in bin.ts requires ESM)
  scriptModule: false,
  package: {
    name: "use-vibes",
    version,
    type: "module",
    description: "Transform any DOM element into an AI-powered micro-app",
    license: "Apache-2.0",
    keywords: ["ai", "dom", "micro-app", "generator", "web", "esm", "typescript"],
    contributors: ["J Chris Anderson", "Meno Abels"],
    peerDependencies: {
      react: ">=19.1.0",
    },
  },
  // Let dnt resolve npm: specifiers from the import map
  // and add them as dependencies in the generated package.json
  compilerOptions: {
    lib: ["ES2023", "DOM"],
    target: "ES2022",
  },
  // Skip type checking and testing — tsgo and deno test handle those in CI
  typeCheck: false,
  test: false,
});

// Copy non-TS assets that dnt doesn't handle
await Deno.copyFile("./commands/help.txt", "./dist/npm/esm/commands/help.txt");
