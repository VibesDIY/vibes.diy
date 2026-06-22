import { BuildURI } from "@adviser/cement";
import { userNotifyShardFor } from "@vibes.diy/api-types";
// Authed reads ride the user's own shard (same as notifications); anon reads
// ride the `global` singleton. Single seam to later re-bucket `global`. (#2265 Track B)
export function sharedReadShardFor(userId: string | undefined): string {
  return userId ? userNotifyShardFor(userId) : "global";
}

// Build the SharedSessions WS URL for a given base apiUrl + shard. The shard is
// embedded in the URL (the connection uses skipShard so it is sent verbatim).
export function sharedApiUrl(apiUrl: string, shard: string): string {
  return BuildURI.from(apiUrl).pathname("/api/shared").cleanParams().setParam("shard", shard).toString();
}

// Decide the shared-plane shard for a NON-VIBE route, deferring the decision
// until Clerk has finished loading. Returning `undefined` means "do not open a
// shared socket yet". Without this gate a signed-in page opens TWO shared
// sockets that both stay alive: the first paint runs before Clerk hydrates
// (`userId` undefined → shard `global`), then a re-render after hydration opens
// `notify-user-<uid>`. The module-level connection cache is keyed by URL, so the
// stale `global` socket is never closed. Waiting for `clerkLoaded` opens exactly
// one socket with the final shard (anon still gets `global`, just a beat later).
// (#2265 Track B — redundant global shared socket)
export function deferredSharedReadShard(clerkLoaded: boolean, userId: string | undefined): string | undefined {
  if (!clerkLoaded) return undefined;
  return sharedReadShardFor(userId);
}
