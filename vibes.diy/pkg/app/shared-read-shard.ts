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
