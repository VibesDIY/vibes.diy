import { useFireproof } from "use-vibes";
import { useAuth } from "@clerk/clerk-react";
import type { VibeInstanceDocument } from "@vibes.diy/prompts";

/**
 * Custom hook for querying all vibe groups for the current user
 * Returns all groups across all vibes (not filtered by titleId)
 */
export function useAllGroups() {
  console.log('[useAllGroups] Hook called');
  const { userId } = useAuth();
  console.log('[useAllGroups] Got userId:', userId);

  // Use a consistent database name to avoid hydration mismatches
  // userId is included in the query filter instead
  console.log('[useAllGroups] Calling useFireproof("vibes-groups")');
  const { useLiveQuery } = useFireproof("vibes-groups");
  console.log('[useAllGroups] Got useLiveQuery');

  // Query ALL groups for this user (no titleId filter)
  console.log('[useAllGroups] Calling useLiveQuery with filter');
  const groupsResult = useLiveQuery<VibeInstanceDocument>(
    (doc) =>
      doc.userId === userId || (userId && doc.sharedWith?.includes(userId)),
  );
  console.log('[useAllGroups] Got groupsResult:', groupsResult);

  const groups = groupsResult.docs || [];
  console.log('[useAllGroups] Returning groups count:', groups.length);

  return {
    groups,
    isLoading: !groupsResult.docs,
  };
}
