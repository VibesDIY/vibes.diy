// Store-shape + friend-link helpers shared by App.

// Stable index fns for useLiveQuery (an inline arrow re-subscribes every render).
export const byTypeUser = (doc) => [doc.type, doc.userId];
export const byTypeFriendSlug = (doc) => [doc.type, doc.friendSlug];

// Re-stamp a locally-stored doc onto the freshly signed-in handle when useFireproof's
// anonymousLocal store migrates local → cloud on first login. Only favorites and notes
// are user-owned cloud docs; DROP everything else (return falsy) — e.g. legacy `geocode`
// docs from the old map, which access.js rejects as "unknown document type" and which
// would otherwise fail the migration on every load.
export const migrateRollingDoc = (doc, handle) => {
  if (doc.type === "favorite") return { ...doc, userId: handle, _id: `favorite-${handle}-${doc.rideId}` };
  if (doc.type === "note") return { ...doc, userId: handle, _id: `note-${handle}-${doc.rideId}` };
  return null;
};

// A friend-connect link arrives as `?friend=<handle>` on the vibes.diy URL, which the
// platform mirrors onto the app's own iframe URL. Read it, then strip it so a visitor
// who copies their address bar doesn't re-share someone else's friend link.
export const readFriendParam = () => {
  try {
    const own = new URLSearchParams(window.location.search).get("friend");
    if (own) return own;
  } catch (e) {}
  try {
    if (window.top && window.top !== window) return new URLSearchParams(window.top.location.search).get("friend");
  } catch (e) {}
  return null;
};
export const clearFriendParamFromUrl = () => {
  const strip = (loc, hist) => {
    try {
      const u = new URL(loc.href);
      if (u.searchParams.has("friend")) {
        u.searchParams.delete("friend");
        hist.replaceState(null, "", u.pathname + u.search + u.hash);
      }
    } catch (e) {}
  };
  strip(window.location, window.history);
  try {
    if (window.top && window.top !== window) strip(window.top.location, window.top.history);
  } catch (e) {}
};

// Build the public vibes.diy link for whatever handle this copy is deployed under
// (rolling-today--<handle>.prod-v2…) so connect links work on staging and prod alike.
export function currentVibeBase() {
  try {
    const first = window.location.hostname.split(".")[0]; // <slug>--<handle>
    const [slug, handle] = first.split("--");
    if (slug && handle) return `https://vibes.diy/vibe/${handle}/${slug}`;
  } catch (e) {}
  return "https://vibes.diy/vibe/jchris/rolling-today";
}
