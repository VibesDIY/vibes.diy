import { HandleTriggerCtx, Result, EventoResultType, EventoResult, exception2Result } from "@adviser/cement";
import { FileSystemItem, HttpResponseBodyType, VibesDiyServCtx, vibesImportMap, vibeUserEnv } from "@vibes.diy/api-types";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { fetchContent, NpmUrlCapture } from "../public/serv-entry-point.js";
import { VibesApiSQLCtx } from "../types.js";
import { type } from "arktype";
// import { VibeEnv, vibesEnvSchema } from "@vibes.diy/use-vibes-base";
import { ExtractedHostToBindings } from "../entry-point-utils.js";
import { VibePage } from "./components/vibes-page.js";
import { renderToReadableStream } from "react-dom/server";
import { serialize as cookieSerialize } from "cookie";
import { Dependencies, render_esm_sh, resolveVersionRegistry } from "./import-map.js";
import { lockedGroupsVersions, lockedVersions } from "./grouped-vibe-import-map.js";
import { defaultFetchPkgVersion } from "../npm-package-version.js";

export interface RenderVibesOpts {
  ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>;
  fs: typeof sqlApps.$inferSelect;
  fsItems: FileSystemItem[];
  pkgRepos: {
    private: NpmUrlCapture;
    public?: string; // default to esm.sh
  };
}

export async function renderVibes({ ctx, fs, fsItems, pkgRepos }: RenderVibesOpts): Promise<Result<EventoResultType>> {
  const fsIportMap = fsItems.find((i) => i.transform?.type === "import-map");
  if (!fsIportMap) {
    return Result.Err(new Error("No import-map found in file system"));
  }
  const rImportMapUint8 = await fetchContent(ctx, fsIportMap);
  if (rImportMapUint8.isErr()) {
    return Result.Err(rImportMapUint8);
  }
  const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
  const genImport = vibesImportMap(JSON.parse(vctx.sthis.txt.decode(rImportMapUint8.Ok())));
  if (genImport instanceof type.errors) {
    return Result.Err(genImport.summary);
  }

  const deps = Dependencies.from({
    ...genImport.imports,
    ...lockedGroupsVersions,
  });

  const importMap = await deps.renderImportMap({
    resolveFn: resolveVersionRegistry({
      fetch: defaultFetchPkgVersion({
        defaults: {
          cache: vctx.cache,
        },
      }),
      symbol2Version: lockedVersions,
    }),
    renderRHS: render_esm_sh({
      privateUrl: pkgRepos.private.npmURL,
    }),
  });

  // console.log(`importMap:`, importMap);
  const imports = fsItems.reduce(
    (acc, item, idx) => {
      if (item.mimeType === "application/javascript") {
        acc.push({
          // import relative to support prod and dev switching
          importStmt: `import V${idx} from ${JSON.stringify(`/~${fs.fsId}~${item.fileName}`)};`,
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

  const usrEnv = vibeUserEnv(fs.env);
  if (usrEnv instanceof type.errors) {
    return Result.Err(`fs.env failure: ${usrEnv.summary}`);
  }

  // console.log("Pre Env", fs.env, vctx.params.vibes.env);
  // const env = vibesEnvSchema({
  //   ...fsEnv,
  //   ...vctx.params.vibes.env,
  // });
  // if (env instanceof type.errors) {
  //   return Result.Err(env.toLocaleString());
  // }

  const vsctx = {
    wrapper: {
      state: "waiting",
    },
    // bindings: {
    //   appSlug: fs.appSlug,
    //   userSlug: fs.userSlug,
    //   fsId: fs.fsId,
    // },
    usrEnv,
    svcEnv: vctx.params.vibes.env,
    importMap: {
      imports: importMap,
    },
    metaProps: {
      title: "we need a title",
      description: "we need a description",
    },
    mountJS: [
      `import { mountVibe, registerDependencies } from '@vibes.diy/vibe-runtime';`,
      ...imports.map((i) => i.importStmt),
      `registerDependencies(${JSON.stringify({ appSlug: fs.appSlug, userSlug: fs.userSlug, fsId: fs.fsId })}, ${JSON.stringify(importMap)}
      )`,
      `  .then(() => mountVibe([${imports.map((i) => i.var).join(",")}], ${JSON.stringify({ usrEnv })}));`,
    ].join("\n"),
  } satisfies VibesDiyServCtx;
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
        "Cache-Control": "public, max-age=86400",
        ETag: fs.fsId,
        ...optionalHeader,
      },
      body: ctx.request.method === "HEAD" ? "" : ((await renderToReadableStream(VibePage(vsctx))) as BodyInit),
    } satisfies HttpResponseBodyType)
  );
  if (res.isErr()) {
    return Result.Err(res);
  }
  return Result.Ok(EventoResult.Stop);
}
