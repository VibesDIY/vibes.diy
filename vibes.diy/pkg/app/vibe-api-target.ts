// Placeholder slugs the editor route component falls back to when params are
// absent (chat.$ownerHandle.$appSlug.tsx defaults). A chat with no appSlug yet
// must NOT get a vibeApi — see #2306 / the vibe-data-on-appsessions spec.
const PLACEHOLDER_OWNER = "preparing";
const PLACEHOLDER_APP = "session";

export interface VibeApiTarget {
  readonly ownerHandle: string;
  readonly appSlug: string;
}

/**
 * Given a pathname, return the vibe whose data should ride `vibeApi`
 * (AppSessions), or undefined if this route renders no vibe-data iframe.
 * Covers the `/vibe/` viewer and the `/chat/:owner/:appSlug` editor.
 */
export function vibeApiTarget(pathname: string): VibeApiTarget | undefined {
  const m = pathname.match(/^\/(?:vibe|chat)\/([^/]+)\/([^/]+)/);
  if (m === null) return undefined;
  const ownerHandle = m[1];
  const appSlug = m[2];
  if (ownerHandle === PLACEHOLDER_OWNER && appSlug === PLACEHOLDER_APP) return undefined;
  return { ownerHandle, appSlug };
}
