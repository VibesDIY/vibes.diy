import { DBExplorerPage } from "@vibes.diy/vibe-db-explorer/page";
import { Dependencies, render_esm_sh, resolveVersionRegistry } from "./import-map.js";
import { defaultFetchPkgVersion } from "../npm-package-version.js";
import { VibesApiSQLCtx } from "../types.js";
import { lockedGroupsVersions, lockedVersions } from "./grouped-vibe-import-map.js";
import { NpmUrlCapture } from "../public/serv-entry-point.js";

export interface RenderDBExplorerOps {
  vctx: VibesApiSQLCtx;
  pkgRepos: {
    private: NpmUrlCapture;
    public?: string; // default to esm.sh
  };
  base: string;
}

export async function renderDBExplorer({ vctx, pkgRepos, base }: RenderDBExplorerOps) {
  const deps = Dependencies.from({
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

  return DBExplorerPage({
    base,
    importMap: {
      imports: importMap,
    },
  });
}
