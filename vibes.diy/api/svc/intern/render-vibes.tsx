import { HandleTriggerCtx, Result, EventoResultType, EventoResult, exception2Result } from "@adviser/cement";
import { FileSystemItem, ResponseType, VibesDiyServCtx, vibesImportMap } from "@vibes.diy/api-types";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { fetchContent } from "../public/serv-entry-point.js";
import { VibesApiSQLCtx } from "../api.js";
import { type } from "arktype";
import { VibeEnv, vibesEnvSchema } from "@vibes.diy/use-vibes-base";
import { DefaultHttpHeaders } from "../create-handler.js";
import { ExtractedHostToBindings } from "../entry-point-utils.js";
import { VibePage } from "./components/vibes-page.js";
import { renderToString } from "react-dom/server";

export async function renderVibes(
  ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>,
  fs: typeof sqlApps.$inferSelect,
  fsItems: FileSystemItem[]
): Promise<Result<EventoResultType>> {
  const fsIportMap = fsItems.find((i) => i.transform?.type === "import-map");
  if (!fsIportMap) {
    return Result.Err(new Error("No import-map found in file system"));
  }
  const rImportMapUint8 = await fetchContent(ctx, fsIportMap);
  if (rImportMapUint8.isErr()) {
    return Result.Err(rImportMapUint8);
  }
  const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
  const importMap = vibesImportMap(JSON.parse(vctx.sthis.txt.decode(rImportMapUint8.Ok())));
  if (importMap instanceof type.errors) {
    return Result.Err(importMap.toLocaleString());
  }

  const imports = fsItems.reduce(
    (acc, item, idx) => {
      if (item.mimeType === "application/javascript") {
        acc.push({
          // import relative to support prod and dev switching
          importStmt: `import * as V${idx} from ${JSON.stringify(item.fileName.replace(/^\//, ""))};`,
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
    bindings: {
      appSlug: fs.appSlug,
      userSlug: fs.userSlug,
      fsId: fs.fsId,
    },
    env,
    importMap,
    metaProps: {
      title: "we need a title",
      description: "we need a description",
    },
    mountJS: [
      `import { mountVibe } from '@vibes.diy/api-pkg';`,
      ...imports.map((i) => i.importStmt),
      `mountVibe(${JSON.stringify(imports.map((i) => i.var))}, ${JSON.stringify(env)});`,
    ].join("\n"),
  };
  const res = await exception2Result(() =>
    ctx.send.send(ctx, {
      type: "Response",
      payload: {
        status: 200,
        headers: DefaultHttpHeaders({
          "Content-Type": "text/html",
          "X-Vibes-Asset-Id": fs.fsId,
          ETag: fs.fsId,
        }),
        body: renderToString(VibePage(vsctx)) as BodyInit,
      },
    } satisfies ResponseType)
  );
  if (res.isErr()) {
    return Result.Err(res);
  }
  return Result.Ok(EventoResult.Stop);
}
