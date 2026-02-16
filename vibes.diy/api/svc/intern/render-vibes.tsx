import {
  HandleTriggerCtx,
  Result,
  EventoResultType,
  EventoResult,
  exception2Result,
  BuildURI,
  stream2array,
} from "@adviser/cement";
import {
  FileSystemItem,
  HttpResponseBodyType,
  VibeEnv,
  VibesDiyServCtx,
  vibesEnvSchema,
  vibesImportMap,
} from "@vibes.diy/api-types";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { fetchContent, NpmUrlCapture } from "../public/serv-entry-point.js";
import { VibesApiSQLCtx } from "../types.js";
import { type } from "arktype";
// import { VibeEnv, vibesEnvSchema } from "@vibes.diy/use-vibes-base";
import { ExtractedHostToBindings } from "../entry-point-utils.js";
import { VibePage } from "./components/vibes-page.js";
import { renderToReadableStream } from "react-dom/server";
import { serialize as cookieSerialize } from "cookie";
import { genImportMap, packageName } from "./import-map.js";

export interface RenderVibesOpts {
  ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>;
  fs: typeof sqlApps.$inferSelect;
  fsItems: FileSystemItem[];
  pkgRepos: {
    private: NpmUrlCapture;
    public?: string; // default to esm.sh
  };
}

export function isReadableStreamContent(
  content: Uint8Array | ReadableStream<Uint8Array>
): content is ReadableStream<Uint8Array> {
  return "getReader" in content;
}

/**
 * Converts content (either Uint8Array or ReadableStream) to Uint8Array.
 * Handles both SQL assets (already buffered) and R2 assets (streamed).
 */
export async function bufferContent(content: ReadableStream<Uint8Array> | Uint8Array): Promise<Uint8Array> {
  if (isReadableStreamContent(content)) {
    // Buffer the stream
    const chunks = await stream2array(content);
    const totalLen = chunks.reduce((n, c) => n + c.length, 0);
    const buffered = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      buffered.set(c, offset);
      offset += c.length;
    }
    return buffered;
  }
  return content;
}

export async function renderVibes({ ctx, fs, fsItems, pkgRepos }: RenderVibesOpts): Promise<Result<EventoResultType>> {
  const fsIportMap = fsItems.find((i) => i.transform?.type === "import-map");
  if (fsIportMap === undefined) {
    return Result.Err(new Error("No import-map found in file system"));
  }
  const rImportMapUint8 = await fetchContent(ctx, fsIportMap);
  if (rImportMapUint8.isErr()) {
    return Result.Err(rImportMapUint8);
  }
  const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
  const maybeContent = rImportMapUint8.Ok();
  if (maybeContent.IsNone()) {
    return Result.Err("Import map content not found");
  }
  const content = maybeContent.unwrap();

  // Handle both Uint8Array (SQL) and ReadableStream (R2)
  const uint8Data = await bufferContent(content);

  const genImport = vibesImportMap(JSON.parse(vctx.sthis.txt.decode(uint8Data)));
  if (genImport instanceof type.errors) {
    return Result.Err(genImportMap.toLocaleString());
  }

  const importMap = await genImportMap({
    genImport,
    version: {
      FP: "0.24.10",
      REACT: "19.2.1",
      ADVISER_CEMENT: "0.5.22",
      CBORG: "4.5.8",
      ZOD: "4.3.6",
      ARKTYPE: "2.1.29",
      JOSE: "6.1.3",
      DOMPURIFY: "3.3.1",
      MULTIFORMATS: "13.4.2",
      YAML: "2.8.2",
      TAILWINDCSS: "4.1.18",
    },
    fetchPkgVersion: ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx").fetchPkgVersion,
    resolveVersionInportMap: function (ipkg: string, iversion: string): string {
      const { pkg, suffix } = packageName(ipkg);
      if (iversion.startsWith("npm:")) {
        const esmShUrl = pkgRepos.public ?? "https://esm.sh";
        const version = iversion.slice("npm:".length);
        if (version === "latest") {
          return BuildURI.from(esmShUrl)
            .appendRelative(`${pkg}${suffix ? "/" + suffix : ""}`)
            .toString();
        }
        return BuildURI.from(esmShUrl)
          .appendRelative(`${pkg}@${version}${suffix ? "/" + suffix : ""}`)
          .toString();
      }
      if (iversion.startsWith("privateNpm:")) {
        return BuildURI.from(pkgRepos.private.npmURL)
          .appendRelative(`${pkg}${suffix ? "/" + suffix : ""}`)
          .toString();
      }
      return `pkg(${pkg})->version(${iversion})`;
    },
  });
  // console.log(`importMap:`, importMap);
  const imports = fsItems.reduce(
    (acc, item, idx) => {
      if (item.mimeType === "application/javascript") {
        acc.push({
          // import relative to support prod and dev switching
          importStmt: `import V${idx} from ${JSON.stringify(item.fileName.replace(/^/, "."))};`,
          var: `V${idx}`,
        });
      }
      return acc;
    },
    [] as {
      importStmt: string;
      var: string;
    }[]
  );
  console.log("Pre Env", fs.env, vctx.params.vibes.env);
  const env = vibesEnvSchema({
    ...(fs.env as VibeEnv),
    ...vctx.params.vibes.env,
  });
  if (env instanceof type.errors) {
    return Result.Err(env.toLocaleString());
  }

  const vsctx: VibesDiyServCtx = {
    wrapper: {
      state: "waiting",
    },
    // bindings: {
    //   appSlug: fs.appSlug,
    //   userSlug: fs.userSlug,
    //   fsId: fs.fsId,
    // },
    env,
    importMap,
    metaProps: {
      title: "we need a title",
      description: "we need a description",
    },
    mountJS: [
      `import { mountVibe } from '@vibes.diy/api-pkg';`,
      ...imports.map((i) => i.importStmt),
      `mountVibe([${imports.map((i) => i.var).join(",")}], ${JSON.stringify({ env })});`,
    ].join("\n"),
  };
  const optionalHeader: Record<string, string> = {};
  if (pkgRepos.private.fromURL) {
    optionalHeader["Set-Cookie"] = cookieSerialize("Vibes-Npm-Url", pkgRepos.private.npmURL, {
      httpOnly: true,
      maxAge: 86400, // 1 week
      path: "/~.....~/",
      sameSite: "lax",
    });
  }
  // console.log("servEntryPoint triggered with URL-3:", optionalHeader);
  const res = await exception2Result(async () =>
    ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "X-Vibes-Asset-Id": fs.fsId,
        ETag: fs.fsId,
        ...optionalHeader,
      },
      body: (await renderToReadableStream(VibePage(vsctx))) as BodyInit,
    } satisfies HttpResponseBodyType)
  );
  if (res.isErr()) {
    return Result.Err(res);
  }
  return Result.Ok(EventoResult.Stop);
}
