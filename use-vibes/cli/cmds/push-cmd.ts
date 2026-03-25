import { command, option, string } from "cmd-ts";
import { readdir, readFile } from "fs/promises";
import { basename, extname, join } from "path";
import { CliCtx, DEFAULT_API_URL } from "../cli-ctx.js";
import type { VibeFile } from "@vibes.diy/api-types";

const CODE_EXTENSIONS: Record<string, string> = {
  ".jsx": "jsx",
  ".js": "js",
  ".ts": "ts",
  ".tsx": "tsx",
};

const TEXT_EXTENSIONS = new Set([".css", ".html", ".json", ".md", ".txt", ".svg"]);

function isTextFile(ext: string): boolean {
  return CODE_EXTENSIONS[ext] !== undefined || TEXT_EXTENSIONS.has(ext);
}

async function readProjectFiles(dir: string): Promise<VibeFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: VibeFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const ext = extname(entry.name).toLowerCase();
    if (!isTextFile(ext)) continue;

    const content = await readFile(join(dir, entry.name), "utf-8");
    const filename = `/${entry.name}`;
    const lang = CODE_EXTENSIONS[ext];

    if (lang) {
      files.push({
        type: "code-block",
        lang,
        content,
        filename,
        entryPoint: entry.name.toLowerCase() === "app.jsx",
      });
    } else {
      files.push({
        type: "str-asset-block",
        content,
        filename,
      });
    }
  }
  return files;
}

export function pushCmd(ctx: CliCtx) {
  return command({
    name: "push",
    description: "Upload files from the current directory to a vibe.",
    args: {
      apiUrl: option({
        long: "api-url",
        short: "u",
        description: "API base URL",
        type: string,
        defaultValue: () => ctx.sthis.env.get("VIBES_API_URL") ?? DEFAULT_API_URL,
        defaultValueIsSerializable: true,
      }),
      mode: option({
        long: "mode",
        description: "Deploy mode: production or dev",
        type: string,
        defaultValue: () => "production",
        defaultValueIsSerializable: true,
      }),
      appSlug: option({
        long: "app-slug",
        short: "a",
        description: "App slug (defaults to directory name)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: async function handlePush(args: {
      readonly apiUrl: string;
      readonly mode: string;
      readonly appSlug: string;
    }): Promise<void> {
      if (ctx.vibesDiyApiFactory === undefined) {
        console.error("Not logged in. Run 'use-vibes login' first.");
        process.exit(1);
        return;
      }

      const mode = args.mode === "dev" ? "dev" : "production";
      const appSlug = args.appSlug === "" ? basename(process.cwd()) : args.appSlug;
      const api = ctx.vibesDiyApiFactory(args.apiUrl);

      // Resolve userSlug
      console.log("Resolving user...");
      const rList = await api.listUserSlugAppSlug({});
      const userSlug = rList.isOk() && rList.Ok().items.length > 0 ? rList.Ok().items[0].userSlug : undefined;
      if (userSlug !== undefined) {
        console.log(`User: ${userSlug}`);
      }

      // Read files from CWD
      console.log("Reading files...");
      const files = await readProjectFiles(process.cwd());
      if (files.length === 0) {
        console.error("No files found in current directory. Expected at least App.jsx.");
        process.exit(1);
        return;
      }
      console.log(`Found ${files.length} file(s): ${files.map((f) => f.filename).join(", ")}`);

      // Push to API
      console.log(`Pushing ${appSlug} (${mode})...`);
      const rResult = await api.ensureAppSlug({
        mode,
        appSlug,
        userSlug,
        fileSystem: files,
      });

      if (rResult.isErr()) {
        console.error("Push failed:", rResult.Err());
        process.exit(1);
        return;
      }

      const result = rResult.Ok();
      // entryPointUrl is returned at runtime but not yet in the arktype schema
      const maybeUrl = "entryPointUrl" in result ? String(result.entryPointUrl) : undefined;
      console.log(`\nDeployed: ${result.userSlug}/${result.appSlug}`);
      if (maybeUrl !== undefined) {
        console.log(`URL: ${maybeUrl}`);
      }
      console.log(`Mode: ${result.mode} | fsId: ${result.fsId}`);
    },
  });
}
