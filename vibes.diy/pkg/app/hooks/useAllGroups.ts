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

  // Query ALL groups for this user (no titleId filter)
  const groupsResult = useLiveQuery<VibeInstanceDocument>(
    (doc) =>
      doc.userId === userId || (userId && doc.sharedWith?.includes(userId)),
  );

  const groups = groupsResult.docs || [];

  return {
    groups,
    isLoading: !groupsResult.docs,
  };
}
