import { HandleTriggerCtx, Result, EventoResultType, EventoResult, exception2Result, stream2uint8array } from "@adviser/cement";
import {
  FileSystemItem,
  HttpResponseBodyType,
  isFetchErrResult,
  isFetchNotFoundResult,
  isMetaScreenShot,
  isMetaTitle,
  MetaItem,
  VibesDiyServCtx,
  vibeImportMap,
  vibeUserEnv,
} from "@vibes.diy/api-types";
import { NpmUrlCapture } from "../public/serv-entry-point.js";
import { VibesApiSQLCtx } from "../types.js";
import { type } from "arktype";
// import { VibeEnv, vibesEnvSchema } from "@vibes.diy/use-vibes-base";
import { ExtractedHostToBindings } from "../entry-point-utils.js";
import { VibePage } from "./components/vibe-page.js";
import { renderToReadableStream } from "react-dom/server";
import { serialize as cookieSerialize } from "cookie";
import { Dependencies, render_esm_sh, resolveVersionRegistry } from "./import-map.js";
import { lockedGroupsVersions, lockedVersions } from "./grouped-vibe-import-map.js";
import { defaultFetchPkgVersion } from "../npm-package-version.js";
import { sqlite } from "@vibes.diy/api-sql";

export interface RenderVibesOpts {
  ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>;
  fs: typeof sqlite.sqlApps.$inferSelect;
  fsItems: FileSystemItem[];
  pkgRepos: {
    private: NpmUrlCapture;
    public?: string; // default to esm.sh
  };
}

export async function renderVibe({ ctx, fs, fsItems, pkgRepos }: RenderVibesOpts): Promise<Result<EventoResultType>> {
  // console.log("renderVibe-8")
  const fsIportMap = fsItems.find((i) => i.transform?.type === "import-map");
  if (!fsIportMap) {
    return Result.Err(new Error("No import-map found in file system"));
  }
  // console.log("renderVibe-7", fsIportMap);
  const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
  const rImportMapUint8 = await vctx.storage.fetch(fsIportMap.assetURI);
  // (ctx, fsIportMap);
  // console.log("renderVibe-6")
  if (isFetchErrResult(rImportMapUint8)) {
    return Result.Err(rImportMapUint8.error);
  }
  // console.log("renderVibe-5")
  if (isFetchNotFoundResult(rImportMapUint8)) {
    return Result.Err(new Error(`Import map not found for URI ${fsIportMap.assetURI}`));
  }
  // console.log("renderVibe-4")
  const genImport = vibeImportMap(JSON.parse(vctx.sthis.txt.decode(await stream2uint8array(rImportMapUint8.data))));
  if (genImport instanceof type.errors) {
    return Result.Err(genImport.summary);
  }
  // console.log("renderVibe-3")

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
  // console.log("renderVibe-1")

  const imports = fsItems.reduce(
    (acc, item, idx) => {
      // console.log(`fsItem:`, item);
      if (["text/javascript", "application/javascript"].includes(item.mimeType) && item.transform?.type !== "jsx-to-js") {
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

  const metaItems = (fs.meta as MetaItem[]) || [];
  const metaTitle = metaItems.find(isMetaTitle);
  const metaScreenShot = metaItems.find(isMetaScreenShot);

  const requestUrl = new URL(ctx.request.url);
  const canonicalUrl = `${requestUrl.protocol}//${requestUrl.host}/`;

  let imageUrl: string | undefined;
  if (metaScreenShot) {
    const assetPath = `/assets/cid/?url=${encodeURIComponent(metaScreenShot.assetUrl)}&mime=${encodeURIComponent(metaScreenShot.mime)}`;
    imageUrl = `${requestUrl.protocol}//${requestUrl.host}${assetPath}`;
  }

  const title = metaTitle?.title ?? fs.appSlug;

  const vsctx = {
    wrapper: {
      state: "waiting",
    },
    usrEnv,
    svcEnv: vctx.params.vibes.env,
    importMap: {
      imports: importMap,
    },
    metaProps: {
      title,
      description: `${title} - built on vibes.diy`,
      imageUrl,
      canonicalUrl,
    },
    mountJS: [
      `import { mountVibe, registerDependencies } from '@vibes.diy/vibe-runtime';`,
      ...imports.map((i) => i.importStmt),
      `registerDependencies(`,
      `  ${JSON.stringify({ appSlug: fs.appSlug, userSlug: fs.userSlug, fsId: fs.fsId })}, `,
      `  JSON.parse(document.getElementById("vibe-import-map").textContent).imports)`,
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
