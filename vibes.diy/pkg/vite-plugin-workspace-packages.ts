import { readFile, access } from "fs/promises";
import { resolve, join } from "path";
import { parse } from "yaml";
import { build } from "vite";
import type { Plugin } from "vite";
import { glob } from "zx";
import mime from "mime";
import { NPMPackage } from "@adviser/cement";

interface PackageJson {
  name: string;
  version?: string;
}

// interface WorkspacePackage {
//   name: string;
//   path: string;
// }

const SKIP_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

export function workspacePackagesPlugin(): Plugin {
  const packages = new Map<string, string>();
  const buildCache = new Map<string, { code: string; timestamp: number }>();
  const repoRoot = resolve(__dirname, "../..");

  async function discoverPackages() {
    // Read pnpm-workspace.yaml
    const workspaceYaml = await readFile(join(repoRoot, "pnpm-workspace.yaml"), "utf-8");
    const workspace = parse(workspaceYaml);

    // Resolve all workspace package paths
    const workspacePatterns = workspace.packages || [];

    for (const pattern of workspacePatterns) {
      // Glob for package.json files directly
      const pkgJsonPattern = `${pattern}/package.json`;
      const matches = await glob(pkgJsonPattern, {
        cwd: repoRoot,
        absolute: false,
        ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
      });

      for (const pkgJsonPath of matches) {
        const pkgJson: PackageJson = JSON.parse(await readFile(join(repoRoot, pkgJsonPath), "utf-8"));
        if (pkgJson.name) {
          const pkgPath = join(repoRoot, pkgJsonPath, "..");
          const relativePath = pkgJsonPath.replace("/package.json", "");
          packages.set(pkgJson.name, pkgPath);
          console.log(`📦 Discovered package: ${pkgJson.name} -> ${relativePath}`);
        }
      }
    }
  }

  async function buildPackage(pkgName: string): Promise<string> {
    const pkgPath = packages.get(pkgName);
    if (!pkgPath) {
      throw new Error(`Package ${pkgName} not found in workspace`);
    }

    // Check that index.ts exists before attempting build
    const entryFile = join(pkgPath, "index.ts");
    try {
      await access(entryFile);
    } catch {
      throw new Error(`No index.ts found in ${pkgName}`);
    }

    // Check cache (simple timestamp-based, could be more sophisticated)
    const cached = buildCache.get(pkgName);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.code;
    }

    console.log(`🔨 Building ${pkgName}...`);

    // Build the package using Vite
    const result = await build({
      root: pkgPath,
      configFile: false,
      build: {
        write: false,
        lib: {
          entry: join(pkgPath, "index.ts"),
          formats: ["es"],
          fileName: "index",
        },
        rollupOptions: {
          external: (id) => {
            // Externalize all dependencies
            return !id.startsWith(".") && !id.startsWith("/");
          },
        },
      },
      logLevel: "warn",
    });

    if (!Array.isArray(result)) {
      throw new Error("Unexpected build result");
    }

    const output = result[0];
    if (!("output" in output)) {
      throw new Error("No output in build result");
    }

    const chunk = output.output[0];
    if (!("code" in chunk)) {
      throw new Error("No code in output chunk");
    }

    const code = chunk.code;
    buildCache.set(pkgName, { code, timestamp: Date.now() });

    // console.log(`✅ Built ${pkgName} (${code.length} bytes)`);
    return code;
  }

  async function getAssetFiles(pkgPath: string): Promise<string[]> {
    const files = await glob("**/*", {
      cwd: pkgPath,
      absolute: false,
      gitignore: true,
      ignore: ["**/node_modules/**", "**/dist/**", "package.json", "tsconfig.json"],
    });
    return files.filter((f) => {
      const dot = f.lastIndexOf(".");
      return dot !== -1 && !SKIP_EXTENSIONS.has(f.slice(dot));
    });
  }

  return {
    name: "workspace-packages",

    async configureServer(server) {
      await discoverPackages();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/vibe-pkg/")) {
          return next();
        }

        // Handle OPTIONS preflight requests
        if (req.method === "OPTIONS") {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.statusCode = 204;
          res.end();
          return;
        }

        const urlPath = req.url.replace("/vibe-pkg/", "");
        const parsed = NPMPackage.parse(urlPath);
        const pkgName = parsed.pkg;
        const subpath = parsed.suffix?.replace(/^\//, "") ?? "";

        const pkgPath = packages.get(pkgName);
        if (!pkgPath) {
          res.statusCode = 404;
          res.end(`Package ${pkgName} not found`);
          return;
        }

        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

        try {
          if (!subpath || subpath === "index.js") {
            const code = await buildPackage(pkgName);
            res.setHeader("Content-Type", "application/javascript");
            res.end(code);
          } else {
            const content = await readFile(join(pkgPath, subpath));
            res.setHeader("Content-Type", mime.getType(subpath) ?? "application/octet-stream");
            res.end(content);
          }
        } catch (error) {
          console.error(`Failed to serve ${pkgName}/${subpath}:`, error);
          res.statusCode = 500;
          res.end(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    },

    async generateBundle(_options, bundle) {
      const outDir = _options.dir || "";
      if (!outDir.includes("client")) return;

      if (packages.size === 0) {
        await discoverPackages();
      }

      for (const [pkgName, pkgPath] of packages) {
        try {
          // Emit bundled JS as index.js inside a per-package directory
          const code = await buildPackage(pkgName);
          const jsFileName = `_vibe-pkg/${pkgName}/index.js`;
          bundle[jsFileName] = {
            type: "asset",
            fileName: jsFileName,
            name: pkgName,
            names: [pkgName],
            originalFileName: "",
            originalFileNames: [],
            needsCodeReference: false,
            source: code,
          };
          console.log(`📦 Emitted ${jsFileName} (${code.length} bytes)`);

          // Copy non-JS/TS asset files (txt, md, json, …) into the same directory
          const assetFiles = await getAssetFiles(pkgPath);
          for (const relativePath of assetFiles) {
            const assetFileName = `_vibe-pkg/${pkgName}/${relativePath}`;
            const content = await readFile(join(pkgPath, relativePath));
            bundle[assetFileName] = {
              type: "asset",
              fileName: assetFileName,
              name: relativePath,
              names: [relativePath],
              originalFileName: join(pkgPath, relativePath),
              originalFileNames: [join(pkgPath, relativePath)],
              needsCodeReference: false,
              source: content,
            };
            console.log(`📄 Emitted ${assetFileName} (${content.length} bytes)`);
          }
        } catch {
          console.log(`⏭️ Skipped ${pkgName}`);
        }
      }
    },
  };
}
