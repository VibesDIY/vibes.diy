// Cache-Control policy for the /vibe-pkg/ route.
//
// /vibe-pkg/ assets are built from monorepo workspace source at deploy time
// (vite-plugin-workspace-packages.ts → _vibe-pkg/*) and served from env.ASSETS.
// The import-map URLs that browsers load carry a per-deploy version stamp
// (?v=<commit-sha>, injected by vibes.diy/actions/deploy/action.yaml and the
// PR-preview workflow). Because a new deploy mints a fresh ?v=, the bytes
// behind any one stamped URL never change — a deploy is a guaranteed cache
// miss on a brand-new URL. So a stamped request can be cached immutably for a
// year and still cut over instantly on the next deploy.
//
// Unstamped requests keep a short TTL as a fallback. The import-map spec forces
// trailing-slash specifiers to resolve to trailing-slash addresses with no
// query string (render_esm_sh strips ?v= for `pkg/` entries in
// api/svc/intern/import-map.ts), so subpath imports reach this route without a
// stamp. Capping those at 60s keeps deploys propagating predictably rather than
// stranding edits at the edge.
import { URI } from "@adviser/cement";

const IMMUTABLE = "public, max-age=31536000, immutable";
const SHORT = "public, max-age=60";

export function vibePkgCacheControl(requestUrl: string): string {
  // Treat any non-empty ?v= stamp as immutable; an empty/absent stamp falls
  // back to the short TTL.
  return URI.from(requestUrl).getParam("v") ? IMMUTABLE : SHORT;
}
