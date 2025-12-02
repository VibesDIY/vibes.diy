import { useFireproof } from "use-vibes";
import { useAuth } from "@clerk/clerk-react";
import type { VibeInstanceDocument } from "@vibes.diy/prompts";

/**
 * Custom hook for querying all vibe groups for the current user
 * Returns all groups across all vibes (not filtered by titleId)
 */
export function useAllGroups() {
  const { userId } = useAuth();
  const { useLiveQuery } = useFireproof(`vibes-${userId}-groups`);

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
