import { userNotifyShardFor } from "@vibes.diy/api-types";
// Authed reads ride the user's own shard (same as notifications); anon reads
// ride the `global` singleton. Single seam to later re-bucket `global`. (#2265 Track B)
export function sharedReadShardFor(userId: string | undefined): string {
  return userId ? userNotifyShardFor(userId) : "global";
}
