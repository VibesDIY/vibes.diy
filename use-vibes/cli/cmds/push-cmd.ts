import { command, option, string } from "cmd-ts";
import { readdir, readFile } from "fs/promises";
import { basename, extname, join } from "path";
import { BuildURI } from "@adviser/cement";
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
    if (isTextFile(ext) === false) continue;

    const content = await readFile(join(dir, entry.name), "utf-8");
    const filename = `/${entry.name}`;
    const lang = CODE_EXTENSIONS[ext];

    if (lang !== undefined) {
      files.push({
        type: "code-block",
        lang,
        content,
        filename,
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
      const { stdout, stderr } = ctx.output;

      if (ctx.vibesDiyApiFactory === undefined) {
        stderr("Not logged in. Run 'use-vibes login' first.\n");
        ctx.exitCode = 1;
        return;
      }

      const mode = args.mode === "dev" ? "dev" : "production";
      const appSlug = args.appSlug === "" ? basename(process.cwd()) : args.appSlug;
      const api = ctx.vibesDiyApiFactory(args.apiUrl);

      // Resolve userSlug
      stdout("Resolving user...\n");
      const rList = await api.listUserSlugAppSlug({});
      const userSlug = rList.isOk() && rList.Ok().items.length > 0 ? rList.Ok().items[0].userSlug : undefined;
      if (userSlug !== undefined) {
        stdout(`User: ${userSlug}\n`);
      }

      // Read files from CWD
      stdout("Reading files...\n");
      const files = await readProjectFiles(process.cwd());
      if (files.length === 0) {
        stderr("No files found in current directory. Expected at least App.jsx.\n");
        ctx.exitCode = 1;
        return;
      }
      stdout(`Found ${files.length} file(s): ${files.map((f) => f.filename).join(", ")}\n`);

      // Push to API
      stdout(`Pushing ${appSlug} (${mode})...\n`);
      const rResult = await api.ensureAppSlug({
        mode,
        appSlug,
        userSlug,
        fileSystem: files,
      });

      if (rResult.isErr()) {
        stderr(`Push failed: ${String(rResult.Err())}\n`);
        ctx.exitCode = 1;
        return;
      }

      const result = rResult.Ok();
      const apiOrigin = BuildURI.from(args.apiUrl).pathname("/").toString().replace(/\/$/, "");
      const vibeUrl = `${apiOrigin}/vibe/${result.userSlug}/${result.appSlug}`;
      stdout(`\nDeployed: ${result.userSlug}/${result.appSlug}\n`);
      stdout(`URL: ${vibeUrl}\n`);
      stdout(`Mode: ${result.mode} | fsId: ${result.fsId}\n`);
    },
  });
}
