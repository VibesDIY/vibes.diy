import { readFile } from "fs/promises";
import { resolve, join } from "path";
import { parse } from "yaml";
import { build } from "vite";
import type { Plugin } from "vite";
import { glob } from "zx";

interface PackageJson {
  name: string;
  version?: string;
}

// interface WorkspacePackage {
//   name: string;
//   path: string;
// }

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

  return {
    name: "workspace-packages",

    async configureServer(server) {
      await discoverPackages();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/dev-npm/")) {
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

        // Extract package name (handle scoped packages like @vibes.diy/api-impl)
        const urlPath = req.url.replace("/dev-npm/", "");
        const parts = urlPath.split("/");
        const pkgName = parts[0].startsWith("@")
          ? `${parts[0]}/${parts[1]}` // Scoped package: @scope/name
          : parts[0]; // Regular package: name

        try {
          const code = await buildPackage(pkgName);

          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          res.end(code);
        } catch (error) {
          console.error(`Failed to build ${pkgName}:`, error);
          res.statusCode = 500;
          res.end(`Failed to build package: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    },
  };
}
