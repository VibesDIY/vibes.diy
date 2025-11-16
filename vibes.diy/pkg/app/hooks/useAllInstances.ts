import { useFireproof } from "use-vibes";
import { useAuth } from "../contexts/AuthContext.js";
import type { VibeInstanceDocument } from "@vibes.diy/prompts";

/**
 * Custom hook for querying all vibe instances for the current user
 * Returns all instances across all vibes (not filtered by titleId)
 */
export function useAllInstances() {
  const { useLiveQuery } = useFireproof("vibes-diy-instances");
  const { userPayload } = useAuth();
  const userId = userPayload?.userId || "anonymous";

  // Query ALL instances for this user (no titleId filter)
  const instancesResult = useLiveQuery<VibeInstanceDocument>(
    (doc) => doc.userId === userId || doc.sharedWith?.includes(userId),
  );

  const instances = instancesResult.docs || [];

  return {
    instances,
    isLoading: !instancesResult.docs,
  };
}
