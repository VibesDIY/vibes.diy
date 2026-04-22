import { readFile, access } from "fs/promises";
import { resolve, join } from "path";
import { parse } from "yaml";
import { build } from "vite";
import type { Plugin } from "vite";
import { glob } from "zx";
import mime from "mime";
import { NPMPackage } from "@adviser/cement";

interface PackageExport {
  import?: string;
}

interface PackageJson {
  name: string;
  version?: string;
  exports?: Record<string, PackageExport | string>;
}

interface BuildEntry {
  entry: string; // absolute path to source file
  outputName: string; // e.g. "index", "start", "root"
}

// interface WorkspacePackage {
//   name: string;
//   path: string;
// }

const SKIP_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

export function workspacePackagesPlugin(options: { exclude?: string[] } = {}): Plugin {
  const packages = new Map<string, string>();
  const buildCache = new Map<string, { codes: Map<string, string>; timestamp: number }>();
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
        if (pkgJson.name && !options.exclude?.includes(pkgJson.name)) {
          const pkgPath = join(repoRoot, pkgJsonPath, "..");
          const relativePath = pkgJsonPath.replace("/package.json", "");
          packages.set(pkgJson.name, pkgPath);
          console.log(`📦 Discovered package: ${pkgJson.name} -> ${relativePath}`);
        }
      }
    }
  }

  async function resolveEntries(pkgPath: string): Promise<BuildEntry[]> {
    try {
      const pkgJson: PackageJson = JSON.parse(await readFile(join(pkgPath, "package.json"), "utf-8"));
      if (pkgJson.exports && Object.keys(pkgJson.exports).length > 0) {
        const entries: BuildEntry[] = [];
        for (const [exportPath, exportValue] of Object.entries(pkgJson.exports)) {
          const importPath = typeof exportValue === "string" ? exportValue : exportValue.import;
          if (!importPath) continue;
          const base = join(pkgPath, importPath.replace(/\.(js|mjs|cjs)$/, ""));
          let entry: string | undefined;
          for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
            try {
              await access(base + ext);
              entry = base + ext;
              break;
            } catch {
              /* ignore */
            }
          }
          if (!entry) continue;
          const outputName = exportPath === "." || exportPath === "./" ? "index" : exportPath.replace(/^\.\//, "");
          entries.push({ entry, outputName });
        }
        if (entries.length > 0) return entries;
      }
    } catch {
      /* ignore */
    }

    // Fallback: find index file
    for (const name of ["index.ts", "index.tsx", "index.js", "index.jsx"]) {
      const candidate = join(pkgPath, name);
      try {
        await access(candidate);
        return [{ entry: candidate, outputName: "index" }];
      } catch {
        /* ignore */
      }
    }

    throw new Error(`No entry point found in ${pkgPath}`);
  }

  async function buildPackage(pkgName: string): Promise<Map<string, string>> {
    const pkgPath = packages.get(pkgName);
    if (!pkgPath) {
      throw new Error(`Package ${pkgName} not found in workspace`);
    }

    const cached = buildCache.get(pkgName);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.codes;
    }

    const entries = await resolveEntries(pkgPath);
    const codes = new Map<string, string>();

    for (const { entry, outputName } of entries) {
      console.log(`🔨 Building ${pkgName}/${outputName}...`);
      const result = await build({
        root: pkgPath,
        configFile: false,
        build: {
          write: false,
          lib: {
            entry,
            formats: ["es"],
            fileName: outputName,
          },
          rollupOptions: {
            external: (id) => !id.startsWith(".") && !id.startsWith("/") && id !== "charwise",
          },
        },
        logLevel: "warn",
      });

      if (!Array.isArray(result)) throw new Error("Unexpected build result");
      const output = result[0];
      if (!("output" in output)) throw new Error("No output in build result");
      const chunk = output.output[0];
      if (!("code" in chunk)) throw new Error("No code in output chunk");
      codes.set(outputName, chunk.code);
    }

    buildCache.set(pkgName, { codes, timestamp: Date.now() });
    return codes;
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
          const outputName = !subpath ? "index" : subpath.replace(/\/index\.js$/, "").replace(/\.js$/, "");
          const codes = await buildPackage(pkgName);
          const code = codes.get(outputName);
          if (code !== undefined) {
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
          const codes = await buildPackage(pkgName);
          for (const [outputName, code] of codes) {
            const jsFileName =
              outputName === "index" ? `_vibe-pkg/${pkgName}/index.js` : `_vibe-pkg/${pkgName}/${outputName}/index.js`;
            bundle[jsFileName] = {
              type: "asset",
              fileName: jsFileName,
              name: outputName,
              names: [outputName],
              originalFileName: "",
              originalFileNames: [],
              source: code,
            } as never;
            console.log(`📦 Emitted ${jsFileName} (${code.length} bytes)`);
          }

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
              // needsCodeReference: false,
              source: content,
            } as never;
            console.log(`📄 Emitted ${assetFileName} (${content.length} bytes)`);
          }
        } catch {
          console.log(`⏭️ Skipped ${pkgName}`);
        }
      }
    },
  };
}
