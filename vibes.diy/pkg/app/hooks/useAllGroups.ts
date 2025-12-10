import { useMemo } from "react";
import { useFireproof } from "use-fireproof";
import { useAuth } from "@clerk/clerk-react";
import type { VibeInstanceDocument } from "@vibes.diy/prompts";

/**
 * Custom hook for querying all vibe groups for the current user
 * Returns all groups across all vibes (not filtered by titleId)
 */
export function useAllGroups() {
  const { userId } = useAuth();
  // Use a consistent database name to avoid hydration mismatches
  // userId is included in the query filter instead
  const { useLiveQuery } = useFireproof("vibes-groups");

  // Stabilize query object to prevent infinite re-subscription loops
  const query = useMemo(() => ({ key: userId }), [userId]);

  // Query ALL groups for this user by userId index
  const groupsResult = useLiveQuery<VibeInstanceDocument>("userId", query);

  // Stabilize the array reference to prevent re-render loops
  const groups = useMemo(() => groupsResult.docs || [], [groupsResult.docs]);

  return {
    groups,
    isLoading: !groupsResult.docs,
  };
}
