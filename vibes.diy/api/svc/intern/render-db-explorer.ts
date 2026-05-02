import { DBExplorerPage } from "@vibes.diy/vibe-db-explorer/page";
import { Dependencies, render_esm_sh, resolveVersionRegistry } from "./import-map.js";
import { defaultFetchPkgVersion } from "../npm-package-version.js";
import { VibesApiSQLCtx } from "../types.js";
import { lockedGroupsVersions, lockedVersions } from "./grouped-vibe-import-map.js";
import { NpmUrlCapture } from "../public/serv-entry-point.js";

// Subset of VibeApp (vibe/runtime/register-dependencies.ts) — fsId is optional
// because the db-explorer loads from the app subdomain without a versioned path.
interface DBExplorerVibeApp {
  readonly appSlug: string;
  readonly userSlug: string;
  readonly fsId?: string;
}

export interface RenderDBExplorerOps {
  vctx: VibesApiSQLCtx;
  pkgRepos: {
    private: NpmUrlCapture;
    public?: string; // default to esm.sh
  };
  base: string;
  vibeApp: DBExplorerVibeApp;
}

export async function renderDBExplorer({ vctx, pkgRepos, base, vibeApp }: RenderDBExplorerOps) {
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
    vibeApp,
    importMap: {
      imports: importMap,
    },
  });
}
