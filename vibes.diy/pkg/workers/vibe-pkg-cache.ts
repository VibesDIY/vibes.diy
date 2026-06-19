// Cache-Control policy for the /vibe-pkg/ route.
//
// /vibe-pkg/ assets are built from monorepo workspace source at deploy time
// (vite-plugin-workspace-packages.ts → _vibe-pkg/*) and served from env.ASSETS.
// The import-map URLs that browsers load carry a per-deploy version stamp
// (?v=<commit-sha>, injected into WORKSPACE_NPM_URL by
// vibes.diy/actions/deploy/action.yaml and the PR-preview workflow). Because a
// new deploy mints a fresh ?v=, the bytes behind any one stamped URL never
// change — a deploy is a guaranteed cache miss on a brand-new URL — so a
// stamped request can be cached immutably for a year and still cut over
// instantly on the next deploy.
//
// BUT the route serves whatever bundle THIS worker was deployed with; it never
// uses ?v= to pick bytes. So a ?v= stamp only proves immutability when it
// matches the stamp baked into this worker's own WORKSPACE_NPM_URL. During a
// rollout a request for the next deploy's SHA can briefly reach an old worker
// (cf deploys aren't globally atomic); caching its old bytes under the new URL
// as immutable would strand new clients on stale runtime packages for a year.
// So we only mark immutable when request.?v= === the worker's own stamp.
//
// Every other request falls back to a short TTL: unstamped requests (the
// import-map spec forces trailing-slash specifiers to query-less addresses, so
// render_esm_sh strips ?v= for `pkg/` entries — subpath imports arrive
// unstamped), stamp mismatches (rollout races, stale client import maps), and
// dev (WORKSPACE_NPM_URL has no ?v=). 60s keeps deploys propagating predictably
// without risking a year-long stale cache.
import { URI } from "@adviser/cement";

const IMMUTABLE = "public, max-age=31536000, immutable";
const SHORT = "public, max-age=60";

export function vibePkgCacheControl(requestUrl: string, workspaceNpmUrl?: string): string {
  const requested = URI.from(requestUrl).getParam("v");
  if (!requested) return SHORT;
  const own = workspaceNpmUrl ? URI.from(workspaceNpmUrl).getParam("v") : undefined;
  return own && requested === own ? IMMUTABLE : SHORT;
}
