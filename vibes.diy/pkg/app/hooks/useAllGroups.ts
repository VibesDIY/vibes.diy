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

  // Extract docs array - groupsResult object changes on every render from useLiveQuery
  const docs = groupsResult.docs;

  // Memoize groups based on docs array CONTENTS (length + ids), not reference
  // useLiveQuery returns a new array reference on every call even if contents are the same
  const groups = useMemo(() => {
    return docs || [];
  }, [docs?.length, docs?.map(d => d._id).join(',')]);
  console.log('[useAllGroups] Returning groups count:', groups.length);

  // Memoize isLoading as a boolean to avoid object recreation
  const isLoading = !docs;

  // Memoize the return value - depend only on stable values
  return useMemo(
    () => {
      console.log('[useAllGroups useMemo] Creating return object');
      return {
        groups,
        isLoading,
      };
    },
    [groups, isLoading]
  );
}
