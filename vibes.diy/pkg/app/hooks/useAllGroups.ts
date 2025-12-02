import { useMemo } from "react";
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
  console.log('[useAllGroups] Got useLiveQuery:', !!useLiveQuery);

  // Query ALL groups for this user (no titleId filter)
  // Memoize the filter function to prevent infinite re-renders
  const filterFn = useMemo(
    () => (doc: VibeInstanceDocument) =>
      doc.userId === userId || (userId && doc.sharedWith?.includes(userId)),
    [userId]
  );

  console.log('[useAllGroups] Calling useLiveQuery with filter');
  const groupsResult = useLiveQuery<VibeInstanceDocument>(filterFn);
  console.log('[useAllGroups] Got groupsResult:', groupsResult);

  // Memoize groups to avoid creating new empty array on every render
  const groups = useMemo(() => groupsResult.docs || [], [groupsResult.docs]);
  console.log('[useAllGroups] Returning groups count:', groups.length);

  // Memoize the return value to prevent creating new object references
  return useMemo(
    () => ({
      groups,
      isLoading: !groupsResult.docs,
    }),
    [groups, groupsResult.docs]
  );
}
