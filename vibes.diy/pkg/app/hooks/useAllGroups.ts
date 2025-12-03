import { useState, useEffect, useMemo } from "react";
import { useFireproof } from "use-fireproof";
import { useAuth } from "@clerk/clerk-react";
import type { VibeInstanceDocument } from "@vibes.diy/prompts";

/**
 * Custom hook for querying all vibe groups for the current user
 * Returns all groups across all vibes (not filtered by titleId)
 *
 * Note: We use database.subscribe() instead of useLiveQuery() to avoid
 * infinite re-render loops caused by useLiveQuery's internal state updates
 */
export function useAllGroups() {
  const { userId } = useAuth();
  const { database } = useFireproof("vibes-groups");

  const [groups, setGroups] = useState<VibeInstanceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadGroups = async () => {
      if (!userId) {
        setGroups([]);
        setIsLoading(false);
        return;
      }

      try {
        // Query the database directly using allDocs
        const result = await database.allDocs<VibeInstanceDocument>();

        if (!mounted) return;

        // Filter for user's groups
        const userGroups = result.rows
          .map((row) => row.value as VibeInstanceDocument)
          .filter(
            (doc) =>
              doc &&
              (doc.userId === userId || doc.sharedWith?.includes(userId)),
          );

        setGroups(userGroups);
        setIsLoading(false);
      } catch (error) {
        console.error("[useAllGroups] Error loading groups:", error);
        if (mounted) {
          setGroups([]);
          setIsLoading(false);
        }
      }
    };

    // Subscribe to changes
    const unsubscribe = database.subscribe(() => {
      loadGroups();
    });

    // Initial load
    loadGroups();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [database, userId]);

  return useMemo(
    () => ({
      groups,
      isLoading,
    }),
    [groups, isLoading],
  );
}
